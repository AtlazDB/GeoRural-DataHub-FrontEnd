
<script setup>
import { ref, computed, onMounted } from 'vue'
import { buscarDashboard } from '@/services/dashboardService'
import { usuarioLogado } from '@/auth/keycloak'
import { listarFontes } from '@/services/fontesService'

const dashboard = ref(null)
const carregando = ref(true)
const erro = ref('')

const primeiroNome = (usuarioLogado()?.nome ?? '').trim().split(/\s+/)[0]

const saudacao = computed(() => {
  const hora = new Date().getHours()
  const periodo = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'
  return primeiroNome ? `${periodo}, ${primeiroNome}!` : `${periodo}!`
})

// Fontes por link (as que coletam sozinhas). Quem não tem acesso a /fontes só não vê o painel.
const fontes = ref([])
const fontesCarregadas = ref(false)

const fontesPorLink = computed(() =>
  fontes.value
    .filter((f) => f.status !== 'inativa' && f.modalidade === 'LINK')
    .sort((a, b) => new Date(b.ultimaColetaEm ?? 0) - new Date(a.ultimaColetaEm ?? 0)),
)

const cards = computed(() => {
  const resumo = dashboard.value?.resumo ?? {}
  const falhas = resumo.execucoesComFalha ?? 0
  const quarentena = resumo.registrosQuarentena ?? 0

  return [
    {
      titulo: 'Fontes ativas',
      valor: resumo.fontesAtivas ?? 0,
      descricao: fontes.value.length
        ? `${fontesPorLink.value.length} com coleta por link`
        : 'Fontes cadastradas e ativas',
      cor: 'text-white',
    },
    {
      titulo: 'Execuções com falha',
      valor: falhas,
      descricao: 'Nos últimos 7 dias',
      cor: falhas ? 'text-rose-400' : 'text-emerald-400',
    },
    {
      titulo: 'Na quarentena',
      valor: quarentena,
      descricao: 'Aguardando análise',
      cor: quarentena ? 'text-amber-300' : 'text-emerald-400',
    },
  ]
})

function coletaFalhou(fonte) {
  return /falhou/i.test(fonte.ultimaColetaMensagem ?? '')
}

async function carregarDashboard() {
  carregando.value = true
  erro.value = ''

  try {
    const [resumo, lista] = await Promise.all([
      buscarDashboard(),
      listarFontes().catch(() => null),
    ])
    dashboard.value = resumo
    fontesCarregadas.value = Array.isArray(lista)
    fontes.value = fontesCarregadas.value ? lista : []
  } catch (e) {
    erro.value = e.message
  } finally {
    carregando.value = false
  }
}

function formatarData(data) {
  if (!data) return '—'

  return new Date(data).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatarStatus(status) {
  const nomes = {
    CONCLUIDA: 'Concluída',
    FALHOU: 'Falhou',
    EM_ANDAMENTO: 'Em andamento',
  }

  return nomes[status] ?? status ?? '—'
}

const ESTILO_STATUS = {
  CONCLUIDA: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  FALHOU: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
  EM_ANDAMENTO: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
}

function estiloStatus(status) {
  return ESTILO_STATUS[status] ?? 'border-slate-600 bg-slate-800/60 text-slate-300'
}

function formatarOrigem(origem) {
  return { UPLOAD: 'Upload', COLETA: 'Coleta por link' }[origem] ?? origem ?? '—'
}

// "04/10 02:00": o modelo da tabela mostra só dia, mês e hora.
function formatarInicio(data) {
  if (!data) return '—'
  const d = new Date(data)
  const dia = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${dia} ${hora}`
}

function formatarNumero(valor) {
  return valor == null ? '—' : Number(valor).toLocaleString('pt-BR')
}

function exportarCSV() {
  if (!dashboard.value) return

  const resumo = dashboard.value.resumo ?? {}

  const linhas = [
    ['Indicador', 'Valor'],
    ['Fontes ativas', resumo.fontesAtivas ?? 0],
    ['Execuções com falha', resumo.execucoesComFalha ?? 0],
    ['Registros na quarentena', resumo.registrosQuarentena ?? 0],
    [],
    [
      'Fonte',
      'Tipo',
      'Status',
      'Registros lidos',
      'Registros válidos',
      'Registros inválidos',
      'Data da execução',
    ],
  ]

  ;(dashboard.value.execucoesRecentes ?? []).forEach((execucao) => {
    linhas.push([
      execucao.fonte,
      execucao.tipo,
      formatarStatus(execucao.status),
      execucao.registrosLidos ?? 0,
      execucao.registrosValidos ?? 0,
      execucao.registrosInvalidos ?? 0,
      formatarData(execucao.iniciadaEm),
    ])
  })

  const csv = linhas
    .map((linha) =>
      linha
        .map((valor) => `"${String(valor ?? '').replace(/"/g, '""')}"`)
        .join(';'),
    )
    .join('\r\n')

  const blob = new Blob(['\uFEFF' + csv], {
    type: 'text/csv;charset=utf-8;',
  })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = 'dashboard-georural.csv'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

onMounted(carregarDashboard)
</script>

