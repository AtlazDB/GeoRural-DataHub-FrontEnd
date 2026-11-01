/**
 * Quem processa é o Airflow, pelo caminho genérico guiado pelo mapeamento de
 * colunas: zip (shapefile ou páginas GeoJSON da coleta por link) e GeoJSON, de
 * qualquer fonte. É a mesma lista do EXTENSOES_PROCESSAVEIS da DAG (gravacao.py,
 * repositório principal) — se ela mudar lá, mude aqui também.
 *
 * Esses arquivos ganham o botão "Processar", para processar de novo depois de
 * mapear as colunas ou de um REJEITADO, e a tela acompanha a fila logo depois
 * do upload.
 */
const EXTENSOES_PROCESSAVEIS = ['.zip', '.geojson', '.json']

export function ehProcessavel(arquivo) {
  const nome = arquivo?.nome?.toLowerCase() ?? ''
  return EXTENSOES_PROCESSAVEIS.some((ext) => nome.endsWith(ext))
}
