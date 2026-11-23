<script setup>
/**
 * Botão padrão da aplicação. Uso:
 *
 *   <BaseButton :carregando="salvando">Cadastrar fonte</BaseButton>
 *   <BaseButton variante="secundario" tamanho="sm">+ Nova fonte</BaseButton>
 *   <BaseButton variante="fantasma" @click="cancelar">Cancelar</BaseButton>
 *
 * As três variantes vêm direto do protótipo:
 *   primario   — ação principal da tela (gradiente ciano → índigo)
 *   secundario — ação de apoio em destaque
 *   fantasma   — ação discreta (cancelar, desfazer)
 */
defineProps({
  variante: {
    type: String,
    default: 'primario',
    validator: (v) => ['primario', 'secundario', 'fantasma'].includes(v),
  },
  tamanho: {
    type: String,
    default: 'md',
    validator: (v) => ['sm', 'md'].includes(v),
  },
  carregando: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
})

const variantes = {
  primario:
    'botao-primario border-transparent bg-gradient-to-br from-cyan-500 to-indigo-500 text-[#04111d] shadow-lg shadow-cyan-500/20 hover:opacity-90',
  secundario:
    'border-cyan-500/30 bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/25',
  fantasma:
    'border-slate-700 text-slate-300 hover:border-slate-500 hover:text-slate-100',
}

const tamanhos = {
  sm: 'gap-1 px-2.5 py-1.5 text-[11px]',
  md: 'gap-2 px-4 py-2.5 text-sm',
}
</script>

<template>
  <button
    :disabled="disabled || carregando"
    :class="[
      'inline-flex items-center justify-center rounded-lg border font-medium transition',
      'disabled:cursor-not-allowed disabled:opacity-50',
      variantes[variante],
      tamanhos[tamanho],
    ]"
  >
    <span
      v-if="carregando"
      class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
    <slot />
  </button>
</template>
