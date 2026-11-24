import { ref } from 'vue'

// Menu do sistema no celular (< 768 px): fica escondido e abre como gaveta pelo botão do topo.
// No tablet e no desktop ele é sempre visível e este estado não muda nada.
const aberto = ref(false)

export function useMenu() {
  return {
    aberto,
    abrir: () => (aberto.value = true),
    fechar: () => (aberto.value = false),
  }
}
