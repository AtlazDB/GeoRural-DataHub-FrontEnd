/**
 * Quem processa é o Airflow, pelo caminho genérico guiado pelo mapeamento de
 * colunas: zip (shapefile ou páginas GeoJSON da coleta por link), GeoJSON e CSV
 * (geometria opcional, por coluna WKT ou latitude/longitude), de qualquer fonte. É a mesma lista do EXTENSOES_PROCESSAVEIS da DAG (gravacao.py,
 * repositório principal) — se ela mudar lá, mude aqui também.
 *
 * Esses arquivos ganham o botão "Processar", para processar de novo depois de
 * mapear as colunas ou de um REJEITADO, e a tela acompanha a fila logo depois
 * do upload.
 */
const EXTENSOES_PROCESSAVEIS = ['.zip', '.geojson', '.json', '.csv']

export function ehProcessavel(arquivo) {
  const nome = arquivo?.nome?.toLowerCase() ?? ''
  return EXTENSOES_PROCESSAVEIS.some((ext) => nome.endsWith(ext))
}
