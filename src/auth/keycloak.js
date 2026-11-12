import Keycloak from 'keycloak-js'

/**
 * Login do front com o Keycloak (Authorization Code + PKCE, sem senha passando pelo front).
 *
 * Variáveis (.env.development / .env.example), todas opcionais: sem elas, vale o Keycloak local
 * do docker-compose do back.
 *   VITE_KEYCLOAK_URL        padrão: http://localhost:8081
 *   VITE_KEYCLOAK_REALM      padrão: georural
 *   VITE_KEYCLOAK_CLIENT_ID  padrão: georural-frontend
 *   VITE_AUTH_HABILITADO     "false" desliga o login (útil com o mock do back, que não valida token)
 *
 * O token fica só em memória: recarregar a página refaz o login silenciosamente (sessão do Keycloak).
 */

// Roles que o Keycloak coloca em todo token e que não são perfis do GeoRural.
const ROLES_PADRAO = ['offline_access', 'uma_authorization']

const habilitado = import.meta.env.VITE_AUTH_HABILITADO !== 'false'

let keycloak = null

/** Inicia o login. Se a pessoa não estiver logada, redireciona para a tela do Keycloak. */
export async function iniciarAuth() {
  if (!habilitado) return false

  keycloak = new Keycloak({
    url: import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8081',
    realm: import.meta.env.VITE_KEYCLOAK_REALM || 'georural',
    clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'georural-frontend',
  })

  await keycloak.init({
    onLoad: 'login-required',
    pkceMethod: 'S256',
    // Sem o iframe de verificação de sessão: ele depende de cookies de terceiros e falha em vários navegadores.
    checkLoginIframe: false,
  })

  // Token vence em 15 min: ao expirar, renova; se a sessão acabou, volta para o login.
  keycloak.onTokenExpired = () => {
    keycloak.updateToken(30).catch(() => keycloak.login())
  }

  // Só em desenvolvimento: permite conferir o token no console do navegador (window.keycloak).
  if (import.meta.env.DEV) window.keycloak = keycloak

  return true
}

/** Token válido para o header Authorization (renova antes se estiver perto de vencer). */
export async function obterToken() {
  if (!keycloak) return null
  try {
    await keycloak.updateToken(30)
  } catch {
    keycloak.login()
    return null
  }
  return keycloak.token
}

/** Dados da pessoa logada, para mostrar no topo. */
export function usuarioLogado() {
  const t = keycloak?.tokenParsed
  if (!t) return null
  return { nome: t.name || t.preferred_username, usuario: t.preferred_username, email: t.email }
}

/** Perfis da pessoa (ex.: ['ANALISTA']), sem as roles padrão do Keycloak. */
export function perfis() {
  const roles = keycloak?.tokenParsed?.realm_access?.roles ?? []
  return roles.filter((r) => !r.startsWith('default-roles-') && !ROLES_PADRAO.includes(r))
}

/** true se a pessoa tem pelo menos um dos perfis. Só esconde telas: quem barra de verdade é o back. */
export function temPerfil(...lista) {
  return perfis().some((p) => lista.includes(p))
}

/**
 * Pode ver/usar algo que exige um desses perfis? Sem exigência (lista vazia ou ausente) = liberado.
 * Com o login desligado (mock), tudo fica liberado.
 */
export function podeAcessar(perfisExigidos) {
  if (!habilitado) return true
  if (!perfisExigidos || perfisExigidos.length === 0) return true
  return temPerfil(...perfisExigidos)
}

/** Manda a pessoa de volta para a tela de login (sessão expirada ou inválida). */
export function reautenticar() {
  if (keycloak) keycloak.login()
}

export function sair() {
  if (keycloak) keycloak.logout({ redirectUri: window.location.origin })
}