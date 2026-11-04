/**
 * Mock da API de fontes do GeoRural DataHub.
 * ------------------------------------------------------------------
 * Serve para você desenvolver o front-end sem depender do back-end.
 * Os dados ficam em memória: ao reiniciar o servidor, tudo volta ao
 * estado inicial (os arquivos enviados ficam em mock/uploads/).
 *
 *   npm run mock     -> sobe só este servidor  (http://localhost:3333)
 *   npm run start    -> sobe este servidor + o Vite juntos
 *
 * Endpoints:
 *   GET    /fontes                  lista as fontes
 *   GET    /fontes/:id              detalhe de uma fonte
 *   POST   /fontes                  cadastra uma fonte
 *   POST   /fontes/:id/arquivos     envia um arquivo (multipart, campo "arquivo")
 *   DELETE /fontes/:id              remove uma fonte
 *   GET    /indicators              lista os indicadores cadastrados
 *   GET    /indicators/:code        detalhe de um indicador
 *   POST   /indicators              cadastra um indicador
 *   POST   /indicators/:code/deactivate   desativa (não apaga)
 */

import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { fileURLToPath } from 'node:url'
import { dirname, join, extname } from 'node:path'
import { mkdirSync, createWriteStream, unlink } from 'node:fs'
import { Transform } from 'node:stream'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PASTA_UPLOADS = join(__dirname, 'uploads')
mkdirSync(PASTA_UPLOADS, { recursive: true })

const PORTA = Number(process.env.MOCK_PORT || 3333)

// Velocidade simulada de upload, em KB/s.
// Sem isso o upload em localhost termina em milissegundos e a barra de
// progresso pisca de 0% a 100% — impossível de testar.
// A 1500 KB/s, o arquivo de 15 MB do `npm run arquivo-teste` leva ~10s.
// Use MOCK_UPLOAD_KBPS=0 para desligar o freio.
const UPLOAD_KBPS = Number(process.env.MOCK_UPLOAD_KBPS ?? 1500)

// Latência simulada das rotas JSON, em ms — deixa os estados de
// "carregando" visíveis na tela.
const LATENCIA_MS = Number(process.env.MOCK_LATENCIA_MS ?? 400)

// ------------------------------------------------------------------
// "Banco de dados" em memória
// ------------------------------------------------------------------
let proximoId = 5
const fontes = [
  {
    id: 1,
    nome: 'CAR — Cadastro Ambiental Rural',
    sigla: 'CAR',
    orgao: 'Serviço Florestal Brasileiro',
    formato: 'SHP',
    periodicidade: 'mensal',
    status: 'ativa',
    criadaEm: '2026-02-10T13:20:00.000Z',
    arquivos: [
      {
        id: 'arq_8f21c0',
        nome: 'car_pr_2026_02.zip',
        tamanho: 18_432_119,
        enviadoEm: '2026-02-10T13:31:00.000Z',
      },
    ],
  },
  {
    id: 2,
    nome: 'IBGE — Malha municipal',
    sigla: 'IBGE',
    orgao: 'Instituto Brasileiro de Geografia e Estatística',
    formato: 'GeoJSON',
    periodicidade: 'anual',
    status: 'ativa',
    criadaEm: '2026-02-11T09:05:00.000Z',
    arquivos: [
      {
        id: 'arq_2b7de1',
        nome: 'municipios_pr.geojson',
        tamanho: 4_210_880,
        enviadoEm: '2026-02-11T09:12:00.000Z',
      },
    ],
  },
  {
    id: 3,
    nome: 'INPE — Alertas de desmatamento',
    sigla: 'INPE',
    orgao: 'Instituto Nacional de Pesquisas Espaciais',
    formato: 'CSV',
    periodicidade: 'diária',
    status: 'pendente',
    criadaEm: '2026-02-12T16:40:00.000Z',
    arquivos: [],
  },
  {
    id: 4,
    nome: 'IBAMA — Embargos ambientais',
    sigla: 'IBAMA',
    orgao: 'Instituto Brasileiro do Meio Ambiente',
    formato: 'CSV',
    periodicidade: 'semanal',
    status: 'pendente',
    criadaEm: '2026-02-14T11:15:00.000Z',
    arquivos: [],
  },
]

