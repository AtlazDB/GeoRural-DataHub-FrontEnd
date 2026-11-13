<script setup>
import { computed, ref } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import BaseButton from '@/components/BaseButton.vue'

/**
 * Formulário de cadastro de indicador (US13). Igual ao FonteForm: não chama o
 * service, só emite 'salvar' com o corpo pronto do POST /indicators. Quem fala
 * com a API é a IndicadoresView, que devolve o erro pela prop `erro`.
 *
 * Faixas: em ordem crescente de limite; só a última fica sem limite (vale para
 * tudo acima da anterior). Ex.: até 5 (inclusive) CONFORME, acima disso CRITICO.
 */

const props = defineProps({
  /** fontes para escolher: [{ id, nome, sigla }] */
  fontes: { type: Array, default: () => [] },
  salvando: { type: Boolean, default: false },
  /** erro do back: { mensagem, campos: [...] }, ou null */
  erro: { type: Object, default: null },
})

const emit = defineEmits(['salvar', 'cancelar'])

const STATUS = [
  { valor: 'CONFORME', rotulo: 'Conforme' },
  { valor: 'ALERTA', rotulo: 'Alerta' },
  { valor: 'CRITICO', rotulo: 'Crítico' },
  { valor: 'VALIDACAO', rotulo: 'Validação' },
]

const MODELOS = [
  {
    valor: 'POINT_DENSITY',
    rotulo: 'Densidade de pontos',
    ajuda: 'Pontos da fonte dentro do imóvel, por área. A fonte precisa ter só pontos (ex.: focos de calor).',
  },
  {
    valor: 'AREA_COVERAGE',
    rotulo: 'Cobertura de área',
    ajuda: 'Quanto do imóvel (em %) é coberto pelos polígonos da fonte. A fonte precisa ter só polígonos.',
  },
  {
    valor: 'BASE_COVERAGE',
    rotulo: 'Cobertura dentro de uma camada',
    ajuda:
      'Quanto de uma camada base dentro do imóvel (em %) é coberto pela fonte. Ex.: APP conservada = APP com vegetação nativa ÷ APP total. A fonte é a cobertura (vegetação); a camada base (APP) é escolhida abaixo. As duas precisam ter só polígonos. Imóvel sem a camada base não recebe resultado.',
  },
]

const form = ref({
  code: '',
  name: '',
  unit: '',
  description: '',
  fonteId: '',
  calculationModel: 'POINT_DENSITY',
  factor: 1000,
  category: '',
  // parameters.since: o <input type="date"> já devolve AAAA-MM-DD, o formato do back e da DAG.
  since: '',
  // parameters.extraSources: outras fontes somadas à principal (ex.: ISAP = UC + TI + quilombola).
  extraSources: [],
  // parameters.baseSources do BASE_COVERAGE: a camada que vira o denominador (ex.: APP).
  baseSource: '',
  ranges: [
    { status: 'CONFORME', limit: '', includeLimit: true },
    { status: 'CRITICO', limit: null, includeLimit: null },
  ],
})

const modelo = computed(() => MODELOS.find((m) => m.valor === form.value.calculationModel))
const densidade = computed(() => form.value.calculationModel === 'POINT_DENSITY')
const porCamada = computed(() => form.value.calculationModel === 'BASE_COVERAGE')
// A principal não aparece na lista de extras.
const fontesExtras = computed(() => props.fontes.filter((f) => f.id !== form.value.fonteId))

// Campo que o back apontou como inválido (400 com `campos`, ou 409 na sigla).
function temErro(campo) {
  return props.erro?.campos?.includes(campo)
}

function classeCampo(campo, extra = '') {
  return ['input', extra, temErro(campo) && 'border-rose-500/70 focus:border-rose-400']
}

// Nova faixa entra antes da última (a última é sempre a "acima disso").
function adicionarFaixa() {
  const faixas = form.value.ranges
  faixas.splice(faixas.length - 1, 0, { status: 'ALERTA', limit: '', includeLimit: true })
}

function removerFaixa(indice) {
  form.value.ranges.splice(indice, 1)
}

// O que vem antes da faixa, para a frase "acima de X" ficar clara.
function limiteAnterior(indice) {
  const anterior = form.value.ranges[indice - 1]
  if (!anterior || anterior.limit === '' || anterior.limit === null) return '…'
  return anterior.limit
}

