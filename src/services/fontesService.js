import http from './http'

/**
 * ==================================================================
 * CAMADA DE SERVIÇO — É AQUI QUE VOCÊ COMEÇA A TASK
 * ==================================================================
 *
 * Por que um "service" separado dos componentes?
 * Porque o componente não deveria saber que a API existe. Ele só pede
 * "me dê as fontes". Se amanhã a rota mudar de /fontes para
 * /api/v1/fontes, você altera um arquivo só — este.
 *
 * As três funções abaixo estão com o corpo vazio de propósito.
 * Implemente na ordem: TODO 1 → TODO 2 → TODO 3.
 *
 * Contrato do back-end (o mock em mock/server.js já responde assim):
 *
 *   GET  /fontes?busca=texto
 *        200 → [ { id, nome, sigla, orgao, formato, periodicidade,
 *                  status, criadaEm, arquivos: [...] } ]
 *
 *   POST /fontes
 *        body → { nome, sigla, orgao, formato, periodicidade }
 *        201 → a fonte criada
 *        400 → { mensagem, campos: [...] }   (faltou preencher algo)
 *        409 → { mensagem }                  (sigla repetida)
 *
 *   POST /fontes/:id/arquivos   (multipart/form-data, campo "arquivo")
 *        201 → { fonte, arquivo }
 *        415 → { mensagem }                  (extensão não aceita)
 */

/**
 * TODO 1 — Listar as fontes.
 *
 * Passos:
 *   a) chame `http.get('/fontes')`
 *   b) o Axios devolve um objeto de resposta; os dados estão em `.data`
 *   c) retorne esses dados
 *
 * Dica: com async/await isso vira duas linhas.
 *   const { data } = await http.get('/fontes')
 *   return data
 *
 * Extra (só depois que o básico funcionar): aceite um termo de busca
 * e mande como query param — `{ params: { busca } }`.
 *
 * @param {string} [busca] texto para filtrar por nome, sigla ou órgão
 * @returns {Promise<Array>} lista de fontes
 */
export async function listarFontes(busca = '') {
  const { data } = await http.get('/fontes')
  return data
}

/**
 * TODO 2 — Cadastrar uma nova fonte.
 *
 * Passos:
 *   a) `http.post('/fontes', fonte)`
 *   b) retorne o `.data` (a fonte criada, já com id e criadaEm)
 *
 * Repare que você NÃO precisa de try/catch aqui: o interceptor em
 * http.js já converte o erro numa Error com mensagem pronta, e quem
 * chamou (o componente) decide o que exibir.
 *
 * @param {{nome:string, sigla:string, orgao:string, formato:string, periodicidade:string}} fonte
 * @returns {Promise<object>} a fonte criada pelo servidor
 */
export async function criarFonte(fonte) {
  const { data } = await http.post('/fontes', fonte)
  return data
}

/**
 * TODO 3 — Enviar um arquivo para uma fonte, com progresso.
 *
 * Esta é a parte central da task. Três coisas novas aqui:
 *
 *   a) FormData — upload não vai como JSON. Monte assim:
 *        const dados = new FormData()
 *        dados.append('arquivo', arquivo)   // 'arquivo' = nome do campo que o back espera
 *
 *   b) onUploadProgress — opção do Axios que dispara várias vezes
 *      durante o envio. Ela recebe um evento com `loaded` (bytes já
 *      enviados) e `total` (bytes totais):
 *        onUploadProgress: (evento) => {
 *          const pct = Math.round((evento.loaded * 100) / evento.total)
 *          aoProgredir(pct)
 *        }
 *      Cuidado: `evento.total` pode vir undefined em alguns casos —
 *      proteja com `if (!evento.total) return`.
 *
 *   c) NÃO defina o header Content-Type manualmente. O navegador
 *      precisa gerar o boundary do multipart sozinho. Se você escrever
 *      'multipart/form-data' na mão, o upload quebra.
 *
 * Junte tudo:
 *   const { data } = await http.post(`/fontes/${fonteId}/arquivos`, dados, { onUploadProgress })
 *   return data
 *
 * @param {number} fonteId    id da fonte que vai receber o arquivo
 * @param {File}   arquivo    o File vindo do <input type="file">
 * @param {(pct:number)=>void} aoProgredir chamada a cada avanço, de 0 a 100
 * @returns {Promise<{fonte:object, arquivo:object}>}
 */
export async function enviarArquivo(fonteId, arquivo, aoProgredir = () => {}) {
  const dados = new FormData()
  dados.append('arquivo', arquivo)

  const { data } = await http.post(`/fontes/${fonteId}/arquivos`, dados, {
    timeout: 10 * 60_000,
    onUploadProgress: (evento) => {
      if (!evento.total) return
      aoProgredir(Math.round((evento.loaded * 100) / evento.total))
    },
  })
  return data
}

/**
 * "Testar link" do formulário: o back pede ao link uma amostra pequena e
 * devolve o que achou, sem gravar nada.
 *
 *   POST /fontes/testar-link
 *        body → { urlOrigem, metodoHttp, cabecalhos, corpoRequisicao }
 *        200  → { tipo, statusHttp, total, limitePorPedido, colunas, avisos, mensagem }
 *        400  → link inválido ou interno · 502 → o servidor de origem falhou
 *
 * @param {{urlOrigem:string, metodoHttp?:string, cabecalhos?:string, corpoRequisicao?:string}} dados
 */
export async function testarLink(dados) {
  const { data } = await http.post('/fontes/testar-link', dados)
  return data
}

/**
 * "Executar agora" de uma fonte por link.
 *
 *   POST /fontes/:id/executar
 *        202 → { resultado: 'SOLICITADA', mensagem }   (coleta na fila do Airflow)
 *        400 → fonte sem link
 *
 * A resposta é imediata: o andamento aparece na fonte (coletando,
 * ultimaColetaMensagem, ultimaColetaEm), e o arquivo coletado é processado
 * pelo próprio Airflow.
 */
export async function executarColeta(fonteId) {
  const { data } = await http.post(`/fontes/${fonteId}/executar`)
  return data
}

/**
 * Edita uma fonte (a sigla não muda: é a pasta dos arquivos na zona bruta).
 *   PUT /fontes/:id   200 → a fonte · 400 → { mensagem, campos } · 404
 * Cabeçalhos e credencial nulos ficam como estão (a API nunca os devolve).
 * Trocar para MANUAL apaga o link e tira a fonte da coleta automática.
 */
export async function atualizarFonte(fonteId, fonte) {
  const { data } = await http.put(`/fontes/${fonteId}`, fonte)
  return data
}

/**
 * Já implementado como exemplo do padrão que os TODOs acima seguem.
 * Use como referência quando travar.
 */
export async function excluirFonte(fonteId) {
  await http.delete(`/fontes/${fonteId}`)
}
