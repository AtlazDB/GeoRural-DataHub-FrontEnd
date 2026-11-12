<script setup>
import { computed, ref, watch } from 'vue'
import BaseModal from '@/components/BaseModal.vue'
import AppIcon from '@/components/AppIcon.vue'
import { formatarDataHora, formatarSituacao } from '@/utils/formato'
import {
  NOMES,
  coresStatus,
  formatarDecimal,
  formatarValor,
  hashCurto,
  nomeConjunto,
  rotuloStatus,
  rotuloVersao,
} from '@/utils/indicadores'

const props = defineProps({
  aberto: { type: Boolean, default: false },
  codImovel: { type: String, default: '' },
  /** IRL ou IFC */
  indicador: { type: String, default: 'IRL' },
  /** GET /imoveis/:cod/origem */
  origem: { type: Object, default: null },
  /** GET /imoveis/:cod/comparar */
  comparacao: { type: Object, default: null },
  carregando: { type: Boolean, default: false },
  comparando: { type: Boolean, default: false },
  erro: { type: String, default: '' },
})

const emit = defineEmits(['fechar', 'comparar'])

const CAMPOS = {
  municipio: 'Município',
  estado: 'UF',
  area_ha: 'Área declarada (ha)',
  situacao: 'Situação no CAR',
  municipio_id: 'Código do município',
}

const MOTIVOS = {
  DADO: 'Mudou o dado: o imóvel ou o insumo usado no cálculo é outro. A regra é a mesma.',
  REGRA: 'Mudou a regra de cálculo. Os dados são os mesmos.',
  DADO_E_REGRA: 'Mudaram o dado e a regra de cálculo.',
  NENHUM: 'Nada que entra no cálculo mudou entre as duas versões.',
  SEM_CALCULO: 'O indicador não foi calculado numa das duas versões.',
}

const resultado = computed(() => props.origem?.indicadores?.find((i) => i.indicador === props.indicador) ?? null)

const camposVisiveis = computed(() =>
  (props.comparacao?.campos ?? []).filter((c) => c.mudou || (c.de != null && c.de !== '')),
)

const indicadorComparado = computed(
  () => props.comparacao?.indicadores?.find((i) => i.indicador === props.indicador) ?? null,
)

const de = ref(null)
const para = ref(null)

// Os seletores mostram o par que o back escolheu (a mais nova e a anterior).
watch(
  () => props.comparacao,
  (c) => {
    de.value = c?.de?.datasetVersaoId ?? null
    para.value = c?.para?.datasetVersaoId ?? null
  },
)

// O id da versão cresce com o tempo: a mais antiga vai sempre na coluna da esquerda.
function trocar() {
  if (!de.value || !para.value || de.value === para.value) return
  emit('comparar', { de: Math.min(de.value, para.value), para: Math.max(de.value, para.value) })
}

function rotuloOpcao(v) {
  const marca = v.situacao === 'ATUAL' ? ' (atual)' : v.situacao === 'REMOVIDO' ? ' (removida depois)' : ''
  return `${nomeConjunto(v.conjunto)} v${v.versao} · ${formatarDataHora(v.processadoEm)}${marca}`
}

function valorCampo(campo, valor) {
  if (valor == null || valor === '') return '—'
  if (campo === 'situacao') return formatarSituacao(valor)
  if (campo === 'area_ha') return formatarDecimal(valor, 4)
  return valor
}

function valorIndicador(valor) {
  if (valor == null) return '—'
  return props.indicador === 'IRL' ? `${formatarDecimal(valor, 1)}%` : formatarDecimal(valor, 1)
}
</script>

