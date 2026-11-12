import axios from 'axios'
import { obterToken, reautenticar } from '@/auth/keycloak'

/**
 * Instância única do Axios usada por toda a aplicação.
 *
 * A URL do servidor vem do arquivo .env.development (VITE_API_URL).
 * Quando o back-end de verdade estiver pronto, basta trocar essa
 * variável: nenhum componente muda.
 */
const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 60_000,
})

/**
 * Interceptor de requisição: anexa o token do Keycloak (Authorization: Bearer ...).
 * O token é renovado antes de vencer. Com o login desligado (VITE_AUTH_HABILITADO=false),
 * não há token e a requisição segue sem o header.
 */
http.interceptors.request.use(async (config) => {
  const token = await obterToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

/**
 * Interceptor de erro: transforma qualquer falha do Axios numa Error
 * com mensagem legível em português, para o componente só precisar
 * fazer `catch (e) { erro.value = e.message }`.
 *
 * 401 = sessão inválida ou expirada: volta para o login.
 * 403 = perfil sem permissão: a mensagem vem do back ("Você não tem permissão...").
 */
http.interceptors.response.use(
  (resposta) => resposta,
  (erro) => {
    if (erro.response?.status === 401) reautenticar()

    const mensagem =
      erro.response?.data?.mensagem ||
      (erro.code === 'ECONNABORTED' && 'O servidor demorou demais para responder.') ||
      (!erro.response && 'Não foi possível falar com o servidor. Ele está rodando?') ||
      `Erro ${erro.response?.status} ao falar com o servidor.`

    return Promise.reject(Object.assign(new Error(mensagem), { original: erro, status: erro.response?.status }))
  },
)

export default http