<script setup>
import { computed } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import BaseButton from '@/components/BaseButton.vue'
import { formatarArea, formatarNumero, formatarSituacao } from '@/utils/formato'

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
})

defineEmits(['selecionar', 'mudar-pagina', 'tentar-novamente'])

const totalPaginas = computed(() => Math.max(1, Math.ceil(props.total / props.tamanho)))
const primeiro = computed(() => (props.pagina - 1) * props.tamanho + 1)
const ultimo = computed(() => Math.min(props.pagina * props.tamanho, props.total))
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
    <!-- No celular a tabela fica dentro da gaveta, que já rola: mais baixa,
         para não ser uma rolagem grande dentro da outra. -->
    <div class="max-h-[40dvh] overflow-auto overscroll-contain rounded-xl border border-slate-800 lg:max-h-[440px]">
      <table class="w-full text-left text-sm">
        <thead class="sticky top-0 bg-slate-900 text-[10.5px] uppercase tracking-wider text-slate-500">
          <tr>
            <th class="px-3 py-2.5 font-semibold">Código</th>
            <th class="px-3 py-2.5 font-semibold">Município</th>
            <th class="px-3 py-2.5 font-semibold">Situação</th>
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
            <td class="px-3 py-2.5 font-mono text-[12px] text-cyan-400">{{ imovel.codImovel }}</td>
            <td class="px-3 py-2.5">{{ imovel.municipio ?? '—' }}</td>
            <td class="px-3 py-2.5">{{ formatarSituacao(imovel.situacao) }}</td>
            <td class="whitespace-nowrap px-3 py-2.5 text-right">{{ formatarArea(imovel.areaHa) }}</td>
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
