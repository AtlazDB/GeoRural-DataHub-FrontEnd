
<script setup>
import { ref, onMounted } from 'vue'
import { buscarDashboard } from '@/services/dashboardService'

const dashboard = ref(null)
const carregando = ref(true)
const erro = ref('')

const cards = [
  {
    titulo: 'Fontes ativas',
    campo: 'fontesAtivas',
    descricao: 'Fontes cadastradas e ativas',
  },
  {
    titulo: 'Execuções recentes',
    campo: 'execucoesUltimos7Dias',
    descricao: 'Últimos 7 dias',
  },
  {
    titulo: 'Execuções com falha',
    campo: 'execucoesComFalha',
    descricao: 'Falhas nos últimos 7 dias',
  },
  {
    titulo: 'Na quarentena',
    campo: 'registrosQuarentena',
    descricao: 'Aguardando análise',
  },
  {
    titulo: 'Zona tratada',
    campo: 'registrosZonaTratada',
    descricao: 'Registros nas versões atuais',
  },
]

async function carregarDashboard() {
  carregando.value = true
  erro.value = ''

  try {
    dashboard.value = await buscarDashboard()
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

function exportarCSV() {
  if (!dashboard.value) return

  const resumo = dashboard.value.resumo ?? {}

  const linhas = [
    ['Indicador', 'Valor'],
    ['Fontes ativas', resumo.fontesAtivas ?? 0],
    ['Execuções nos últimos 7 dias', resumo.execucoesUltimos7Dias ?? 0],
    ['Execuções com falha', resumo.execucoesComFalha ?? 0],
    ['Registros na quarentena', resumo.registrosQuarentena ?? 0],
    ['Registros na zona tratada', resumo.registrosZonaTratada ?? 0],
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

    <!-- Introdução -->
    <section>
      <h2 class="text-lg font-semibold text-white">
        Visão geral da plataforma
      </h2>
      <p class="mt-1 text-sm text-slate-400">
        Acompanhe as fontes, execuções e processamento dos dados rurais.
      </p>
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

      <!-- Exportação -->
      <div class="flex justify-end">
        <button
          type="button"
          @click="exportarCSV"
          class="inline-flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-300 transition hover:border-cyan-400/50 hover:bg-cyan-500/20"
        >
          Exportar CSV
        </button>
      </div>

      <!-- Indicadores -->
      <section class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <article
          v-for="card in cards"
          :key="card.campo"
          class="rounded-xl border border-slate-800 bg-slate-900/60 p-5 transition hover:border-cyan-500/40"
        >
          <p class="text-sm font-medium text-slate-400">
            {{ card.titulo }}
          </p>

          <p class="mt-3 text-3xl font-semibold tracking-tight text-white">
            {{ dashboard.resumo?.[card.campo] ?? 0 }}
          </p>

          <p class="mt-2 text-xs text-slate-500">
            {{ card.descricao }}
          </p>
        </article>
      </section>

      <!-- Execuções recentes -->
      <section class="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">

        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
          <div>
            <h2 class="font-semibold text-white">
              Execuções recentes
            </h2>

            <p class="mt-1 text-xs text-slate-500">
              Últimas execuções registradas na plataforma.
            </p>
          </div>

          <span class="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-300">
            {{ dashboard.execucoesRecentes?.length ?? 0 }} registros
          </span>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="bg-slate-950/50 text-xs uppercase text-slate-500">
              <tr>
                <th class="px-5 py-4 font-medium">Fonte</th>
                <th class="px-5 py-4 font-medium">Tipo</th>
                <th class="px-5 py-4 font-medium">Status</th>
                <th class="px-5 py-4 font-medium">Lidos</th>
                <th class="px-5 py-4 font-medium">Válidos</th>
                <th class="px-5 py-4 font-medium">Inválidos</th>
                <th class="px-5 py-4 font-medium">Data</th>
              </tr>
            </thead>

            <tbody class="divide-y divide-slate-800">
              <tr
                v-for="(execucao, index) in dashboard.execucoesRecentes"
                :key="index"
                class="text-slate-300 transition hover:bg-slate-800/30"
              >
                <td class="px-5 py-4 font-medium text-white">
                  {{ execucao.fonte }}
                </td>

                <td class="px-5 py-4">
                  {{ execucao.tipo }}
                </td>

                <td class="px-5 py-4">
                  <span
                    :class="[
                      'rounded-full px-2.5 py-1 text-xs font-medium',
                      execucao.status === 'CONCLUIDA'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : execucao.status === 'FALHOU'
                          ? 'bg-red-500/10 text-red-400'
                          : 'bg-amber-500/10 text-amber-400',
                    ]"
                  >
                    {{ formatarStatus(execucao.status) }}
                  </span>
                </td>

                <td class="px-5 py-4">
                  {{ execucao.registrosLidos ?? 0 }}
                </td>

                <td class="px-5 py-4 text-emerald-400">
                  {{ execucao.registrosValidos ?? 0 }}
                </td>

                <td class="px-5 py-4 text-red-400">
                  {{ execucao.registrosInvalidos ?? 0 }}
                </td>

                <td class="whitespace-nowrap px-5 py-4 text-slate-400">
                  {{ formatarData(execucao.iniciadaEm) }}
                </td>
              </tr>

              <tr v-if="!dashboard.execucoesRecentes?.length">
                <td colspan="7" class="px-5 py-10 text-center text-slate-500">
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
