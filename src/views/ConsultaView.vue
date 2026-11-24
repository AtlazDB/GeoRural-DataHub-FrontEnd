<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import FiltroTerritorio from '@/components/consulta/FiltroTerritorio.vue'
import MapaImoveis from '@/components/consulta/MapaImoveis.vue'
import TabelaImoveis from '@/components/consulta/TabelaImoveis.vue'
import CardIndicadores from '@/components/consulta/CardIndicadores.vue'
import CardIndicadoresCadastrados from '@/components/consulta/CardIndicadoresCadastrados.vue'
import GraficosIndicadores from '@/components/consulta/GraficosIndicadores.vue'
import ModalOrigem from '@/components/consulta/ModalOrigem.vue'
import {
  listarPaginaImoveis,
  buscarImoveisNoMapa,
  buscarImovel,
} from '@/services/imoveisService'
import { listarMunicipios, buscarMunicipio } from '@/services/municipiosService'
import { buscarMeuAcesso } from '@/services/acessoService'
import { buscarFocosNoMapa } from '@/services/focosService'
import { buscarIndicadores, calcularIndicadores } from '@/services/indicadoresService'
import { listarIndicadores, buscarResultado } from '@/services/indicadoresCadastrosService'
import { buscarOrigem, compararVersoes } from '@/services/versoesService'
import { formatarNumero } from '@/utils/formato'

/**
 * Consulta do Analista (Imóveis rurais no menu): imóveis rurais no mapa e numa tabela.
 * É a única camada desta tela que fala com a API.
 *
 * Mapa e tabela são independentes: a tabela pagina TODOS os imóveis que
 * passam no filtro; o mapa mostra os que estão na área visível, seja qual
 * for o filtro. O contorno do município só ajuda a achar o lugar.
 */
const UF = 'PR'
const TAMANHO = 50
const PRIORIDADE_STATUS = {
  CRITICO: 4,
  ALERTA: 3,
  VALIDACAO: 2,
  CONFORME: 1,
}

// --- Filtro -------------------------------------------------------
const municipios = ref([])
const carregandoMunicipios = ref(false)
const erroMunicipios = ref('')
const restrito = ref(false) // analista com cidades definidas pelo gestor (US10)
const erroContorno = ref('')
const codIbge = ref('')
const codImovel = ref('')
const situacao = ref('') // AT | PE | CA | SU, '' = todas
const municipio = ref(null) // com geometria, para o contorno no mapa

// --- Tabela -------------------------------------------------------
const itens = ref([])
const total = ref(0)
const pagina = ref(1)
const carregando = ref(false)
const erro = ref('')

// --- Indicadores da página (US11.T22, sob demanda) --------------
const resumoIndicadores = ref({})
const carregandoIndicadoresPagina = ref(false)
const avisoIndicadoresPagina = ref('')
let pedidoIndicadoresPagina = 0

// --- Mapa ---------------------------------------------------------
const mapaRef = ref(null)
const camada = ref(null) // FeatureCollection da área visível
const carregandoMapa = ref(false)
const erroMapa = ref('')
const focos = ref(null) // focos de calor da área visível (os que o IFC conta)

// --- Seleção ------------------------------------------------------
const selecionadoCod = ref(null)
const destaque = ref(null) // o imóvel selecionado, com a geometria completa

// --- Indicadores do imóvel selecionado ----------------------------
const indicadores = ref(null)
const carregandoIndicadores = ref(false)
const erroIndicadores = ref('')
const calculando = ref(false)
let pedidoFocos = null // AbortController dos focos, separado do dos imóveis
let indicadoresAtual = 0

// Se o filtro mudar antes da resposta anterior chegar, só a última consulta
// vale — senão uma resposta atrasada sobrescreveria a mais nova.
let consultaAtual = 0
let contornoAtual = 0
let selecaoAtual = 0
let pedidoMapa = null // AbortController do pedido do mapa em andamento
let ultimaCaixa = null // última área visível avisada pelo mapa
let esperaBusca = null // setTimeout da busca por código

