<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from '@/components/BaseButton.vue'
import BaseGaveta from '@/components/BaseGaveta.vue'
import AppIcon from '@/components/AppIcon.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import FonteList from '@/components/fontes/FonteList.vue'
import FonteForm from '@/components/fontes/FonteForm.vue'
import FonteUpload from '@/components/fontes/FonteUpload.vue'
import ArquivoList from '@/components/fontes/ArquivoList.vue'
import RecebimentoLink from '@/components/fontes/RecebimentoLink.vue'
import MapeamentoPainel from '@/components/mapeamento/MapeamentoPainel.vue'
import { listarColunas } from '@/services/mapeamentosService'
import {
  listarFontes,
  criarFonte,
  atualizarFonte,
  enviarArquivo,
  testarLink,
  executarColeta,
} from '@/services/fontesService'
import { processarArquivo, excluirArquivo } from '@/services/arquivosService'
import { ehProcessavel } from '@/utils/processamento'
import { formatarDataHora } from '@/utils/formato'

/**
 * ==================================================================
 * CADASTRO & IMPORTAÇÃO — o "cérebro" da tela (TODO 7, 8 e 9)
 * ==================================================================
 * Esta é a única camada que conversa com o service. Os componentes
 * filhos só recebem props e emitem eventos.
 *
 * Ordem sugerida: faça os TODOs 1 a 6 primeiro (service, formulário e
 * upload), e só então volte aqui para ligar tudo.
 *
 * A tela tem duas partes, escolhidas pela rota:
 *   /importacao            a lista de fontes em cartões, com filtro e busca
 *   /importacao/:fonteId   a página da fonte, com as abas Recebimento,
 *                          Arquivos recebidos e Mapeamento (?aba=...)
 */

const route = useRoute()
const router = useRouter()

// --- Estado do mapeamento -----------------------------------------
const novasPorFonte = ref({})

// --- Lista: filtro por como os dados chegam e busca --------------
const filtro = ref('todas') // todas | LINK | MANUAL
const busca = ref('')

const filtros = [
  { valor: 'todas', rotulo: 'Todas' },
  { valor: 'LINK', rotulo: 'Coleta automática' },
  { valor: 'MANUAL', rotulo: 'Upload' },
]

function doFiltro(fonte, valor) {
  return valor === 'todas' || (valor === 'LINK') === (fonte.modalidade === 'LINK')
}

function contar(valor) {
  return fontes.value.filter((f) => doFiltro(f, valor)).length
}

const fontesVisiveis = computed(() => {
  const termo = busca.value.trim().toLowerCase()
  return fontes.value.filter(
    (f) =>
      doFiltro(f, filtro.value) &&
      (!termo || `${f.nome} ${f.sigla} ${f.orgao}`.toLowerCase().includes(termo)),
  )
})

// --- Página da fonte: abas ----------------------------------------
const ABAS = ['recebimento', 'arquivos', 'mapeamento']
const aba = computed(() => (ABAS.includes(route.query.aba) ? route.query.aba : 'recebimento'))

function irParaAba(nova) {
  router.replace({ query: { ...route.query, aba: nova === 'recebimento' ? undefined : nova } })
}

const abas = computed(() => [
  { id: 'recebimento', rotulo: 'Recebimento' },
  { id: 'arquivos', rotulo: 'Arquivos recebidos', contagem: selecionada.value?.arquivos?.length ?? 0 },
  { id: 'mapeamento', rotulo: 'Mapeamento', semRegra: novasPorFonte.value[selecionada.value?.id] ?? 0 },
])

// O que trava a fonte aberta: arquivo esperando o mapeamento. Coluna sem regra
// sozinha não é alerta: muitas ficam sem mapeamento de propósito (objectid, Shape__Area)
// e só ganham o ponto na aba Mapeamento.
const alertaFonte = computed(() => {
  const fonte = selecionada.value
  if (!fonte?.arquivos?.some((a) => a.status === 'AGUARDANDO_MAPEAMENTO')) return null
  return 'Há arquivo esperando o mapeamento das colunas: ele está guardado na zona bruta e é processado assim que as colunas forem mapeadas.'
})