// ------------------------------------------------------------------
// Middlewares
// ------------------------------------------------------------------
const app = express()
app.use(cors())
app.use(express.json())

/** Segura as respostas JSON por um instante, para simular rede real. */
function comLatencia(_req, _res, next) {
  if (!LATENCIA_MS) return next()
  setTimeout(next, LATENCIA_MS)
}

/**
 * Freio de upload — o que faz a barra de progresso ser testável.
 *
 * Em localhost um upload termina em milissegundos: a barra pularia de
 * 0% a 100% e você não conseguiria verificar se ela funciona. Este
 * Transform deixa os bytes passarem devagar, em cotas de 1/20 de
 * segundo.
 *
 * O detalhe importante: só chamamos `pronto()` depois de empurrar o
 * pedaço inteiro. Isso segura o lado de escrita do Transform, que
 * segura o busboy, que segura o `req`, que enche o buffer TCP e faz o
 * NAVEGADOR escrever mais devagar no socket. É esse efeito dominó —
 * backpressure — que o `onUploadProgress` do Axios enxerga.
 *
 * (Tentar pausar o socket na mão não funciona aqui: enquanto o multer
 * consome o req, o Node o retoma sozinho.)
 */
class FreioDeUpload extends Transform {
  constructor(kbps) {
    super()
    this.porTique = Math.max(1, Math.floor((kbps * 1024) / 20))
  }

  _transform(pedaco, _codificacao, pronto) {
    const passo = (inicio) => {
      if (inicio >= pedaco.length) return pronto()
      const fim = Math.min(inicio + this.porTique, pedaco.length)
      this.push(pedaco.subarray(inicio, fim))
      setTimeout(() => passo(fim), 50)
    }
    passo(0)
  }
}

/** Storage engine do multer que grava em disco passando pelo freio. */
const armazenamento = {
  _handleFile(_req, file, cb) {
    const nome = `${Date.now()}_${file.originalname.replace(/[^\w.\-]/g, '_')}`
    const caminho = join(PASTA_UPLOADS, nome)
    const saida = createWriteStream(caminho)

    let tamanho = 0
    // O readable com o conteúdo fica em file.stream (não em file).
    const entrada = file.stream
    const origem = UPLOAD_KBPS > 0 ? entrada.pipe(new FreioDeUpload(UPLOAD_KBPS)) : entrada

    origem.on('data', (pedaco) => (tamanho += pedaco.length))
    origem.on('error', cb)
    saida.on('error', cb)
    saida.on('finish', () =>
      cb(null, { destination: PASTA_UPLOADS, filename: nome, path: caminho, size: tamanho }),
    )

    origem.pipe(saida)
  },

  _removeFile(_req, file, cb) {
    unlink(file.path, cb)
  },
}

const upload = multer({
  storage: armazenamento,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB
})

const acharFonte = (id) => fontes.find((f) => f.id === Number(id))

// ------------------------------------------------------------------
// Rotas
// ------------------------------------------------------------------

app.get('/fontes', comLatencia, (req, res) => {
  const busca = String(req.query.busca ?? '').trim().toLowerCase()
  const lista = busca
    ? fontes.filter(
        (f) =>
          f.nome.toLowerCase().includes(busca) ||
          f.sigla.toLowerCase().includes(busca) ||
          f.orgao.toLowerCase().includes(busca),
      )
    : fontes
  res.json(lista)
})

app.get('/fontes/:id', comLatencia, (req, res) => {
  const fonte = acharFonte(req.params.id)
  if (!fonte) return res.status(404).json({ mensagem: 'Fonte não encontrada.' })
  res.json(fonte)
})

