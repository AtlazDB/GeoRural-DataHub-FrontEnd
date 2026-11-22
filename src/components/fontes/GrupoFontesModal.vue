<script setup>
import { computed, ref, watch } from 'vue'
import BaseModal from '@/components/BaseModal.vue'
import BaseButton from '@/components/BaseButton.vue'
import { atualizarGrupo, criarGrupo, excluirGrupo } from '@/services/fontesService'

/**
 * Criar ou editar um grupo de fontes. O grupo só organiza a tela: os cards ficam dentro de uma
 * "pasta" (ex.: APP com os 15 pedaços). Não muda processamento nem indicadores.
 *   grupo = null → criar; grupo = { id, nome, fonteIds } → editar (e pode excluir).
 */
const props = defineProps({
  aberto: { type: Boolean, default: false },
  grupo: { type: Object, default: null },
  fontes: { type: Array, default: () => [] },
  /** todos os grupos, para mostrar onde cada fonte está hoje */
  grupos: { type: Array, default: () => [] },
})
const emit = defineEmits(['fechar', 'salvo'])

const nome = ref('')
const marcadas = ref([])
const busca = ref('')
const salvando = ref(false)
const confirmandoExclusao = ref(false)
const erro = ref('')

watch(
  () => props.aberto,
  (sim) => {
    if (!sim) return
    nome.value = props.grupo?.nome ?? ''
    marcadas.value = [...(props.grupo?.fonteIds ?? [])]
    busca.value = ''
    erro.value = ''
    confirmandoExclusao.value = false
  },
)

const nomeDoGrupo = computed(() => Object.fromEntries(props.grupos.map((g) => [g.id, g.nome])))

// Desativadas não entram na lista, a não ser que já estejam neste grupo (para dar para tirar).
const fontesDaBusca = computed(() => {
  const termo = busca.value.trim().toLowerCase()
  const doGrupo = props.grupo?.fonteIds ?? []
  return props.fontes.filter(
    (f) =>
      (f.status !== 'inativa' || doGrupo.includes(f.id)) &&
      (!termo || `${f.sigla} ${f.nome} ${f.orgao}`.toLowerCase().includes(termo)),
  )
})

function marcarDaBusca() {
  marcadas.value = [...new Set([...marcadas.value, ...fontesDaBusca.value.map((f) => f.id)])]
}

// Fonte que está em OUTRO grupo: marcar aqui tira ela de lá.
function grupoAtual(fonte) {
  if (!fonte.grupoId || fonte.grupoId === props.grupo?.id) return ''
  return nomeDoGrupo.value[fonte.grupoId] ?? ''
}

const pendencia = computed(() => (nome.value.trim() ? '' : 'Dê um nome ao grupo.'))

async function salvar() {
  salvando.value = true
  erro.value = ''
  try {
    const dados = { nome: nome.value.trim(), fonteIds: marcadas.value }
    const salvo = props.grupo ? await atualizarGrupo(props.grupo.id, dados) : await criarGrupo(dados)
    emit('salvo', salvo)
  } catch (e) {
    erro.value = e.message
  } finally {
    salvando.value = false
  }
}

async function excluir() {
  salvando.value = true
  erro.value = ''
  try {
    await excluirGrupo(props.grupo.id)
    emit('salvo', null)
  } catch (e) {
    erro.value = e.message
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <BaseModal
    :aberto="aberto"
    :titulo="grupo ? `Editar grupo ${grupo.nome}` : 'Novo grupo de fontes'"
    largura="max-w-lg"
    @fechar="emit('fechar')"
  >
    <p class="text-[13px] text-slate-400">
      O grupo só organiza a tela: os cards das fontes marcadas ficam dentro de uma pasta. Nada muda no
      processamento nem nos indicadores.
    </p>

    <div class="mt-4">
      <label class="label" for="grupo-nome">Nome do grupo</label>
      <input id="grupo-nome" v-model="nome" class="input" maxlength="120" placeholder="Ex.: APP – Paraná" />
    </div>

    <fieldset class="mt-4">
      <legend class="label">
        Fontes do grupo <span class="text-slate-500">· {{ marcadas.length }} marcada(s)</span>
      </legend>
      <div class="flex gap-2">
        <input v-model="busca" type="search" class="input" placeholder="Buscar, ex.: APP" aria-label="Buscar fonte" />
        <BaseButton type="button" variante="fantasma" tamanho="sm" class="shrink-0" @click="marcarDaBusca">
          Marcar todas da busca
        </BaseButton>
        <BaseButton
          v-if="marcadas.length"
          type="button"
          variante="fantasma"
          tamanho="sm"
          class="shrink-0"
          @click="marcadas = []"
        >
          Limpar
        </BaseButton>
      </div>
      <div class="mt-2 max-h-64 space-y-1 overflow-y-auto rounded-lg border border-slate-800 p-2">
        <label
          v-for="f in fontesDaBusca"
          :key="f.id"
          class="flex cursor-pointer items-center gap-2 text-sm text-slate-300"
        >
          <input v-model="marcadas" type="checkbox" :value="f.id" />
          <span class="font-mono text-[12px] text-cyan-400">{{ f.sigla }}</span>
          <span class="truncate">{{ f.nome }}</span>
          <span v-if="grupoAtual(f)" class="ml-auto shrink-0 text-[11px] text-amber-300">em {{ grupoAtual(f) }}</span>
        </label>
        <p v-if="!fontesDaBusca.length" class="text-xs text-slate-500">Nenhuma fonte com essa busca.</p>
      </div>
      <p class="mt-1 text-xs text-slate-500">Uma fonte fica em um grupo só: marcar uma que está em outro grupo traz ela para cá.</p>
    </fieldset>

    <p
      v-if="erro"
      role="alert"
      class="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
    >
      {{ erro }}
    </p>

    <template #rodape>
      <template v-if="grupo">
        <BaseButton
          v-if="!confirmandoExclusao"
          variante="fantasma"
          class="mr-auto"
          :disabled="salvando"
          @click="confirmandoExclusao = true"
        >
          Excluir grupo
        </BaseButton>
        <span v-else class="mr-auto flex items-center gap-2 text-xs text-slate-400">
          As fontes ficam sem grupo. Excluir?
          <BaseButton variante="fantasma" tamanho="sm" :carregando="salvando" @click="excluir">Sim, excluir</BaseButton>
          <BaseButton variante="fantasma" tamanho="sm" :disabled="salvando" @click="confirmandoExclusao = false">Não</BaseButton>
        </span>
      </template>
      <p v-else-if="pendencia" class="mr-auto text-xs text-amber-300">{{ pendencia }}</p>
      <BaseButton variante="fantasma" :disabled="salvando" @click="emit('fechar')">Cancelar</BaseButton>
      <BaseButton :carregando="salvando" :disabled="!!pendencia" @click="salvar">
        {{ grupo ? 'Salvar' : 'Criar grupo' }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
