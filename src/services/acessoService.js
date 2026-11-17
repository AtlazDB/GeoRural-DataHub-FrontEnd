import http from './http'

/** Região do usuário logado: { todas, municipios: [{ codIbge, nome }] }. Só o analista pode ser restrito. */
export async function buscarMeuAcesso() {
  const { data } = await http.get('/acesso')
  return data
}
