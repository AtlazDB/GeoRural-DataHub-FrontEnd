<script setup>
import AppMenu from '@/components/layout/AppMenu.vue'
import AppTopo from '@/components/layout/AppTopo.vue'
import AppFooter from '@/components/layout/AppFooter.vue'
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <!-- Manchas de luz do fundo, atrás de todo o conteúdo. -->
  <div class="glow -left-40 -top-40 h-[520px] w-[520px] bg-cyan-500/10" />
  <div class="glow -right-52 top-1/3 h-[520px] w-[520px] bg-indigo-500/10" />
  <div class="glow bottom-0 left-1/4 h-[480px] w-[480px] bg-emerald-500/10" />

  <div class="relative z-10 flex h-screen">
    <AppMenu />

    <div class="flex min-w-0 flex-1 flex-col">
      <AppTopo />

      <!-- Telas de mapa (meta.telaCheia) usam o <main> inteiro, sem margem nem rodapé. -->
      <main v-if="route.meta.telaCheia" class="relative min-h-0 flex-1 overflow-hidden">
        <RouterView />
      </main>
      <main v-else class="flex-1 overflow-y-auto px-4 py-6 md:px-7">
        <div class="mx-auto max-w-[1320px]">
          <RouterView />
        </div>
        <AppFooter class="mx-auto mt-8 max-w-[1320px] pb-2" />
      </main>
    </div>
  </div>
</template>
