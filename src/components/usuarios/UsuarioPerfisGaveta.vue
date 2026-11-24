<script setup>
import { computed, ref, watch } from 'vue'
import BaseGaveta from '@/components/BaseGaveta.vue'
import BaseButton from '@/components/BaseButton.vue'
import AppIcon from '@/components/AppIcon.vue'
import SeletorCidades from '@/components/usuarios/SeletorCidades.vue'
import { CATALOGO_PADRAO, expandir, restritoPorRegiao } from '@/components/usuarios/perfis'
import {
  buscarMunicipiosDoUsuario,
  buscarUsuario,
  editarDescricaoPerfil,
  redefinirSenha,
  salvarMunicipiosDoUsuario,
  salvarPerfis,
} from '@/services/usuariosService'
import { usuarioLogado } from '@/auth/keycloak'
import { gerarSenhaProvisoria } from '@/utils/senha'

/**
 * Gaveta de edição dos perfis e das cidades de um usuário (T28.4 e US10.T05).
 *
 * Abre quando recebe um `usuario`; fecha quando ele volta a ser null.
 * Emite 'fechar' e 'salvo' (com o usuário já atualizado, como o back devolve).
 * Só esconde/trava: quem barra de verdade é o back (SecurityConfig e UsuarioService).
 */
const props = defineProps({
  usuario: { type: Object, default: null },
  /** perfis que podem ser marcados (os 4 do sistema e os combinados), vindos da UsuariosView */
  catalogo: { type: Array, default: () => CATALOGO_PADRAO },
})
// 'perfil-atualizado': a descrição de um perfil combinado mudou (a UsuariosView atualiza o catálogo).
const emit = defineEmits(['fechar', 'salvo', 'perfil-atualizado'])

// Descrição de um perfil combinado, editada ali mesmo no card do perfil.
const descricaoEmEdicao = ref(null) // código do perfil aberto, ou null
const textoDescricao = ref('')
const salvandoDescricao = ref(false)
const erroDescricao = ref('')

function abrirDescricao(p) {
  descricaoEmEdicao.value = p.codigo
  textoDescricao.value = p.nota ?? ''
  erroDescricao.value = ''
}

async function salvarDescricao() {
  salvandoDescricao.value = true
  erroDescricao.value = ''
  try {
    emit('perfil-atualizado', await editarDescricaoPerfil(descricaoEmEdicao.value, textoDescricao.value.trim()))
    descricaoEmEdicao.value = null
  } catch (e) {
    erroDescricao.value = e.message
  } finally {
    salvandoDescricao.value = false
  }
}

const marcados = ref([])
const todas = ref(true)
const cidades = ref([])
const cidadesAntes = ref({ todas: true, cidades: [] })
const carregandoCidades = ref(false)
const salvando = ref(false)
const erro = ref('')

// Redefinir senha: ação à parte do Salvar (vai direto para o Keycloak).
const novaSenha = ref('')
const redefinindo = ref(false)
const avisoSenha = ref(null) // { tipo: 'ok' | 'erro', texto }

// Cada vez que outro usuário é aberto, o formulário volta ao estado dele.
watch(
  () => props.usuario,
  async (u) => {
    marcados.value = u ? [...u.perfis] : []
    erro.value = ''
    descricaoEmEdicao.value = null
    novaSenha.value = ''
    avisoSenha.value = null
    salvando.value = false
    todas.value = true
    cidades.value = []
    cidadesAntes.value = { todas: true, cidades: [] }
    if (!u) return
    carregandoCidades.value = true
    try {
      const acesso = await buscarMunicipiosDoUsuario(u.id)
      if (props.usuario?.id !== u.id) return
      todas.value = acesso.todas
      cidades.value = acesso.municipios.map((m) => m.codIbge)
      cidadesAntes.value = { todas: acesso.todas, cidades: [...cidades.value] }
    } catch (e) {
      erro.value = `Não deu para carregar as cidades: ${e.message}`
    } finally {
      carregandoCidades.value = false
    }
  },
  { immediate: true },
)

