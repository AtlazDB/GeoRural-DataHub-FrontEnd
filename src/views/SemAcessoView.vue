<script setup>
import { sair, usuarioLogado } from '@/auth/keycloak'

const usuario = usuarioLogado()
</script>

<template>
  <section class="mx-auto mt-16 max-w-md rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center">
    <h2 class="font-display text-lg font-semibold text-white">Sem acesso a nenhuma área</h2>
    <p class="mt-2 text-sm text-slate-400">
      <template v-if="usuario">{{ usuario.nome }}, seu</template>
      <template v-else>Seu</template>
      usuário ainda não tem um perfil liberado neste sistema. Peça a quem administra os acessos para
      atribuir um perfil e entre novamente.
    </p>
    <button
      type="button"
      class="mt-6 inline-flex items-center rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium
             text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
      @click="sair"
    >
      Sair
    </button>
  </section>
</template>