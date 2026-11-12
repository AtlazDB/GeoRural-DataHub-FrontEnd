<script setup>
import { computed, onMounted, onBeforeUnmount, reactive, ref, watch } from 'vue'
import BaseCard from '@/components/BaseCard.vue'
import BaseButton from '@/components/BaseButton.vue'
import BaseGaveta from '@/components/BaseGaveta.vue'
import AnaliseRegistro from '@/components/quarentena/AnaliseRegistro.vue'
import { listarFontes } from '@/services/fontesService'
import {
  listarQuarentena,
  buscarMetricas,
  buscarRegistro,
  buscarGeometria,
  buscarGeometriaCorrigida,
  salvarGeometriaCorrigida,
  iniciarAnalise,
  corrigir,
  revalidar,
  descartar,
} from '@/services/quarentenaService'
import { formatarNumero } from '@/utils/formato'
import { usePermissoes } from '@/composables/usePermissoes'
import {
  FAMILIAS,
  TIPOS_ERRO,
  STATUS,
  ENCERRADOS,
  nomeErro,
  nomeEntidade,
  formatarPayload,
} from '@/utils/quarentena'

const TAMANHO = 20

// Só quem opera os dados analisa, corrige e descarta; os demais perfis só consultam.
const { podeOperar } = usePermissoes()

const metricas = ref({})
const registros = ref([])
const total = ref(0)
const totalPaginas = ref(1)
const pagina = ref(1)
const carregando = ref(false)
const erro = ref(null)
const fontes = ref([])
const filtros = reactive({ texto: '', tipoErro: '', status: '', fonteId: '' })

const aviso = ref(null)
let timerAviso = null

let consulta = 0
let timerBusca = null

const KPIS = [
  { status: '', rotulo: 'Total retido', campo: 'total', cor: 'text-white' },
  { status: 'PENDENTE', rotulo: 'Pendentes', campo: 'pendentes', cor: 'text-amber-300' },
  { status: 'EM_ANALISE', rotulo: 'Em análise', campo: 'emAnalise', cor: 'text-cyan-300' },
  { status: 'CORRIGIDO', rotulo: 'Corrigidos', campo: 'corrigidos', cor: 'text-indigo-300' },
  { status: 'REVALIDADO', rotulo: 'Revalidados', campo: 'revalidados', cor: 'text-emerald-300' },
  { status: 'DESCARTADO', rotulo: 'Descartados', campo: 'descartados', cor: 'text-slate-300' },
]

const tiposPorFamilia = computed(() =>
  FAMILIAS.map((familia) => ({
    familia,
    tipos: Object.entries(TIPOS_ERRO).filter(([, t]) => t.familia === familia),
  })),
)

const temFiltro = computed(() => Object.values(filtros).some(Boolean))

function mostrarAviso(texto, tipo = 'ok') {
  aviso.value = { texto, tipo }
  clearTimeout(timerAviso)
  timerAviso = setTimeout(() => (aviso.value = null), 5000)
}

async function carregarRegistros() {
  const minha = ++consulta
  carregando.value = true
  erro.value = null
  try {
    const dados = await listarQuarentena({ ...filtros, pagina: pagina.value, tamanho: TAMANHO })
    if (minha !== consulta) return
    registros.value = dados.content
    total.value = dados.totalElements
    totalPaginas.value = Math.max(dados.totalPages, 1)
  } catch (e) {
    if (minha === consulta) erro.value = e.message
  } finally {
    if (minha === consulta) carregando.value = false
  }
}

async function carregarMetricas() {
  try {
    metricas.value = await buscarMetricas()
  } catch {
    // a lista já mostra o erro
  }
}

function atualizarTudo() {
  carregarRegistros()
  carregarMetricas()
}

function filtrarStatus(status) {
  filtros.status = filtros.status === status ? '' : status
}

function limparFiltros() {
  Object.assign(filtros, { texto: '', tipoErro: '', status: '', fonteId: '' })
}

function mudarPagina(nova) {
  pagina.value = nova
  carregarRegistros()
}

watch(
  () => filtros.texto,
  () => {
    clearTimeout(timerBusca)
    timerBusca = setTimeout(() => {
      pagina.value = 1
      carregarRegistros()
    }, 350)
  },
)
watch(
  () => [filtros.tipoErro, filtros.status, filtros.fonteId],
  () => {
    pagina.value = 1
    carregarRegistros()
  },
)

const gaveta = reactive({
  aberta: false,
  registro: null,
  geometria: null,
  geometriaCorrigida: null,
  carregandoGeometria: false,
  revalidacao: null,
  payload: '',
  justificativa: '',
  ocupado: '',
  erro: null,
})

const encerrado = computed(() => ENCERRADOS.includes(gaveta.registro?.statusAnalise))

