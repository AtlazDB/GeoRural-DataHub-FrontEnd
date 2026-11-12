<script setup>
import { computed, reactive, ref, watch } from 'vue'
import BaseGaveta from '@/components/BaseGaveta.vue'
import BaseButton from '@/components/BaseButton.vue'
import SeletorCidades from '@/components/usuarios/SeletorCidades.vue'
import { PERFIS } from '@/components/usuarios/perfis'
import { criarUsuario } from '@/services/usuariosService'

/** Cadastro de usuário pelo gestor (US14). A senha é provisória: o Keycloak pede outra no primeiro login. */
const props = defineProps({
  aberto: { type: Boolean, default: false },
})
const emit = defineEmits(['fechar', 'criado'])

const vazio = () => ({
  username: '',
  nome: '',
  sobrenome: '',
  email: '',
  senhaProvisoria: '',
  perfis: ['ANALISTA'],
  todasCidades: true,
  municipios: [],
})

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

function gerarSenha() {
  const letras = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const sorteio = crypto.getRandomValues(new Uint32Array(12))
  form.senhaProvisoria = Array.from(sorteio, (n) => letras[n % letras.length]).join('')
}

const pendencia = computed(() => {
  if (!/^[a-zA-Z0-9._-]{3,50}$/.test(form.username.trim())) return 'Login com 3 a 50 letras, números, ponto, hífen ou sublinhado.'
  if (!form.nome.trim() || !form.sobrenome.trim()) return 'Preencha nome e sobrenome.'
  if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return 'Informe um e-mail válido.'
  if (form.senhaProvisoria.length < 8) return 'A senha provisória precisa de pelo menos 8 caracteres.'
  if (!form.perfis.length) return 'Marque pelo menos um perfil.'
  if (form.perfis.includes('ANALISTA') && !form.todasCidades && !form.municipios.length) {
    return 'Escolha pelo menos uma cidade, ou libere todas.'
  }
  return ''
})

async function criar() {
  salvando.value = true
  erro.value = ''
  try {
    const criado = await criarUsuario({
      ...form,
      username: form.username.trim(),
      email: form.email.trim(),
      todasCidades: !form.perfis.includes('ANALISTA') || form.todasCidades,
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
  <BaseGaveta :aberto="aberto" titulo="Novo usuário" sobre="Gestão de usuários" @fechar="emit('fechar')">
    <form class="mx-auto max-w-xl space-y-4" @submit.prevent="pendencia || criar()">
      <fieldset class="grid grid-cols-1 gap-3 sm:grid-cols-2" :disabled="salvando">
        <legend class="sr-only">Dados de acesso</legend>
        <div>
          <label class="label" for="nu-nome">Nome</label>
          <input id="nu-nome" v-model="form.nome" class="input" autocomplete="off" />
        </div>
        <div>
          <label class="label" for="nu-sobrenome">Sobrenome</label>
          <input id="nu-sobrenome" v-model="form.sobrenome" class="input" autocomplete="off" />
        </div>
        <div>
          <label class="label" for="nu-login">Login</label>
          <input id="nu-login" v-model="form.username" class="input font-mono" autocomplete="off" placeholder="ana.silva" />
        </div>
        <div>
          <label class="label" for="nu-email">E-mail</label>
          <input id="nu-email" v-model="form.email" type="email" class="input" autocomplete="off" />
        </div>
        <div class="sm:col-span-2">
          <label class="label" for="nu-senha">Senha provisória</label>
          <div class="flex gap-2">
            <input id="nu-senha" v-model="form.senhaProvisoria" class="input font-mono" autocomplete="new-password" />
            <BaseButton type="button" variante="fantasma" @click="gerarSenha">Gerar</BaseButton>
          </div>
          <p class="mt-1 text-xs text-slate-500">Passe a senha para a pessoa: no primeiro login ela escolhe uma nova.</p>
        </div>
      </fieldset>

      <fieldset class="space-y-2" :disabled="salvando">
        <legend class="mb-2 text-sm font-medium text-slate-100">Perfis</legend>
        <label
          v-for="p in PERFIS"
          :key="p.codigo"
          :class="[
            'flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition',
            form.perfis.includes(p.codigo)
              ? 'border-cyan-500/40 bg-cyan-500/5'
              : 'border-slate-800 hover:border-slate-600',
          ]"
        >
          <input v-model="form.perfis" type="checkbox" :value="p.codigo" class="mt-1 h-4 w-4 accent-cyan-500" />
          <span class="min-w-0">
            <span class="block text-sm font-medium text-slate-100">{{ p.rotulo }}</span>
            <span class="block text-xs text-slate-400">{{ p.descricao }}</span>
          </span>
        </label>
      </fieldset>

      <section v-if="form.perfis.includes('ANALISTA')" class="rounded-xl border border-slate-800 p-4">
        <SeletorCidades
          v-model:todas="form.todasCidades"
          v-model:selecionadas="form.municipios"
          :desabilitado="salvando"
        />
      </section>

      <p
        v-if="erro"
        role="alert"
        class="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
      >
        {{ erro }}
      </p>
    </form>

    <template #rodape>
      <p v-if="pendencia" class="mr-auto text-xs text-slate-500">{{ pendencia }}</p>
      <BaseButton variante="fantasma" :disabled="salvando" @click="emit('fechar')">Cancelar</BaseButton>
      <BaseButton :carregando="salvando" :disabled="!!pendencia" @click="criar">Criar usuário</BaseButton>
    </template>
  </BaseGaveta>
</template>