function submeter() {
  const f = form.value
  const ultima = f.ranges.length - 1

  const parameters = {}
  if (densidade.value) parameters.factor = Number(f.factor)
  if (f.category.trim()) parameters.category = f.category.trim()
  if (f.since) parameters.since = f.since
  const extras = f.extraSources.filter((id) => id !== f.fonteId).map(Number)
  if (extras.length) parameters.extraSources = extras
  if (porCamada.value && f.baseSource !== '') parameters.baseSources = [Number(f.baseSource)]

  emit('salvar', {
    code: f.code.trim().toUpperCase(),
    name: f.name.trim(),
    unit: f.unit.trim(),
    description: f.description.trim() || null,
    fonteId: f.fonteId === '' ? null : Number(f.fonteId),
    calculationModel: f.calculationModel,
    parameters,
    ranges: f.ranges.map((r, i) =>
      i === ultima
        ? { status: r.status }
        : { status: r.status, limit: r.limit === '' ? null : Number(r.limit), includeLimit: r.includeLimit },
    ),
  })
}
</script>

<template>
  <form class="space-y-4" @submit.prevent="submeter">
    <p
      v-if="erro"
      class="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300"
    >
      {{ erro.mensagem }}
    </p>

    <!-- Identificação -->
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-[140px_1fr_140px]">
      <div>
        <label class="label" for="ind-code">Sigla</label>
        <input
          id="ind-code"
          v-model="form.code"
          :class="classeCampo('code', 'font-mono uppercase')"
          placeholder="DFOCO"
          maxlength="10"
          required
        />
      </div>
      <div>
        <label class="label" for="ind-name">Nome</label>
        <input
          id="ind-name"
          v-model="form.name"
          :class="classeCampo('name')"
          placeholder="Densidade de focos de calor"
          maxlength="120"
          required
        />
      </div>
      <div>
        <label class="label" for="ind-unit">Unidade</label>
        <input
          id="ind-unit"
          v-model="form.unit"
          :class="classeCampo('unit', 'font-mono')"
          placeholder="focos/1000"
          maxlength="12"
          required
        />
      </div>
    </div>
    <p class="-mt-2 text-xs text-slate-500">
      Sigla: de 2 a 10 letras maiúsculas ou números, começando com letra. Não pode repetir, nem a de um indicador desativado.
    </p>

    <div>
      <label class="label" for="ind-desc">Descrição <span class="text-slate-500">(opcional)</span></label>
      <textarea
        id="ind-desc"
        v-model="form.description"
        :class="classeCampo('description')"
        rows="2"
        maxlength="1000"
      />
    </div>

    <!-- Fonte e modelo -->
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <label class="label" for="ind-fonte">Fonte de dados</label>
        <select id="ind-fonte" v-model="form.fonteId" :class="classeCampo('fonteId')" required>
          <option value="" disabled>Escolha a fonte</option>
          <option v-for="f in fontes" :key="f.id" :value="f.id">{{ f.sigla }} · {{ f.nome }}</option>
        </select>
      </div>
      <div>
        <label class="label" for="ind-modelo">Modelo de cálculo</label>
        <select id="ind-modelo" v-model="form.calculationModel" :class="classeCampo('calculationModel')">
          <option v-for="m in MODELOS" :key="m.valor" :value="m.valor">{{ m.rotulo }}</option>
        </select>
      </div>
    </div>
    <p class="-mt-2 text-xs text-slate-500">{{ modelo.ajuda }}</p>

    <div v-if="porCamada">
      <label class="label" for="ind-base">Camada base (o denominador)</label>
      <select id="ind-base" v-model="form.baseSource" :class="classeCampo('parameters')" required>
        <option value="" disabled>Escolha a camada base, ex.: APP</option>
        <option v-for="f in fontes" :key="f.id" :value="f.id">{{ f.sigla }} · {{ f.nome }}</option>
      </select>
    </div>

    <!-- Fontes extras: o indicador cruza o imóvel com todas juntas -->
    <details class="rounded-xl border border-slate-800 p-3" :open="form.extraSources.length > 0">
      <summary class="cursor-pointer text-sm font-medium text-slate-200">
        Somar outras fontes <span class="text-slate-500">(opcional{{ form.extraSources.length ? ` · ${form.extraSources.length} marcada(s)` : '' }})</span>
      </summary>
      <p class="mt-2 text-xs text-slate-500">
        Para um indicador de várias camadas (ex.: áreas protegidas = UC + terra indígena + quilombola + floresta
        pública). Na cobertura, a área coberta por mais de uma fonte conta uma vez só. Todas precisam ter o mesmo
        tipo de geometria da principal.
      </p>
      <div
        :class="['mt-2 max-h-40 space-y-1 overflow-y-auto rounded-lg border p-2', temErro('parameters') ? 'border-rose-500/50' : 'border-slate-800']"
      >
        <label
          v-for="f in fontesExtras"
          :key="f.id"
          class="flex cursor-pointer items-center gap-2 text-sm text-slate-300"
        >
          <input v-model="form.extraSources" type="checkbox" :value="f.id" />
          {{ f.sigla }} · {{ f.nome }}
        </label>
        <p v-if="!fontesExtras.length" class="text-xs text-slate-500">Nenhuma outra fonte cadastrada.</p>
      </div>
    </details>

    <!-- Parâmetros -->
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div v-if="densidade">
        <label class="label" for="ind-fator">Pontos a cada quantos hectares</label>
        <input
          id="ind-fator"
          v-model="form.factor"
          type="number"
          min="1"
          step="any"
          :class="classeCampo('parameters', 'tabular-nums')"
          required
        />
      </div>
      <div>
        <label class="label" for="ind-cat">Só a categoria <span class="text-slate-500">(opcional)</span></label>
        <input
          id="ind-cat"
          v-model="form.category"
          :class="classeCampo('parameters')"
          placeholder="ex.: AQUA ou MATA"
        />
      </div>
      <div>
        <label class="label" for="ind-desde">A partir de <span class="text-slate-500">(opcional)</span></label>
        <input
          id="ind-desde"
          v-model="form.since"
          type="date"
          :class="classeCampo('parameters', 'tabular-nums')"
        />
      </div>
    </div>
    <p class="-mt-2 text-xs text-slate-500">
      Categoria: usa só as feições da fonte com essa categoria. A partir de: usa só as feições com data de
      referência nesse dia ou depois (ex.: desmatamento após 22/07/2008); a fonte precisa ter a coluna de data
      mapeada em data_referencia. Vazio = sem filtro.
    </p>

    <!-- Faixas -->
    <div :class="['rounded-xl border p-3', temErro('ranges') ? 'border-rose-500/50' : 'border-slate-800']">
      <div class="mb-2 flex items-center justify-between">
        <p class="text-sm font-medium text-slate-200">Faixas de status</p>
        <BaseButton type="button" variante="secundario" tamanho="sm" @click="adicionarFaixa">
          + Faixa
        </BaseButton>
      </div>
      <p class="mb-3 text-xs text-slate-500">Em ordem crescente de valor. A última vale para tudo acima da anterior.</p>

      <div class="space-y-2">
        <div
          v-for="(faixa, i) in form.ranges"
          :key="i"
          class="grid grid-cols-[1fr_auto] items-center gap-2 sm:grid-cols-[150px_1fr_auto]"
        >
          <select v-model="faixa.status" class="input" :aria-label="`Status da faixa ${i + 1}`">
            <option v-for="s in STATUS" :key="s.valor" :value="s.valor">{{ s.rotulo }}</option>
          </select>

          <!-- Última faixa: sem limite -->
          <p v-if="i === form.ranges.length - 1" class="text-sm text-slate-400 sm:col-auto col-span-2 sm:col-span-1">
            acima de <span class="font-mono text-slate-200">{{ limiteAnterior(i) }}</span>
          </p>
          <div v-else class="col-span-2 flex items-center gap-2 text-sm text-slate-400 sm:col-span-1">
            <span>até</span>
            <input
              v-model="faixa.limit"
              type="number"
              step="any"
              class="input w-28 tabular-nums"
              :aria-label="`Limite da faixa ${i + 1}`"
              required
            />
            <label class="inline-flex items-center gap-1.5 whitespace-nowrap">
              <input v-model="faixa.includeLimit" type="checkbox" class="accent-cyan-400" />
              inclui o limite
            </label>
          </div>

          <button
            v-if="i < form.ranges.length - 1 && form.ranges.length > 2"
            type="button"
            class="justify-self-end rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-rose-300"
            :title="`Remover a faixa ${i + 1}`"
            @click="removerFaixa(i)"
          >
            <AppIcon nome="lixeira" class="h-4 w-4" />
          </button>
          <span v-else class="w-7" />
        </div>
      </div>
    </div>

    <div class="flex justify-end gap-2 pt-1">
      <BaseButton type="button" variante="fantasma" :disabled="salvando" @click="emit('cancelar')">
        Cancelar
      </BaseButton>
      <BaseButton type="submit" :carregando="salvando">Cadastrar indicador</BaseButton>
    </div>
  </form>
</template>
