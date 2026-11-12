<script setup>
import { computed } from 'vue'
import { formatarDataHora, formatarNumero } from '@/utils/formato'
import { hashCurto, nomeConjunto } from '@/utils/indicadores'

const props = defineProps({
  versoes: { type: Array, default: () => [] },
  carregando: { type: Boolean, default: false },
  erro: { type: String, default: '' },
})

defineEmits(['tentar-novamente'])

const porConjunto = computed(() => {
  const grupos = new Map()
  for (const v of props.versoes) {
    if (!grupos.has(v.conjunto)) grupos.set(v.conjunto, [])
    grupos.get(v.conjunto).push(v)
  }
  return [...grupos.entries()].map(([conjunto, lista]) => ({ conjunto, lista }))
})

function resumo(v) {
  if (v.novos == null) return null
  const partes = []
  if (v.novos) partes.push(`+${formatarNumero(v.novos)} ${v.novos === 1 ? 'novo' : 'novos'}`)
  if (v.alterados) partes.push(`${formatarNumero(v.alterados)} ${v.alterados === 1 ? 'alterado' : 'alterados'}`)
  if (v.removidos) partes.push(`${formatarNumero(v.removidos)} ${v.removidos === 1 ? 'removido' : 'removidos'}`)
  return partes.length ? partes.join(' · ') : 'nenhum imóvel mudou'
}
</script>

<template>
  <div>
    <p class="mb-4 max-w-3xl text-[13px] text-slate-400">
      Cada processamento gera uma versão dos dados. Versões antigas nunca são alteradas: é isso que
      permite comparar o antes e o depois e explicar por que um indicador mudou.
    </p>

    <div v-if="carregando" class="rounded-xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">
      Carregando as versões…
    </div>

    <div v-else-if="erro" class="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-300">
      {{ erro }}
      <button type="button" class="ml-2 underline hover:text-rose-200" @click="$emit('tentar-novamente')">Tentar de novo</button>
    </div>

    <p
      v-else-if="!versoes.length"
      class="rounded-xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400"
    >
      Nenhuma versão ainda. A primeira é criada quando um arquivo desta fonte é processado com sucesso.
    </p>

    <div v-else class="space-y-6">
      <section v-for="grupo in porConjunto" :key="grupo.conjunto">
        <p
          v-if="porConjunto.length > 1"
          class="mb-3 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500"
        >
          {{ nomeConjunto(grupo.conjunto) }}
        </p>
        <ol>
          <li v-for="(v, i) in grupo.lista" :key="v.id" class="relative flex gap-4 pb-5 last:pb-0">
            <span
              v-if="i < grupo.lista.length - 1"
              class="absolute left-[19px] top-10 h-[calc(100%-28px)] w-0.5 bg-slate-700/60"
            />
            <span
              :class="[
                'relative grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 bg-base font-mono text-[12px] font-semibold',
                v.atual ? 'border-cyan-400 text-cyan-300' : 'border-slate-600 text-slate-400',
              ]"
            >
              v{{ v.versao }}
            </span>
            <div
              :class="[
                'min-w-0 flex-1 rounded-xl border p-3.5',
                v.atual ? 'border-cyan-500/40 bg-cyan-500/[0.06]' : 'border-slate-800 bg-slate-950/40',
              ]"
            >
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                  <span
                    :class="[
                      'rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                      v.atual
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                        : 'border-slate-500/40 bg-slate-500/10 text-slate-300',
                    ]"
                  >
                    {{ v.atual ? 'Atual' : 'Imutável' }}
                  </span>
                  <span class="font-mono text-[11.5px] text-slate-400">{{ formatarDataHora(v.processadoEm) }}</span>
                </div>
                <span v-if="v.execucaoId" class="font-mono text-[11px] text-slate-500">execução #{{ v.execucaoId }}</span>
              </div>
              <p class="mt-2 truncate text-[12.5px] text-slate-300" :title="v.arquivo">
                {{ v.arquivo || '—' }}
                <span class="font-mono text-slate-500" :title="v.hash"> · {{ hashCurto(v.hash) }}</span>
                <span v-if="v.origem" class="text-slate-500"> · {{ v.origem === 'COLETA' ? 'coleta' : 'upload' }}</span>
              </p>
              <p class="text-[12px] text-slate-500">
                <template v-if="v.registros != null">
                  <span class="tabular-nums">{{ formatarNumero(v.registros) }}</span> registros
                </template>
                <template v-if="resumo(v)"> · {{ resumo(v) }}</template>
              </p>
            </div>
          </li>
        </ol>
      </section>
    </div>
  </div>
</template>
