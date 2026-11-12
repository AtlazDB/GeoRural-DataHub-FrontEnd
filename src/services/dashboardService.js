
import http from './http'

export async function buscarDashboard() {
  const resposta = await http.get('/dashboard')
  return resposta.data
}