// --- Painel flutuante (filtro, tabela e indicadores por cima do mapa) ---
// Tela larga (lg+): coluna à esquerda. Celular: gaveta que sobe de baixo,
// começa fechada para o mapa aparecer inteiro.
const consultaTelaLarga = window.matchMedia('(min-width: 1024px)')
const telaLarga = ref(consultaTelaLarga.matches)
const painelAberto = ref(telaLarga.value)
// Celular: a legenda fica recolhida num botão (aberta, cobria o "voltar" e parte do mapa).
const legendaAberta = ref(false)
const painelRef = ref(null)
const indicadoresRef = ref(null)
const areaRef = ref(null) // a área do mapa: o painel não sai dela
const tamanhoPainel = ref({ largura: 0, altura: 0 })
const tamanhoArea = ref({ largura: 0, altura: 0 })
let observadorPainel = null

function aoMudarLargura(e) {
  telaLarga.value = e.matches
}

// --- Arrastar o painel (só na tela larga) ----------------------------
// O usuário arrasta pela barra "Filtro e imóveis". Um clique sem mover
// continua abrindo/recolhendo; se moveu mais que LIMIAR px, foi arrasto.
const MARGEM = 16
const LIMIAR = 4
// Começa abaixo do botão "Voltar ao painel" (que fica no canto de cima, à esquerda).
const posicao = ref({ x: MARGEM, y: 64 })
let arrasto = null // { inicioX, inicioY, origemX, origemY, moveu }
let ignorarClique = false

/** Mantém o painel dentro da área do mapa (a barra sempre visível). */
function limitar({ x, y }) {
  const { largura: lp } = tamanhoPainel.value
  const { largura: la, altura: aa } = tamanhoArea.value
  const BARRA = 48 // altura da barra de arrastar, que nunca pode sumir
  return {
    x: Math.min(Math.max(x, 8), Math.max(8, la - lp - 8)),
    y: Math.min(Math.max(y, 8), Math.max(8, aa - BARRA - 8)),
  }
}

function iniciarArrasto(e) {
  if (!telaLarga.value || e.button !== 0) return
  arrasto = {
    inicioX: e.clientX,
    inicioY: e.clientY,
    origemX: posicao.value.x,
    origemY: posicao.value.y,
    moveu: false,
  }
  e.currentTarget.setPointerCapture(e.pointerId)
}

function arrastar(e) {
  if (!arrasto) return
  const dx = e.clientX - arrasto.inicioX
  const dy = e.clientY - arrasto.inicioY
  if (!arrasto.moveu && Math.hypot(dx, dy) < LIMIAR) return
  arrasto.moveu = true
  posicao.value = limitar({ x: arrasto.origemX + dx, y: arrasto.origemY + dy })
}

function soltarArrasto() {
  if (!arrasto) return
  ignorarClique = arrasto.moveu
  arrasto = null
}

function alternarPainel() {
  if (ignorarClique) {
    ignorarClique = false
    return
  }
  painelAberto.value = !painelAberto.value
}

/** Na tela larga o painel fica onde o usuário deixou; no celular, a gaveta. */
const estiloPainel = computed(() => {
  if (!telaLarga.value) return {}
  const { x, y } = posicao.value
  return { left: `${x}px`, top: `${y}px`, maxHeight: `calc(100% - ${y + MARGEM}px)` }
})

/**
 * Quanto do mapa o painel cobre: o enquadramento do mapa desconta isso.
 * Na tela larga depende de onde ele está: metade esquerda → folga à
 * esquerda; metade direita → folga à direita.
 */
const folga = computed(() => {
  const { largura, altura } = tamanhoPainel.value
  if (!largura) return {}
  if (!telaLarga.value) return { baixo: altura + 8 }
  const { x } = posicao.value
  const larguraArea = tamanhoArea.value.largura
  if (x + largura / 2 <= larguraArea / 2) return { esquerda: x + largura + 8 }
  return { direita: larguraArea - x + 8 }
})

// Se a janela encolher, o painel volta para dentro da área.
// Celular: um painel aberto por vez. Abrir as camadas recolhe o painel de baixo (senão a lista
// abria acima dele e saía da tela); abrir o painel (ou tocar num imóvel) fecha as camadas.
function aoAbrirCamadas(aberta) {
  if (aberta && !telaLarga.value) painelAberto.value = false
}
watch(painelAberto, (aberto) => {
  if (aberto && !telaLarga.value) mapaRef.value?.fecharCamadas()
})

watch([tamanhoArea, tamanhoPainel], () => {
  if (telaLarga.value) posicao.value = limitar(posicao.value)
})

