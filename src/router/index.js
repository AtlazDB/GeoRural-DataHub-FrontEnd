
import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '@/views/DashboardView.vue'
import ImportacaoView from '@/views/ImportacaoView.vue'
import ConsultaView from '@/views/ConsultaView.vue'
import QuarentenaView from '@/views/QuarentenaView.vue'
import RastreabilidadeView from '@/views/RastreabilidadeView.vue'
import IndicadoresMunicipaisView from '@/views/IndicadoresMunicipaisView.vue'
import IndicadoresView from '@/views/IndicadoresView.vue'
import SemAcessoView from '@/views/SemAcessoView.vue'
import UsuariosView from '@/views/UsuariosView.vue'
import { podeAcessar } from '@/auth/keycloak'

// Perfis do Keycloak (iguais aos do back, ver SecurityConfig). Esta é a ÚNICA lista de quem acessa cada tela:
// o menu e o bloqueio de endereço leem daqui (meta.perfis). Isso só esconde telas; quem barra de verdade é o back.
const TODOS = ['OPERADOR_DADOS', 'ANALISTA', 'AUDITOR', 'GESTOR']
const OPERACAO = ['OPERADOR_DADOS', 'AUDITOR', 'GESTOR']

// meta.grupo e meta.titulo aparecem no topo (AppTopo).
const routes = [
  {
    path: '/',
    redirect: { name: 'importacao' },
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: DashboardView,
    meta: {
      grupo: 'Visão geral',
      titulo: 'Dashboard operacional',
    },
  },
  {
    // Sem fonteId: lista de fontes. Com fonteId: página da fonte.
    path: '/importacao/:fonteId(\\d+)?',
    name: 'importacao',
    component: ImportacaoView,

    meta: {
      grupo: 'Dados',
      titulo: 'Fontes de dados',
    },
    meta: { grupo: 'Dados', titulo: 'Fontes de dados', perfis: OPERACAO },

  },
  {
    path: '/consulta',
    name: 'consulta',
    component: ConsultaView,

    meta: {
      grupo: 'Consulta',
      titulo: 'Imóveis rurais · Paraná',
    },
  },
  {
    path: '/indicadores-municipais',
    name: 'indicadores-municipais',
    component: IndicadoresMunicipaisView,
    meta: {
      grupo: 'Consulta',
      titulo: 'Indicadores municipais',
    },

    // telaCheia: o mapa ocupa todo o espaço do <main> (sem margem nem rodapé).
    meta: { grupo: 'Consulta', titulo: 'Imóveis rurais · Paraná', telaCheia: true, perfis: TODOS },
  },
  {
    path: '/quarentena',
    name: 'quarentena',
    component: QuarentenaView,

    meta: {
      grupo: 'Dados',
      titulo: 'Quarentena',
    },
    meta: { grupo: 'Dados', titulo: 'Quarentena', perfis: OPERACAO },
  },
  {
    // Indicadores cadastrados pelo usuário (US13); o IRL/IFC ficam no card do imóvel.
    path: '/indicadores',
    name: 'indicadores',
    component: IndicadoresView,
    meta: { grupo: 'Governança', titulo: 'Indicadores', perfis: TODOS },

  },
  {
    // ?imovel=<cod_imovel>&indicador=IRL|IFC
    path: '/rastreabilidade',
    name: 'rastreabilidade',
    component: RastreabilidadeView,

    meta: {
      grupo: 'Governança',
      titulo: 'Rastreabilidade',
    },

    meta: { grupo: 'Governança', titulo: 'Rastreabilidade', perfis: TODOS },
  },
  {
    // Gestão de perfis de acesso (T28). Só o GESTOR; o back também barra (/api/v1/usuarios).
    path: '/usuarios',
    name: 'usuarios',
    component: UsuariosView,
    meta: { grupo: 'Administração', titulo: 'Usuários e perfis', perfis: ['GESTOR'] },
  },
  {
    // Quem entrou, mas não tem perfil para nenhuma tela. Sem meta.perfis: qualquer pessoa logada abre.
    path: '/sem-acesso',
    name: 'sem-acesso',
    component: SemAcessoView,
    meta: { grupo: '', titulo: 'Sem acesso' },
  },

  // Qualquer endereço desconhecido volta para o começo do fluxo.
  {
    path: '/:caminho(.*)*',
    redirect: { name: 'importacao' },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// Ordem de preferência para mandar a pessoa quando ela tenta abrir uma tela que o perfil dela não vê.
const ORDEM_DE_ENTRADA = ['importacao', 'consulta', 'quarentena', 'indicadores', 'rastreabilidade']

router.beforeEach((to) => {
  if (podeAcessar(to.meta.perfis)) return true

  const destino = ORDEM_DE_ENTRADA.find((nome) => podeAcessar(router.resolve({ name: nome }).meta.perfis))
  return { name: destino ?? 'sem-acesso' }
})

export default router

