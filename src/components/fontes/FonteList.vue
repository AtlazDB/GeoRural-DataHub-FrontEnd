<script setup>
import AppIcon from '@/components/AppIcon.vue'
import BaseChave from '@/components/BaseChave.vue'
import { formatarDataHora } from '@/utils/formato'

/**
 * Componente de APRESENTAÇÃO — as fontes em cartões.
 *
 * Ele não sabe que existe uma API: só recebe uma lista via props e
 * avisa o pai (a ImportacaoView) quando alguém clica em algo, via emit.
 * Esse é o padrão "props para baixo, eventos para cima" do Vue.
 *
 * Clicar no cartão abre a página da fonte (evento 'selecionar'). Fonte por
 * link (modalidade LINK) ganha a etiqueta "Coleta automática" e mostra a
 * última coleta; a de upload mostra o último envio. O rodapé também conta as
 * colunas sem mapeamento: nem sempre é problema (objectid, Shape__Area ficam sem
 * regra de propósito), então o tom é neutro; o que trava o processamento é o
 * arquivo "Aguardando mapeamento", que ganha o aviso âmbar.
 */
defineProps({
  fontes: { type: Array, required: true },
  carregando: { type: Boolean, default: false },
  erro: { type: String, default: '' },
  /** id da fonte → quantidade de colunas novas sem mapeamento */
  novas: { type: Object, default: () => ({}) },
  /** true quando há fontes, mas o filtro ou a busca escondeu todas */
  filtrada: { type: Boolean, default: false },
  /** mostra a chave de ativar/desativar (só para quem opera os dados) */
  podeOperar: { type: Boolean, default: false },
  /** id da fonte cuja chave está sendo trocada (desliga a chave enquanto isso) */
  alternandoId: { type: Number, default: null },
})

defineEmits(['selecionar', 'tentar-novamente', 'alternar-ativa'])

// Fonte desativada: não recebe arquivo nem coleta. O card fica apagado.
function inativa(fonte) {
  return fonte.status === 'inativa'
}

function porLink(fonte) {
  return fonte.modalidade === 'LINK'
}

// Coleta que terminou com falha: a mensagem gravada pela DAG começa com "A coleta falhou".
function coletaFalhou(fonte) {
  return /falhou/i.test(fonte.ultimaColetaMensagem ?? '')
}
</script>