const nomeMunicipio = computed(
  () => municipios.value.find((m) => m.codIbge === codIbge.value)?.nome ?? '',
)

/** Legenda do mapa: diz exatamente quais focos estão desenhados (os que o IFC conta). */
const legendaFocos = computed(() => {
  const f = focos.value
  if (!f?.satelite) return 'Foco de calor (INPE)'
  return `Foco de calor · INPE ${f.satelite} · ${f.janelaMeses} meses`
})

/** Indica se algum imóvel carregado tem status ambiental classificado (para legenda). */
const temStatusNoMapa = computed(() =>
  Object.values(resumoIndicadores.value).some((r) => Boolean(r?.status)),
)

// Vai o nome do IBGE como está ("Maringá"): o back-end compara por igualdade,
// sem diferenciar acento nem maiúsculas, com o "Maringa" que o CAR grava.
// Vale para a tabela e para o mapa.
const nomeFiltro = computed(() => nomeMunicipio.value)

async function carregarMunicipios() {
  carregandoMunicipios.value = true
  erroMunicipios.value = ''
  try {
    // A lista já vem só com as cidades liberadas; o acesso diz se há restrição.
    const [lista, acesso] = await Promise.all([
      listarMunicipios(UF),
      buscarMeuAcesso().catch(() => ({ todas: true })),
    ])
    municipios.value = lista
    restrito.value = !acesso.todas
    if (restrito.value && lista.length === 1 && !codIbge.value) codIbge.value = lista[0].codIbge
  } catch (e) {
    erroMunicipios.value = `Não deu para carregar a lista de municípios: ${e.message}`
  } finally {
    carregandoMunicipios.value = false
  }
}

/**
 * Busca a página atual da tabela.
 *
 * O município vai pelo NOME: os imóveis carregados do CAR não têm o vínculo
 * com o código IBGE. O back-end compara por igualdade (Ivaí não traz
 * Ivaiporã) e ignora acento e maiúsculas.
 */
async function carregarPagina() {
  const consulta = ++consultaAtual
  ++pedidoIndicadoresPagina
  resumoIndicadores.value = {}
  avisoIndicadoresPagina.value = ''
  carregandoIndicadoresPagina.value = false
  carregando.value = true
  erro.value = ''
  try {
    const resposta = await listarPaginaImoveis({
      pagina: pagina.value,
      tamanho: TAMANHO,
      municipio: nomeFiltro.value,
      codImovel: codImovel.value.trim(),
      situacao: situacao.value,
    })
    if (consulta !== consultaAtual) return
    itens.value = resposta.itens
    total.value = resposta.total
  } catch (e) {
    if (consulta === consultaAtual) erro.value = e.message
  } finally {
    if (consulta === consultaAtual) carregando.value = false
  }
}

function consolidarStatus(resultados) {
  let piorStatus = null
  let maiorPrioridade = 0
  let calculados = 0

  for (const item of resultados) {
    if (!item?.status) continue
    calculados += 1
    const prioridade = PRIORIDADE_STATUS[item.status] ?? 0
    if (prioridade > maiorPrioridade) {
      maiorPrioridade = prioridade
      piorStatus = item.status
    }
  }

  return {
    status: piorStatus,
    quantidade: resultados.length,
    calculados,
  }
}

async function carregarIndicadoresPagina() {
  if (!itens.value.length) return
  const pedido = ++pedidoIndicadoresPagina
  carregandoIndicadoresPagina.value = true
  avisoIndicadoresPagina.value = ''

  try {
    const ativos = (await listarIndicadores()).filter((i) => i.active)
    if (pedido !== pedidoIndicadoresPagina) return

    if (!ativos.length) {
      resumoIndicadores.value = {}
      avisoIndicadoresPagina.value = 'Nenhum indicador cadastrado ativo.'
      return
    }

    const resultadosPorImovel = await Promise.all(
      itens.value.map(async (imovel) => {
        const res = await Promise.all(
          ativos.map((indicador) => buscarResultado(indicador.code, imovel.codImovel)),
        )
        return [imovel.codImovel, consolidarStatus(res)]
      }),
    )

    if (pedido !== pedidoIndicadoresPagina) return
    resumoIndicadores.value = Object.fromEntries(resultadosPorImovel)
    avisoIndicadoresPagina.value = `${ativos.length} indicador(es) consultado(s) na página.`
  } catch (e) {
    if (pedido === pedidoIndicadoresPagina) {
      avisoIndicadoresPagina.value = e.message || 'Não deu para carregar os indicadores.'
    }
  } finally {
    if (pedido === pedidoIndicadoresPagina) carregandoIndicadoresPagina.value = false
  }
}