const metaFonte = computed(() => {
  const fonte = selecionada.value
  if (!fonte) return []
  const ultimo = fonte.arquivos?.[0]
  return [
    { rotulo: 'Como chega', valor: fonte.modalidade === 'LINK' ? 'Coleta automática por link' : 'Upload pelo operador' },
    { rotulo: 'Formato', valor: fonte.formato },
    { rotulo: 'Periodicidade', valor: fonte.periodicidade || '—' },
    { rotulo: 'Último arquivo', valor: ultimo ? formatarDataHora(ultimo.enviadoEm) : 'nenhum ainda' },
  ]
})

// --- Estado da listagem -------------------------------------------
const fontes = ref([])
const carregando = ref(false)
const erro = ref('')

// --- Estado do formulário -----------------------------------------
const mostrandoForm = ref(false)
const emEdicao = ref(null) // a fonte aberta no formulário para editar, ou null
const salvando = ref(false)
const formRef = ref(null)

// --- Estado do upload ---------------------------------------------
const selecionada = ref(null)
const enviando = ref(false)
const progresso = ref(0)
const uploadRef = ref(null)

// Fonte por link: o "Testar link" do formulário e o "Executar" da lista
const testando = ref(false)
const teste = ref(null) // a resposta do último "Testar link"
const erroTeste = ref('')
const executandoId = ref(null) // fonte com coleta em andamento

// --- Estado do processamento --------------------------------------
const emProcessamento = ref([]) // ids mandados processar que ainda não responderam
const naFilaAirflow = ref({}) // id → arquivo: processamento entregue ao Airflow, ainda sem resultado
const resultados = ref({}) // id do arquivo → { tipo, texto } do último processamento
const excluindo = ref([]) // ids com exclusão em andamento
let consulta = null // o setInterval da consulta periódica
let atualizando = false

// --- Aviso na tela (sucesso/erro) ---------------------------------
const aviso = ref(null) // { tipo: 'ok' | 'erro', texto: string }
let timerAviso = null

// O clearTimeout evita que o timer de um aviso antigo apague um aviso
// novo antes da hora — o resultado do processamento pode chegar poucos
// segundos depois do "Arquivo enviado".
function avisar(tipo, texto) {
  aviso.value = { tipo, texto }
  clearTimeout(timerAviso)
  timerAviso = setTimeout(() => (aviso.value = null), 5000)
}

// Conta as colunas "novas" de uma fonte para o aviso da lista. Se a fonte não
// tem colunas ou o back não tem o endpoint (mock), simplesmente não há aviso.
async function contarNovas(fonteId) {
  try {
    const colunas = await listarColunas(fonteId)
    novasPorFonte.value[fonteId] = colunas.filter(
      (c) => String(c.situacao).toLowerCase() === 'nova',
    ).length
  } catch {
    delete novasPorFonte.value[fonteId]
  }
}

function recarregarNovas() {
  fontes.value.forEach((f) => contarNovas(f.id))
}

function abrirMapeamento(fonte) {
  router.push({ name: 'importacao', params: { fonteId: fonte.id }, query: { aba: 'mapeamento' } })
}

/**
 * TODO 7 — Carregar as fontes da API.
 *
 *   a) marque carregando.value = true e limpe erro.value
 *   b) chame `await listarFontes()` e jogue o resultado em fontes.value
 *   c) se der erro, guarde a mensagem em erro.value
 *   d) no finally, carregando.value = false
 *
 * O esqueleto do try/catch/finally já está aí — só preencha.
 */
async function carregar() {
  carregando.value = true
  erro.value = ''
  try {
    fontes.value = await listarFontes()
        recarregarNovas()
  } catch (e) {
    erro.value = e.message
  } finally {
    carregando.value = false
  }
}

