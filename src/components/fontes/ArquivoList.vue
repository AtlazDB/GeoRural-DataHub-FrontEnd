<script setup>
import BaseButton from '@/components/BaseButton.vue'
import AppIcon from '@/components/AppIcon.vue'
import { formatarTamanho, formatarDataHora } from '@/utils/formato'
import { ehProcessavel } from '@/utils/processamento'

/**
 * Arquivos recebidos de uma fonte, com o status do processamento.
 *
 * Componente de apresentação, como o FonteList: não chama o service.
 * Os botões "Processar" e "Excluir" só emitem 'processar' / 'excluir' —
 * quem faz a chamada é a ImportacaoView. "Mapear colunas" (arquivo esperando o
 * mapeamento) emite 'mapear', e a página da fonte abre a aba Mapeamento.
 *
 * O `status` do arquivo (RECEBIDO → AGUARDANDO_MAPEAMENTO → PROCESSANDO → PROCESSADO | REJEITADO)
 * não é o `status` da fonte (ativa | pendente | inativa). No mock o
 * arquivo vem sem status; aí a etiqueta simplesmente não aparece.
 */
const props = defineProps({
  fonte: { type: Object, required: true },
  /** ids que a tela mandou processar e ainda não responderam */
  emProcessamento: { type: Array, default: () => [] },
  /** resultado do último processamento, por id: { tipo: 'ok' | 'erro', texto } */
  resultados: { type: Object, default: () => ({}) },
  /** ids com exclusão em andamento (o botão fica em "carregando") */
  excluindo: { type: Array, default: () => [] },
})

defineEmits(['processar', 'excluir', 'mapear'])

const etiquetas = {
  AGUARDANDO_MAPEAMENTO: {
    rotulo: 'Aguardando mapeamento',
    classe: 'text-amber-300 bg-amber-500/10 border-amber-500/40',
  },
  RECEBIDO: { rotulo: 'Recebido', classe: 'text-slate-300 bg-slate-500/10 border-slate-500/40' },
  PROCESSANDO: {
    rotulo: 'Processando',
    classe: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/40 animate-pulse',
  },
  PROCESSADO: {
    rotulo: 'Processado',
    classe: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/40',
  },
  REJEITADO: { rotulo: 'Rejeitado', classe: 'text-rose-300 bg-rose-500/10 border-rose-500/40' },
}

// Assim que a tela manda processar, o arquivo já aparece como PROCESSANDO,
// sem esperar a próxima consulta à API.
function statusDe(arquivo) {
  return props.emProcessamento.includes(arquivo.id) ? 'PROCESSANDO' : arquivo.status
}

function podeProcessar(arquivo) {
  return (
    ehProcessavel(arquivo) &&
    ['RECEBIDO', 'AGUARDANDO_MAPEAMENTO', 'REJEITADO'].includes(statusDe(arquivo))
  )
}

// O back-end também recusa (409) rejeitado que já gerou versão de dados —
// raro (processado, depois falhou num reprocessamento); a mensagem vem pronta.
function podeExcluir(arquivo) {
  return statusDe(arquivo) === 'REJEITADO'
}
</script>

<template>
  <div
    v-if="!fonte.arquivos?.length"
    class="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400"
  >
    Nenhum arquivo recebido para esta fonte.
  </div>

  <ul v-else class="divide-y divide-slate-800/80">
    <li v-for="arquivo in fonte.arquivos" :key="arquivo.id" class="py-3 first:pt-0 last:pb-0">
      <div class="flex items-center gap-3">
        <AppIcon nome="arquivo" traco="1.8" class="h-4 w-4 shrink-0 text-slate-500" />

        <div class="min-w-0 flex-1">
          <p class="truncate text-sm text-slate-200">{{ arquivo.nome }}</p>
          <p class="font-mono text-[11px] text-slate-500">
            {{ formatarTamanho(arquivo.tamanho) }} · {{ formatarDataHora(arquivo.enviadoEm) }}
            <template v-if="arquivo.origem"> · {{ arquivo.origem === 'COLETA' ? 'Coleta' : 'Upload' }}</template>
          </p>
        </div>

        <span
          v-if="etiquetas[statusDe(arquivo)]"
          :class="[
            'shrink-0 rounded-full border px-2 py-0.5 whitespace-nowrap',
            'text-[10px] font-semibold uppercase tracking-wide',
            etiquetas[statusDe(arquivo)].classe,
          ]"
        >
          {{ etiquetas[statusDe(arquivo)].rotulo }}
        </span>

        <BaseButton
          v-if="statusDe(arquivo) === 'AGUARDANDO_MAPEAMENTO'"
          variante="secundario"
          tamanho="sm"
          class="shrink-0"
          @click="$emit('mapear', arquivo)"
        >
          Mapear colunas
        </BaseButton>

        <BaseButton
          v-if="podeProcessar(arquivo)"
          variante="secundario"
          tamanho="sm"
          class="shrink-0"
          @click="$emit('processar', arquivo)"
        >
          <AppIcon nome="executar" traco="2.2" class="h-3 w-3" />
          Processar
        </BaseButton>

        <BaseButton
          v-if="podeExcluir(arquivo)"
          variante="fantasma"
          tamanho="sm"
          class="shrink-0 text-rose-300 hover:text-rose-200"
          :carregando="excluindo.includes(arquivo.id)"
          @click="$emit('excluir', arquivo)"
        >
          <AppIcon v-if="!excluindo.includes(arquivo.id)" nome="lixeira" traco="2" class="h-3 w-3" />
          Excluir
        </BaseButton>
      </div>

      <p
        v-if="resultados[arquivo.id]"
        :class="[
          'mt-1.5 pl-7 text-xs',
          resultados[arquivo.id].tipo === 'ok' ? 'text-emerald-300/90' : 'text-rose-300/90',
        ]"
      >
        {{ resultados[arquivo.id].texto }}
      </p>
    </li>
  </ul>
</template>