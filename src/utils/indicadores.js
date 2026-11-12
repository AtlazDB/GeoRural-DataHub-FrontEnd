/** Rótulos, cores e formatos dos indicadores. Usados no card e na Rastreabilidade. */

export const NOMES = {
  IRL: 'IRL · Reserva Legal',
  IFC: 'IFC · Focos de calor',
}

/** Conjuntos de dados como o usuário os conhece. */
const CONJUNTOS = {
  imoveis_rurais: 'CAR',
  reserva_legal: 'Reserva Legal',
  focos_calor: 'Focos INPE',
}

const STATUS = {
  CONFORME: 'Conforme',
  ALERTA: 'Alerta',
  CRITICO: 'Crítico',
  VALIDACAO: 'Em validação',
}

/** Classes de cada status: etiqueta, número grande e barra. */
export const CORES_STATUS = {
  CONFORME: {
    etiqueta: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    texto: 'text-emerald-300',
    barra: 'bg-gradient-to-r from-cyan-400 to-emerald-400',
  },
  ALERTA: {
    etiqueta: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
    texto: 'text-amber-300',
    barra: 'bg-gradient-to-r from-amber-500 to-amber-300',
  },
  CRITICO: {
    etiqueta: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
    texto: 'text-rose-300',
    barra: 'bg-gradient-to-r from-rose-500 to-amber-400',
  },
  VALIDACAO: {
    etiqueta: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
    texto: 'text-cyan-300',
    barra: 'bg-cyan-400',
  },
}

/** No IFC, "Conforme" quer dizer que não houve foco — o protótipo chama assim. */
export function rotuloStatus(indicador) {
  if (indicador.indicador === 'IFC' && indicador.status === 'CONFORME') return 'Sem focos'
  return STATUS[indicador.status] ?? indicador.status
}

export function coresStatus(indicador) {
  return CORES_STATUS[indicador.status] ?? CORES_STATUS.VALIDACAO
}

/** 15.4229 -> "15,4" */
export function formatarDecimal(valor, casas = 1) {
  if (valor == null) return '—'
  return Number(valor).toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })
}

/** IRL em %, IFC como número de focos a cada 1.000 ha. */
export function formatarValor(indicador) {
  const numero = formatarDecimal(indicador.valor, 1)
  return indicador.indicador === 'IRL' ? `${numero}%` : numero
}

export function nomeConjunto(conjunto) {
  return CONJUNTOS[conjunto] ?? conjunto
}

/** { conjunto: 'reserva_legal', versao: 2 } -> "Reserva Legal v2" */
export function rotuloVersao(versao) {
  if (!versao) return '—'
  return `${nomeConjunto(versao.conjunto)} v${versao.versao}`
}

/** sha256 de 64 caracteres -> "sha256:51ab…7e" */
export function hashCurto(hash) {
  if (!hash) return '—'
  const limpo = hash.replace(/^sha256:/, '')
  return `sha256:${limpo.slice(0, 4)}…${limpo.slice(-2)}`
}
