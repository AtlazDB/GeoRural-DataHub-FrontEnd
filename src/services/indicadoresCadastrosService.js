import http from './http'

/**
 * Indicadores cadastrados pelo usuário (US13): o usuário escolhe uma fonte, um
 * modelo de cálculo pronto e as faixas de status. Não confundir com o IRL/IFC
 * (indicadoresService.js), que são fixos.
 *
 *   POST /indicators
 *        body → { code, name, unit, description, fonteId, calculationModel,
 *                 parameters, ranges: [ { status, limit, includeLimit }, ..., { status } ] }
 *        201 → o indicador cadastrado (mesma forma do GET)
 *        400 → { mensagem, campos: [...] }   (campo inválido; ex.: campos = ['ranges'])
 *        409 → { mensagem }                  (sigla já usada, mesmo por indicador desativado)
 *
 *   GET  /indicators
 *        200 → [ { code, name, unit, description, fonteId, calculationModel,
 *                  parameters, ranges, active, createdAt } ]
 *
 *   GET  /indicators/:code
 *        200 → um indicador · 404 → { mensagem }
 *
 *   POST /indicators/:code/deactivate
 *        204 · 404 → { mensagem }
 *
 *   POST /indicators/:code/calculate
 *        202 (só dispara a DAG calcular_indicador no Airflow; leva alguns minutos)
 *        400 → { mensagem } (desativado) · 404 · 503 → { mensagem } (Airflow fora do ar)
 *
 *   GET  /indicators/:code/results?codImovel=
 *        200 → { indicatorCode, codImovel, value, status, numerator, areaImovelHa, calculatedAt }
 *              (o resultado sobre a versão do imóvel publicada na imovel_rural)
 *        404 → { mensagem } (indicador não existe ou ainda não calculado para o imóvel)
 *
 * calculationModel: POINT_DENSITY (pontos por área) | AREA_COVERAGE (% de área coberta)
 *   | BASE_COVERAGE (% de uma camada base coberta, ex.: APP com vegetação = IAPP)
 * parameters: factor, category, since (AAAA-MM-DD), extraSources [ids], baseSources [ids]
 * status das faixas: CONFORME | ALERTA | CRITICO | VALIDACAO
 */

export async function listarIndicadores() {
  const { data } = await http.get('/indicators')
  return data
}

export async function buscarIndicador(code) {
  const { data } = await http.get(`/indicators/${encodeURIComponent(code)}`)
  return data
}

export async function cadastrarIndicador(indicador) {
  const { data } = await http.post('/indicators', indicador)
  return data
}

export async function desativarIndicador(code) {
  await http.post(`/indicators/${encodeURIComponent(code)}/deactivate`)
}

export async function calcularIndicador(code) {
  await http.post(`/indicators/${encodeURIComponent(code)}/calculate`)
}

/**
 * O indicador agregado por município: [{ codIbge, name, state, properties, conforme, alerta,
 * critico, validacao, averageValue, numeratorSum }]. Lista vazia se ainda não foi calculado;
 * imóveis sem município vêm numa linha com name null.
 */
export async function buscarPorMunicipio(code) {
  const { data } = await http.get(`/indicators/${encodeURIComponent(code)}/municipalities`)
  return data
}

/** O resultado do indicador para o imóvel, ou null se ainda não foi calculado (404). */
export async function buscarResultado(code, codImovel) {
  try {
    const { data } = await http.get(`/indicators/${encodeURIComponent(code)}/results`, {
      params: { codImovel },
    })
    return data
  } catch (e) {
    if (e.original?.response?.status === 404) return null
    throw e
  }
}