// Os 4 perfis do sistema: mesma lista do back (UsuarioServiceImpl.PERFIS_DO_SISTEMA). Se a matriz de permissões mudar,
// atualize também as descrições.
export const PERFIS = [
  { codigo: 'OPERADOR_DADOS', rotulo: 'Operador de dados', descricao: 'Importa e processa dados: fontes, arquivos, mapeamentos, quarentena e indicadores.' },
  { codigo: 'ANALISTA', rotulo: 'Analista', descricao: 'Consulta o mapa, os imóveis e os indicadores das cidades liberadas, sem alterar dados.' },
  { codigo: 'AUDITOR', rotulo: 'Auditor', descricao: 'Acompanha fontes, quarentena e rastreabilidade, sem alterar dados.' },
  { codigo: 'GESTOR', rotulo: 'Gestor', descricao: 'Acesso total, inclusive a gestão de usuários.' },
]

/** Catálogo só com os 4 do sistema (antes de o GET /usuarios/perfis responder, ou se ele falhar). */
export const CATALOGO_PADRAO = PERFIS.map((p) => ({ ...p, doSistema: true, inclui: [p.codigo] }))

/**
 * Junta a lista do back (GET /usuarios/perfis) com os rótulos e descrições dos 4 do sistema.
 * Perfil combinado: rótulo = o código (COORDENADOR → Coordenador) e, sem descrição, "Junta: Analista + Auditor".
 */
export function montarCatalogo(doBack) {
  const rotulo = (codigo) => PERFIS.find((p) => p.codigo === codigo)?.rotulo ?? codigo
  return doBack.map((p) => {
    if (p.doSistema) return CATALOGO_PADRAO.find((b) => b.codigo === p.codigo) ?? { ...p, rotulo: p.codigo }
    const junta = `Junta: ${p.inclui.map(rotulo).join(' + ')}`
    return {
      codigo: p.codigo,
      rotulo: p.codigo.charAt(0) + p.codigo.slice(1).toLowerCase().replaceAll('_', ' '),
      descricao: p.descricao ? `${p.descricao} · ${junta}` : junta,
      nota: p.descricao ?? '', // só o texto que o gestor escreveu (para editar)
      doSistema: false,
      inclui: p.inclui,
    }
  })
}

/** Os perfis do sistema que a pessoa tem de fato: os marcados, com os combinados abertos. */
export function expandir(perfis, catalogo = CATALOGO_PADRAO) {
  return [...new Set(perfis.flatMap((c) => catalogo.find((p) => p.codigo === c)?.inclui ?? [c]))]
}

/** A região só restringe quem é apenas analista: com outro perfil junto, a pessoa vê tudo. */
export function restritoPorRegiao(perfis, catalogo = CATALOGO_PADRAO) {
  const efetivos = expandir(perfis, catalogo)
  return efetivos.includes('ANALISTA') && efetivos.every((p) => p === 'ANALISTA')
}