<template>
  <BaseModal
    :aberto="aberto"
    :titulo="`De onde veio este número? · ${NOMES[indicador] ?? indicador}`"
    :descricao="codImovel"
    largura="max-w-5xl"
    @fechar="$emit('fechar')"
  >
    <div v-if="carregando" class="rounded-xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">
      Buscando a origem do número…
    </div>

    <div v-else-if="erro" class="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-300">
      {{ erro }}
    </div>

    <div v-else-if="origem" class="space-y-5">
      <!-- Valor atual -->
      <section v-if="resultado" class="flex flex-wrap items-center justify-between gap-3">
        <p class="flex items-center gap-3">
          <span :class="['font-display text-3xl font-semibold tabular-nums', coresStatus(resultado).texto]">
            {{ formatarValor(resultado) }}
          </span>
          <span
            :class="['rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', coresStatus(resultado).etiqueta]"
          >
            {{ rotuloStatus(resultado) }}
          </span>
        </p>
        <p class="font-mono text-[11.5px] text-slate-500">calculado em {{ formatarDataHora(resultado.calculadoEm) }}</p>
      </section>
      <p v-else class="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">
        Este indicador ainda não foi calculado para o imóvel.
      </p>

      <!-- Caminho até a origem -->
      <section>
        <h3 class="mb-3 text-sm font-semibold text-white">Caminho até a origem</h3>
        <div class="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div class="space-y-3">
            <p class="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">1 · Dados de entrada</p>
            <div v-if="origem.versaoAtual" class="rounded-xl border border-indigo-500/30 bg-slate-950/40 p-3.5">
              <p class="text-[11.5px] text-indigo-300">Contorno e área do imóvel</p>
              <p class="mt-0.5 text-[13px] font-medium text-slate-100">{{ origem.versaoAtual.fonteNome || '—' }}</p>
              <p class="mt-1.5 truncate text-[11.5px] text-slate-400" :title="origem.versaoAtual.arquivo">
                {{ origem.versaoAtual.arquivo || '—' }}
              </p>
              <p class="font-mono text-[11px] text-slate-500" :title="origem.versaoAtual.hash">
                {{ hashCurto(origem.versaoAtual.hash) }} · {{ nomeConjunto(origem.versaoAtual.conjunto) }}
                v{{ origem.versaoAtual.versao }}
              </p>
              <p v-if="origem.versaoAtual.execucaoId" class="font-mono text-[11px] text-slate-500">
                execução #{{ origem.versaoAtual.execucaoId }} · {{ formatarDataHora(origem.versaoAtual.processadoEm) }}
              </p>
            </div>
            <div v-if="resultado?.versaoInsumo" class="rounded-xl border border-indigo-500/30 bg-slate-950/40 p-3.5">
              <p class="text-[11.5px] text-indigo-300">{{ indicador === 'IRL' ? 'Áreas de Reserva Legal' : 'Focos de calor' }}</p>
              <p class="mt-0.5 text-[13px] font-medium text-slate-100">{{ resultado.versaoInsumo.fonteNome || '—' }}</p>
              <p class="mt-1.5 truncate text-[11.5px] text-slate-400" :title="resultado.versaoInsumo.arquivo">
                {{ resultado.versaoInsumo.arquivo || '—' }}
              </p>
              <p class="font-mono text-[11px] text-slate-500" :title="resultado.versaoInsumo.hash">
                {{ hashCurto(resultado.versaoInsumo.hash) }} · {{ rotuloVersao(resultado.versaoInsumo) }}
              </p>
            </div>
          </div>

          <div class="space-y-3">
            <p class="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">2 · Regra aplicada</p>
            <div v-if="resultado" class="rounded-xl border border-indigo-500/30 bg-slate-950/40 p-3.5">
              <p class="font-mono text-[13px] font-medium text-indigo-300">
                {{ resultado.regra.nome }} v{{ resultado.regra.versao }}
              </p>
              <p class="font-mono text-[11px] text-slate-500">{{ resultado.regra.codigo }}</p>
              <p class="mt-2 text-[12.5px] leading-relaxed text-slate-300">{{ resultado.regra.formula }}</p>
            </div>
          </div>

          <div class="space-y-3">
            <p class="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">3 · Resultado</p>
            <div v-if="resultado" class="rounded-xl border border-cyan-500/40 bg-cyan-500/[0.05] p-3.5 text-[13px] text-slate-300">
              <template v-if="indicador === 'IRL'">
                {{ formatarDecimal(resultado.numerador, 2) }} ha de RL ÷ {{ formatarDecimal(resultado.areaImovelHa, 2) }} ha
                do imóvel × 100 =
              </template>
              <template v-else>
                {{ formatarDecimal(resultado.numerador, 0) }}
                {{ Number(resultado.numerador) === 1 ? 'foco' : 'focos' }} ÷
                {{ formatarDecimal(resultado.areaImovelHa, 2) }} ha × 1.000 =
              </template>
              <b class="text-white">{{ formatarValor(resultado) }}</b>
            </div>
          </div>
        </div>
      </section>

      <!-- Comparação de versões -->
      <section>
        <h3 class="mb-1 text-sm font-semibold text-white">Comparação com a versão anterior</h3>
        <p
          v-if="comparacao && !comparacao.de"
          class="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400"
        >
          O imóvel só tem uma versão até agora: ainda não há com o que comparar.
        </p>

        <template v-else-if="comparacao">
          <div class="mb-3 flex flex-wrap items-end gap-3">
            <div class="min-w-[220px] flex-1">
              <label class="label" for="versao-de">Versão anterior</label>
              <select id="versao-de" v-model="de" class="input" @change="trocar">
                <option v-for="v in origem.versoes" :key="v.datasetVersaoId" :value="v.datasetVersaoId">
                  {{ rotuloOpcao(v) }}
                </option>
              </select>
            </div>
            <div class="min-w-[220px] flex-1">
              <label class="label" for="versao-para">Versão mais nova</label>
              <select id="versao-para" v-model="para" class="input" @change="trocar">
                <option v-for="v in origem.versoes" :key="v.datasetVersaoId" :value="v.datasetVersaoId">
                  {{ rotuloOpcao(v) }}
                </option>
              </select>
            </div>
          </div>

          <div :class="['overflow-x-auto rounded-xl border border-slate-800 transition-opacity', comparando && 'opacity-50']">
            <table class="w-full text-left text-sm">
              <thead class="bg-slate-900/80">
                <tr class="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
                  <th class="px-3 py-2.5">Campo</th>
                  <th class="px-3 py-2.5">{{ rotuloVersao(comparacao.de) }}</th>
                  <th class="px-3 py-2.5">{{ rotuloVersao(comparacao.para) }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/80">
                <tr v-for="c in camposVisiveis" :key="c.campo" :class="c.mudou && 'bg-amber-500/[0.06]'">
                  <td :class="['px-3 py-2.5 text-[12px]', c.mudou ? 'text-amber-300' : 'text-slate-400']">
                    {{ CAMPOS[c.campo] ?? c.campo }}
                  </td>
                  <td :class="['px-3 py-2.5', c.mudou ? 'text-slate-500 line-through decoration-slate-600' : 'text-slate-400']">
                    {{ valorCampo(c.campo, c.de) }}
                  </td>
                  <td :class="['px-3 py-2.5', c.mudou ? 'font-medium text-slate-100' : 'text-slate-400']">
                    {{ valorCampo(c.campo, c.para) }}
                  </td>
                </tr>
                <tr :class="comparacao.geometriaMudou && 'bg-amber-500/[0.06]'">
                  <td :class="['px-3 py-2.5 text-[12px]', comparacao.geometriaMudou ? 'text-amber-300' : 'text-slate-400']">
                    Contorno (área do polígono)
                  </td>
                  <td :class="['px-3 py-2.5', comparacao.geometriaMudou ? 'text-slate-500 line-through decoration-slate-600' : 'text-slate-400']">
                    {{ formatarDecimal(comparacao.areaGeometriaDeHa, 2) }} ha
                  </td>
                  <td :class="['px-3 py-2.5', comparacao.geometriaMudou ? 'font-medium text-slate-100' : 'text-slate-400']">
                    {{ formatarDecimal(comparacao.areaGeometriaParaHa, 2) }} ha
                    <span v-if="comparacao.geometriaMudou" class="text-[11px] text-amber-300">· contorno mudou</span>
                  </td>
                </tr>
                <tr v-if="indicadorComparado" class="bg-cyan-500/[0.05]">
                  <td class="px-3 py-2.5 text-[12px] text-cyan-300">{{ indicador }}</td>
                  <td class="px-3 py-2.5 text-slate-400">
                    {{ valorIndicador(indicadorComparado.valorDe) }}
                    <span v-if="indicadorComparado.regraDe" class="font-mono text-[10.5px] text-slate-500">· {{ indicadorComparado.regraDe }}</span>
                  </td>
                  <td class="px-3 py-2.5 font-medium text-slate-100">
                    {{ valorIndicador(indicadorComparado.valorPara) }}
                    <span v-if="indicadorComparado.regraPara" class="font-mono text-[10.5px] font-normal text-slate-500">· {{ indicadorComparado.regraPara }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="mt-3 rounded-lg border border-cyan-500/30 bg-cyan-500/[0.06] p-3 text-[12.5px]">
            <template v-if="indicadorComparado">
              <p class="font-semibold text-cyan-200">Por que o {{ indicador }} mudou</p>
              <p class="mt-1 text-slate-400">{{ MOTIVOS[indicadorComparado.motivo] ?? indicadorComparado.motivo }}</p>
            </template>
            <p v-else class="text-slate-400">
              O {{ indicador }} não foi calculado em nenhuma das duas versões: recalcule os indicadores para comparar o número.
            </p>
          </div>
        </template>
      </section>
    </div>

    <template #rodape>
      <RouterLink
        :to="{ name: 'rastreabilidade', query: { imovel: codImovel, indicador } }"
        class="mr-auto inline-flex items-center gap-1.5 text-[12px] text-cyan-300 hover:text-cyan-200"
      >
        <AppIcon nome="rastro" class="h-3.5 w-3.5" />
        Histórico completo do cálculo
      </RouterLink>
      <button
        type="button"
        class="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
        @click="$emit('fechar')"
      >
        Fechar
      </button>
    </template>
  </BaseModal>
</template>