app.post('/fontes', comLatencia, (req, res) => {
  const { nome, sigla, orgao, formato, periodicidade } = req.body ?? {}

  // Validação simples — o front deve tratar o 400 e mostrar a mensagem.
  const faltando = ['nome', 'sigla', 'orgao', 'formato'].filter((c) => !req.body?.[c]?.trim?.())
  if (faltando.length) {
    return res.status(400).json({
      mensagem: `Preencha: ${faltando.join(', ')}.`,
      campos: faltando,
    })
  }

  if (fontes.some((f) => f.sigla.toLowerCase() === sigla.trim().toLowerCase())) {
    return res.status(409).json({ mensagem: `Já existe uma fonte com a sigla "${sigla}".` })
  }

  const nova = {
    id: proximoId++,
    nome: nome.trim(),
    sigla: sigla.trim().toUpperCase(),
    orgao: orgao.trim(),
    formato: formato.trim(),
    periodicidade: periodicidade?.trim() || 'eventual',
    status: 'pendente',
    criadaEm: new Date().toISOString(),
    arquivos: [],
  }
  fontes.unshift(nova)
  res.status(201).json(nova)
})

app.post('/fontes/:id/arquivos', upload.single('arquivo'), (req, res) => {
  const fonte = acharFonte(req.params.id)
  if (!fonte) return res.status(404).json({ mensagem: 'Fonte não encontrada.' })
  if (!req.file) return res.status(400).json({ mensagem: 'Nenhum arquivo enviado.' })

  const extensoesAceitas = ['.csv', '.zip', '.geojson', '.json', '.shp', '.xlsx', '.txt']
  const ext = extname(req.file.originalname).toLowerCase()
  if (!extensoesAceitas.includes(ext)) {
    return res.status(415).json({
      mensagem: `Formato "${ext}" não aceito. Use: ${extensoesAceitas.join(', ')}.`,
    })
  }

  const arquivo = {
    id: 'arq_' + Math.random().toString(16).slice(2, 8),
    nome: req.file.originalname,
    tamanho: req.file.size,
    enviadoEm: new Date().toISOString(),
    // Hash fictício: no sistema real, é o que garante a integridade do arquivo recebido
    hash: 'sha256:' + Math.random().toString(16).slice(2).padEnd(12, '0').slice(0, 12),
  }

  fonte.arquivos.unshift(arquivo)
  fonte.status = 'ativa'

  res.status(201).json({ fonte, arquivo })
})

app.delete('/fontes/:id', comLatencia, (req, res) => {
  const i = fontes.findIndex((f) => f.id === Number(req.params.id))
  if (i === -1) return res.status(404).json({ mensagem: 'Fonte não encontrada.' })
  fontes.splice(i, 1)
  res.status(204).end()
})

// ------------------------------------------------------------------
// Indicadores cadastrados (US13) — mesmas regras do back, resumidas
// ------------------------------------------------------------------
const STATUS_FAIXA = ['CONFORME', 'ALERTA', 'CRITICO', 'VALIDACAO']
const MODELOS = ['POINT_DENSITY', 'AREA_COVERAGE']

const indicadores = [
  {
    code: 'DFOCO',
    name: 'Densidade de focos de calor',
    unit: 'focos/1000ha',
    description: 'Focos do satélite de referência por mil hectares do imóvel.',
    fonteId: 2,
    calculationModel: 'POINT_DENSITY',
    parameters: { factor: 1000 },
    ranges: [
      { status: 'CONFORME', limit: 5, includeLimit: true },
      { status: 'ALERTA', limit: 20, includeLimit: false },
      { status: 'CRITICO' },
    ],
    active: true,
    createdAt: '2026-11-03T12:00:00.000Z',
  },
]

const acharIndicador = (code) => indicadores.find((i) => i.code === code)