/**
 * TODO 8 — Cadastrar uma fonte nova.
 * Recebe os dados do evento 'salvar' emitido pelo FonteForm.
 *
 *   a) salvando.value = true
 *   b) `const nova = await criarFonte(dados)`
 *   c) coloque a nova fonte no topo da lista: fontes.value.unshift(nova)
 *      (ou chame carregar() de novo — as duas abordagens são válidas;
 *       unshift é mais rápido, recarregar é mais garantido)
 *   d) feche o formulário, limpe os campos (formRef.value.limpar())
 *      e chame avisar('ok', 'Fonte cadastrada.')
 *   e) no catch, avisar('erro', e.message)
 */
function editarFonte(fonte) {
  limparTeste()
  emEdicao.value = fonte
  mostrandoForm.value = true
}

function fecharForm() {
  mostrandoForm.value = false
  emEdicao.value = null
}

async function salvarFonte(dados) {
  salvando.value = true
  try {
    if (emEdicao.value) {
      const atualizada = await atualizarFonte(emEdicao.value.id, dados)
      const i = fontes.value.findIndex((f) => f.id === atualizada.id)
      if (i !== -1) fontes.value[i] = atualizada
      if (selecionada.value?.id === atualizada.id) selecionada.value = atualizada
      fecharForm()
      limparTeste()
      avisar('ok', 'Fonte atualizada.')
      return
    }
    const nova = await criarFonte(dados)
    fontes.value.unshift(nova)
    mostrandoForm.value = false
    formRef.value.limpar()
    limparTeste()
    avisar('ok', 'Fonte cadastrada.')
  } catch (e) {
    avisar('erro', e.message)
  } finally {
    salvando.value = false
  }
}

/**
 * "Testar link" do formulário: o back pede ao link uma amostra pequena e
 * devolve o status, o total, as colunas e os avisos. Nada é gravado.
 */
async function testarLinkDoFormulario(dados) {
  testando.value = true
  limparTeste()
  try {
    teste.value = await testarLink(dados)
  } catch (e) {
    erroTeste.value = e.message
  } finally {
    testando.value = false
  }
}

function limparTeste() {
  teste.value = null
  erroTeste.value = ''
}

/** "Testar link" da página da fonte: o mesmo teste do formulário, com o link cadastrado. */
function testarLinkDaFonte() {
  const { urlOrigem, metodoHttp, corpoRequisicao } = selecionada.value
  testarLinkDoFormulario({ urlOrigem, metodoHttp, corpoRequisicao })
}

/**
 * "Executar agora" de uma fonte por link.
 *
 * O back só dispara a DAG no Airflow (SOLICITADA, 202): a coleta
 * pagina o serviço e pode levar horas. A fonte fica "coletando" e a consulta
 * periódica mostra o andamento (fonte.ultimaColetaMensagem); quando o arquivo
 * chega na zona bruta, o próprio Airflow o processa.
 */
async function executar(fonte) {
  executandoId.value = fonte.id
  try {
    const { mensagem } = await executarColeta(fonte.id)
    avisar('ok', mensagem)
    selecionada.value = fonte // mostra o andamento da fonte que acabou de ser pedida
    await atualizar()
  } catch (e) {
    avisar('erro', e.message)
  } finally {
    executandoId.value = null
  }
}

/**
 * TODO 9 — Enviar o arquivo, atualizando a barra de progresso.
 * Recebe o File do evento 'enviar' emitido pelo FonteUpload.
 *
 *   a) enviando.value = true e progresso.value = 0
 *   b) chame o service passando o callback de progresso:
 *
 *        const { fonte } = await enviarArquivo(
 *          selecionada.value.id,
 *          arquivo,
 *          (pct) => { progresso.value = pct },
 *        )
 *
 *      Esse terceiro argumento é a ponte: o Axios avisa o service,
 *      o service avisa esta função, esta função atualiza a ref, e o
 *      Vue redesenha a barra. Reatividade de ponta a ponta.
 *
 *   c) com a fonte atualizada que voltou do servidor, troque a versão
 *      antiga na lista:
 *
 *        const i = fontes.value.findIndex((f) => f.id === fonte.id)
 *        if (i !== -1) fontes.value[i] = fonte
 *        selecionada.value = fonte
 *
 *   d) uploadRef.value.limpar() e avisar('ok', 'Arquivo enviado.')
 *   e) no finally, enviando.value = false e progresso.value = 0
 */