async function abrir(id) {
  Object.assign(gaveta, {
    aberta: true,
    registro: registros.value.find((r) => r.id === id) ?? null,
    geometria: null,
    geometriaCorrigida: null,
    carregandoGeometria: true,
    revalidacao: null,
    payload: '',
    justificativa: '',
    ocupado: '',
    erro: null,
  })
  try {
    const [registro, geometria, geometriaCorrigida] = await Promise.all([
      buscarRegistro(id),
      buscarGeometria(id),
      buscarGeometriaCorrigida(id),
    ])
    gaveta.registro = registro
    gaveta.geometria = geometria
    gaveta.geometriaCorrigida = geometriaCorrigida
  } catch (e) {
    gaveta.erro = e.message
  } finally {
    gaveta.carregandoGeometria = false
  }
}

function fechar() {
  gaveta.aberta = false
}

async function executar(acao, fn) {
  gaveta.ocupado = acao
  gaveta.erro = null
  try {
    await fn()
    atualizarTudo()
  } catch (e) {
    gaveta.erro = e.message
  } finally {
    gaveta.ocupado = ''
  }
}

function payloadValido() {
  try {
    const json = JSON.parse(gaveta.payload)
    if (json && typeof json === 'object' && !Array.isArray(json)) return true
  } catch {
    // tratado abaixo
  }
  gaveta.erro = 'A correção precisa ser um objeto JSON válido, como o dado original.'
  return false
}

function correcaoPendente() {
  if (!gaveta.payload.trim()) return false
  return gaveta.payload.trim() !== formatarPayload(gaveta.registro.payloadCorrigido).trim()
}

function aoIniciar() {
  executar('iniciar', async () => {
    gaveta.registro = await iniciarAnalise(gaveta.registro.id)
  })
}

function aoSalvarCorrecao() {
  if (!payloadValido()) return
  executar('corrigir', async () => {
    gaveta.registro = await corrigir(gaveta.registro.id, gaveta.payload, gaveta.justificativa || undefined)
    mostrarAviso('Correção salva. Falta revalidar para gravar na zona tratada.')
  })
}

// Se o Oracle recusar, o motivo aparece no rodapé e a edição continua no mapa.
function aoSalvarGeometria(geometria) {
  executar('geometria', async () => {
    gaveta.registro = await salvarGeometriaCorrigida(gaveta.registro.id, geometria, gaveta.justificativa || undefined)
    gaveta.geometriaCorrigida = geometria
    mostrarAviso('Geometria salva. Falta revalidar para gravar na zona tratada.')
  })
}

function aoRevalidar() {
  if (correcaoPendente() && !payloadValido()) return
  executar('revalidar', async () => {
    if (correcaoPendente()) {
      gaveta.registro = await corrigir(gaveta.registro.id, gaveta.payload, gaveta.justificativa || undefined)
    }
    const resposta = await revalidar(gaveta.registro.id)
    gaveta.registro = resposta.quarantine ?? gaveta.registro
    if (resposta.status === 'APROVADO') {
      fechar()
      mostrarAviso('Revalidado: passou em todas as regras e foi gravado na zona tratada.')
    } else {
      gaveta.revalidacao = resposta
    }
  })
}

function aoDescartar() {
  if (!gaveta.justificativa.trim()) {
    gaveta.erro = 'Escreva o motivo antes de descartar.'
    return
  }
  executar('descartar', async () => {
    await descartar(gaveta.registro.id, gaveta.justificativa.trim())
    fechar()
    mostrarAviso('Registro descartado com justificativa.')
  })
}

onMounted(async () => {
  atualizarTudo()
  try {
    fontes.value = await listarFontes()
  } catch {
    // o filtro de fonte fica vazio
  }
})

onBeforeUnmount(() => {
  clearTimeout(timerBusca)
  clearTimeout(timerAviso)
})
</script>

