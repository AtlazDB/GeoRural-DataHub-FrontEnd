<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import BaseCard from '@/components/BaseCard.vue'
import FiltroTerritorio from '@/components/consulta/FiltroTerritorio.vue'
import MapaImoveis from '@/components/consulta/MapaImoveis.vue'
import TabelaImoveis from '@/components/consulta/TabelaImoveis.vue'
import CardIndicadores from '@/components/consulta/CardIndicadores.vue'
import CardIndicadoresCadastrados from '@/components/consulta/CardIndicadoresCadastrados.vue'
import {
  listarPaginaImoveis,
  buscarImoveisNoMapa,
  buscarImovel,
} from '@/services/imoveisService'
import { listarMunicipios, buscarMunicipio } from '@/services/municipiosService'
import { buscarFocosNoMapa } from '@/services/focosService'
import { buscarIndicadores, calcularIndicadores } from '@/services/indicadoresService'
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

// --- Filtro -------------------------------------------------------
const municipios = ref([])
const carregandoMunicipios = ref(false)
const erroMunicipios = ref('')
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

const nomeMunicipio = computed(
  () => municipios.value.find((m) => m.codIbge === codIbge.value)?.nome ?? '',
)

/** Legenda do mapa: diz exatamente quais focos estão desenhados (os que o IFC conta). */
const legendaFocos = computed(() => {
  const f = focos.value
  if (!f?.satelite) return 'Foco de calor (INPE)'
  return `Foco de calor · INPE ${f.satelite} · ${f.janelaMeses} meses`
})

// Vai o nome do IBGE como está ("Maringá"): o back-end compara por igualdade,
// sem diferenciar acento nem maiúsculas, com o "Maringa" que o CAR grava.
// Vale para a tabela e para o mapa.
const nomeFiltro = computed(() => nomeMunicipio.value)

async function carregarMunicipios() {
  carregandoMunicipios.value = true
  erroMunicipios.value = ''
  try {
    municipios.value = await listarMunicipios(UF)
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
function alternarSelecao(codigo) {
  const pedido = ++selecaoAtual
  destaque.value = null

  if (selecionadoCod.value === codigo) {
    selecionadoCod.value = null
    carregarIndicadores(null)
    return false
  }

  selecionadoCod.value = codigo
  carregarIndicadores(codigo)
  buscarImovel(codigo)
    .then((imovel) => {
      if (pedido === selecaoAtual) destaque.value = imovel
    })
    .catch((e) => {
      if (pedido === selecaoAtual) erroMapa.value = e.message
    })
  return true
}

// Da tabela: o item traz a caixa envolvente, então o mapa vai até o imóvel.
function selecionarDaTabela(item) {
  if (alternarSelecao(item.codImovel)) mapaRef.value?.enquadrar(item)
}

// Do mapa: o usuário já está olhando para o imóvel.
function selecionarDoMapa(codigo) {
  alternarSelecao(codigo)
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
})

onBeforeUnmount(() => {
  pedidoMapa?.abort()
  pedidoFocos?.abort()
  clearTimeout(esperaBusca)
})
</script>

<template>
  <div class="space-y-5">
    <BaseCard>
      <FiltroTerritorio
        v-model:cod-ibge="codIbge"
        v-model:cod-imovel="codImovel"
        v-model:situacao="situacao"
        :municipios="municipios"
        :carregando="carregandoMunicipios"
        :erro="erroMunicipios || erroContorno"
      />
    </BaseCard>

    <div class="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
      <BaseCard class="lg:col-span-7" titulo="Mapa">
        <template #acoes>
          <div class="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 pt-0.5 text-[11px] text-slate-400">
            <span class="flex items-center gap-1.5">
              <span class="h-2.5 w-2.5 rounded-sm border border-cyan-400 bg-cyan-400/30" />
              Imóvel rural
            </span>
            <span class="flex items-center gap-1.5">
              <span class="h-2.5 w-2.5 rounded-full bg-orange-500" />
              {{ legendaFocos }}
            </span>
          </div>
        </template>
        <MapaImoveis
          ref="mapaRef"
          :camada="camada"
          :carregando="carregandoMapa"
          :erro="erroMapa"
          :municipio="municipio"
          :destaque="destaque"
          :filtrado="!!nomeFiltro || !!situacao"
          :focos="focos"
          @area="aoMoverMapa"
          @selecionar="selecionarDoMapa"
        />
      </BaseCard>

      <div class="space-y-5 lg:col-span-5">
        <BaseCard titulo="Imóveis" :contagem="total ? formatarNumero(total) : ''">
          <TabelaImoveis
            :itens="itens"
            :total="total"
            :pagina="pagina"
            :tamanho="TAMANHO"
            :carregando="carregando"
            :erro="erro"
            :selecionado-cod="selecionadoCod"
            @selecionar="selecionarDaTabela"
            @mudar-pagina="mudarPagina"
            @tentar-novamente="carregarPagina"
          />
        </BaseCard>

        <BaseCard titulo="Indicadores do imóvel">
          <template v-if="selecionadoCod" #subtitulo>
            <p class="truncate font-mono text-[11.5px] text-cyan-400">{{ selecionadoCod }}</p>
          </template>
          <CardIndicadores
            :cod-imovel="selecionadoCod"
            :indicadores="indicadores"
            :carregando="carregandoIndicadores"
            :erro="erroIndicadores"
            :calculando="calculando"
            @calcular="calcular"
            @tentar-novamente="carregarIndicadores(selecionadoCod)"
          />
          <CardIndicadoresCadastrados :cod-imovel="selecionadoCod" />
        </BaseCard>
      </div>
    </div>
  </div>
</template>
