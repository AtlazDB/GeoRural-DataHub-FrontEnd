<script setup>
import { computed, onMounted, ref } from 'vue'
import { listarMunicipios } from '@/services/municipiosService'

/**
 * Escolha das cidades que um analista pode consultar (US14).
 *   v-model:todas        true = Paraná inteiro
 *   v-model:selecionadas códigos IBGE escolhidos (vale quando todas = false)
 */
const todas = defineModel('todas', { type: Boolean, default: true })
const selecionadas = defineModel('selecionadas', { type: Array, default: () => [] })

defineProps({
  desabilitado: { type: Boolean, default: false },
})

const LIMITE_LISTA = 60

const municipios = ref([])
const carregando = ref(false)
const erro = ref('')
const busca = ref('')

// Compara sem acento e sem maiúsculas: "maringa" acha "Maringá".
const normalizar = (texto) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const nomes = computed(() => new Map(municipios.value.map((m) => [m.codIbge, m.nome])))

const escolhidas = computed(() =>
  selecionadas.value
    .map((cod) => ({ codIbge: cod, nome: nomes.value.get(cod) ?? cod }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
)

const encontrados = computed(() => {
  const termo = normalizar(busca.value.trim())
  const lista = termo ? municipios.value.filter((m) => normalizar(m.nome).includes(termo)) : municipios.value
  return lista.slice(0, LIMITE_LISTA)
})

function alternar(cod) {
  selecionadas.value = selecionadas.value.includes(cod)
    ? selecionadas.value.filter((c) => c !== cod)
    : [...selecionadas.value, cod]
}

onMounted(async () => {
  carregando.value = true
  try {
    municipios.value = await listarMunicipios('PR')
  } catch (e) {
    erro.value = `Não deu para carregar os municípios: ${e.message}`
  } finally {
    carregando.value = false
  }
})
</script>

<template>
  <fieldset class="space-y-3" :disabled="desabilitado">
    <legend class="text-sm font-medium text-slate-100">Cidades que pode consultar</legend>

    <div class="flex flex-wrap gap-2">
      <label
        v-for="opcao in [
          { valor: true, rotulo: 'Todas as cidades' },
          { valor: false, rotulo: 'Cidades selecionadas' },
        ]"
        :key="String(opcao.valor)"
        :class="[
          'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition',
          todas === opcao.valor
            ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200'
            : 'border-slate-700 text-slate-300 hover:border-slate-500',
        ]"
      >
        <input v-model="todas" type="radio" :value="opcao.valor" class="accent-cyan-500" />
        {{ opcao.rotulo }}
      </label>
    </div>

    <template v-if="!todas">
      <div v-if="escolhidas.length" class="flex flex-wrap gap-1.5">
        <button
          v-for="m in escolhidas"
          :key="m.codIbge"
          type="button"
          class="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5
                 text-[12px] text-cyan-200 transition hover:border-rose-500/40 hover:text-rose-200"
          :title="`Remover ${m.nome}`"
          @click="alternar(m.codIbge)"
        >
          {{ m.nome }} <span aria-hidden="true">✕</span>
        </button>
      </div>
      <p v-else class="text-xs text-amber-300">
        Escolha pelo menos uma cidade. Sem nenhuma, o analista vê o Paraná inteiro.
      </p>

      <input v-model="busca" type="search" class="input" placeholder="Buscar município" aria-label="Buscar município" />

      <p v-if="erro" role="alert" class="text-xs text-rose-300">{{ erro }}</p>
      <p v-else-if="carregando" class="text-xs text-slate-400">Carregando municípios…</p>
      <ul v-else class="max-h-56 overflow-y-auto rounded-lg border border-slate-800">
        <li v-for="m in encontrados" :key="m.codIbge">
          <label class="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800/40">
            <input
              type="checkbox"
              class="h-4 w-4 accent-cyan-500"
              :checked="selecionadas.includes(m.codIbge)"
              @change="alternar(m.codIbge)"
            />
            {{ m.nome }}
          </label>
        </li>
        <li v-if="!encontrados.length" class="px-3 py-2 text-xs text-slate-500">Nenhum município com esse nome.</li>
      </ul>
      <p class="text-xs text-slate-500">{{ selecionadas.length }} de {{ municipios.length }} cidades escolhidas.</p>
    </template>
  </fieldset>
</template>
