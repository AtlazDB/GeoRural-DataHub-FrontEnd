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
 * calculationModel: POINT_DENSITY (pontos por área) | AREA_COVERAGE (% de área coberta)
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