// É a própria pessoa logada? (compara o nome de usuário do token com o da linha)
const eVoce = computed(
  () => !!props.usuario && usuarioLogado()?.usuario === props.usuario.username,
)

// Analista direto ou dentro de um perfil combinado.
const mostraCidades = computed(() => expandir(marcados.value, props.catalogo).includes('ANALISTA'))

const mudouPerfis = computed(() => {
  const antes = [...(props.usuario?.perfis ?? [])].sort().join()
  const agora = [...marcados.value].sort().join()
  return antes !== agora
})

const mudouCidades = computed(
  () =>
    todas.value !== cidadesAntes.value.todas ||
    (!todas.value && [...cidades.value].sort().join() !== [...cidadesAntes.value.cidades].sort().join()),
)

const semCidade = computed(() => mostraCidades.value && !todas.value && !cidades.value.length)

async function confirmarNovaSenha() {
  redefinindo.value = true
  avisoSenha.value = null
  try {
    await redefinirSenha(props.usuario.id, novaSenha.value)
    avisoSenha.value = {
      tipo: 'ok',
      texto: `Senha redefinida. Passe para a pessoa: ${novaSenha.value} — no próximo login ela escolhe uma nova.`,
    }
    novaSenha.value = ''
  } catch (e) {
    avisoSenha.value = { tipo: 'erro', texto: e.message }
  } finally {
    redefinindo.value = false
  }
}