async function enviar(arquivo) {
  enviando.value = true
  progresso.value = 0
  try {
    const { fonte, arquivo: recebido } = await enviarArquivo(
      selecionada.value.id,
      arquivo,
      (pct) => {
        progresso.value = pct
      },
    )

    const i = fontes.value.findIndex((f) => f.id === fonte.id)
    if (i !== -1) fontes.value[i] = fonte
    selecionada.value = fonte

    uploadRef.value.limpar()
    avisar('ok', 'Arquivo enviado.')

    // Nada roda sozinho no Airflow: é processar() que dispara o processamento
    // e põe a linha do arquivo no acompanhamento. Sem await de propósito.
    if (ehProcessavel(recebido)) processar(recebido)
  } catch (e) {
    avisar('erro', e.message)
  } finally {
    enviando.value = false
    progresso.value = 0
  }
}

/**
 * Dispara o processamento de um arquivo no Airflow (o back reserva, dispara e
 * responde na hora). O processamento corre fora desta chamada: o andamento e o
 * resultado chegam pela consulta periódica (ver acompanharFilaAirflow()). O catch
 * pega erro de requisição (404, 409 já em processamento, 503 Airflow fora do ar...).
 */
async function processar(arquivo) {
  const id = arquivo.id
  if (emProcessamento.value.includes(id)) return

  emProcessamento.value.push(id)
  delete resultados.value[id]
  try {
    await processarArquivo(id)
    naFilaAirflow.value[id] = arquivo
    resultados.value[id] = {
      tipo: 'ok',
      texto: 'Enviado ao Airflow.',
    }
  } catch (e) {
    concluir(arquivo, 'erro', e.message)
  } finally {
    emProcessamento.value = emProcessamento.value.filter((x) => x !== id)
    atualizar()
  }
}

// O resultado fica na linha do arquivo e também sobe como aviso, para
// quem estiver olhando outra fonte quando o processamento terminar.
function concluir(arquivo, tipo, texto) {
  resultados.value[arquivo.id] = { tipo, texto }
  avisar(tipo, `${arquivo.nome} — ${texto}`)
  recarregarNovas()
}

/**
 * Recarrega as fontes sem ligar o `carregando` — senão a lista viraria
 * esqueleto a cada 3 segundos. Se falhar, mantém o que está na tela e a
 * próxima volta da consulta tenta de novo.
 */
async function atualizar() {
  if (atualizando) return // a volta anterior ainda não respondeu
  atualizando = true
  try {
    fontes.value = await listarFontes()
    // `selecionada` guarda o objeto antigo: troca pela versão nova da mesma fonte
    if (selecionada.value) {
      selecionada.value =
        fontes.value.find((f) => f.id === selecionada.value.id) ?? selecionada.value
    }
    acompanharFilaAirflow()
  } catch {
    // silencioso de propósito — é só a consulta de fundo
  } finally {
    atualizando = false
  }
}

/**
 * Para os arquivos entregues ao Airflow, olha o status que veio na última
 * consulta e mostra o resultado na linha do arquivo quando ele termina.
 */
