<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import { podeAcessar } from '@/auth/keycloak'

const route = useRoute()
const router = useRouter()

const todosOsGrupos = [
  {
    nome: 'Dados',
    itens: [
      { rota: 'importacao', rotulo: 'Fontes de dados', icone: 'camadas' },
      { rota: 'quarentena', rotulo: 'Quarentena', icone: 'escudo' },
    ],
  },
  {
    nome: 'Consulta',
    itens: [{ rota: 'consulta', rotulo: 'Imóveis rurais', icone: 'mapa' }],
  },
  {
    nome: 'Governança',
    itens: [
      { rota: 'indicadores', rotulo: 'Indicadores', icone: 'tabela' },
      { rota: 'rastreabilidade', rotulo: 'Rastreabilidade', icone: 'rastro' },
    ],
  },
    {
    nome: 'Administração',
    itens: [{ rota: 'usuarios', rotulo: 'Usuários e perfis', icone: 'escudo' }],
  },
]

// Mostra só o que o perfil pode usar (a regra vem do meta.perfis de cada rota, em router/index.js).
// Grupo sem nenhum item permitido some junto.
const grupos = computed(() =>
  todosOsGrupos
    .map((grupo) => ({
      ...grupo,
      itens: grupo.itens.filter((item) => podeAcessar(router.resolve({ name: item.rota }).meta.perfis)),
    }))
    .filter((grupo) => grupo.itens.length > 0),
)
</script>

<template>
  <aside
    class="flex w-[72px] shrink-0 flex-col border-r border-slate-800/80 bg-slate-950/50 backdrop-blur-lg md:w-64"
  >
    <div class="flex items-center gap-3 border-b border-slate-800/80 px-3 py-5 md:px-5">
      <div
        class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br
               from-cyan-400 via-emerald-400 to-indigo-500 shadow-lg shadow-cyan-500/20"
      >
        <AppIcon nome="local" traco="2.4" class="h-5 w-5 text-[#04111d]" />
      </div>
      <div class="hidden leading-tight md:block">
        <p class="font-display text-[15px] font-semibold tracking-tight text-white">GeoRural DataHub</p>
        <p class="text-[10px] text-slate-400">Portal de dados · Visiona</p>
      </div>
    </div>

    <nav class="flex-1 space-y-5 overflow-y-auto px-2 py-4 md:px-3" aria-label="Áreas do sistema">
      <div v-for="grupo in grupos" :key="grupo.nome">
        <p class="mb-1.5 hidden px-3 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 md:block">
          {{ grupo.nome }}
        </p>
        <div class="space-y-0.5">
          <RouterLink
            v-for="item in grupo.itens"
            :key="item.rota"
            :to="{ name: item.rota }"
            :title="item.rotulo"
            :class="[
              'flex w-full items-center justify-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition md:justify-start',
              route.name === item.rota
                ? 'bg-cyan-500/10 text-cyan-300'
                : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-100',
            ]"
          >
            <AppIcon :nome="item.icone" class="h-[18px] w-[18px] shrink-0" />
            <span class="hidden flex-1 text-left md:inline">{{ item.rotulo }}</span>
          </RouterLink>
        </div>
      </div>
    </nav>
  </aside>
</template>