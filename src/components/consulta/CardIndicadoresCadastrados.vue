<script setup>
import { ref, watch } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import BaseButton from '@/components/BaseButton.vue'
import {
  buscarResultado,
  calcularIndicador,
  listarIndicadores,
} from '@/services/indicadoresCadastrosService'
import { formatarDataHora } from '@/utils/formato'
import { CORES_STATUS, formatarDecimal } from '@/utils/indicadores'

/**
 * Indicadores cadastrados pelo usuário (US13) para o imóvel selecionado, abaixo
 * do IRL/IFC. Busca sozinho: a lista dos ativos e, em paralelo, o resultado de
 * cada um (GET /indicators/:code/results).
 *
 * "Calcular" dispara a DAG no Airflow para todos os imóveis (como na tela de
 * Indicadores) e volta logo: o resultado só aparece quando a DAG termina, uns
 * minutos depois, pelo "atualizar".
 */
const props = defineProps({
  codImovel: { type: String, default: null },
})

const STATUS = { CONFORME: 'Conforme', ALERTA: 'Alerta', CRITICO: 'Crítico', VALIDACAO: 'Em validação' }

// [{ indicador, resultado | null }]
const linhas = ref([])
const carregando = ref(false)
const erro = ref('')
let pedidoAtual = 0

async function carregar() {
  const pedido = ++pedidoAtual
  linhas.value = []
  erro.value = ''
  if (!props.codImovel) return

  carregando.value = true
  try {
    const ativos = (await listarIndicadores()).filter((i) => i.active)
    const resultados = await Promise.all(ativos.map((i) => buscarResultado(i.code, props.codImovel)))
    if (pedido === pedidoAtual) {
      linhas.value = ativos.map((indicador, n) => ({ indicador, resultado: resultados[n] }))
    }
  } catch (e) {
    if (pedido === pedidoAtual) erro.value = e.message
  } finally {
    if (pedido === pedidoAtual) carregando.value = false
  }
}

watch(() => props.codImovel, carregar, { immediate: true })

// Disparo do cálculo: sigla em andamento e o aviso de cada indicador.
const calculandoCode = ref(null)
const avisos = ref({}) // { [code]: { tipo: 'sucesso' | 'erro', texto } }

async function calcular(indicador) {
  calculandoCode.value = indicador.code
  try {
    await calcularIndicador(indicador.code)
    avisos.value[indicador.code] = {
      tipo: 'sucesso',
      texto: 'Cálculo iniciado no Airflow. Leva alguns minutos: depois, clique em atualizar.',
    }
  } catch (e) {
    avisos.value[indicador.code] = { tipo: 'erro', texto: e.message }
  } finally {
    calculandoCode.value = null
  }
}

function atualizar() {
  avisos.value = {}
  carregar()
}

function cores(status) {
  return CORES_STATUS[status] ?? CORES_STATUS.VALIDACAO
}
</script>

<template>
  <div v-if="codImovel" class="mt-4 border-t border-slate-800 pt-4">
    <div class="mb-2 flex items-center justify-between">
      <p class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Indicadores cadastrados</p>
      <div class="flex items-center gap-3 text-[11px]">
        <button
          type="button"
          class="inline-flex items-center gap-1 text-slate-400 hover:text-slate-100 disabled:opacity-50"
          :disabled="carregando"
          @click="atualizar"
        >
          <AppIcon nome="atualizar" traco="2.4" class="h-3 w-3" />
          atualizar
        </button>
        <RouterLink :to="{ name: 'indicadores' }" class="text-cyan-400 hover:underline">gerenciar</RouterLink>
      </div>
    </div>

    <div v-if="carregando" class="space-y-2">
      <div v-for="n in 2" :key="n" class="h-14 animate-pulse rounded-xl bg-slate-800/30" />
    </div>

    <div v-else-if="erro" class="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs">
      <p class="text-red-300">{{ erro }}</p>
      <button class="mt-2 inline-flex items-center gap-1 font-semibold text-red-200 underline" @click="carregar">
        <AppIcon nome="atualizar" traco="2.4" class="h-3 w-3" />
        Tentar de novo
      </button>
    </div>

    <p v-else-if="!linhas.length" class="text-xs text-slate-500">Nenhum indicador ativo cadastrado.</p>

    <div v-else class="space-y-2">
      <section
        v-for="{ indicador, resultado } in linhas"
        :key="indicador.code"
        class="rounded-xl border border-slate-800 bg-slate-950/40 p-3"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="text-[12.5px] font-semibold text-slate-200">
              <span class="font-mono text-cyan-300">{{ indicador.code }}</span> · {{ indicador.name }}
            </p>
          </div>
          <span
            v-if="resultado"
            :class="['whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', cores(resultado.status).etiqueta]"
          >
            {{ STATUS[resultado.status] ?? resultado.status }}
          </span>
        </div>

        <template v-if="resultado">
          <p :class="['mt-1 font-display text-xl font-semibold tabular-nums', cores(resultado.status).texto]">
            {{ formatarDecimal(resultado.value, 2) }}
            <span class="text-xs font-normal text-slate-500">{{ indicador.unit }}</span>
          </p>
          <p class="text-[10.5px] text-slate-500">calculado em {{ formatarDataHora(resultado.calculatedAt) }}</p>
        </template>
        <p v-else class="mt-1 text-[12px] text-slate-500">Ainda não calculado para este imóvel.</p>

        <p
          v-if="avisos[indicador.code]"
          :class="[
            'mt-2 text-[11px]',
            avisos[indicador.code].tipo === 'erro' ? 'text-rose-300' : 'text-emerald-300',
          ]"
        >
          {{ avisos[indicador.code].texto }}
        </p>

        <div class="mt-2 flex justify-end">
          <BaseButton
            :variante="resultado ? 'fantasma' : 'secundario'"
            tamanho="sm"
            :carregando="calculandoCode === indicador.code"
            :disabled="!!calculandoCode"
            :title="'Calcula para todos os imóveis (leva alguns minutos)'"
            @click="calcular(indicador)"
          >
            {{ resultado ? 'Recalcular' : 'Calcular' }}
          </BaseButton>
        </div>
      </section>
    </div>
  </div>
</template>
