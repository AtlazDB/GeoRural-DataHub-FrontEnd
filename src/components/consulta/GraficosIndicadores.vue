<script setup>
import { computed } from 'vue'
import { CORES_STATUS } from '@/utils/indicadores'
import { formatarNumero } from '@/utils/formato'

const props = defineProps({
  /** Mapa { [codImovel]: { status, quantidade, calculados } } da página atual */
  resumoIndicadores: { type: Object, default: () => ({}) },
  /** Indicadores fixos do imóvel selecionado (ex.: { irl, ifc }) */
  indicadoresImovel: { type: Object, default: null },
  /** Código do imóvel selecionado */
  codImovel: { type: String, default: null },
})

const ORDEM_STATUS = ['CONFORME', 'ALERTA', 'CRITICO', 'VALIDACAO']

const ROTULO_STATUS = {
  CONFORME: 'Conforme',
  ALERTA: 'Alerta',
  CRITICO: 'Crítico',
  VALIDACAO: 'Em validação',
}

const BARRA_STATUS = {
  CONFORME: 'bg-emerald-500',
  ALERTA: 'bg-amber-500',
  CRITICO: 'bg-rose-500',
  VALIDACAO: 'bg-slate-400',
}

const distribuicaoStatus = computed(() => {
  const entradas = Object.values(props.resumoIndicadores ?? {}).filter((item) => item?.status)
  const totalAvaliados = entradas.length

  const contagem = {
    CONFORME: 0,
    ALERTA: 0,
    CRITICO: 0,
    VALIDACAO: 0,
  }

  for (const item of entradas) {
    if (item.status in contagem) contagem[item.status] += 1
  }

  const itens = ORDEM_STATUS.map((status) => {
    const quantidade = contagem[status]
    const percentual = totalAvaliados > 0 ? Math.round((quantidade / totalAvaliados) * 100) : 0
    return {
      status,
      rotulo: ROTULO_STATUS[status],
      quantidade,
      percentual,
      corBarra: BARRA_STATUS[status] ?? 'bg-cyan-400',
      corEtiqueta: CORES_STATUS[status]?.etiqueta ?? '',
    }
  })

  return {
    totalAvaliados,
    itens,
  }
})

const barrasImovel = computed(() => {
  if (!props.codImovel || !props.indicadoresImovel) return []

  const lista = []
  const { irl, ifc } = props.indicadoresImovel

  if (irl && typeof irl.valor === 'number') {
    lista.push({
      chave: 'IRL',
      rotulo: 'IRL (Reserva Legal)',
      valor: Number(irl.valor),
      textoValor: `${Number(irl.valor).toFixed(1)}%`,
      percentualLargura: Math.max(0, Math.min(100, Number(irl.valor))),
      corBarra: 'bg-cyan-400',
    })
  }

  if (ifc && typeof ifc.valor === 'number') {
    const maxReferencia = Math.max(10, Number(ifc.valor))
    lista.push({
      chave: 'IFC',
      rotulo: 'IFC (Focos de calor)',
      valor: Number(ifc.valor),
      textoValor: formatarNumero(ifc.valor),
      percentualLargura: Math.max(4, Math.min(100, Math.round((Number(ifc.valor) / maxReferencia) * 100))),
      corBarra: Number(ifc.valor) > 0 ? 'bg-orange-500' : 'bg-emerald-500',
    })
  }

  return lista
})

const temConteudo = computed(
  () => distribuicaoStatus.value.totalAvaliados > 0 || barrasImovel.value.length > 0,
)
</script>

<template>
  <div class="mt-3 space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-3">
    <div class="flex items-center justify-between gap-2">
      <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-400">
        Análise gráfica
      </h3>
      <span v-if="distribuicaoStatus.totalAvaliados > 0" class="text-[11px] text-slate-500">
        {{ formatarNumero(distribuicaoStatus.totalAvaliados) }} na página
      </span>
    </div>

    <!-- Distribuição por status dos imóveis carregados na página -->
    <div v-if="distribuicaoStatus.totalAvaliados > 0" class="space-y-2.5">
      <p class="text-xs font-medium text-slate-300">Distribuição por status (página atual)</p>

      <!-- Barra empilhada proporcional em SVG -->
      <svg
        viewBox="0 0 300 14"
        class="h-3.5 w-full overflow-hidden rounded-full bg-slate-800"
        role="img"
        aria-label="Distribuição percentual dos status de indicadores na página"
      >
        <g v-for="(item, idx) in distribuicaoStatus.itens" :key="item.status">
          <rect
            v-if="item.quantidade > 0"
            :x="
              distribuicaoStatus.itens
                .slice(0, idx)
                .reduce((acc, anterior) => acc + (anterior.quantidade / distribuicaoStatus.totalAvaliados) * 300, 0)
            "
            y="0"
            :width="(item.quantidade / distribuicaoStatus.totalAvaliados) * 300"
            height="14"
            :class="item.corBarra"
          />
        </g>
      </svg>

      <div class="space-y-1.5">
        <div
          v-for="item in distribuicaoStatus.itens"
          :key="item.status"
          class="flex items-center justify-between gap-2 text-xs"
        >
          <span class="flex items-center gap-2 text-slate-300">
            <span :class="['h-2 w-2 rounded-full', item.corBarra]" />
            {{ item.rotulo }}
          </span>
          <span class="tabular-nums text-slate-400">
            {{ formatarNumero(item.quantidade) }} ({{ item.percentual }}%)
          </span>
        </div>
      </div>
    </div>

    <!-- Indicadores numéricos do imóvel selecionado -->
    <div v-if="barrasImovel.length > 0" class="space-y-2 border-t border-slate-800/80 pt-3">
      <p class="text-xs font-medium text-slate-300">
        Indicadores do imóvel <span class="font-mono text-[11px] text-cyan-400">{{ codImovel }}</span>
      </p>

      <div v-for="barra in barrasImovel" :key="barra.chave" class="space-y-1">
        <div class="flex items-center justify-between gap-2 text-xs">
          <span class="text-slate-300">{{ barra.rotulo }}</span>
          <span class="font-mono text-[11.5px] tabular-nums text-slate-200">{{ barra.textoValor }}</span>
        </div>
        <div class="h-2 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            :class="['h-full rounded-full transition-all', barra.corBarra]"
            :style="{ width: `${barra.percentualLargura}%` }"
          />
        </div>
      </div>
    </div>

    <!-- Estado vazio -->
    <p v-if="!temConteudo" class="text-xs text-slate-500">
      Selecione um imóvel ou clique em <strong class="font-medium text-slate-400">Indicadores da página</strong>
      para visualizar os gráficos.
    </p>
  </div>
</template>