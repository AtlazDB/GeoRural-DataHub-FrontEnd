import http from './http'

/**
 * Camadas extras do mapa da consulta: a Reserva Legal e cada fonte do insumo
 * genérico (APP, vegetação nativa, UC...). Fonte nova cadastrada no insumo
 * aparece sozinha na lista.
 *
 *   GET /camadas
 *       200 → [{ id, nome, tipo, sigla }]   id: "reserva-legal" ou "fonte-{id}"
 *   GET /camadas/:id/mapa?minLon=&minLat=&maxLon=&maxLat=&limite=1000
 *       200 → FeatureCollection + { truncado, limite }  (mesmo formato do /imoveis/mapa)
 *       400 → área inválida ou grande demais (mais de 2° de largura)
 *       404 → camada inexistente
 */

export async function listarCamadas() {
  const { data } = await http.get('/camadas')
  return data
}

/**
 * Geometrias de uma camada dentro da caixa visível. `signal` (AbortController)
 * cancela o pedido anterior quando o usuário continua arrastando o mapa.
 */
export async function buscarCamadaNoMapa(id, caixa, { limite = 1000, signal } = {}) {
  const { data } = await http.get(`/camadas/${encodeURIComponent(id)}/mapa`, {
    params: { ...caixa, limite },
    signal,
  })
  return data
}