function acompanharFilaAirflow() {
  for (const [id, arquivo] of Object.entries(naFilaAirflow.value)) {
    const atual = fontes.value.flatMap((f) => f.arquivos ?? []).find((a) => String(a.id) === id)
    if (!atual) continue
    
    if (atual.status === 'AGUARDANDO_MAPEAMENTO') {
      delete naFilaAirflow.value[id]
      resultados.value[id] = {
        tipo: 'erro',
        texto: 'Há colunas sem mapeamento. Mapeie pelo botão # e processe de novo.',
      }
      continue
    }
    if (atual.status === 'PROCESSANDO') {
      resultados.value[id] = { tipo: 'ok', texto: 'Processando no Airflow…' }
    } else if (atual.status === 'PROCESSADO') {
      delete naFilaAirflow.value[id]
      concluir(arquivo, 'ok', 'Processado pelo Airflow.')
    } else if (atual.status === 'REJEITADO') {
      delete naFilaAirflow.value[id]
      concluir(arquivo, 'erro', 'Rejeitado no processamento. O motivo fica registrado na execução.')
    }
  }
}

/**
 * Consulta periódica: enquanto houver arquivo PROCESSANDO ou fonte coletando
 * no Airflow, recarrega a lista a cada 3 s. Conta também os ids que esta tela acabou de mandar
 * processar — a primeira consulta pode chegar antes de o back-end gravar
 * PROCESSANDO, e a consulta pararia cedo demais.
 *
 * A consulta liga e desliga sozinha pelo watch: ninguém chama
 * iniciarConsulta() direto.
 */
const haProcessando = computed(
  () =>
    emProcessamento.value.length > 0 ||
    Object.keys(naFilaAirflow.value).length > 0 ||
    fontes.value.some((f) => f.coletando) ||
    fontes.value.some((f) => f.arquivos?.some((a) => a.status === 'PROCESSANDO')),
)

function iniciarConsulta() {
  if (!consulta) consulta = setInterval(atualizar, 3000)
}

function pararConsulta() {
  clearInterval(consulta)
  consulta = null
}

watch(haProcessando, (sim) => (sim ? iniciarConsulta() : pararConsulta()))

/**
 * Exclui um arquivo REJEITADO — do catálogo e da zona bruta, sem volta.
 * Se o back-end recusar (409: não está rejeitado, ou já gerou versão de
 * dados), a mensagem chega pronta pelo interceptor do http.js.
 */
async function excluir(arquivo) {
  const confirmado = window.confirm(
    `Excluir "${arquivo.nome}"?\n\nO arquivo é apagado do catálogo e da zona bruta. Não dá para desfazer.`,
  )
  if (!confirmado || excluindo.value.includes(arquivo.id)) return

  excluindo.value.push(arquivo.id)
  try {
    await excluirArquivo(arquivo.id)
    delete resultados.value[arquivo.id]
    avisar('ok', `${arquivo.nome} excluído.`)
    await atualizar()
  } catch (e) {
    avisar('erro', e.message)
  } finally {
    excluindo.value = excluindo.value.filter((x) => x !== arquivo.id)
  }
}

function selecionar(fonte) {
  router.push({ name: 'importacao', params: { fonteId: fonte.id } })
}

// A fonte aberta vem da rota (/importacao/:fonteId): trocar de fonte, voltar
// para a lista ou recarregar a página mantém a tela coerente com o endereço.
watch(
  () => [route.params.fonteId, fontes.value],
  ([id], antes) => {
    const anterior = antes?.[0]
    selecionada.value = id ? (fontes.value.find((f) => String(f.id) === String(id)) ?? null) : null
    if (id !== anterior) {
      uploadRef.value?.limpar()
      limparTeste()
    }
  },
)

onMounted(carregar)
onBeforeUnmount(() => {
  pararConsulta()
  clearTimeout(timerAviso)
})
</script>