<template>
  <main class="space-y-7 p-4 md:p-7">

    <!-- Saudação e exportação -->
    <section class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 class="text-2xl font-semibold text-white">
          {{ saudacao }}
        </h2>
        <p class="mt-1 text-sm text-slate-400">
          Acompanhe as fontes, execuções e processamento dos dados rurais.
        </p>
      </div>

      <button
        v-if="dashboard"
        type="button"
        @click="exportarCSV"
        class="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-cyan-500 to-teal-400 px-3 py-1.5 text-xs font-semibold text-slate-950 shadow-md shadow-cyan-500/20 transition hover:-translate-y-0.5 hover:shadow-cyan-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
      >
        <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 3v12" />
          <path d="m7 10 5 5 5-5" />
          <path d="M5 21h14" />
        </svg>
        Exportar CSV
      </button>
    </section>

    <!-- Carregamento -->
    <div
      v-if="carregando"
      class="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center text-slate-400"
    >
      Carregando informações do dashboard...
    </div>

    <!-- Erro -->
    <div
      v-else-if="erro"
      class="rounded-xl border border-red-500/30 bg-red-500/10 p-5"
    >
      <p class="font-medium text-red-300">
        Não foi possível carregar o dashboard.
      </p>

      <p class="mt-1 text-sm text-red-200">
        {{ erro }}
      </p>

      <button
        @click="carregarDashboard"
        class="mt-4 rounded-lg bg-red-500/20 px-4 py-2 text-sm text-red-200 hover:bg-red-500/30"
      >
        Tentar novamente
      </button>
    </div>

    <template v-else-if="dashboard">

      <!-- Indicadores -->
      <section class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <article
          v-for="card in cards"
          :key="card.titulo"
          class="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3.5 transition hover:border-cyan-500/40"
        >
          <p class="text-xs font-medium text-slate-400">
            {{ card.titulo }}
          </p>

          <p :class="['mt-1 text-2xl font-semibold tracking-tight', card.cor]">
            {{ card.valor.toLocaleString('pt-BR') }}
          </p>

          <p class="mt-1 text-xs text-slate-500">
            {{ card.descricao }}
          </p>
        </article>
      </section>

      <!-- Coletas automáticas (fontes por link) -->
      <section
        v-if="fontesCarregadas"
        class="rounded-xl border border-slate-800 bg-slate-900/60 p-5"
      >
        <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 class="font-semibold text-white">
            Coletas automáticas
          </h2>
          <RouterLink
            :to="{ name: 'importacao' }"
            class="text-xs font-medium text-cyan-300 hover:text-cyan-200"
          >
            Ver fontes →
          </RouterLink>
        </div>

        <p v-if="!fontesPorLink.length" class="rounded-lg border border-dashed border-slate-800 px-4 py-6 text-center text-sm text-slate-500">
          Nenhuma fonte ativa coleta por link ainda. Cadastre o link de origem na fonte para ela aparecer aqui.
        </p>

        <ul v-else class="grid grid-cols-1 gap-3 md:grid-cols-2">
          <li
            v-for="fonte in fontesPorLink"
            :key="fonte.id"
            class="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-3"
          >
            <svg
              :class="['h-4 w-4 shrink-0', coletaFalhou(fonte) ? 'text-rose-400' : 'text-cyan-400']"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>

            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-slate-100">
                {{ fonte.sigla }} — {{ fonte.nome }}
              </p>
              <p class="font-mono text-xs text-slate-500">
                {{ fonte.periodicidade || 'eventual' }}
              </p>
            </div>

            <p
              :class="[
                'shrink-0 text-right text-xs',
                coletaFalhou(fonte) ? 'text-rose-300' : fonte.ultimaColetaEm ? 'text-slate-300' : 'text-slate-500',
              ]"
            >
              <template v-if="fonte.ultimaColetaEm">
                {{ formatarData(fonte.ultimaColetaEm) }}
                <span v-if="coletaFalhou(fonte)" class="block">falhou</span>
              </template>
              <template v-else>ainda sem coleta</template>
            </p>
          </li>
        </ul>
      </section>

      <!-- Execuções recentes -->
      <section class="rounded-xl border border-slate-800 bg-slate-900/60 p-5">

        <h2 class="mb-4 font-semibold text-white">
          Execuções recentes
        </h2>

        <div class="overflow-x-auto rounded-lg border border-slate-800">
          <table class="w-full text-center text-sm">
            <thead class="bg-slate-950/50 text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th class="px-4 py-3 text-left font-medium">Fonte</th>
                <th class="px-4 py-3 font-medium">Origem</th>
                <th class="px-4 py-3 font-medium">Início</th>
                <th class="px-4 py-3 font-medium">Registros</th>
                <th class="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>

            <tbody class="divide-y divide-slate-800">
              <tr
                v-for="(execucao, index) in dashboard.execucoesRecentes"
                :key="execucao.id ?? index"
                class="text-slate-300 transition hover:bg-slate-800/30"
              >
                <td class="px-4 py-3.5 text-left text-slate-100">
                  {{ execucao.sigla ? `${execucao.sigla} — ${execucao.fonte}` : execucao.fonte }}
                </td>

                <td class="px-4 py-3.5 text-xs text-slate-400">
                  {{ formatarOrigem(execucao.origem) }}
                </td>

                <td class="whitespace-nowrap px-4 py-3.5 font-mono text-xs text-slate-300">
                  {{ formatarInicio(execucao.iniciadaEm) }}
                </td>

                <td
                  class="px-4 py-3.5 tabular-nums text-slate-100"
                  :title="`Lidos: ${formatarNumero(execucao.registrosLidos)} · Inválidos: ${formatarNumero(execucao.registrosInvalidos)}`"
                >
                  {{ execucao.registrosValidos ? formatarNumero(execucao.registrosValidos) : '—' }}
                </td>

                <td class="px-4 py-3.5">
                  <span
                    :class="[
                      'inline-block whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase',
                      estiloStatus(execucao.status),
                    ]"
                  >
                    {{ formatarStatus(execucao.status) }}
                  </span>
                </td>
              </tr>

              <tr v-if="!dashboard.execucoesRecentes?.length">
                <td colspan="5" class="px-4 py-10 text-center text-slate-500">
                  Nenhuma execução encontrada.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

    </template>
  </main>
</template>
