<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import L from 'leaflet'
import { formatarArea, formatarDataHora, formatarSituacao } from '@/utils/formato'
// Contorno do estado, da API de malhas do IBGE (qualidade intermediária, 9 KB):
// servicodados.ibge.gov.br/api/v3/malhas/estados/41?formato=application/vnd.geo+json
import parana from '@/assets/parana.json'
import { useTema } from '@/composables/useTema'
import { listarCamadas, buscarCamadaNoMapa } from '@/services/camadasService'

/**
 * Mapa dos imóveis rurais, carregado por área visível.
 *
 * O Paraná tem mais de 500 mil imóveis: não dá para desenhar todos. Então o
 * mapa só avisa ONDE o usuário está olhando (evento `area`) e a view busca os
 * imóveis daquela caixa e devolve pela prop `camada`. Abaixo do zoom mínimo a
 * área é grande demais e o mapa manda `null` — nada é buscado.
 *
 * Os objetos do Leaflet ficam em variáveis comuns, fora de ref(): se o Vue
 * transformasse o mapa em objeto reativo, o Leaflet passaria a lidar com
 * proxies e quebraria ao arrastar e dar zoom.
 */
const props = defineProps({
  /** FeatureCollection de GET /imoveis/mapa, ou null */
  camada: { type: Object, default: null },
  carregando: { type: Boolean, default: false },
  erro: { type: String, default: '' },
  /** município com geometria, para o contorno */
  municipio: { type: Object, default: null },
  /** imóvel selecionado, com a geometria completa */
  destaque: { type: Object, default: null },
  /** true quando a camada já vem filtrada por município */
  filtrado: { type: Boolean, default: false },
  /** FeatureCollection de GET /focos (os focos que o IFC conta), ou null */
  focos: { type: Object, default: null },
  /** Mapa { [codImovel]: { status, quantidade, calculados } } carregado na consulta */
  resumoIndicadores: { type: Object, default: () => ({}) },
  /**
   * Espaço (px) coberto pelos painéis flutuantes em cada lado do mapa:
   * { topo, direita, baixo, esquerda }. O enquadramento desconta essa folga
   * para o imóvel/município não ficar escondido atrás de um painel.
   */
  folga: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['area', 'selecionar'])

const CENTRO_PARANA = [-24.89, -51.55]
const ZOOM_PARANA = 7
const ZOOM_MINIMO = 11 // abaixo disso a área visível tem imóveis demais
const ZOOM_MAXIMO = 16 // o fundo da Esri não tem tiles além disso

const ROTULO_STATUS = {
  CONFORME: 'Conforme',
  ALERTA: 'Alerta',
  CRITICO: 'Crítico',
  VALIDACAO: 'Em validação',
}

const { claro } = useTema()

// A máscara tem a cor do fundo da aplicação: fora do PR o mapa "some".
function paleta(temaClaro) {
  const c = temaClaro
    ? { linha: '#0e7490', destaque: '#1e293b', municipio: '#334155', estado: '#334155', fundo: '#dce2e9' }
    : { linha: '#22d3ee', destaque: '#f8fafc', municipio: '#e2e8f0', estado: '#94a3b8', fundo: '#0b0f19' }
  return {
    imovel: { color: c.linha, weight: 1, fillColor: '#22d3ee', fillOpacity: 0.15 },
    status: {
      CONFORME: { color: '#10b981', weight: 1.5, fillColor: '#10b981', fillOpacity: 0.22 },
      ALERTA: { color: '#f59e0b', weight: 1.5, fillColor: '#f59e0b', fillOpacity: 0.25 },
      CRITICO: { color: '#f43f5e', weight: 1.8, fillColor: '#f43f5e', fillOpacity: 0.28 },
      VALIDACAO: { color: '#94a3b8', weight: 1.4, fillColor: '#94a3b8', fillOpacity: 0.18 },
    },
    destaque: { color: c.destaque, weight: 2.5, fillColor: '#22d3ee', fillOpacity: 0.4 },
    municipio: { color: c.municipio, weight: 2.5, dashArray: '6 4', fill: false },
    // Contorno do PR forte e o resto do mapa quase apagado: o olho vai direto para o estado.
    estado: { color: c.estado, weight: 2.5, fill: false },
    mascara: { stroke: false, fillColor: c.fundo, fillOpacity: 0.94 },
    foco: { radius: 4, color: '#fb923c', weight: 1, fillColor: '#f97316', fillOpacity: 0.9 },
  }
}

let estilo = paleta(claro.value)

function estiloImovel(feature) {
  const cod = feature?.properties?.codImovel
  const status = cod ? props.resumoIndicadores?.[cod]?.status : null
  if (status && estilo.status[status]) return estilo.status[status]
  return estilo.imovel
}

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas'
const fundoEsri = (camada) =>
  `${ESRI}/World_${claro.value ? 'Light' : 'Dark'}_Gray_${camada}/MapServer/tile/{z}/{y}/{x}`

const container = ref(null)
const perto = ref(false) // zoom >= ZOOM_MINIMO

let mapa = null
let camadaImoveis = null
let camadaDestaque = null
let camadaMunicipio = null
let camadaFocos = null
let fundo = null
let referencia = null
let mascara = null
let contornoEstado = null
let observador = null // ResizeObserver: o mapa acompanha o tamanho da tela
let limitesParana = null

// --- Camadas extras (Reserva Legal e fontes do insumo genérico) ---------------
// O próprio mapa busca: cada camada ligada pede GET /camadas/:id/mapa da área
// visível a cada movimento, como os imóveis. Fica desligada até o usuário marcar.
const LIMITE_CAMADA = 2000
// Cores fixas, distintas das dos imóveis (ciano) e dos focos (laranja).
const CORES_CAMADA = ['#22c55e', '#a855f7', '#eab308', '#ec4899', '#3b82f6', '#84cc16', '#f97316', '#14b8a6', '#ef4444']
const camadasDisponiveis = ref([]) // [{ id, nome, tipo, sigla }]
const camadasLigadas = ref([]) // ids
const estadoCamada = ref({}) // { [id]: 'carregando' | 'parcial' | 'erro' | null }
const painelCamadas = ref(false)
const camadasExtras = new Map() // id → L.geoJSON
const pedidosCamada = new Map() // id → AbortController

function corDaCamada(id) {
  const i = camadasDisponiveis.value.findIndex((c) => c.id === id)
  return CORES_CAMADA[(i < 0 ? 0 : i) % CORES_CAMADA.length]
}

const mensagem = computed(() => {
  if (!perto.value) return { tipo: 'info', texto: 'Aproxime o zoom para ver os imóveis' }
  if (props.erro) return { tipo: 'erro', texto: props.erro }
  if (props.carregando) return { tipo: 'info', texto: 'Carregando imóveis…' }
  if (props.camada?.truncado) {
    return { tipo: 'alerta', texto: 'Mostrando parte dos imóveis — aproxime o zoom' }
  }
  if (props.camada && !props.camada.features?.length) {
    const texto = props.filtrado ? 'Nenhum imóvel com este filtro nesta área' : 'Nenhum imóvel nesta área'
    return { tipo: 'info', texto }
  }
  return null
})

const coresMensagem = {
  info: 'border-slate-700 text-slate-200',
  alerta: 'border-amber-500/50 text-amber-200',
  erro: 'border-red-500/50 text-red-200',
}

onMounted(() => {
  limitesParana = L.geoJSON(parana).getBounds()

  // preferCanvas: mil polígonos num único <canvas> em vez de mil elementos SVG.
  // maxBounds + viscosidade 1: o mapa não deixa arrastar para fora do PR.
  mapa = L.map(container.value, {
    preferCanvas: true,
    maxBounds: limitesParana.pad(0.05),
    maxBoundsViscosity: 1,
    zoomControl: false, // vai para baixo, à direita: em cima ficam os painéis
  }).setView(CENTRO_PARANA, ZOOM_PARANA)

  // Zoom mínimo = o que mostra o estado inteiro. Calculado pelo tamanho real
  // do mapa na tela: numa tela estreita ele é menor que num monitor largo.
  mapa.setMinZoom(mapa.getBoundsZoom(limitesParana))
  L.control.zoom({ position: 'bottomright' }).addTo(mapa)

  // O mapa ocupa a tela toda: se a janela (ou o menu) mudar de tamanho,
  // o Leaflet precisa recalcular o tamanho e o zoom mínimo.
  observador = new ResizeObserver(() => {
    if (!mapa) return
    mapa.invalidateSize()
    mapa.setMinZoom(mapa.getBoundsZoom(limitesParana))
  })
  observador.observe(container.value)

  // Esri não exige chave de API (a CARTO do protótipo passou a exigir).
  const atribuicao =
    'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap · Contorno do PR: IBGE'
  fundo = L.tileLayer(fundoEsri('Base'), { attribution: atribuicao, maxZoom: ZOOM_MAXIMO }).addTo(mapa)
  referencia = L.tileLayer(fundoEsri('Reference'), { maxZoom: ZOOM_MAXIMO }).addTo(mapa)

  desenharMascara()

  // Uma camada só para os imóveis, reaproveitada a cada movimento: troca-se
  // o conteúdo (clearLayers + addData), não a camada.
  // style como função para os imóveis refletirem tema e status dos indicadores.
  camadaImoveis = L.geoJSON(null, { style: estiloImovel, onEachFeature: prepararImovel }).addTo(mapa)
  camadaDestaque = L.geoJSON(null, { style: () => estilo.destaque, interactive: false }).addTo(mapa)
  camadaFocos = L.geoJSON(null, {
    pointToLayer: (_feature, posicao) => L.circleMarker(posicao, estilo.foco),
    onEachFeature: prepararFoco,
  }).addTo(mapa)

  mapa.on('moveend', avisarArea)
  mapa.on('moveend', atualizarCamadas)

  // Sem permissão ou sem dados, a lista vem vazia e o botão nem aparece.
  listarCamadas()
    .then((lista) => (camadasDisponiveis.value = Array.isArray(lista) ? lista : []))
    .catch(() => (camadasDisponiveis.value = []))

  desenharMunicipio()
  desenharImoveis()
  desenharDestaque()
  desenharFocos()
  avisarArea()
})

onBeforeUnmount(() => {
  for (const pedido of pedidosCamada.values()) pedido.abort()
  observador?.disconnect()
  mapa?.remove()
  mapa = null
})

watch(claro, (temaClaro) => {
  estilo = paleta(temaClaro)
  if (!mapa) return
  fundo.setUrl(fundoEsri('Base'))
  referencia.setUrl(fundoEsri('Reference'))
  mascara.setStyle(estilo.mascara)
  contornoEstado.setStyle(estilo.estado)
  camadaImoveis.setStyle(estiloImovel)
  camadaDestaque.setStyle(estilo.destaque)
  camadaMunicipio?.setStyle(estilo.municipio)
})

watch(() => props.camada, desenharImoveis)
watch(() => props.resumoIndicadores, () => {
  camadaImoveis?.setStyle(estiloImovel)
}, { deep: true })
watch(() => props.destaque, desenharDestaque)
watch(() => props.focos, desenharFocos)
watch(
  () => props.municipio,
  () => {
    if (!mapa) return
    desenharMunicipio()
    if (camadaMunicipio) mapa.fitBounds(camadaMunicipio.getBounds(), margens(24))
    else mapa.setView(CENTRO_PARANA, ZOOM_PARANA)
  },
)

/**
 * Escurece tudo o que fica fora do Paraná. É um polígono do tamanho do
 * mundo com o estado recortado como buraco: no Leaflet, o primeiro anel de
 * um L.polygon é o contorno e os seguintes são buracos. O PR tem mais de um
 * polígono (o continente e as ilhas), e cada um vira um buraco.
 *
 * O GeoJSON guarda [lon, lat]; o Leaflet quer [lat, lon] — daí o map().
 */
function desenharMascara() {
  const mundo = [
    [-90, -180],
    [-90, 180],
    [90, 180],
    [90, -180],
  ]
  const buracos = parana.features
    .flatMap((f) => f.geometry.coordinates) // MultiPolygon → lista de polígonos
    .map(([anelExterno]) => anelExterno.map(([lon, lat]) => [lat, lon]))

  mascara = L.polygon([mundo, ...buracos], { ...estilo.mascara, interactive: false }).addTo(mapa)
  contornoEstado = L.geoJSON(parana, { style: estilo.estado, interactive: false }).addTo(mapa)
}

/** Diz à view qual caixa buscar — ou `null`, se o zoom estiver longe demais. */
function avisarArea() {
  perto.value = mapa.getZoom() >= ZOOM_MINIMO
  if (!perto.value) {
    emit('area', null)
    return
  }

  // Com o mapa bem afastado, getBounds() passa de ±180/±90 e a API recusa.
  const caixa = mapa.getBounds()
  emit('area', {
    minLon: limitar(caixa.getWest(), -180, 180),
    minLat: limitar(caixa.getSouth(), -90, 90),
    maxLon: limitar(caixa.getEast(), -180, 180),
    maxLat: limitar(caixa.getNorth(), -90, 90),
  })
}

function limitar(valor, minimo, maximo) {
  return Math.min(maximo, Math.max(minimo, valor))
}

function prepararImovel(feature, poligono) {
  const imovel = feature.properties
  poligono.bindPopup(() => montarPopup(imovel))
  poligono.on('click', () => emit('selecionar', imovel.codImovel))
}

// Texto montado como nó do DOM, e não como HTML: o código e o município
// vêm dos arquivos das fontes e não devem ser interpretados como marcação.
function montarPopup(imovel) {
  const caixa = document.createElement('div')
  const resumo = imovel?.codImovel ? props.resumoIndicadores?.[imovel.codImovel] : null
  const statusTexto = resumo?.status
    ? `${ROTULO_STATUS[resumo.status] ?? resumo.status} (${resumo.calculados}/${resumo.quantidade})`
    : null

  const linhas = [
    ['Código', imovel.codImovel],
    ['Município', imovel.municipio ?? '—'],
    ['Área', formatarArea(imovel.areaHa)],
    ['Situação', formatarSituacao(imovel.situacao)],
    ...(statusTexto ? [['Indicadores', statusTexto]] : []),
  ]
  for (const [rotulo, valor] of linhas) {
    const linha = document.createElement('div')
    const titulo = document.createElement('strong')
    titulo.textContent = `${rotulo}: `
    linha.append(titulo, valor)
    caixa.append(linha)
  }
  return caixa
}

function desenharImoveis() {
  if (!mapa) return
  camadaImoveis.clearLayers()
  if (props.camada) camadaImoveis.addData(props.camada)
  // No canvas, quem é desenhado por último fica por cima: o destaque não pode
  // sumir embaixo dos imóveis que acabaram de chegar, e os focos ficam acima
  // de tudo — senão o preenchimento do destaque esconde os pontos dentro dele.
  // As camadas extras ficam acima dos imóveis (o usuário ligou para ver) e
  // abaixo do destaque e dos focos.
  for (const camada of camadasExtras.values()) camada.bringToFront()
  camadaDestaque.bringToFront()
  camadaFocos.bringToFront()
}

/** Liga ou desliga uma camada extra. */
function alternarCamada(id) {
  if (camadasLigadas.value.includes(id)) {
    camadasLigadas.value = camadasLigadas.value.filter((x) => x !== id)
    pedidosCamada.get(id)?.abort()
    pedidosCamada.delete(id)
    camadasExtras.get(id)?.remove()
    camadasExtras.delete(id)
    estadoCamada.value = { ...estadoCamada.value, [id]: null }
    return
  }
  camadasLigadas.value = [...camadasLigadas.value, id]
  const cor = corDaCamada(id)
  const nome = camadasDisponiveis.value.find((c) => c.id === id)?.nome ?? id
  const camada = L.geoJSON(null, {
    style: { color: cor, weight: 1.2, fillColor: cor, fillOpacity: 0.25 },
    onEachFeature: (feature, poligono) => poligono.bindPopup(() => montarPopupCamada(nome, feature.properties)),
  }).addTo(mapa)
  camadasExtras.set(id, camada)
  buscarCamada(id)
}

function atualizarCamadas() {
  for (const id of camadasLigadas.value) buscarCamada(id)
}

async function buscarCamada(id) {
  const camada = camadasExtras.get(id)
  if (!mapa || !camada) return
  pedidosCamada.get(id)?.abort()
  if (mapa.getZoom() < ZOOM_MINIMO) {
    camada.clearLayers()
    estadoCamada.value = { ...estadoCamada.value, [id]: null }
    return
  }
  const caixa = mapa.getBounds()
  const area = {
    minLon: limitar(caixa.getWest(), -180, 180),
    minLat: limitar(caixa.getSouth(), -90, 90),
    maxLon: limitar(caixa.getEast(), -180, 180),
    maxLat: limitar(caixa.getNorth(), -90, 90),
  }
  const pedido = new AbortController()
  pedidosCamada.set(id, pedido)
  estadoCamada.value = { ...estadoCamada.value, [id]: 'carregando' }
  try {
    const dados = await buscarCamadaNoMapa(id, area, { limite: LIMITE_CAMADA, signal: pedido.signal })
    if (pedido.signal.aborted || camadasExtras.get(id) !== camada) return
    camada.clearLayers()
    camada.addData(dados)
    camadaDestaque.bringToFront()
    camadaFocos.bringToFront()
    estadoCamada.value = { ...estadoCamada.value, [id]: dados.truncado ? 'parcial' : null }
  } catch (e) {
    if (pedido.signal.aborted || e?.original?.code === 'ERR_CANCELED') return
    estadoCamada.value = { ...estadoCamada.value, [id]: 'erro' }
  }
}

const ROTULOS_CAMADA = {
  codImovel: 'Imóvel',
  areaHa: 'Área',
  situacao: 'Situação',
  categoria: 'Categoria',
  valor: 'Valor',
  dataReferencia: 'Data',
}

// Como o popup do imóvel: nós do DOM, sem interpretar o texto das fontes como HTML.
function montarPopupCamada(nome, propriedades) {
  const caixa = document.createElement('div')
  const titulo = document.createElement('strong')
  titulo.textContent = nome
  caixa.append(titulo)
  for (const [chave, valor] of Object.entries(propriedades ?? {})) {
    if (valor === null || valor === undefined || valor === '') continue
    let texto = String(valor)
    if (chave === 'areaHa') texto = formatarArea(valor)
    else if (chave === 'situacao') texto = formatarSituacao(valor)
    const linha = document.createElement('div')
    const rotulo = document.createElement('strong')
    rotulo.textContent = `${ROTULOS_CAMADA[chave] ?? chave}: `
    linha.append(rotulo, texto)
    caixa.append(linha)
  }
  return caixa
}

function desenharDestaque() {
  if (!mapa) return
  camadaDestaque.clearLayers()
  if (props.destaque?.geometria) camadaDestaque.addData(props.destaque.geometria)
  camadaFocos.bringToFront()
}

function desenharFocos() {
  if (!mapa) return
  camadaFocos.clearLayers()
  if (props.focos) camadaFocos.addData(props.focos)
  camadaFocos.bringToFront()
}

function prepararFoco(feature, ponto) {
  const foco = feature.properties
  const dica = document.createElement('span')
  const quando = foco.dataHora ? formatarDataHora(`${foco.dataHora}Z`) : '—'
  dica.textContent = `Foco de calor · ${foco.satelite} · ${quando}`
  ponto.bindTooltip(dica)
}

function desenharMunicipio() {
  if (!mapa) return
  camadaMunicipio?.remove()
  camadaMunicipio = null

  if (props.municipio?.geometria) {
    camadaMunicipio = L.geoJSON(props.municipio.geometria, {
      style: estilo.municipio,
      interactive: false,
    }).addTo(mapa)
  }
}

/** Padding do fitBounds: a margem mínima mais o que os painéis cobrem. */
function margens(minimo) {
  const { topo = 0, direita = 0, baixo = 0, esquerda = 0 } = props.folga
  return {
    paddingTopLeft: [esquerda + minimo, topo + minimo],
    paddingBottomRight: [direita + minimo, baixo + minimo],
  }
}

/**
 * Leva o mapa até a caixa envolvente de um imóvel da tabela.
 * Atenção à ordem: a API e o GeoJSON usam [lon, lat]; o Leaflet usa [lat, lon].
 */
function enquadrar({ minLon, minLat, maxLon, maxLat }) {
  mapa?.fitBounds(
    [
      [minLat, minLon],
      [maxLat, maxLon],
    ],
    { ...margens(32), maxZoom: ZOOM_MAXIMO },
  )
}

defineExpose({ enquadrar })
</script>

<template>
  <div class="relative h-full w-full">
    <div ref="container" class="isolate h-full w-full" />

    <!-- Embaixo, no centro: em cima ficam os painéis da tela -->
    <div
      v-if="mensagem"
      class="pointer-events-none absolute z-10 flex justify-center px-14"
      :style="{
        left: `${folga.esquerda ?? 0}px`,
        right: `${folga.direita ?? 0}px`,
        bottom: `${(folga.baixo ?? 0) + 16}px`,
      }"
    >
      <span
        :class="[
          'rounded-full border bg-slate-950/85 px-3 py-1 text-xs backdrop-blur',
          coresMensagem[mensagem.tipo],
        ]"
      >
        {{ mensagem.texto }}
      </span>
    </div>

    <!-- Camadas extras: em baixo, à direita, acima dos botões de zoom -->
    <div
      v-if="camadasDisponiveis.length"
      class="absolute z-10 flex flex-col items-end gap-2"
      :style="{ right: `${(folga.direita ?? 0) + 10}px`, bottom: `${(folga.baixo ?? 0) + 92}px` }"
    >
      <div
        v-if="painelCamadas"
        class="max-h-72 w-72 overflow-y-auto rounded-xl border border-slate-700 bg-slate-950/90 p-3
               text-xs text-slate-200 shadow-lg backdrop-blur"
      >
        <p class="mb-2 font-semibold text-slate-100">Camadas</p>
        <p v-if="!perto" class="mb-2 text-slate-400">Aproxime o zoom para ver as camadas ligadas.</p>
        <label
          v-for="c in camadasDisponiveis"
          :key="c.id"
          class="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-slate-800/60"
        >
          <input
            type="checkbox"
            class="accent-cyan-500"
            :checked="camadasLigadas.includes(c.id)"
            @change="alternarCamada(c.id)"
          />
          <span class="h-3 w-3 shrink-0 rounded-sm" :style="{ backgroundColor: corDaCamada(c.id) }" />
          <span class="flex-1 leading-tight">{{ c.nome }}</span>
          <span v-if="estadoCamada[c.id] === 'carregando'" class="text-slate-400">…</span>
          <span v-else-if="estadoCamada[c.id] === 'parcial'" class="text-amber-300" title="Mostrando parte: aproxime o zoom">parcial</span>
          <span v-else-if="estadoCamada[c.id] === 'erro'" class="text-red-300">erro</span>
        </label>
      </div>
      <button
        type="button"
        class="rounded-full border border-slate-700 bg-slate-950/85 px-3 py-1.5 text-xs text-slate-200
               shadow backdrop-blur hover:border-cyan-500/60"
        :aria-expanded="painelCamadas"
        @click="painelCamadas = !painelCamadas"
      >
        Camadas<span v-if="camadasLigadas.length"> ({{ camadasLigadas.length }})</span>
      </button>
    </div>
  </div>
</template>