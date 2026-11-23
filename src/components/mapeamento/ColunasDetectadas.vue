<script setup>
import { computed } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import BaseButton from '@/components/BaseButton.vue'
import { usePermissoes } from '@/composables/usePermissoes'

/**
 * Painel "Colunas detectadas": as colunas que o sistema encontrou nos
 * arquivos da fonte, cada uma com a situação em relação ao mapeamento.
 *
 * Componente de APRESENTAÇÃO, como o FonteList: não chama a API. Só recebe
 * a lista por props e avisa o pai por evento.
 *
 *   mapeada — já tem regra de destino
 *   nova    — está no último arquivo e ainda não tem regra (precisa de atenção)
 *   ausente — tem regra, mas sumiu do último arquivo
 *
 * Só a coluna "nova" mostra o botão Mapear (emite 'selecionar').
 */
const props = defineProps({
  colunas: { type: Array, required: true },
  carregando: { type: Boolean, default: false },
  erro: { type: String, default: '' },
  /** id da coluna que está sendo mapeada agora (fica destacada) */
  selecionadaId: { type: [Number, null], default: null },
})

defineEmits(['selecionar', 'tentar-novamente'])

const { podeOperar } = usePermissoes()

const etiquetas = {
  mapeada: {
    rotulo: 'Mapeada',
    classe: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/40',
  },
  nova: { rotulo: 'Nova', classe: 'text-amber-300 bg-amber-500/10 border-amber-500/40' },
  ausente: { rotulo: 'Ausente', classe: 'text-slate-300 bg-slate-500/10 border-slate-500/40' },
}

// Aceita MAPEADA ou mapeada: não depende de como o back serializa o enum.
function situacaoDe(coluna) {
  return String(coluna.situacao ?? '').toLowerCase()
}

function exemplosDe(coluna) {
  const lista = (coluna.exemplos ?? []).filter((e) => e !== null && e !== '')
  return lista.length ? lista.slice(0, 3).join(' · ') : '—'
}

const resumo = computed(() => {
  const conta = (s) => props.colunas.filter((c) => situacaoDe(c) === s).length
  return {
    total: props.colunas.length,
    mapeadas: conta('mapeada'),
    novas: conta('nova'),
    ausentes: conta('ausente'),
  }
})
</script>

<template>
  <!-- Estado 1: carregando -->
  <div v-if="carregando" class="space-y-2">
    <div v-for="n in 4" :key="n" class="h-12 animate-pulse rounded-xl bg-slate-800/30" />
  </div>

  <!-- Estado 2: erro -->
  <div v-else-if="erro" class="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm">
    <p class="font-medium text-red-300">Não deu para carregar as colunas</p>
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

  <!-- Estado 3: nenhuma coluna detectada -->
  <div
    v-else-if="!colunas.length"
    class="rounded-xl border border-dashed border-slate-700 p-8 text-center"
  >
    <p class="text-sm text-slate-400">Nenhuma coluna detectada para esta fonte.</p>
    <p class="mt-1 text-xs text-slate-600">
      As colunas aparecem depois que o primeiro arquivo da fonte é lido.
    </p>
  </div>

  <!-- Estado 4: a lista de verdade -->
  <div v-else>
    <p class="mb-3 font-mono text-[11px] text-slate-500">
      {{ resumo.total }} colunas · {{ resumo.mapeadas }} mapeadas ·
      <span :class="resumo.novas ? 'text-amber-300' : ''">{{ resumo.novas }} novas</span> ·
      {{ resumo.ausentes }} ausentes
    </p>

    <ul class="divide-y divide-slate-800/80">
      <li
        v-for="coluna in colunas"
        :key="coluna.id"
        :class="[
          'flex items-center gap-3 py-2.5 first:pt-0 last:pb-0',
          selecionadaId === coluna.id ? 'rounded-lg bg-cyan-500/5' : '',
        ]"
      >
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="font-mono text-sm text-slate-100">{{ coluna.nome }}</span>
            <span class="font-mono text-[10px] uppercase text-slate-600">{{ coluna.tipo }}</span>
          </div>
          <p class="truncate text-xs text-slate-500" :title="exemplosDe(coluna)">
            Exemplos: {{ exemplosDe(coluna) }}
          </p>
        </div>

        <BaseButton
          v-if="podeOperar && situacaoDe(coluna) === 'nova'"
          variante="secundario"
          tamanho="sm"
          class="shrink-0"
          @click="$emit('selecionar', coluna)"
        >
          Mapear
        </BaseButton>

        <span
          v-if="etiquetas[situacaoDe(coluna)]"
          :class="[
            'shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5',
            'text-[10px] font-semibold uppercase tracking-wide',
            etiquetas[situacaoDe(coluna)].classe,
          ]"
        >
          {{ etiquetas[situacaoDe(coluna)].rotulo }}
        </span>
      </li>
    </ul>
  </div>
</template>