<template>
  <div class="space-y-5">
    <BaseCard
      descricao="Registros que não cumpriram alguma regra do mapeamento. O dado original na zona bruta nunca é alterado: a correção é guardada à parte e validada de novo antes de ir para a zona tratada."
    >
      <div class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <button
          v-for="k in KPIS"
          :key="k.rotulo"
          type="button"
          :class="[
            'rounded-xl border p-3.5 text-left transition',
            filtros.status === k.status && (k.status || !temFiltro)
              ? 'border-cyan-500/50 bg-cyan-500/10'
              : 'border-slate-800 bg-slate-950/40 hover:border-slate-600',
          ]"
          @click="k.status ? filtrarStatus(k.status) : limparFiltros()"
        >
          <p class="text-[11px] text-slate-400">{{ k.rotulo }}</p>
          <p :class="['mt-1 font-display text-2xl font-semibold tabular-nums', k.cor]">
            {{ formatarNumero(metricas[k.campo] ?? 0) }}
          </p>
        </button>
      </div>
    </BaseCard>

    <div
      v-if="aviso"
      :class="[
        'rounded-xl border px-4 py-2.5 text-sm',
        aviso.tipo === 'erro'
          ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
          : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
      ]"
    >
      {{ aviso.texto }}
    </div>

    <BaseCard>
      <div class="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr_1fr_auto] xl:items-end">
        <div>
          <label class="label" for="q-texto">Buscar</label>
          <input id="q-texto" v-model="filtros.texto" class="input font-mono" placeholder="Código, campo ou motivo" />
        </div>
        <div>
          <label class="label" for="q-tipo">Tipo de erro</label>
          <select id="q-tipo" v-model="filtros.tipoErro" class="input">
            <option value="">Todos</option>
            <optgroup v-for="g in tiposPorFamilia" :key="g.familia" :label="g.familia">
              <option v-for="[codigo, t] in g.tipos" :key="codigo" :value="codigo">{{ t.nome }}</option>
            </optgroup>
          </select>
        </div>
        <div>
          <label class="label" for="q-fonte">Fonte</label>
          <select id="q-fonte" v-model="filtros.fonteId" class="input">
            <option value="">Todas as fontes</option>
            <option v-for="f in fontes" :key="f.id" :value="f.id">{{ f.nome }}</option>
          </select>
        </div>
        <div>
          <label class="label" for="q-status">Status</label>
          <select id="q-status" v-model="filtros.status" class="input">
            <option value="">Todos</option>
            <option v-for="(s, codigo) in STATUS" :key="codigo" :value="codigo">{{ s.rotulo }}</option>
          </select>
        </div>
        <BaseButton variante="fantasma" :disabled="!temFiltro" @click="limparFiltros">Limpar</BaseButton>
      </div>

      <div v-if="erro" class="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-300">
        {{ erro }}
        <button type="button" class="ml-2 underline hover:text-rose-200" @click="carregarRegistros">Tentar de novo</button>
      </div>

      <div v-else class="overflow-x-auto rounded-xl border border-slate-800">
        <table class="w-full min-w-[880px] text-left text-sm">
          <thead class="bg-slate-900/80">
            <tr class="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
              <th class="px-3 py-2.5">Registro</th>
              <th class="px-3 py-2.5">Erro</th>
              <th class="px-3 py-2.5">Campo e motivo</th>
              <th class="px-3 py-2.5">Origem</th>
              <th class="px-3 py-2.5">Status</th>
              <th class="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody :class="['divide-y divide-slate-800/80 transition-opacity', carregando && 'opacity-50']">
            <tr v-for="r in registros" :key="r.id" class="text-slate-300 hover:bg-slate-800/30">
              <td class="max-w-[230px] px-3 py-2.5 align-top">
                <p class="font-mono text-[11px] text-slate-500">#{{ r.id }} · {{ nomeEntidade(r.entidade) }}</p>
                <p class="truncate font-mono text-[12px] text-cyan-400" :title="r.chaveNatural">{{ r.chaveNatural || '—' }}</p>
              </td>
              <td class="px-3 py-2.5 align-top">
                <p class="text-[12.5px] text-slate-200">{{ nomeErro(r.tipoErro) }}</p>
                <p class="text-[11px] text-slate-500">{{ TIPOS_ERRO[r.tipoErro]?.familia ?? '—' }}</p>
              </td>
              <td class="max-w-[320px] px-3 py-2.5 align-top">
                <p class="font-mono text-[11px] text-slate-500">{{ r.campo || '—' }}</p>
                <p class="truncate text-[12.5px]" :title="r.motivo">{{ r.motivo }}</p>
              </td>
              <td class="px-3 py-2.5 align-top font-mono text-[11px] text-slate-500">
                execução #{{ r.execucaoId }}<br />
                <span v-if="r.numeroLinha">linha {{ formatarNumero(r.numeroLinha) }}</span>
              </td>
              <td class="px-3 py-2.5 align-top">
                <span
                  :class="[
                    'whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                    (STATUS[r.statusAnalise] ?? STATUS.PENDENTE).classe,
                  ]"
                >
                  {{ (STATUS[r.statusAnalise] ?? STATUS.PENDENTE).rotulo }}
                </span>
              </td>
              <td class="px-3 py-2.5 text-right align-top">
                <BaseButton variante="fantasma" tamanho="sm" @click="abrir(r.id)">{{ podeOperar ? 'Analisar' : 'Ver' }}</BaseButton>
              </td>
            </tr>
            <tr v-if="!registros.length && !carregando">
              <td colspan="6" class="px-3 py-10 text-center text-slate-500">
                {{ temFiltro ? 'Nenhum registro com esse filtro.' : 'Nada na quarentena. Todos os registros passaram nas regras.' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="total > TAMANHO" class="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-slate-400">
        <span>{{ formatarNumero(total) }} registros</span>
        <div class="flex items-center gap-2">
          <BaseButton variante="fantasma" tamanho="sm" :disabled="carregando || pagina <= 1" @click="mudarPagina(pagina - 1)">
            Anterior
          </BaseButton>
          <span>Página {{ formatarNumero(pagina) }} de {{ formatarNumero(totalPaginas) }}</span>
          <BaseButton
            variante="fantasma"
            tamanho="sm"
            :disabled="carregando || pagina >= totalPaginas"
            @click="mudarPagina(pagina + 1)"
          >
            Próxima
          </BaseButton>
        </div>
      </div>
    </BaseCard>

    <BaseCard
      titulo="Os tipos de erro que a validação encontra"
      descricao="Cada regra marcada no mapeamento corresponde a um tipo de erro. Estão agrupados em três famílias."
    >
      <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div v-for="g in tiposPorFamilia" :key="g.familia" class="rounded-xl border border-slate-800 bg-slate-950/40 p-3.5">
          <p class="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">{{ g.familia }}</p>
          <ul class="space-y-2.5">
            <li v-for="[codigo, t] in g.tipos" :key="codigo">
              <p class="text-[12.5px] font-medium text-slate-200">
                {{ t.nome }} <span class="font-mono text-[10px] font-normal text-slate-500">{{ codigo }}</span>
              </p>
              <p class="text-[11.5px] leading-relaxed text-slate-400">{{ t.explica }}</p>
            </li>
          </ul>
        </div>
      </div>
    </BaseCard>

    <BaseGaveta
      :aberto="gaveta.aberta"
      :titulo="gaveta.registro?.chaveNatural || `Registro #${gaveta.registro?.id ?? ''}`"
      :sobre="gaveta.registro ? `#${gaveta.registro.id} · ${nomeEntidade(gaveta.registro.entidade)} · execução #${gaveta.registro.execucaoId}` : ''"
      @fechar="fechar"
    >
      <AnaliseRegistro
        v-if="gaveta.registro"
        v-model:payload="gaveta.payload"
        v-model:justificativa="gaveta.justificativa"
        :registro="gaveta.registro"
        :geometria="gaveta.geometria"
        :geometria-corrigida="gaveta.geometriaCorrigida"
        :carregando-geometria="gaveta.carregandoGeometria"
        :revalidacao="gaveta.revalidacao"
        :salvando-geometria="gaveta.ocupado === 'geometria'"
        @salvar-geometria="aoSalvarGeometria"
      />

      <template #rodape>
        <p v-if="gaveta.erro" class="mr-auto max-w-md text-[12px] text-rose-300">{{ gaveta.erro }}</p>
        <template v-if="encerrado || !podeOperar">
          <p v-if="!gaveta.erro" class="mr-auto text-[12px] text-slate-500">
            {{
              encerrado
                ? 'Registro encerrado. O histórico fica guardado para auditoria.'
                : 'Somente leitura: a análise e a correção são feitas pelo operador de dados.'
            }}
          </p>
          <BaseButton variante="fantasma" @click="fechar">Fechar</BaseButton>
        </template>
        <template v-else-if="gaveta.registro">
          <BaseButton v-if="!gaveta.erro" variante="fantasma" class="mr-auto" @click="fechar">Fechar</BaseButton>
          <BaseButton
            v-if="gaveta.registro.statusAnalise === 'PENDENTE'"
            variante="secundario"
            :carregando="gaveta.ocupado === 'iniciar'"
            :disabled="!!gaveta.ocupado"
            @click="aoIniciar"
          >
            Iniciar análise
          </BaseButton>
          <BaseButton
            v-if="gaveta.payload"
            variante="secundario"
            :carregando="gaveta.ocupado === 'corrigir'"
            :disabled="!!gaveta.ocupado"
            @click="aoSalvarCorrecao"
          >
            Salvar correção
          </BaseButton>
          <button
            type="button"
            :disabled="!!gaveta.ocupado"
            class="inline-flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2.5
                   text-sm font-medium text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            @click="aoDescartar"
          >
            <span
              v-if="gaveta.ocupado === 'descartar'"
              class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
            />
            Descartar
          </button>
          <BaseButton :carregando="gaveta.ocupado === 'revalidar'" :disabled="!!gaveta.ocupado" @click="aoRevalidar">
            Revalidar e aprovar
          </BaseButton>
        </template>
      </template>
    </BaseGaveta>
  </div>
</template>