<template>
  <div class="space-y-5">
    <!-- Aviso de sucesso/erro -->
    <Transition
      enter-active-class="transition duration-200"
      enter-from-class="-translate-y-1 opacity-0"
      leave-active-class="transition duration-150"
      leave-to-class="opacity-0"
    >
      <div
        v-if="aviso"
        :class="[
          'flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm',
          aviso.tipo === 'ok'
            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
            : 'border-red-500/40 bg-red-500/10 text-red-300',
        ]"
      >
        <AppIcon :nome="aviso.tipo === 'ok' ? 'check' : 'alerta'" class="h-4 w-4 shrink-0" />
        {{ aviso.texto }}
      </div>
    </Transition>

    <!-- ============================================ LISTA DE FONTES -->
    <template v-if="!route.params.fonteId">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <p class="max-w-3xl text-[13px] text-slate-400">
          Cada fonte é um órgão que entrega dados ao sistema. Os dados chegam de dois jeitos: por
          <b class="font-medium text-slate-200">upload</b>, quando o operador envia o arquivo, ou por
          <b class="font-medium text-slate-200">coleta automática</b>, quando o sistema busca no link
          do órgão.
        </p>
        <!-- As fontes do projeto já estão cadastradas: o botão fica à vista, mas inativo.
             Para mudar como uma fonte chega (link ou upload), use "Editar" na página dela. -->
        <span title="As fontes do projeto já estão cadastradas. Para mudar uma delas, abra a fonte e use Editar.">
          <BaseButton tamanho="sm" disabled>
            <AppIcon nome="mais" traco="2.4" class="h-3 w-3" />
            Nova fonte
          </BaseButton>
        </span>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="inline-flex rounded-xl border border-slate-800 bg-slate-950/40 p-1" role="tablist">
          <button
            v-for="f in filtros"
            :key="f.valor"
            type="button"
            role="tab"
            :aria-selected="filtro === f.valor"
            :class="[
              'rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition',
              filtro === f.valor ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200',
            ]"
            @click="filtro = f.valor"
          >
            {{ f.rotulo }} <span class="text-slate-500">{{ contar(f.valor) }}</span>
          </button>
        </div>
        <input
          v-model="busca"
          class="input max-w-xs"
          placeholder="Buscar por nome, sigla ou órgão"
          aria-label="Buscar fonte"
        />
      </div>

      <FonteList
        :fontes="fontesVisiveis"
        :carregando="carregando"
        :erro="erro"
        :novas="novasPorFonte"
        :filtrada="fontes.length > 0"
        @selecionar="selecionar"
        @tentar-novamente="carregar"
      />
    </template>

    <!-- ============================================ PÁGINA DA FONTE -->
    <template v-else>
      <RouterLink
        :to="{ name: 'importacao' }"
        class="inline-flex items-center gap-1.5 text-[12px] text-slate-400 hover:text-slate-200"
      >
        <AppIcon nome="voltar" class="h-3.5 w-3.5" />
        Todas as fontes
      </RouterLink>

      <div v-if="!selecionada" class="glass p-8 text-center text-sm text-slate-400">
        <template v-if="carregando">Carregando a fonte…</template>
        <template v-else-if="erro">{{ erro }}</template>
        <template v-else>Fonte não encontrada.</template>
      </div>

      <template v-else>
        <section class="glass p-5">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-mono text-[13px] font-medium text-cyan-400">{{ selecionada.sigla }}</span>
            <span
              :class="[
                'rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                selecionada.modalidade === 'LINK'
                  ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
                  : 'border-slate-600/60 bg-slate-500/10 text-slate-300',
              ]"
            >
              {{ selecionada.modalidade === 'LINK' ? 'Coleta automática' : 'Upload' }}
            </span>
            <StatusBadge :status="selecionada.status" />
            <span class="text-[12px] text-slate-500">· {{ selecionada.orgao }}</span>
            <BaseButton class="ml-auto" variante="fantasma" tamanho="sm" @click="editarFonte(selecionada)">
              <AppIcon nome="lapis" class="h-3.5 w-3.5" />
              Editar
            </BaseButton>
          </div>
          <h1 class="mt-2 font-display text-lg font-semibold text-white">{{ selecionada.nome }}</h1>

          <dl class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div v-for="m in metaFonte" :key="m.rotulo">
              <dt class="text-[11px] font-medium text-slate-500">{{ m.rotulo }}</dt>
              <dd class="mt-0.5 text-[13px] text-slate-200">{{ m.valor }}</dd>
            </div>
          </dl>

          <div
            v-if="alertaFonte && aba !== 'mapeamento'"
            class="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5"
          >
            <AppIcon nome="alerta" class="h-4 w-4 shrink-0 text-amber-300" />
            <p class="flex-1 text-[13px] text-amber-100">{{ alertaFonte }}</p>
            <BaseButton variante="fantasma" tamanho="sm" @click="irParaAba('mapeamento')">Resolver</BaseButton>
          </div>
        </section>

        <div class="flex flex-wrap gap-1 rounded-xl border border-slate-800 bg-slate-950/40 p-1" role="tablist">
          <button
            v-for="a in abas"
            :key="a.id"
            type="button"
            role="tab"
            :aria-selected="aba === a.id"
            :class="[
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition',
              aba === a.id ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200',
            ]"
            @click="irParaAba(a.id)"
          >
            {{ a.rotulo }}
            <span v-if="a.contagem !== undefined" class="text-slate-500">{{ a.contagem }}</span>
            <span
              v-if="a.semRegra"
              class="text-[11px] text-slate-500"
              :title="`${a.semRegra} coluna(s) sem mapeamento`"
            >· {{ a.semRegra }} sem regra</span>
          </button>
        </div>

        <!-- Aba: Recebimento -->
        <template v-if="aba === 'recebimento'">
          <RecebimentoLink
            v-if="selecionada.modalidade === 'LINK'"
            :fonte="selecionada"
            :executando="executandoId === selecionada.id"
            :testando="testando"
            :teste="teste"
            :erro-teste="erroTeste"
            @executar="executar(selecionada)"
            @testar="testarLinkDaFonte"
          />
          <section v-else class="glass space-y-4 p-5">
            <div>
              <h2 class="text-sm font-semibold text-white">Enviar arquivo</h2>
              <p class="mt-1 max-w-2xl text-[13px] text-slate-400">
                O arquivo original é guardado sem nenhuma alteração na zona bruta, com um hash que
                prova a integridade e o carimbo de data e hora do recebimento.
              </p>
            </div>
            <FonteUpload
              ref="uploadRef"
              :fonte="selecionada"
              :enviando="enviando"
              :progresso="progresso"
              @enviar="enviar"
            />
          </section>
        </template>

        <!-- Aba: Arquivos recebidos -->
        <section v-else-if="aba === 'arquivos'" class="glass p-5">
          <ArquivoList
            :fonte="selecionada"
            :em-processamento="emProcessamento"
            :resultados="resultados"
            :excluindo="excluindo"
            @processar="processar"
            @excluir="excluir"
            @mapear="irParaAba('mapeamento')"
          />
        </section>

        <!-- Aba: Mapeamento -->
        <section v-else class="glass p-5">
          <p class="mb-4 max-w-3xl text-[13px] text-slate-400">
            O mapeamento diz <b class="font-medium text-slate-200">de qual coluna do arquivo vem cada
            campo</b> da zona tratada e <b class="font-medium text-slate-200">que regras ele precisa
            cumprir</b>. É o que permite receber dados de órgãos diferentes, cada um com seu formato.
            Registro que não cumpre uma regra vai para a quarentena.
          </p>
          <MapeamentoPainel
            :fonte="selecionada"
            :ativo="aba === 'mapeamento'"
            @alterado="contarNovas(selecionada.id)"
          />
        </section>
      </template>
    </template>

    <!-- Cadastro de fonte: gaveta lateral -->
    <BaseGaveta
      :aberto="mostrandoForm"
      sobre="Fontes de dados"
      :titulo="emEdicao ? `Editar ${emEdicao.sigla}` : 'Nova fonte de dados'"
      @fechar="fecharForm"
    >
      <FonteForm
        ref="formRef"
        :fonte="emEdicao"
        :salvando="salvando"
        :testando="testando"
        :teste="teste"
        :erro-teste="erroTeste"
        @salvar="salvarFonte"
        @testar-link="testarLinkDoFormulario"
        @limpar-teste="limparTeste"
        @cancelar="fecharForm"
      />
    </BaseGaveta>
  </div>
</template>
