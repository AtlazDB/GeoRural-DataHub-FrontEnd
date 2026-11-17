// Mesma lista do back (UsuarioServiceImpl.PERFIS_DO_SISTEMA). Se a matriz de permissões mudar,
// atualize também as descrições.
export const PERFIS = [
  { codigo: 'OPERADOR_DADOS', rotulo: 'Operador de dados', descricao: 'Importa e processa dados: fontes, arquivos, mapeamentos, quarentena e indicadores.' },
  { codigo: 'ANALISTA', rotulo: 'Analista', descricao: 'Consulta o mapa, os imóveis e os indicadores das cidades liberadas, sem alterar dados.' },
  { codigo: 'AUDITOR', rotulo: 'Auditor', descricao: 'Acompanha fontes, quarentena e rastreabilidade, sem alterar dados.' },
  { codigo: 'GESTOR', rotulo: 'Gestor', descricao: 'Acesso total, inclusive a gestão de usuários.' },
]

/** A região só restringe quem é apenas analista: com outro perfil junto, a pessoa vê tudo. */
export function restritoPorRegiao(perfis) {
  return perfis.includes('ANALISTA') && perfis.every((p) => p === 'ANALISTA')
}
