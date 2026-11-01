import http from './http'

/**
 * Arquivos já recebidos na zona bruta.
 *
 *   POST /arquivos/:id/processar
 *        200 → { arquivoId, status: 'RECEBIDO' }   (na fila do Airflow)
 *        404 → { mensagem }
 *        409 → { mensagem }   (o arquivo já está sendo processado)
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
 * Põe o arquivo na fila do Airflow, que o processa pelo mapeamento da fonte.
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
 * Exclui um arquivo REJEITADO: some do catálogo e da zona bruta, sem volta.
 * O back-end só aceita arquivo rejeitado que nunca gerou versão de dados;
 * nos outros casos responde 409 com a mensagem pronta.
 *
 * @param {number} arquivoId
 */
export async function excluirArquivo(arquivoId) {
  await http.delete(`/arquivos/${arquivoId}`)
}