<template>
  <!-- Estado 1: carregando -->
  <div v-if="carregando" class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
    <div v-for="n in 6" :key="n" class="h-[148px] animate-pulse rounded-2xl bg-slate-800/30" />
  </div>

  <!-- Estado 2: deu erro -->
  <div
    v-else-if="erro"
    class="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm"
  >
    <p class="font-medium text-red-300">Não deu para carregar as fontes</p>
    <p class="mt-1 text-red-300/70">{{ erro }}</p>
    <button
      class="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-red-200
             underline underline-offset-2"
      @click="$emit('tentar-novamente')"
    >
      <AppIcon nome="atualizar" traco="2.4" class="h-3.5 w-3.5" />
      Tentar de novo
    </button>
  </div>

  <!-- Estado 3: lista vazia (ou tudo escondido pelo filtro) -->
  <div
    v-else-if="!fontes.length"
    class="rounded-xl border border-dashed border-slate-700 p-8 text-center"
  >
    <template v-if="filtrada">
      <p class="text-sm text-slate-400">Nenhuma fonte com esse filtro.</p>
    </template>
    <template v-else>
      <p class="text-sm text-slate-400">Nenhuma fonte cadastrada ainda.</p>
      <p class="mt-1 text-xs text-slate-600">
        Use &ldquo;Nova fonte&rdquo; para registrar a primeira origem de dados.
      </p>
    </template>
  </div>

  <!-- Estado 4: os cartões -->
  <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
    <div
      v-for="fonte in fontes"
      :key="fonte.id"
      class="glass flex flex-col transition hover:border-slate-600"
    >
      <!-- Chave de ativar no topo do card -->
      <div
        v-if="podeOperar"
        class="flex items-center justify-between gap-3 border-b border-slate-800/80 px-4 py-2.5"
      >
        <span :class="['text-[11.5px]', inativa(fonte) ? 'text-slate-500' : 'text-cyan-300']">
          {{ inativa(fonte) ? 'Desativada · não recebe dados' : 'Ativa' }}
        </span>
        <BaseChave
          :ligada="!inativa(fonte)"
          :rotulo="`a fonte ${fonte.sigla}`"
          :ocupada="alternandoId === fonte.id"
          @alternar="$emit('alternar-ativa', fonte)"
        />
      </div>

      <!-- A chave de ativar fica fora deste botão: um botão dentro do outro não é HTML válido. -->
      <button
        type="button"
        :class="['flex flex-1 flex-col gap-3 p-4 text-left transition', inativa(fonte) && 'opacity-50']"
        :aria-label="`Abrir a fonte ${fonte.sigla}`"
        @click="$emit('selecionar', fonte)"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="flex flex-wrap items-center gap-1.5">
            <span class="font-mono text-[12px] font-medium text-cyan-400">{{ fonte.sigla }}</span>
            <span
              v-if="porLink(fonte)"
              class="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-300"
            >
              Coleta automática
            </span>
            <span
              v-else
              class="rounded-full border border-slate-600/60 bg-slate-500/10 px-2 py-0.5 text-[10px] font-semibold text-slate-300"
            >
              Upload
            </span>
            <span
              v-if="inativa(fonte)"
              class="rounded-full border border-slate-500/40 bg-slate-500/10 px-2 py-0.5 text-[10px] font-semibold text-slate-400"
            >
              Inativa
            </span>
          </div>
          <span class="shrink-0 font-mono text-[10px] uppercase text-slate-500">{{ fonte.formato }}</span>
        </div>

        <div class="min-w-0">
          <p class="truncate text-[14px] font-medium text-slate-100">{{ fonte.nome }}</p>
          <p class="truncate text-[12px] text-slate-500">{{ fonte.orgao }}</p>
        </div>

        <div class="mt-auto space-y-1.5 border-t border-slate-800/80 pt-3 text-[11.5px]">
          <template v-if="porLink(fonte)">
            <p v-if="fonte.coletando" class="flex items-center gap-1.5 text-cyan-300">
              <AppIcon nome="atualizar" traco="2.2" class="h-3.5 w-3.5 animate-spin" />
              <span class="truncate">{{ fonte.ultimaColetaMensagem || 'Coletando…' }}</span>
            </p>
            <p v-else-if="fonte.ultimaColetaEm" :class="coletaFalhou(fonte) ? 'text-rose-300' : 'text-slate-400'">
              Última coleta: {{ formatarDataHora(fonte.ultimaColetaEm) }}{{ coletaFalhou(fonte) ? ' · falhou' : '' }}
            </p>
            <p v-else class="text-slate-500">Ainda sem coleta · {{ fonte.periodicidade }}</p>
          </template>
          <p v-else class="text-slate-400">
            Último envio: {{ fonte.arquivos?.length ? formatarDataHora(fonte.arquivos[0].enviadoEm) : '—' }}
          </p>

          <p
            v-if="fonte.arquivos?.some((a) => a.status === 'AGUARDANDO_MAPEAMENTO')"
            class="flex items-center gap-1.5 text-amber-300"
          >
            <span class="h-1.5 w-1.5 rounded-full bg-amber-400" />
            Arquivo aguardando o mapeamento das colunas
          </p>
          <p v-else-if="novas[fonte.id] > 0" class="text-slate-500">
            {{ novas[fonte.id] }} {{ novas[fonte.id] === 1 ? 'coluna' : 'colunas' }} sem mapeamento
          </p>
        </div>
      </button>
    </div>
  </div>
</template>
