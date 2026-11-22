import { reactive } from 'vue'

/**
 * Pergunta de confirmação no visual da plataforma, no lugar do window.confirm.
 * Uso (devolve uma Promise<boolean>):
 *
 *   const { confirmar } = useConfirmacao()
 *   if (!(await confirmar({ titulo: 'Excluir arquivo?', mensagem: '...', confirmar: 'Excluir', tom: 'perigo' }))) return
 *
 * Um diálogo só para a aplicação inteira: o <ConfirmacaoDialogo /> fica no App.vue.
 * tom: 'aviso' (padrão, ciano) | 'perigo' (vermelho, para o que não tem volta).
 */
const estado = reactive({
  aberto: false,
  titulo: '',
  mensagem: '',
  destaque: '',
  detalhe: '',
  textoConfirmar: 'Confirmar',
  textoCancelar: 'Cancelar',
  tom: 'aviso',
  icone: 'alerta',
})

let resolver = null

function responder(sim) {
  estado.aberto = false
  const r = resolver
  resolver = null
  r?.(sim)
}

function confirmar({
  titulo,
  mensagem = '',
  destaque = '',
  detalhe = '',
  confirmar: textoConfirmar = 'Confirmar',
  cancelar: textoCancelar = 'Cancelar',
  tom = 'aviso',
  icone = 'alerta',
} = {}) {
  // Uma pergunta nova responde "não" à que ainda estava aberta.
  if (resolver) responder(false)
  Object.assign(estado, { titulo, mensagem, destaque, detalhe, textoConfirmar, textoCancelar, tom, icone, aberto: true })
  return new Promise((resolve) => {
    resolver = resolve
  })
}

export function useConfirmacao() {
  return { estado, confirmar, responder }
}
