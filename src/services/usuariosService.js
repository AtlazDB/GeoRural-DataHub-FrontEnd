import http from './http'

/**
 * Gestão de usuários e perfis (T28). Só o GESTOR acessa; o back responde 403 para os outros.
 * Perfis = os 4 do GeoRural: OPERADOR_DADOS, ANALISTA, AUDITOR, GESTOR.
 */

/** Página de usuários, cada um com a lista de perfis. busca é opcional (nome, usuário ou e-mail). */
export async function listarUsuarios({ busca = '', pagina = 0, tamanho = 20 } = {}) {
  const { data } = await http.get('/usuarios', {
    params: { busca: busca || undefined, pagina, tamanho },
  })
  return data
}

/** Um usuário com seus perfis. */
export async function buscarUsuario(id) {
  const { data } = await http.get(`/usuarios/${id}`)
  return data
}

/** Define os perfis do usuário (substitui o conjunto atual). Devolve o usuário atualizado. */
export async function salvarPerfis(id, perfis) {
  const { data } = await http.put(`/usuarios/${id}/perfis`, { perfis })
  return data
}
/** Cria o usuário no Keycloak com perfis e cidades. A senha é provisória (troca no primeiro login). */
export async function criarUsuario(usuario) {
  const { data } = await http.post('/usuarios', usuario)
  return data
}

/** { todas, municipios: [{ codIbge, nome }] } — todas = true quando não há restrição. */
export async function buscarMunicipiosDoUsuario(id) {
  const { data } = await http.get(`/usuarios/${id}/municipios`)
  return data
}

/** Troca as cidades liberadas. todas = true volta para o Paraná inteiro. */
export async function salvarMunicipiosDoUsuario(id, { todas, municipios }) {
  const { data } = await http.put(`/usuarios/${id}/municipios`, { todas, municipios })
  return data
}
