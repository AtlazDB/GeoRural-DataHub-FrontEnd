<script setup>
import { computed } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import BaseButton from '@/components/BaseButton.vue'
import { usePermissoes } from '@/composables/usePermissoes'
import { formatarArea, formatarDataHora } from '@/utils/formato'
import {
  NOMES,
  coresStatus,
  formatarDecimal,
  formatarValor,
  rotuloStatus,
  rotuloVersao,
} from '@/utils/indicadores'

/**
 * IRL e IFC do imóvel selecionado, no desenho do protótipo da Sprint 2. Cada
 * indicador mostra a versão dos dados e a regra que produziram o número, e
 * leva à Rastreabilidade ("De onde veio este número?").
 *
 * Só apresentação: a view busca os indicadores e trata o "Calcular agora".
 */
const props = defineProps({
  codImovel: { type: String, default: null },
  /** lista de GET /imoveis/:cod/indicadores, ou null enquanto não buscou */
  indicadores: { type: Array, default: null },
  carregando: { type: Boolean, default: false },
  erro: { type: String, default: '' },
  calculando: { type: Boolean, default: false },
})

defineEmits(['calcular', 'tentar-novamente'])

const { podeOperar } = usePermissoes()

const irl = computed(() => props.indicadores?.find((i) => i.indicador === 'IRL') ?? null)
const ifc = computed(() => props.indicadores?.find((i) => i.indicador === 'IFC') ?? null)

/** Barra de 0 a 40%, com a marca do mínimo (20%) no meio, como no protótipo. */
const larguraIrl = computed(() => `${Math.min((Number(irl.value?.valor) || 0) / 40 * 100, 100)}%`)

const minimoIrl = computed(() => irl.value?.regra?.parametros?.percentual_minimo ?? 20)

function rodape(indicador) {
  const regra = indicador.regra
  return [
    `${regra.codigo} v${regra.versao}`,
    rotuloVersao(indicador.versaoImovel),
    rotuloVersao(indicador.versaoInsumo),
    `calculado em ${formatarDataHora(indicador.calculadoEm)}`,
  ].join(' · ')
}

function rastreio(indicador) {
  return { name: 'rastreabilidade', query: { imovel: props.codImovel, indicador } }
}
</script>

