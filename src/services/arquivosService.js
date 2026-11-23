import http from './http'

/**
 * Arquivos já recebidos na zona bruta.
 *
 *   POST /arquivos/:id/processar
 *        200 → { arquivoId, status: 'PROCESSANDO' }   (Airflow disparado)
 *        404 → { mensagem }
 *        409 → { mensagem }   (o arquivo já está sendo processado)
 *        503 → { mensagem }   (Airflow fora do ar: o arquivo fica RECEBIDO)
 *
 *   POST /arquivos/:id/cancelar
 *        200 → { arquivoId, status: 'REJEITADO' }   (execução encerrada no Airflow)
 *        409 → { mensagem }   (o arquivo não está sendo processado)
 *        503 → { mensagem }   (Airflow fora do ar: o arquivo continua PROCESSANDO)
 *
 *   DELETE /arquivos/:id
 *        204 → (sem corpo)
 *        404 → { mensagem }
 *        409 → { mensagem }   (não está REJEITADO, ou já gerou versão de dados)
 *
 * O resultado do processamento (PROCESSADO, REJEITADO, AGUARDANDO_MAPEAMENTO)
 * não vem nesta resposta: chega depois, pelo status do arquivo.
 */

/**
 * Dispara o Airflow, que processa o arquivo pelo mapeamento da fonte.
 * A resposta é imediata; o andamento aparece no status do arquivo.
 *
 * @param {number} arquivoId
 * @returns {Promise<{arquivoId: number, status: string}>}
 */
export async function processarArquivo(arquivoId) {
  const { data } = await http.post(`/arquivos/${arquivoId}/processar`)
  return data
}

/**
 * Interrompe o processamento em andamento: o Airflow encerra a execução e o
 * arquivo fica REJEITADO, pronto para ser processado de novo do começo.
 * 409 se o arquivo não está PROCESSANDO; 503 se o Airflow está fora do ar
 * (aí o arquivo continua PROCESSANDO).
 *
 * @param {number} arquivoId
 * @returns {Promise<{arquivoId: number, status: string}>}
 */
export async function cancelarArquivo(arquivoId) {
  const { data } = await http.post(`/arquivos/${arquivoId}/cancelar`)
  return data
}

/**
 * Exclui um arquivo REJEITADO: some do catálogo e da zona bruta, sem volta.
 * O back-end só aceita arquivo rejeitado que nunca gerou versão de dados;
 * nos outros casos responde 409 com a mensagem pronta.
 *
 * @param {number} arquivoId
 */
export async function excluirArquivo(arquivoId) {
  await http.delete(`/arquivos/${arquivoId}`)
}