/** Devolve a mensagem do primeiro problema nas faixas, ou null se estão certas. */
function erroNasFaixas(ranges) {
  if (!Array.isArray(ranges) || ranges.length === 0) return 'Informe pelo menos uma faixa.'
  let anterior = null
  for (let i = 0; i < ranges.length; i++) {
    const { status, limit, includeLimit } = ranges[i]
    const ultima = i === ranges.length - 1
    if (!STATUS_FAIXA.includes(status)) {
      return `Faixa ${i + 1}: o status deve ser ${STATUS_FAIXA.join(', ')}.`
    }
    if (ultima) {
      if (limit != null) return `Faixa ${i + 1}: a última faixa não tem limite (vale para tudo acima da anterior).`
    } else {
      if (limit == null || includeLimit == null) {
        return `Faixa ${i + 1}: só a última faixa pode ficar sem limit e includeLimit.`
      }
      if (anterior != null && Number(limit) <= anterior) {
        return `Faixa ${i + 1}: o limite tem que ser maior que o da faixa anterior.`
      }
      anterior = Number(limit)
    }
  }
  return null
}

app.get('/indicators', comLatencia, (_req, res) => {
  res.json(indicadores)
})

app.get('/indicators/:code', comLatencia, (req, res) => {
  const indicador = acharIndicador(req.params.code)
  if (!indicador) return res.status(404).json({ mensagem: `Indicador "${req.params.code}" não encontrado.` })
  res.json(indicador)
})

app.post('/indicators', comLatencia, (req, res) => {
  const corpo = req.body ?? {}

  const faltando = ['code', 'name', 'unit', 'calculationModel'].filter((c) => !corpo[c]?.trim?.())
  if (corpo.fonteId == null) faltando.push('fonteId')
  if (faltando.length) {
    return res.status(400).json({ mensagem: `Preencha: ${faltando.join(', ')}.`, campos: faltando })
  }
  if (!/^[A-Z][A-Z0-9]{1,9}$/.test(corpo.code)) {
    return res.status(400).json({
      mensagem: 'A sigla deve começar com letra e ter de 2 a 10 letras maiúsculas ou números.',
      campos: ['code'],
    })
  }
  if (acharIndicador(corpo.code)) {
    return res.status(409).json({ mensagem: `Já existe um indicador com a sigla "${corpo.code}".` })
  }
  if (!MODELOS.includes(corpo.calculationModel)) {
    return res.status(400).json({
      mensagem: 'Modelo de cálculo deve ser POINT_DENSITY ou AREA_COVERAGE.',
      campos: ['calculationModel'],
    })
  }
  const erro = erroNasFaixas(corpo.ranges)
  if (erro) return res.status(400).json({ mensagem: erro, campos: ['ranges'] })

  const novo = {
    code: corpo.code,
    name: corpo.name.trim(),
    unit: corpo.unit.trim(),
    description: corpo.description?.trim() || null,
    fonteId: Number(corpo.fonteId),
    calculationModel: corpo.calculationModel,
    parameters: corpo.parameters ?? {},
    ranges: corpo.ranges,
    active: true,
    createdAt: new Date().toISOString(),
  }
  indicadores.push(novo)
  res.status(201).json(novo)
})

app.post('/indicators/:code/deactivate', comLatencia, (req, res) => {
  const indicador = acharIndicador(req.params.code)
  if (!indicador) return res.status(404).json({ mensagem: `Indicador "${req.params.code}" não encontrado.` })
  indicador.active = false
  res.status(204).end()
})

app.use((_req, res) => res.status(404).json({ mensagem: 'Rota não existe neste mock.' }))

app.listen(PORTA, () => {
  console.log(`\n  Mock do GeoRural DataHub no ar`)
  console.log(`  http://localhost:${PORTA}`)
  console.log(`  upload freado em ${UPLOAD_KBPS || 'ilimitado'} KB/s · latência ${LATENCIA_MS} ms\n`)
})
