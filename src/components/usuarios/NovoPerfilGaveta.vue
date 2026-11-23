<script setup>
import { computed, reactive, ref, watch } from 'vue'
import BaseGaveta from '@/components/BaseGaveta.vue'
import BaseButton from '@/components/BaseButton.vue'
import { PERFIS } from '@/components/usuarios/perfis'
import { criarPerfil } from '@/services/usuariosService'

/**
 * Cadastro de perfil combinado pelo gestor: um perfil novo que junta perfis do sistema
 * (ex.: Coordenador = Analista + Auditor). Vira uma role composta no Keycloak, e quem recebe o
 * perfil ganha tudo o que os perfis marcados podem. O que cada perfil do sistema faz não muda.
 */
const props = defineProps({
  aberto: { type: Boolean, default: false },
})
const emit = defineEmits(['fechar', 'criado'])

const vazio = () => ({ nome: '', descricao: '', inclui: [] })

const form = reactive(vazio())
const salvando = ref(false)
const erro = ref('')

watch(
  () => props.aberto,
  (sim) => {
    if (!sim) return
    Object.assign(form, vazio())
    erro.value = ''
  },
)

// Mesma regra do back: começa com letra; 3 a 30 letras, números ou sublinhado. Fica em maiúsculas.
const nomeLimpo = computed(() => form.nome.trim().toUpperCase().replace(/\s+/g, '_'))

const pendencia = computed(() => {
  if (!/^[A-Z][A-Z0-9_]{2,29}$/.test(nomeLimpo.value)) {
    return 'Nome com 3 a 30 letras, números ou sublinhado, começando com letra.'
  }
  if (PERFIS.some((p) => p.codigo === nomeLimpo.value)) return 'Esse nome já é de um perfil do sistema.'
  if (!form.inclui.length) return 'Marque pelo menos um perfil para juntar.'
  return ''
})

async function criar() {
  salvando.value = true
  erro.value = ''
  try {
    const criado = await criarPerfil({
      nome: nomeLimpo.value,
      descricao: form.descricao.trim(),
      inclui: form.inclui,
    })
    emit('criado', criado)
  } catch (e) {
    erro.value = e.message
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <BaseGaveta :aberto="aberto" titulo="Novo perfil" sobre="Gestão de usuários" @fechar="emit('fechar')">
    <form class="mx-auto max-w-xl space-y-4" @submit.prevent="pendencia || criar()">
      <p class="text-sm text-slate-400">
        Um perfil novo junta perfis que já existem. Quem receber ele pode fazer tudo o que os perfis
        marcados podem. Depois de criado, ele aparece na lista de perfis de cada usuário.
      </p>

      <fieldset class="grid grid-cols-1 gap-3" :disabled="salvando">
        <legend class="sr-only">Dados do perfil</legend>
        <div>
          <label class="label" for="np-nome">Nome</label>
          <input id="np-nome" v-model="form.nome" class="input font-mono" autocomplete="off" placeholder="COORDENADOR" />
          <p v-if="form.nome.trim()" class="mt-1 text-xs text-slate-500">
            Vai ficar assim: <span class="font-mono text-slate-300">{{ nomeLimpo }}</span>
          </p>
        </div>
        <div>
          <label class="label" for="np-descricao">Descrição <span class="text-slate-500">(opcional)</span></label>
          <input
            id="np-descricao"
            v-model="form.descricao"
            class="input"
            maxlength="255"
            autocomplete="off"
            placeholder="Ex.: acompanha os dados e consulta o mapa"
          />
        </div>
      </fieldset>

      <fieldset class="space-y-2" :disabled="salvando">
        <legend class="mb-2 text-sm font-medium text-slate-100">Junta os perfis</legend>
        <label
          v-for="p in PERFIS"
          :key="p.codigo"
          :class="[
            'flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition',
            form.inclui.includes(p.codigo)
              ? 'border-cyan-500/40 bg-cyan-500/5'
              : 'border-slate-800 hover:border-slate-600',
          ]"
        >
          <input v-model="form.inclui" type="checkbox" :value="p.codigo" class="mt-1 h-4 w-4 accent-cyan-500" />
          <span class="min-w-0">
            <span class="block text-sm font-medium text-slate-100">{{ p.rotulo }}</span>
            <span class="block text-xs text-slate-400">{{ p.descricao }}</span>
          </span>
        </label>
      </fieldset>

      <p
        v-if="erro"
        role="alert"
        class="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
      >
        {{ erro }}
      </p>
    </form>

    <template #rodape>
      <!-- Por que o "Criar perfil" está bloqueado (a descrição é opcional). -->
      <p
        v-if="pendencia"
        role="status"
        class="mr-auto rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200"
      >
        <span class="font-semibold">Preencha os campos obrigatórios.</span>
        <span class="text-amber-200/80">{{ pendencia }}</span>
      </p>
      <BaseButton variante="fantasma" :disabled="salvando" @click="emit('fechar')">Cancelar</BaseButton>
      <BaseButton :carregando="salvando" :disabled="!!pendencia" @click="criar">Criar perfil</BaseButton>
    </template>
  </BaseGaveta>
</template>