function mudarPagina(nova) {
  pagina.value = nova
  carregarPagina()
}

function recomecar() {
  pagina.value = 1
  carregarPagina()
}

/**
 * Contorno do município no mapa (o mapa dá fitBounds sozinho quando ele
 * chega). Se falhar, a tabela continua filtrando normalmente.
 */
async function carregarContorno(cod) {
  const pedido = ++contornoAtual
  erroContorno.value = ''
  if (!cod) {
    municipio.value = null
    return
  }
  try {
    const detalhe = await buscarMunicipio(cod)
    if (pedido === contornoAtual) municipio.value = detalhe
  } catch (e) {
    if (pedido !== contornoAtual) return
    municipio.value = null
    erroContorno.value = `Não deu para carregar o contorno do município: ${e.message}`
  }
}

/**
 * O mapa avisa a área visível a cada movimento (ou `null`, se o zoom
 * estiver longe demais). Se o usuário continuar arrastando, o pedido
 * anterior é cancelado — só a última área interessa.
 */
async function aoMoverMapa(caixa) {
  ultimaCaixa = caixa
  pedidoMapa?.abort()
  pedidoMapa = null
  erroMapa.value = ''
  carregarFocos(caixa)

  if (!caixa) {
    camada.value = null
    carregandoMapa.value = false
    return
  }

  const controle = new AbortController()
  pedidoMapa = controle
  carregandoMapa.value = true
  try {
    camada.value = await buscarImoveisNoMapa(caixa, {
      municipio: nomeFiltro.value,
      situacao: situacao.value,
      signal: controle.signal,
    })
  } catch (e) {
    // Cancelado de propósito: não é erro. O interceptor do http.js embrulha
    // o erro do Axios, mas deixa o original em `e.original`.
    if (e.original?.code === 'ERR_CANCELED') return
    erroMapa.value = e.message
  } finally {
    if (pedidoMapa === controle) {
      pedidoMapa = null
      carregandoMapa.value = false
    }
  }
}

/**
 * Focos da mesma área do mapa. Correm em paralelo aos imóveis, com o próprio
 * AbortController: um não espera nem cancela o outro. Falha nos focos não
 * apaga o mapa — só some a camada laranja.
 */
async function carregarFocos(caixa) {
  pedidoFocos?.abort()
  pedidoFocos = null
  if (!caixa) {
    focos.value = null
    return
  }
  const controle = new AbortController()
  pedidoFocos = controle
  try {
    focos.value = await buscarFocosNoMapa(caixa, { signal: controle.signal })
  } catch (e) {
    if (e.original?.code !== 'ERR_CANCELED') focos.value = null
  } finally {
    if (pedidoFocos === controle) pedidoFocos = null
  }
}

/** IRL e IFC do imóvel selecionado, para o card. */
async function carregarIndicadores(codigo) {
  const pedido = ++indicadoresAtual
  indicadores.value = null
  erroIndicadores.value = ''
  if (!codigo) return

  carregandoIndicadores.value = true
  try {
    const resposta = await buscarIndicadores(codigo)
    if (pedido === indicadoresAtual) indicadores.value = resposta.indicadores
  } catch (e) {
    if (pedido === indicadoresAtual) erroIndicadores.value = e.message
  } finally {
    if (pedido === indicadoresAtual) carregandoIndicadores.value = false
  }
}

/** Recalcula os indicadores de todos os imóveis e recarrega os do selecionado. */
async function calcular() {
  calculando.value = true
  erroIndicadores.value = ''
  try {
    await calcularIndicadores()
    await carregarIndicadores(selecionadoCod.value)
  } catch (e) {
    erroIndicadores.value = e.message
  } finally {
    calculando.value = false
  }
}

/**
 * Marca (ou desmarca, se clicar de novo) um imóvel e busca a geometria
 * completa dele para o destaque. Devolve true se ficou selecionado.
 */
