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

/**
 * Liga ou desliga o acesso do usuário (enabled no Keycloak). Devolve o usuário atualizado.
 *   POST /usuarios/:id/ativar · POST /usuarios/:id/desativar
 *   409 → o gestor tentou desativar a si mesmo
 */
export async function alterarAtivoUsuario(id, ativo) {
  const { data } = await http.post(`/usuarios/${id}/${ativo ? 'ativar' : 'desativar'}`)
  return data
}

/**
 * Perfis que podem ser atribuídos: os 4 do sistema e os combinados criados pelo gestor.
 *   GET /usuarios/perfis → [ { codigo, descricao, doSistema, inclui: ['ANALISTA', ...] } ]
 */
export async function listarPerfis() {
  const { data } = await http.get('/usuarios/perfis')
  return data
}

/**
 * Cria um perfil combinado (role composta no Keycloak).
 *   POST /usuarios/perfis { nome, descricao, inclui }  201 → o perfil · 400 · 409 (nome repetido)
 */
export async function criarPerfil(perfil) {
  const { data } = await http.post('/usuarios/perfis', perfil)
  return data
}

/**
 * Muda a descrição de um perfil combinado (os 4 do sistema não mudam).
 *   PUT /usuarios/perfis/:codigo { descricao }  200 → o perfil · 400 · 409 (perfil do sistema)
 */
export async function editarDescricaoPerfil(codigo, descricao) {
  const { data } = await http.put(`/usuarios/perfis/${encodeURIComponent(codigo)}`, { descricao })
  return data
}

/**
 * Redefine a senha (perda ou esquecimento). É provisória: a pessoa troca no próximo login.
 *   POST /usuarios/:id/senha { senhaProvisoria }  204 · 400 (senha recusada) · 404
 */
export async function redefinirSenha(id, senhaProvisoria) {
  await http.post(`/usuarios/${id}/senha`, { senhaProvisoria })
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