<template>
  <!-- Nenhum imóvel selecionado -->
  <div v-if="!codImovel" class="rounded-xl border border-dashed border-slate-700 p-8 text-center">
    <p class="text-sm text-slate-400">Selecione um imóvel na tabela ou no mapa</p>
    <p class="mt-1 text-xs text-slate-600">para ver a Reserva Legal e os focos de calor dele.</p>
  </div>

  <!-- Carregando -->
  <div v-else-if="carregando" class="space-y-3">
    <div v-for="n in 2" :key="n" class="h-36 animate-pulse rounded-xl bg-slate-800/30" />
  </div>

  <!-- Erro -->
  <div v-else-if="erro" class="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm">
    <p class="font-medium text-red-300">Não deu para carregar os indicadores</p>
    <p class="mt-1 text-red-300/70">{{ erro }}</p>
    <button
      class="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-red-200 underline underline-offset-2"
      @click="$emit('tentar-novamente')"
    >
      <AppIcon nome="atualizar" traco="2.4" class="h-3.5 w-3.5" />
      Tentar de novo
    </button>
  </div>

  <!-- Ainda não calculado -->
  <div
    v-else-if="!indicadores?.length"
    class="rounded-xl border border-dashed border-slate-700 p-6 text-center"
  >
    <p class="text-sm text-slate-300">Os indicadores deste imóvel ainda não foram calculados.</p>
    <p class="mx-auto mt-1 max-w-sm text-xs text-slate-500">
      O cálculo usa a Reserva Legal e os focos de calor já carregados. Depois de carregar dados
      novos, calcule de novo.
    </p>
    <BaseButton v-if="podeOperar" class="mt-4" tamanho="sm" :carregando="calculando" @click="$emit('calcular')">
      Calcular indicadores
    </BaseButton>
    <p v-else class="mt-4 text-xs text-slate-500">O cálculo é feito pela equipe de dados.</p>
  </div>

  <!-- O código do imóvel aparece no cabeçalho do card (ConsultaView) -->
  <div v-else class="space-y-3">
    <!-- IRL -->
    <section class="rounded-xl border border-slate-800 bg-slate-950/40 p-3.5">
      <div class="flex items-start justify-between gap-2">
        <div>
          <p class="text-[12.5px] font-semibold text-slate-200">{{ NOMES.IRL }}</p>
          <p class="text-[11px] text-slate-500">
            área de RL ÷ área do imóvel · mínimo {{ minimoIrl }}% (Mata Atlântica e Cerrado)
          </p>
        </div>
        <span
          v-if="irl"
          :class="['whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', coresStatus(irl).etiqueta]"
        >
          {{ rotuloStatus(irl) }}
        </span>
      </div>

      <template v-if="irl">
        <p :class="['mt-2 font-display text-2xl font-semibold tabular-nums', coresStatus(irl).texto]">
          {{ formatarValor(irl) }}
        </p>
        <div class="relative mt-2 h-2 rounded-full bg-slate-800">
          <div :class="['h-full rounded-full', coresStatus(irl).barra]" :style="{ width: larguraIrl }" />
          <span class="absolute -top-1 left-1/2 h-4 w-0.5 bg-slate-200" :title="`mínimo de ${minimoIrl}%`" />
        </div>
        <div class="mt-1 flex justify-between text-[10px] text-slate-500">
          <span>0%</span><span>mínimo {{ minimoIrl }}%</span><span>40%</span>
        </div>
        <p class="mt-2 text-[12px] text-slate-400">
          {{ formatarArea(irl.numerador) }} de RL em {{ formatarArea(irl.areaImovelHa) }} ·
          <span v-if="Number(irl.saldoHa) < 0" class="text-rose-300">
            faltam {{ formatarDecimal(-irl.saldoHa, 2) }} ha
          </span>
          <span v-else class="text-emerald-300">sobram {{ formatarDecimal(irl.saldoHa, 2) }} ha</span>
        </p>
        <p class="mt-2 text-[10.5px] leading-relaxed text-slate-500">{{ rodape(irl) }}</p>
        <RouterLink
          :to="rastreio('IRL')"
          class="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-[11.5px] font-medium text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
        >
          <AppIcon nome="rastro" class="h-3.5 w-3.5" />
          De onde veio este número?
        </RouterLink>
      </template>
      <p v-else class="mt-2 text-[12px] text-slate-500">
        Sem Reserva Legal carregada para o município deste imóvel.
      </p>
    </section>

    <!-- IFC -->
    <section class="rounded-xl border border-slate-800 bg-slate-950/40 p-3.5">
      <div class="flex items-start justify-between gap-2">
        <div>
          <p class="text-[12.5px] font-semibold text-slate-200">{{ NOMES.IFC }}</p>
          <p class="text-[11px] text-slate-500">
            focos dentro do imóvel a cada 1.000 ha · últimos
            {{ ifc?.regra?.parametros?.janela_meses ?? 12 }} meses
            <template v-if="ifc?.regra?.parametros?.satelite">
              · satélite {{ ifc.regra.parametros.satelite }}
            </template>
          </p>
        </div>
        <span
          v-if="ifc"
          :class="['whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', coresStatus(ifc).etiqueta]"
        >
          {{ rotuloStatus(ifc) }}
        </span>
      </div>

      <template v-if="ifc">
        <p :class="['mt-2 font-display text-2xl font-semibold tabular-nums', coresStatus(ifc).texto]">
          {{ formatarValor(ifc) }}
        </p>
        <p class="text-[12px] text-slate-400">
          {{ formatarDecimal(ifc.numerador, 0) }}
          {{ Number(ifc.numerador) === 1 ? 'foco detectado' : 'focos detectados' }} no imóvel
        </p>
        <p class="mt-2 text-[10.5px] leading-relaxed text-slate-500">{{ rodape(ifc) }}</p>
        <RouterLink
          :to="rastreio('IFC')"
          class="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-[11.5px] font-medium text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
        >
          <AppIcon nome="rastro" class="h-3.5 w-3.5" />
          De onde veio este número?
        </RouterLink>
      </template>
      <p v-else class="mt-2 text-[12px] text-slate-500">Sem focos de calor carregados.</p>
    </section>

    <div v-if="podeOperar" class="flex justify-end">
      <BaseButton variante="fantasma" tamanho="sm" :carregando="calculando" @click="$emit('calcular')">
        <AppIcon v-if="!calculando" nome="atualizar" traco="2.4" class="h-3 w-3" />
        Recalcular
      </BaseButton>
    </div>
  </div>
</template>