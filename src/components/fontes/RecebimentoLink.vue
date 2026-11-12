<script setup>
import { computed } from 'vue'
import BaseButton from '@/components/BaseButton.vue'
import AppIcon from '@/components/AppIcon.vue'
import { formatarDataHora, formatarNumero } from '@/utils/formato'
import { usePermissoes } from '@/composables/usePermissoes'

/**
 * Aba "Recebimento" de uma fonte por link (modalidade LINK): o link, como a
 * coleta anda e os botões "Executar agora" e "Testar link".
 *
 * Componente de apresentação: emite 'executar' e 'testar', e quem conversa
 * com o service é a ImportacaoView, que devolve o resultado do teste pelas
 * props `teste` / `erroTeste`.
 */
const props = defineProps({
  fonte: { type: Object, required: true },
  /** "Executar agora" em andamento (só a chamada; a coleta em si é fonte.coletando) */
  executando: { type: Boolean, default: false },
  testando: { type: Boolean, default: false },
  /** resposta do "Testar link": { mensagem, total, limitePorPedido, colunas, avisos } */
  teste: { type: Object, default: null },
  erroTeste: { type: String, default: '' },
})

defineEmits(['executar', 'testar'])

const { podeOperar } = usePermissoes()

const falhou = computed(() => /falhou/i.test(props.fonte.ultimaColetaMensagem ?? ''))

const caixas = computed(() => [
  {
    rotulo: 'Periodicidade',
    valor: props.fonte.periodicidade || '—',
    detalhe: 'coleta pelo agendador (Airflow)',
  },
  {
    rotulo: 'Última coleta',
    valor: props.fonte.coletando
      ? 'em andamento'
      : props.fonte.ultimaColetaEm
        ? formatarDataHora(props.fonte.ultimaColetaEm)
        : 'nenhuma ainda',
    detalhe: props.fonte.coletando ? '' : falhou.value ? 'falhou · veja a mensagem abaixo' : '',
  },
  {
    rotulo: 'Paginação',
    valor: 'automática',
    detalhe: 'ArcGIS e WFS são lidos em páginas até o fim, conferindo o total',
  },
])
</script>

<template>
  <section class="glass space-y-4 p-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="max-w-2xl">
        <h2 class="text-sm font-semibold text-white">Coleta automática</h2>
        <p class="mt-1 text-[13px] text-slate-400">
          O sistema busca os dados no link do órgão e grava na zona bruta com hash. Se nada mudou
          desde a última coleta, a execução fica registrada como &ldquo;sem mudança&rdquo; e nada é
          reprocessado.
        </p>
      </div>
      <div v-if="podeOperar" class="flex shrink-0 items-center gap-2">
        <BaseButton
          variante="secundario"
          tamanho="sm"
          :carregando="testando"
          @click="$emit('testar')"
        >
          Testar link
        </BaseButton>
        <BaseButton
          tamanho="sm"
          :carregando="executando"
          :disabled="fonte.coletando"
          @click="$emit('executar')"
        >
          <AppIcon
            v-if="!executando"
            :nome="fonte.coletando ? 'atualizar' : 'executar'"
            traco="2.2"
            :class="['h-3.5 w-3.5', fonte.coletando ? 'animate-spin' : '']"
          />
          {{ fonte.coletando ? 'Coletando…' : 'Executar agora' }}
        </BaseButton>
      </div>
    </div>

    <div class="rounded-xl border border-slate-800 bg-slate-950/40 p-3.5">
      <p class="text-[11px] font-medium text-slate-500">Link de acesso</p>
      <p class="mt-1 flex items-start gap-2">
        <span
          class="shrink-0 rounded border border-indigo-500/40 bg-indigo-500/10 px-1.5 py-0.5
                 font-mono text-[10.5px] font-semibold text-indigo-300"
        >
          {{ fonte.metodoHttp || 'GET' }}
        </span>
        <span class="break-all font-mono text-[12px] text-slate-300">{{ fonte.urlOrigem }}</span>
      </p>
    </div>

    <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div v-for="c in caixas" :key="c.rotulo" class="rounded-xl border border-slate-800 bg-slate-950/40 p-3.5">
        <p class="text-[11px] font-medium text-slate-500">{{ c.rotulo }}</p>
        <p class="mt-1 text-[13px] text-slate-200">{{ c.valor }}</p>
        <p v-if="c.detalhe" class="font-mono text-[11px] text-slate-500">{{ c.detalhe }}</p>
      </div>
    </div>

    <!-- Andamento ou resultado da última coleta (escrito pela DAG coletar_fonte) -->
    <p
      v-if="fonte.ultimaColetaMensagem"
      :class="[
        'flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-[12.5px]',
        fonte.coletando
          ? 'border-cyan-500/30 bg-cyan-500/[0.06] text-cyan-200'
          : falhou
            ? 'border-rose-500/30 bg-rose-500/[0.06] text-rose-200'
            : 'border-slate-800 bg-slate-950/40 text-slate-300',
      ]"
    >
      <AppIcon
        :nome="fonte.coletando ? 'atualizar' : falhou ? 'alerta' : 'check'"
        traco="2.2"
        :class="['mt-0.5 h-3.5 w-3.5 shrink-0', fonte.coletando ? 'animate-spin' : '']"
      />
      {{ fonte.ultimaColetaMensagem }}
    </p>

    <!-- Resultado do "Testar link" -->
    <div
      v-if="erroTeste"
      class="rounded-xl border border-red-500/40 bg-red-500/10 px-3.5 py-2.5 text-[12.5px] text-red-300"
    >
      {{ erroTeste }}
    </div>
    <div
      v-else-if="teste"
      class="space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-3.5 text-[12.5px]"
    >
      <p class="font-medium text-emerald-300">{{ teste.mensagem }}</p>
      <p v-if="teste.limitePorPedido" class="text-slate-400">
        Até {{ formatarNumero(teste.limitePorPedido) }} registros por pedido: a coleta pagina até o fim.
      </p>
      <div v-if="teste.colunas?.length" class="flex flex-wrap gap-1">
        <span
          v-for="coluna in teste.colunas"
          :key="coluna"
          class="rounded-md border border-slate-700 bg-slate-950/60 px-1.5 py-0.5 font-mono text-[11px] text-slate-300"
        >
          {{ coluna }}
        </span>
      </div>
      <p
        v-for="aviso in teste.avisos"
        :key="aviso"
        class="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-amber-300"
      >
        {{ aviso }}
      </p>
      <p class="text-[11.5px] text-slate-400">
        O teste lê só o começo da resposta. As colunas aparecem na aba Mapeamento depois da primeira
        carga.
      </p>
    </div>
  </section>
</template>