<script setup>
import { computed, nextTick, ref, watch, onBeforeUnmount } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import BaseButton from '@/components/BaseButton.vue'
import { useConfirmacao } from '@/composables/useConfirmacao'

/**
 * O diálogo do useConfirmacao. Montado uma vez, no App.vue.
 * Esc ou clique fora = Cancelar; Enter = Confirmar (o botão já vem com o foco).
 */
const { estado, responder } = useConfirmacao()
const botaoConfirmar = ref(null)

const perigo = computed(() => estado.tom === 'perigo')

function aoApertarTecla(e) {
  if (e.key === 'Escape') responder(false)
}

watch(
  () => estado.aberto,
  async (sim) => {
    if (sim) {
      window.addEventListener('keydown', aoApertarTecla)
      await nextTick()
      botaoConfirmar.value?.$el?.focus?.()
    } else {
      window.removeEventListener('keydown', aoApertarTecla)
    }
  },
)

onBeforeUnmount(() => window.removeEventListener('keydown', aoApertarTecla))
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150"
      enter-from-class="opacity-0"
      leave-active-class="transition duration-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="estado.aberto"
        class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
        @mousedown.self="responder(false)"
      >
        <section
          role="alertdialog"
          aria-modal="true"
          :aria-label="estado.titulo"
          class="glass w-full max-w-md bg-slate-900/95 p-6"
        >
          <div class="flex items-start gap-4">
            <span
              :class="[
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border',
                perigo
                  ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                  : 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
              ]"
            >
              <AppIcon :nome="estado.icone" traco="2" class="h-5 w-5" />
            </span>

            <div class="min-w-0 flex-1">
              <h2 class="font-display text-[16px] font-semibold text-white">{{ estado.titulo }}</h2>
              <p
                v-if="estado.destaque"
                class="mt-2 truncate rounded-lg border border-slate-700 bg-slate-950/50 px-2.5 py-1.5
                       font-mono text-[12px] text-slate-200"
                :title="estado.destaque"
              >
                {{ estado.destaque }}
              </p>
              <p v-if="estado.mensagem" class="mt-3 text-[13px] leading-relaxed text-slate-300">
                {{ estado.mensagem }}
              </p>
              <p v-if="estado.detalhe" class="mt-2 text-[12px] leading-relaxed text-slate-500">
                {{ estado.detalhe }}
              </p>
            </div>
          </div>

          <footer class="mt-6 flex justify-end gap-2">
            <BaseButton variante="fantasma" @click="responder(false)">{{ estado.textoCancelar }}</BaseButton>
            <BaseButton
              ref="botaoConfirmar"
              :class="perigo ? '!bg-none !bg-rose-500 !text-[#fff] !shadow-rose-500/20 hover:!bg-rose-400' : ''"
              @click="responder(true)"
            >
              {{ estado.textoConfirmar }}
            </BaseButton>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
