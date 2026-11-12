<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import BaseButton from '@/components/BaseButton.vue'
import UsuarioPerfisGaveta from '@/components/usuarios/UsuarioPerfisGaveta.vue'
import NovoUsuarioGaveta from '@/components/usuarios/NovoUsuarioGaveta.vue'
import { restritoPorRegiao } from '@/components/usuarios/perfis'
import { listarUsuarios } from '@/services/usuariosService'

/**
 * Gestão de usuários e perfis (T28). Só o GESTOR chega aqui (router: meta.perfis).
 */
const TAMANHO = 20

const ROTULOS_PERFIL = {
  OPERADOR_DADOS: 'Operador de dados',
  ANALISTA: 'Analista',
  AUDITOR: 'Auditor',
  GESTOR: 'Gestor',
}

const usuarios = ref([])
const carregando = ref(false)
const erro = ref('')
const busca = ref('')
const pagina = ref(0)

const editando = ref(null) // usuário aberto na gaveta
const criando = ref(false)
const aviso = ref('')
let esperaAviso = null

// Só a resposta da última chamada vale (evita lista antiga sobrescrever a nova).
let chamadaAtual = 0

async function carregar() {
  const minha = ++chamadaAtual
  carregando.value = true
  erro.value = ''
  try {
    const lista = await listarUsuarios({
      busca: busca.value.trim(),
      pagina: pagina.value,
      tamanho: TAMANHO,
    })
    if (minha !== chamadaAtual) return
    usuarios.value = lista
  } catch (e) {
    if (minha !== chamadaAtual) return
    erro.value = e.message
    usuarios.value = []
  } finally {
    if (minha === chamadaAtual) carregando.value = false
  }
}

// Busca: espera a pessoa parar de digitar e volta para a primeira página.
let espera = null
watch(busca, () => {
  clearTimeout(espera)
  espera = setTimeout(() => {
    pagina.value = 0
    carregar()
  }, 400)
})

function irPara(novaPagina) {
  pagina.value = Math.max(novaPagina, 0)
  carregar()
}

// Chamado quando a gaveta salvou: troca a linha na lista e avisa.
function aoSalvar(atualizado) {
  usuarios.value = usuarios.value.map((u) => (u.id === atualizado.id ? atualizado : u))
  editando.value = null
  avisar(`Acesso de ${atualizado.nome} atualizado.`)
}

function aoCriar(criado) {
  criando.value = false
  usuarios.value = [criado, ...usuarios.value.filter((u) => u.id !== criado.id)]
  avisar(`Usuário ${criado.username} criado. Passe a senha provisória para a pessoa.`)
}

function avisar(texto) {
  aviso.value = texto
  clearTimeout(esperaAviso)
  esperaAviso = setTimeout(() => (aviso.value = ''), 5000)
}

function rotuloRegiao(u) {
  if (!restritoPorRegiao(u.perfis)) return ''
  if (!u.totalMunicipios) return 'Todas as cidades'
  return u.totalMunicipios === 1 ? '1 cidade' : `${u.totalMunicipios} cidades`
}

// Página cheia = provavelmente há mais; o back não informa o total.
const temProxima = computed(() => usuarios.value.length === TAMANHO)

onMounted(carregar)
onBeforeUnmount(() => {
  clearTimeout(espera)
  clearTimeout(esperaAviso)
})
</script>

<template>
  <section class="space-y-4">
    <div class="flex flex-wrap items-center gap-2">
      <input
        v-model="busca"
        type="search"
        placeholder="Buscar por nome, usuário ou e-mail"
        aria-label="Buscar usuários"
        class="w-full max-w-sm rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm
               text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
      />
      <BaseButton variante="fantasma" :carregando="carregando" @click="carregar">Atualizar</BaseButton>
      <BaseButton class="ml-auto" @click="criando = true">Novo usuário</BaseButton>
    </div>

    <p
      v-if="aviso"
      role="status"
      class="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
    >
      {{ aviso }}
    </p>

    <p
      v-if="erro"
      role="alert"
      class="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
    >
      {{ erro }}
    </p>

    <p
      v-else-if="carregando && !usuarios.length"
      class="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400"
    >
      Carregando usuários…
    </p>

    <p
      v-else-if="!usuarios.length"
      class="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400"
    >
      Nenhum usuário encontrado.
    </p>

    <ul v-else class="divide-y divide-slate-800/80 rounded-xl border border-slate-800 bg-slate-900/40 px-4">
      <li v-for="u in usuarios" :key="u.id" class="flex flex-wrap items-center gap-3 py-3">
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-slate-100">
            {{ u.nome }}
            <span class="ml-1 font-mono text-xs font-normal text-slate-500">{{ u.username }}</span>
            <span v-if="!u.ativo" class="ml-2 text-[10px] uppercase text-rose-300">desativado</span>
          </p>
          <p class="truncate text-xs text-slate-400">{{ u.email || 'sem e-mail' }}</p>
        </div>

        <div class="flex flex-wrap justify-end gap-1.5">
          <span
            v-for="p in u.perfis"
            :key="p"
            :class="[
              'rounded-full border px-2 py-0.5 text-[11px]',
              p === 'GESTOR'
                ? 'border-indigo-400/40 bg-indigo-500/10 text-indigo-200'
                : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200',
            ]"
          >
            {{ ROTULOS_PERFIL[p] ?? p }}
          </span>
          <span
            v-if="rotuloRegiao(u)"
            class="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-200"
          >
            {{ rotuloRegiao(u) }}
          </span>
          <span
            v-if="!u.perfis.length"
            class="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-500"
          >
            Sem perfil
          </span>
        </div>

        <BaseButton variante="fantasma" tamanho="sm" class="shrink-0" @click="editando = u">
          Editar acesso
        </BaseButton>
      </li>
    </ul>

    <div v-if="pagina > 0 || temProxima" class="flex items-center justify-end gap-2">
      <BaseButton variante="fantasma" tamanho="sm" :disabled="pagina === 0 || carregando" @click="irPara(pagina - 1)">
        Anterior
      </BaseButton>
      <span class="text-xs text-slate-500">Página {{ pagina + 1 }}</span>
      <BaseButton variante="fantasma" tamanho="sm" :disabled="!temProxima || carregando" @click="irPara(pagina + 1)">
        Próxima
      </BaseButton>
    </div>

    <UsuarioPerfisGaveta :usuario="editando" @fechar="editando = null" @salvo="aoSalvar" />
    <NovoUsuarioGaveta :aberto="criando" @fechar="criando = false" @criado="aoCriar" />
  </section>
</template>