function alternarSelecao(codigo, { centralizar = false } = {}) {
  const pedido = ++selecaoAtual
  destaque.value = null

  if (selecionadoCod.value === codigo) {
    selecionadoCod.value = null
    carregarIndicadores(null)
    return false
  }

  selecionadoCod.value = codigo
  carregarIndicadores(codigo)
  mostrarIndicadores()
  buscarImovel(codigo)
    .then((imovel) => {
      if (pedido !== selecaoAtual) return
      destaque.value = imovel
      // No celular o painel abre embaixo e pode cobrir o imóvel tocado: espera ele assumir o
      // tamanho (a folga do mapa vem do ResizeObserver) e centraliza na parte que sobra.
      if (centralizar && !telaLarga.value) {
        nextTick(() => requestAnimationFrame(() => requestAnimationFrame(
          () => mapaRef.value?.centralizar(imovel.geometria))))
      }
    })
    .catch((e) => {
      if (pedido === selecaoAtual) erroMapa.value = e.message
    })
  return true
}

/** Abre o painel (se estiver fechado) e rola até o card de indicadores. */
async function mostrarIndicadores() {
  painelAberto.value = true
  await nextTick()
  indicadoresRef.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

// Da tabela: o item traz a caixa envolvente, então o mapa vai até o imóvel.
function selecionarDaTabela(item) {
  if (alternarSelecao(item.codImovel)) mapaRef.value?.enquadrar(item)
}

// Do mapa: o usuário já está olhando para o imóvel. Na tela larga ele fica onde está;
// no celular o painel cobre a metade de baixo, então o mapa centraliza o imóvel acima dele.
function selecionarDoMapa(codigo) {
  alternarSelecao(codigo, { centralizar: true })
}

// Trocar o município ou a situação busca na hora; digitar o código espera
// 400 ms parado, para não disparar um pedido a cada tecla.
watch([codIbge, situacao, codImovel], ([ibge, sit], [ibgeAntes, sitAntes]) => {
  clearTimeout(esperaBusca)
  if (ibge !== ibgeAntes || sit !== sitAntes) recomecar()
  else esperaBusca = setTimeout(recomecar, 400)
})

// A situação também vale no mapa: refaz a área que está na tela.
watch(situacao, () => aoMoverMapa(ultimaCaixa))

// Trocar o município também refaz o mapa. O fitBounds no contorno quase
// sempre dispara um moveend (e um pedido novo) logo em seguida; o
// AbortController descarta o que ficar duplicado.
watch(codIbge, (cod) => {
  carregarContorno(cod)
  aoMoverMapa(ultimaCaixa)
})

onMounted(() => {
  carregarMunicipios()
  carregarPagina()

  consultaTelaLarga.addEventListener('change', aoMudarLargura)
  // Um observador para os dois: o painel e a área do mapa.
  observadorPainel = new ResizeObserver((entradas) => {
    for (const { target } of entradas) {
      const { width, height } = target.getBoundingClientRect()
      const tamanho = { largura: width, altura: height }
      if (target === painelRef.value) tamanhoPainel.value = tamanho
      else tamanhoArea.value = tamanho
    }
  })
  observadorPainel.observe(painelRef.value)
  observadorPainel.observe(areaRef.value)
})

// "De onde veio este número?": origem do imóvel e comparação com a versão anterior.
const origem = ref({ aberto: false, indicador: 'IRL', dados: null, comparacao: null, carregando: false, comparando: false, erro: '' })

async function abrirOrigem(indicador) {
  const cod = selecionadoCod.value
  origem.value = { aberto: true, indicador, dados: null, comparacao: null, carregando: true, comparando: false, erro: '' }
  try {
    const [dados, comparacao] = await Promise.all([buscarOrigem(cod), compararVersoes(cod)])
    if (cod !== selecionadoCod.value) return
    origem.value = { ...origem.value, dados, comparacao }
  } catch (e) {
    origem.value.erro = e.message
  } finally {
    origem.value.carregando = false
  }
}

async function compararOutras(par) {
  origem.value.comparando = true
  try {
    origem.value.comparacao = await compararVersoes(selecionadoCod.value, par)
  } catch (e) {
    origem.value.erro = e.message
  } finally {
    origem.value.comparando = false
  }
}

onBeforeUnmount(() => {
  consultaTelaLarga.removeEventListener('change', aoMudarLargura)
  observadorPainel?.disconnect()
  pedidoMapa?.abort()
  pedidoFocos?.abort()
  clearTimeout(esperaBusca)
})
</script>

<template>
  <!-- O mapa ocupa a tela inteira; o resto flutua por cima, como no Google Maps. -->
  <div ref="areaRef" class="absolute inset-0">
    <MapaImoveis
      ref="mapaRef"
      class="absolute inset-0"
      :camada="camada"
      :carregando="carregandoMapa"
      :erro="erroMapa"
      :municipio="municipio"
      :destaque="destaque"
      :filtrado="!!nomeFiltro || !!situacao"
      :focos="focos"
      :resumo-indicadores="resumoIndicadores"
      :folga="folga"
      @area="aoMoverMapa"
      @selecionar="selecionarDoMapa"
      @camadas="aoAbrirCamadas"
    />

    <!-- Voltar ao Dashboard: canto superior esquerdo (o zoom fica embaixo, à direita).
         No celular só a seta; o texto aparece a partir do sm. -->
    <RouterLink
      :to="{ name: 'dashboard' }"
      class="glass-mapa absolute left-4 top-4 z-20 inline-flex items-center gap-1.5 p-2.5 text-[12.5px]
             font-medium text-slate-200 transition hover:text-cyan-300 sm:px-3 sm:py-2"
      aria-label="Voltar ao painel"
      title="Voltar ao painel"
    >
      <AppIcon nome="voltar" class="h-4 w-4 sm:h-3.5 sm:w-3.5" />
      <span class="hidden sm:inline">Voltar ao painel</span>
    </RouterLink>

    <!-- Celular: botão que abre e fecha a legenda (a partir do sm ela fica sempre aberta). -->
    <button
      type="button"
      class="glass-mapa absolute right-4 top-4 z-20 inline-flex items-center gap-1.5 px-3 py-2 text-[12px]
             font-medium text-slate-200 sm:hidden"
      :aria-expanded="legendaAberta"
      @click="legendaAberta = !legendaAberta"
    >
      <span class="h-2.5 w-2.5 rounded-sm border border-cyan-400 bg-cyan-400/30" />
      <span class="h-2.5 w-2.5 rounded-full bg-orange-500" />
      Legenda
    </button>

    <!-- Legenda: canto superior direito. No celular, abaixo do botão e só quando aberta
         (tocar nela fecha); a partir do sm, sempre visível e sem receber cliques. -->
    <div
      :class="[
        'glass-mapa absolute right-4 top-16 z-20 max-w-[calc(100%-2rem)] flex-col gap-1 px-3 py-2 text-[11px]',
        'text-slate-400 sm:pointer-events-none sm:top-4 sm:flex sm:flex-row sm:flex-wrap sm:gap-x-4',
        legendaAberta ? 'flex' : 'hidden',
      ]"
      @click="legendaAberta = false"
    >
      <span class="flex items-center gap-1.5">
        <span class="h-2.5 w-2.5 shrink-0 rounded-sm border border-cyan-400 bg-cyan-400/30" />
        Imóvel rural
      </span>
      <template v-if="temStatusNoMapa">
        <span class="flex items-center gap-1.5">
          <span class="h-2.5 w-2.5 shrink-0 rounded-sm border border-emerald-500 bg-emerald-500/30" />
          Conforme
        </span>
        <span class="flex items-center gap-1.5">
          <span class="h-2.5 w-2.5 shrink-0 rounded-sm border border-amber-500 bg-amber-500/30" />
          Alerta
        </span>
        <span class="flex items-center gap-1.5">
          <span class="h-2.5 w-2.5 shrink-0 rounded-sm border border-rose-500 bg-rose-500/30" />
          Crítico
        </span>
      </template>
      <span class="flex items-center gap-1.5">
        <span class="h-2.5 w-2.5 shrink-0 rounded-full bg-orange-500" />
        {{ legendaFocos }}
      </span>
    </div>

    <!-- Painel: arrastável pelo mapa (lg+) ou gaveta embaixo (celular).
         Na tela larga, left/top vêm de estiloPainel. -->
    <aside
      ref="painelRef"
      :class="[
        'glass-mapa absolute z-20 flex flex-col overflow-hidden',
        'lg:bottom-auto lg:right-auto lg:w-[460px]',
        painelAberto ? 'inset-x-2 bottom-2 max-h-[65%]' : 'bottom-2 left-2',
      ]"
      :style="estiloPainel"
      aria-label="Filtro e lista de imóveis"
    >
      <button
        type="button"
        :class="[
          'flex shrink-0 select-none items-center justify-between gap-3 px-4 py-3 text-left',
          'text-sm font-semibold text-slate-100 transition hover:text-white lg:cursor-move lg:touch-none',
          painelAberto && 'border-b border-slate-800',
        ]"
        :aria-expanded="painelAberto"
        title="Arraste para mover o painel; clique para abrir ou recolher"
        @pointerdown="iniciarArrasto"
        @pointermove="arrastar"
        @pointerup="soltarArrasto"
        @pointercancel="soltarArrasto"
        @click="alternarPainel"
      >
        <span class="flex items-center gap-2">
          <!-- Pegador: seis pontinhos, só onde dá para arrastar -->
          <svg class="hidden h-4 w-4 text-slate-500 lg:block" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <circle cx="6" cy="4" r="1.2" /><circle cx="10" cy="4" r="1.2" />
            <circle cx="6" cy="8" r="1.2" /><circle cx="10" cy="8" r="1.2" />
            <circle cx="6" cy="12" r="1.2" /><circle cx="10" cy="12" r="1.2" />
          </svg>
          Filtro e imóveis
        </span>
        <span class="text-xs font-normal text-slate-400">{{ painelAberto ? 'Recolher' : 'Abrir' }}</span>
      </button>

      <!-- overscroll-contain: no Android, chegar ao topo da gaveta e puxar
           não dispara o "puxar para recarregar" da página inteira. -->
      <div
        v-show="painelAberto"
        class="min-h-0 flex-1 divide-y divide-slate-800 overflow-y-auto overscroll-contain"
      >
        <section class="p-4">
          <FiltroTerritorio
            v-model:cod-ibge="codIbge"
            v-model:cod-imovel="codImovel"
            v-model:situacao="situacao"
            :municipios="municipios"
            :restrito="restrito"
            :carregando="carregandoMunicipios"
            :erro="erroMunicipios || erroContorno"
          />
        </section>

        <section class="p-4">
          <h2 class="mb-3 flex items-baseline gap-2 text-sm font-semibold text-slate-100">
            Imóveis
            <span v-if="total" class="text-xs font-normal text-slate-500">{{ formatarNumero(total) }}</span>
          </h2>
          <TabelaImoveis
            :itens="itens"
            :total="total"
            :pagina="pagina"
            :tamanho="TAMANHO"
            :carregando="carregando"
            :erro="erro"
            :selecionado-cod="selecionadoCod"
            :resumo-indicadores="resumoIndicadores"
            :carregando-indicadores="carregandoIndicadoresPagina"
            :aviso-indicadores="avisoIndicadoresPagina"
            @selecionar="selecionarDaTabela"
            @mudar-pagina="mudarPagina"
            @tentar-novamente="carregarPagina"
            @carregar-indicadores="carregarIndicadoresPagina"
          />
        </section>

        <section ref="indicadoresRef" class="p-4">
          <h2 class="text-sm font-semibold text-slate-100">Indicadores do imóvel</h2>
          <p v-if="selecionadoCod" class="mt-0.5 truncate font-mono text-[11.5px] text-cyan-400">{{ selecionadoCod }}</p>
          <div class="mt-3">
            <CardIndicadores
              :cod-imovel="selecionadoCod"
              :indicadores="indicadores"
              :carregando="carregandoIndicadores"
              :erro="erroIndicadores"
              :calculando="calculando"
              @calcular="calcular"
              @tentar-novamente="carregarIndicadores(selecionadoCod)"
              @origem="abrirOrigem"
            />
            <CardIndicadoresCadastrados :cod-imovel="selecionadoCod" />
            <GraficosIndicadores
              :resumo-indicadores="resumoIndicadores"
              :indicadores-imovel="indicadores"
              :cod-imovel="selecionadoCod"
            />
          </div>
        </section>
      </div>
    </aside>
    <ModalOrigem
      :aberto="origem.aberto"
      :cod-imovel="selecionadoCod ?? ''"
      :indicador="origem.indicador"
      :origem="origem.dados"
      :comparacao="origem.comparacao"
      :carregando="origem.carregando"
      :comparando="origem.comparando"
      :erro="origem.erro"
      @fechar="origem.aberto = false"
      @comparar="compararOutras"
    />
  </div>
</template>