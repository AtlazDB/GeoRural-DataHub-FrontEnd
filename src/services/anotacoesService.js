import http from './http'

/** Anotação do usuário logado ({ content, updatedAt }); texto vazio se ele nunca salvou. */
export async function buscarAnotacoes() {
  const { data } = await http.get('/notes/me')
  return data
}

/** Troca o texto inteiro da anotação do usuário logado. */
export async function salvarAnotacoes(content) {
  const { data } = await http.put('/notes/me', { content })
  return data
}