async function salvar() {
  salvando.value = true
  erro.value = ''
  try {
    if (mudouPerfis.value) await salvarPerfis(props.usuario.id, marcados.value)
    if (mudouCidades.value) {
      await salvarMunicipiosDoUsuario(props.usuario.id, { todas: todas.value, municipios: cidades.value })
    }
    emit('salvo', await buscarUsuario(props.usuario.id))
  } catch (e) {
    erro.value = e.message
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <BaseGaveta
    :aberto="!!usuario"
    :titulo="usuario?.nome ?? ''"
    :sobre="usuario?.username ?? ''"
    @fechar="emit('fechar')"
  >
    <div v-if="usuario" class="mx-auto max-w-xl space-y-4">
      <p class="text-sm text-slate-400">
        Marque o que esta pessoa pode usar no sistema.
        A mudança de perfil vale no próximo login dela (ou em até 15 minutos, se ela estiver conectada).
      </p>

      <fieldset class="space-y-2" :disabled="salvando">
        <legend class="sr-only">Perfis de {{ usuario.nome }}</legend>

        <label
          v-for="p in catalogo"
          :key="p.codigo"
          :class="[
            'flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition',
            marcados.includes(p.codigo)
              ? 'border-cyan-500/40 bg-cyan-500/5'
              : 'border-slate-800 hover:border-slate-600',
          ]"
        >
          <input
            v-model="marcados"
            type="checkbox"
            :value="p.codigo"
            :disabled="eVoce && p.codigo === 'GESTOR'"
            class="mt-1 h-4 w-4 accent-cyan-500"
          />
          <span class="min-w-0">
            <span class="block text-sm font-medium text-slate-100">{{ p.rotulo }}</span>
            <span class="block text-xs text-slate-400">{{ p.descricao }}</span>

            <!-- Perfil combinado: a descrição pode ser editada aqui (os 4 do sistema, não).
                 Botão e campo dentro do <label> não marcam o checkbox (são interativos). -->
            <template v-if="!p.doSistema">
              <button
                v-if="descricaoEmEdicao !== p.codigo"
                type="button"
                class="mt-1 inline-flex items-center gap-1 text-xs text-cyan-300 hover:text-cyan-200"
                @click.prevent.stop="abrirDescricao(p)"
              >
                <AppIcon nome="lapis" class="h-3 w-3" />
                Editar descrição
              </button>
              <span v-else class="mt-2 block space-y-2">
                <textarea
                  v-model="textoDescricao"
                  rows="2"
                  maxlength="255"
                  class="input text-xs"
                  :aria-label="`Descrição do perfil ${p.rotulo}`"
                  placeholder="Ex.: acompanha os dados e consulta o mapa"
                  :disabled="salvandoDescricao"
                />
                <span v-if="erroDescricao" role="alert" class="block text-xs text-rose-300">{{ erroDescricao }}</span>
                <span class="flex gap-2">
                  <BaseButton
                    type="button"
                    tamanho="sm"
                    variante="secundario"
                    :carregando="salvandoDescricao"
                    @click.prevent.stop="salvarDescricao"
                  >
                    Salvar descrição
                  </BaseButton>
                  <BaseButton
                    type="button"
                    tamanho="sm"
                    variante="fantasma"
                    :disabled="salvandoDescricao"
                    @click.prevent.stop="descricaoEmEdicao = null"
                  >
                    Cancelar
                  </BaseButton>
                </span>
              </span>
            </template>
            <span
              v-if="eVoce && p.codigo === 'GESTOR'"
              class="mt-1 block text-xs text-amber-300"
            >
              Você não pode remover o seu próprio perfil de Gestor.
            </span>
          </span>
        </label>
      </fieldset>

      <p
        v-if="!marcados.length"
        class="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
      >
        Sem nenhum perfil, a pessoa consegue entrar, mas não acessa nenhuma tela.
      </p>

      <section v-if="mostraCidades" class="rounded-xl border border-slate-800 p-4">
        <p v-if="carregandoCidades" class="text-sm text-slate-400">Carregando as cidades…</p>
        <SeletorCidades
          v-else
          v-model:todas="todas"
          v-model:selecionadas="cidades"
          :desabilitado="salvando"
        />
        <p v-if="!restritoPorRegiao(marcados, catalogo)" class="mt-3 text-xs text-slate-500">
          Com outro perfil além de Analista, a pessoa vê todas as cidades; esta lista só vale se ela ficar só como Analista.
        </p>
      </section>

      <!-- Perda ou esquecimento de senha -->
      <section class="rounded-xl border border-slate-800 p-4">
        <h3 class="text-sm font-medium text-slate-100">Redefinir senha</h3>
        <p class="mt-1 text-xs text-slate-400">
          Para quando a pessoa perdeu ou esqueceu a senha. A senha nova é provisória: no próximo login
          ela escolhe outra.
        </p>
        <!-- Celular: o campo ocupa a linha toda e os botões vão para baixo dele. -->
        <div class="mt-3 flex flex-wrap gap-2 sm:flex-nowrap">
          <label class="sr-only" for="senha-nova">Senha provisória nova</label>
          <input
            id="senha-nova"
            v-model="novaSenha"
            class="input basis-full font-mono sm:basis-auto"
            autocomplete="new-password"
            placeholder="Senha provisória nova"
            :disabled="redefinindo"
          />
          <BaseButton type="button" variante="fantasma" :disabled="redefinindo" @click="novaSenha = gerarSenhaProvisoria()">
            Gerar
          </BaseButton>
          <BaseButton
            type="button"
            variante="secundario"
            :carregando="redefinindo"
            :disabled="novaSenha.length < 8"
            @click="confirmarNovaSenha"
          >
            Redefinir
          </BaseButton>
        </div>
        <p v-if="novaSenha && novaSenha.length < 8" class="mt-1 text-xs text-slate-500">Pelo menos 8 caracteres.</p>
        <p
          v-if="avisoSenha"
          :role="avisoSenha.tipo === 'erro' ? 'alert' : 'status'"
          :class="[
            'mt-3 rounded-lg border px-3 py-2 text-xs',
            avisoSenha.tipo === 'erro'
              ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
          ]"
        >
          {{ avisoSenha.texto }}
        </p>
      </section>

      <p
        v-if="erro"
        role="alert"
        class="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
      >
        {{ erro }}
      </p>
    </div>

    <template #rodape>
      <BaseButton variante="fantasma" :disabled="salvando" @click="emit('fechar')">Cancelar</BaseButton>
      <BaseButton :carregando="salvando" :disabled="(!mudouPerfis && !mudouCidades) || semCidade" @click="salvar">
        Salvar
      </BaseButton>
    </template>
  </BaseGaveta>
</template>
