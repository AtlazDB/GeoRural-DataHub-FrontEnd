
import { createRouter, createWebHistory } from 'vue-router'

import DashboardView from '@/views/DashboardView.vue'
import ImportacaoView from '@/views/ImportacaoView.vue'
import ConsultaView from '@/views/ConsultaView.vue'
import QuarentenaView from '@/views/QuarentenaView.vue'
import RastreabilidadeView from '@/views/RastreabilidadeView.vue'
import IndicadoresMunicipaisView from '@/views/IndicadoresMunicipaisView.vue'

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
  },
  {
    path: '/quarentena',
    name: 'quarentena',
    component: QuarentenaView,
    meta: {
      grupo: 'Dados',
      titulo: 'Quarentena',
    },
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
  },

  // Qualquer endereço desconhecido volta para o começo do fluxo.
  {
    path: '/:caminho(.*)*',
    redirect: { name: 'importacao' },
  },
]

export default createRouter({
  history: createWebHistory(),
  routes,
})
