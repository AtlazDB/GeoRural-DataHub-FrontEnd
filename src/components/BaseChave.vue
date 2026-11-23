<script setup>
/**
 * Chave liga/desliga (ativar e desativar fontes, indicadores e usuários).
 *
 * Só mostra o estado e avisa o clique: quem chama decide o que fazer (evento 'alternar').
 *   <BaseChave :ligada="fonte.status !== 'inativa'" rotulo="fonte FOCOS" @alternar="..." />
 */
defineProps({
  ligada: { type: Boolean, required: true },
  /** o que a chave liga, para leitores de tela: "Ativar a fonte FOCOS" */
  rotulo: { type: String, required: true },
  /** desliga a chave (ex.: enquanto o pedido está indo para a API) */
  ocupada: { type: Boolean, default: false },
  /** some com a chave sem esconder o motivo: vai no title (ex.: "Você não pode desativar a si mesmo") */
  bloqueadaPor: { type: String, default: '' },
})

defineEmits(['alternar'])
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="ligada"
    :aria-label="`${ligada ? 'Desativar' : 'Ativar'} ${rotulo}`"
    :title="bloqueadaPor || undefined"
    :disabled="ocupada || !!bloqueadaPor"
    :class="[
      'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition',
      'disabled:opacity-50',
      ocupada ? 'disabled:cursor-wait' : 'disabled:cursor-not-allowed',
      ligada ? 'bg-cyan-500' : 'bg-slate-700',
    ]"
    @click="$emit('alternar')"
  >
    <!-- Bolinha sempre branca (bg-[#fff]): no modo claro o "white" do tema vira escuro. -->
    <span
      :class="[
        'inline-block h-4 w-4 rounded-full bg-[#fff] shadow transition',
        ligada ? 'translate-x-[18px]' : 'translate-x-0.5',
      ]"
    />
  </button>
</template>
