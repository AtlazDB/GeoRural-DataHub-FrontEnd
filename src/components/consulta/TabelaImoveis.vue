<script setup>
import { computed } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import BaseButton from '@/components/BaseButton.vue'
import { formatarArea, formatarNumero, formatarSituacao } from '@/utils/formato'
import { CORES_STATUS } from '@/utils/indicadores'

/**
 * Uma página da tabela de imóveis. Mesmo padrão da FonteList: estados de
 * carregando, erro, vazia e preenchida, e nenhuma chamada à API — a view
 * busca a página e esta tabela só pede outra pelo evento `mudar-pagina`.
 */
const props = defineProps({
  itens: { type: Array, required: true },
  total: { type: Number, default: 0 },
  pagina: { type: Number, default: 1 },
  tamanho: { type: Number, default: 50 },
  carregando: { type: Boolean, default: false },
  erro: { type: String, default: '' },
  selecionadoCod: { type: String, default: null },
  /** Mapa { [codImovel]: { status, quantidade, calculados } } carregado sob demanda */
  resumoIndicadores: { type: Object, default: () => ({}) },
  carregandoIndicadores: { type: Boolean, default: false },
  avisoIndicadores: { type: String, default: '' },
})

defineEmits(['selecionar', 'mudar-pagina', 'tentar-novamente', 'carregar-indicadores'])

const ROTULO_STATUS = {
  CONFORME: 'Conforme',
  ALERTA: 'Alerta',
  CRITICO: 'Crítico',
  VALIDACAO: 'Em validação',
}

const totalPaginas = computed(() => Math.max(1, Math.ceil(props.total / props.tamanho)))
const primeiro = computed(() => (props.pagina - 1) * props.tamanho + 1)
const ultimo = computed(() => Math.min(props.pagina * props.tamanho, props.total))

/**
 * O código do CAR é longo (PR-4100103- + 32 letras/números) e quebrava a tabela. Mostra o começo e o
 * fim ("PR-4100103-A2D6…72AA"); o código inteiro fica no title (passar o mouse) e no card do imóvel.
 */
function codigoCurto(codigo) {
  if (!codigo || codigo.length <= 22) return codigo
  return `${codigo.slice(0, 15)}…${codigo.slice(-4)}`
}

function estiloStatus(status) {
  return CORES_STATUS[status] ?? CORES_STATUS.VALIDACAO
}
</script>

