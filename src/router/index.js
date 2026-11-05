import { createRouter, createWebHistory } from 'vue-router'
import ImportacaoView from '@/views/ImportacaoView.vue'
import ConsultaView from '@/views/ConsultaView.vue'
import QuarentenaView from '@/views/QuarentenaView.vue'
import RastreabilidadeView from '@/views/RastreabilidadeView.vue'
import IndicadoresView from '@/views/IndicadoresView.vue'

// meta.grupo e meta.titulo aparecem no topo (AppTopo).
const routes = [
  { path: '/', redirect: { name: 'importacao' } },
  {
    // Sem fonteId: a lista de fontes. Com fonteId: a página da fonte (mesma view,
    // para o menu continuar marcando "Fontes de dados"). ?aba=arquivos|mapeamento
    path: '/importacao/:fonteId(\\d+)?',
    name: 'importacao',
    component: ImportacaoView,
    meta: { grupo: 'Dados', titulo: 'Fontes de dados' },
  },
  {
    path: '/consulta',
    name: 'consulta',
    component: ConsultaView,
    meta: { grupo: 'Consulta', titulo: 'Imóveis rurais · Paraná' },
  },
  {
    path: '/quarentena',
    name: 'quarentena',
    component: QuarentenaView,
    meta: { grupo: 'Dados', titulo: 'Quarentena' },
  },
  {
    // Indicadores cadastrados pelo usuário (US13); o IRL/IFC ficam no card do imóvel.
    path: '/indicadores',
    name: 'indicadores',
    component: IndicadoresView,
    meta: { grupo: 'Governança', titulo: 'Indicadores' },
  },
  {
    // ?imovel=<cod_imovel>&indicador=IRL|IFC
    path: '/rastreabilidade',
    name: 'rastreabilidade',
    component: RastreabilidadeView,
    meta: { grupo: 'Governança', titulo: 'Rastreabilidade' },
  },
  // Qualquer endereço desconhecido volta para o começo do fluxo.
  { path: '/:caminho(.*)*', redirect: { name: 'importacao' } },
]

export default createRouter({
  history: createWebHistory(),
  routes,
})