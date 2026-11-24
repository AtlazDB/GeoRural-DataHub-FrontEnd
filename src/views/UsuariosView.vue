<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import BaseButton from '@/components/BaseButton.vue'
import BaseChave from '@/components/BaseChave.vue'
import UsuarioPerfisGaveta from '@/components/usuarios/UsuarioPerfisGaveta.vue'
import NovoUsuarioGaveta from '@/components/usuarios/NovoUsuarioGaveta.vue'
import NovoPerfilGaveta from '@/components/usuarios/NovoPerfilGaveta.vue'
import { CATALOGO_PADRAO, montarCatalogo, restritoPorRegiao } from '@/components/usuarios/perfis'
import { alterarAtivoUsuario, listarPerfis, listarUsuarios } from '@/services/usuariosService'
import { usuarioLogado } from '@/auth/keycloak'

/**
 * Gestão de usuários e perfis (T28). Só o GESTOR chega aqui (router: meta.perfis).
 */
const TAMANHO = 20

// Perfis que podem ser atribuídos: os 4 do sistema e os combinados criados pelo gestor.
// Começa só com os 4 e troca quando o GET /usuarios/perfis responde.
const catalogo = ref(CATALOGO_PADRAO)
const criandoPerfil = ref(false)

async function carregarPerfis() {
  try {
    catalogo.value = montarCatalogo(await listarPerfis())
  } catch (e) {
    erroChave.value = `Não deu para carregar os perfis combinados: ${e.message}`
  }
}

function rotuloPerfil(codigo) {
  return catalogo.value.find((p) => p.codigo === codigo)?.rotulo ?? codigo
}

// A descrição de um perfil combinado foi editada na gaveta do usuário: atualiza o catálogo.
function aoAtualizarPerfil(atualizado) {
  const [novo] = montarCatalogo([atualizado])
  catalogo.value = catalogo.value.map((p) => (p.codigo === novo.codigo ? novo : p))
  avisar(`Descrição do perfil ${novo.rotulo} atualizada.`)
}

function aoCriarPerfil(criado) {
  criandoPerfil.value = false
  catalogo.value = [...catalogo.value, ...montarCatalogo([criado])]
  avisar(`Perfil ${criado.codigo} criado. Ele já aparece na lista de perfis de cada usuário.`)
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

// Chave de ativar: id do usuário sendo trocado e o erro da última troca (não esconde a lista).
const alternandoId = ref(null)
const erroChave = ref('')
// O gestor não desativa a si mesmo (o back também barra).
const eu = usuarioLogado()?.usuario

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

/** Liga ou desliga o acesso. Desativado, o usuário não entra; perfis e cidades ficam guardados. */
async function alternarAtivo(u) {
  alternandoId.value = u.id
  erroChave.value = ''
  try {
    const atualizado = await alterarAtivoUsuario(u.id, !u.ativo)
    usuarios.value = usuarios.value.map((x) => (x.id === atualizado.id ? atualizado : x))
    avisar(`Usuário ${atualizado.username} ${atualizado.ativo ? 'ativado' : 'desativado'}.`)
  } catch (e) {
    erroChave.value = e.message
  } finally {
    alternandoId.value = null
  }
}

function avisar(texto) {
  aviso.value = texto
  clearTimeout(esperaAviso)
  esperaAviso = setTimeout(() => (aviso.value = ''), 5000)
}

function rotuloRegiao(u) {
  if (!restritoPorRegiao(u.perfis, catalogo.value)) return ''
  if (!u.totalMunicipios) return 'Todas as cidades'
  return u.totalMunicipios === 1 ? '1 cidade' : `${u.totalMunicipios} cidades`
}

// Página cheia = provavelmente há mais; o back não informa o total.
// Desativados vão para o fim da página; entre os do mesmo grupo, a ordem do Keycloak não muda.
const usuariosOrdenados = computed(() =>
  [...usuarios.value].sort((a, b) => Number(!a.ativo) - Number(!b.ativo)),
)

const temProxima = computed(() => usuarios.value.length === TAMANHO)

onMounted(() => {
  carregar()
  carregarPerfis()
})
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
      <BaseButton class="ml-auto" variante="secundario" @click="criandoPerfil = true">Novo perfil</BaseButton>
      <BaseButton @click="criando = true">Novo usuário</BaseButton>
    </div>


    <p
      v-if="aviso"
      role="status"
      class="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
    >
      {{ aviso }}
    </p>

    <p
      v-if="erroChave"
      role="alert"
      class="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
    >
      {{ erroChave }}
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
      <!-- Celular: nome e e-mail na largura toda, perfis embaixo e, por último, a chave e o botão.
           A partir do md volta a ser uma linha só. -->
      <li v-for="u in usuariosOrdenados" :key="u.id" class="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
        <div :class="['min-w-0 basis-full md:basis-0 md:flex-1', !u.ativo && 'opacity-50']">
          <p class="truncate text-sm font-medium text-slate-100">
            {{ u.nome }}
            <span class="ml-1 font-mono text-xs font-normal text-slate-500">{{ u.username }}</span>
          </p>
          <p class="truncate text-xs text-slate-400">{{ u.email || 'sem e-mail' }}</p>
        </div>

        <div class="flex basis-full flex-wrap gap-1.5 md:basis-auto md:justify-end">
          <span
            v-for="p in u.perfis"
            :key="p"
            :class="[
              'rounded-full border px-2 py-0.5 text-[11px]',
              p === 'GESTOR'
                ? 'border-indigo-400/40 bg-indigo-500/10 text-indigo-200'
                : catalogo.find((c) => c.codigo === p)?.doSistema === false
                  ? 'border-slate-600 bg-slate-500/10 text-slate-200'
                  : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200',
            ]"
          >
            {{ rotuloPerfil(p) }}
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

        <div class="flex shrink-0 items-center gap-2">
          <BaseChave
            :ligada="u.ativo"
            :rotulo="`o usuário ${u.username}`"
            :ocupada="alternandoId === u.id"
            :bloqueada-por="u.ativo && u.username === eu ? 'Você não pode desativar o seu próprio usuário.' : ''"
            @alternar="alternarAtivo(u)"
          />
          <span :class="['w-12 text-[11px]', u.ativo ? 'text-cyan-300' : 'text-slate-400']">
            {{ u.ativo ? 'Ativo' : 'Inativo' }}
          </span>
        </div>

        <BaseButton variante="fantasma" tamanho="sm" class="ml-auto shrink-0 md:ml-0" @click="editando = u">
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

    <UsuarioPerfisGaveta
      :usuario="editando"
      :catalogo="catalogo"
      @fechar="editando = null"
      @salvo="aoSalvar"
      @perfil-atualizado="aoAtualizarPerfil"
    />
    <NovoUsuarioGaveta :aberto="criando" :catalogo="catalogo" @fechar="criando = false" @criado="aoCriar" />
    <NovoPerfilGaveta :aberto="criandoPerfil" @fechar="criandoPerfil = false" @criado="aoCriarPerfil" />
  </section>
</template>