<template>
  <!-- Estado 1: carregando pela primeira vez (depois, a página antiga fica
       na tela, apagada, até a nova chegar) -->
  <div v-if="carregando && !itens.length" class="space-y-2">
    <div v-for="n in 4" :key="n" class="h-10 animate-pulse rounded-lg bg-slate-800/30" />
  </div>

  <!-- Estado 2: deu erro -->
  <div v-else-if="erro" class="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm">
    <p class="font-medium text-red-300">Não deu para carregar os imóveis</p>
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

  <!-- Estado 3: nenhum imóvel -->
  <div
    v-else-if="!itens.length"
    class="rounded-xl border border-dashed border-slate-700 p-8 text-center"
  >
    <p class="text-sm text-slate-400">Nenhum imóvel encontrado.</p>
    <p class="mt-1 text-xs text-slate-600">Tente outro município ou limpe o filtro.</p>
  </div>

  <!-- Estado 4: a tabela -->
  <div v-else :class="['transition-opacity', carregando && 'opacity-50']">
    <div class="mb-2 flex items-center justify-between gap-2">
      <p class="min-w-0 truncate text-[11px] text-slate-400">
        {{ avisoIndicadores }}
      </p>
      <BaseButton
        variante="fantasma"
        tamanho="sm"
        class="shrink-0"
        :carregando="carregandoIndicadores"
        :disabled="carregando || carregandoIndicadores"
        @click="$emit('carregar-indicadores')"
      >
        <AppIcon nome="atualizar" traco="2.2" class="mr-1 h-3 w-3" />
        Indicadores da página
      </BaseButton>
    </div>

    <!-- No celular a tabela fica dentro da gaveta, que já rola: mais baixa,
         para não ser uma rolagem grande dentro da outra. -->
    <div class="max-h-[40dvh] overflow-auto overscroll-contain rounded-xl border border-slate-800 lg:max-h-[440px]">
      <table class="w-full text-left text-sm">
        <thead class="sticky top-0 z-10 bg-slate-900 text-[10.5px] uppercase tracking-wider text-slate-500">
          <tr>
            <th class="px-3 py-2.5 font-semibold">Imóvel</th>
            <th class="px-3 py-2.5 font-semibold">Situação</th>
            <th class="px-3 py-2.5 font-semibold">Indicadores</th>
            <th class="px-3 py-2.5 text-right font-semibold">Área</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-800/80">
          <tr
            v-for="imovel in itens"
            :key="imovel.codImovel"
            tabindex="0"
            :aria-selected="selecionadoCod === imovel.codImovel"
            class="cursor-pointer transition focus:outline-none focus-visible:bg-slate-800/60"
            :class="
              selecionadoCod === imovel.codImovel
                ? 'bg-cyan-500/10 text-cyan-100'
                : 'text-slate-300 hover:bg-slate-900/60'
            "
            @click="$emit('selecionar', imovel)"
            @keydown.enter.prevent="$emit('selecionar', imovel)"
            @keydown.space.prevent="$emit('selecionar', imovel)"
          >
            <!-- Código (curto, inteiro no title) em cima e município embaixo: cabe sem rolar para o lado. -->
            <td class="px-3 py-2" :title="imovel.codImovel">
              <span class="block whitespace-nowrap font-mono text-[12px] text-cyan-400">{{ codigoCurto(imovel.codImovel) }}</span>
              <span class="block text-[12px] text-slate-400">{{ imovel.municipio ?? '—' }}</span>
            </td>
            <td class="whitespace-nowrap px-3 py-2 text-[12.5px]">{{ formatarSituacao(imovel.situacao) }}</td>
            <td class="whitespace-nowrap px-3 py-2 text-[12px]">
              <template v-if="resumoIndicadores[imovel.codImovel]?.status">
                <span
                  :class="[
                    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                    estiloStatus(resumoIndicadores[imovel.codImovel].status).etiqueta,
                  ]"
                  :title="`${resumoIndicadores[imovel.codImovel].calculados}/${resumoIndicadores[imovel.codImovel].quantidade} calculado(s)`"
                >
                  {{ ROTULO_STATUS[resumoIndicadores[imovel.codImovel].status] ?? resumoIndicadores[imovel.codImovel].status }}
                </span>
              </template>
              <span v-else class="text-slate-500">—</span>
            </td>
            <td class="whitespace-nowrap px-3 py-2 text-right text-[12.5px] tabular-nums">{{ formatarArea(imovel.areaHa) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
      <span>
        {{ formatarNumero(primeiro) }}–{{ formatarNumero(ultimo) }} de
        {{ formatarNumero(total) }} {{ total === 1 ? 'imóvel' : 'imóveis' }}
      </span>

      <div class="flex items-center gap-2">
        <BaseButton
          variante="fantasma"
          tamanho="sm"
          :disabled="carregando || pagina <= 1"
          @click="$emit('mudar-pagina', pagina - 1)"
        >
          Anterior
        </BaseButton>
        <span class="whitespace-nowrap">
          Página {{ formatarNumero(pagina) }} de {{ formatarNumero(totalPaginas) }}
        </span>
        <BaseButton
          variante="fantasma"
          tamanho="sm"
          :disabled="carregando || pagina >= totalPaginas"
          @click="$emit('mudar-pagina', pagina + 1)"
        >
          Próxima
        </BaseButton>
      </div>
    </div>
  </div>
</template>