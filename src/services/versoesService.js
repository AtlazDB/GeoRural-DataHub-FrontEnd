import http from './http'

/** Versões de cada conjunto de dados da fonte, da mais nova para a mais antiga. */
export async function listarVersoesDaFonte(fonteId) {
  const { data } = await http.get(`/fontes/${fonteId}/versoes`)
  return data
}

/** Trilha da versão atual do imóvel, as versões dele e os indicadores com regra e versões usadas. */
export async function buscarOrigem(codImovel) {
  const { data } = await http.get(`/imoveis/${encodeURIComponent(codImovel)}/origem`)
  return data
}

/** Sem de/para, o back compara a versão mais nova com a anterior. */
export async function compararVersoes(codImovel, { de, para } = {}) {
  const { data } = await http.get(`/imoveis/${encodeURIComponent(codImovel)}/comparar`, {
    params: { de: de || undefined, para: para || undefined },
  })
  return data
}
