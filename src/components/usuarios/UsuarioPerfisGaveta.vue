<script setup>
import { computed, ref, watch } from 'vue'
import BaseGaveta from '@/components/BaseGaveta.vue'
import BaseButton from '@/components/BaseButton.vue'
import SeletorCidades from '@/components/usuarios/SeletorCidades.vue'
import { PERFIS, restritoPorRegiao } from '@/components/usuarios/perfis'
import {
  buscarMunicipiosDoUsuario,
  buscarUsuario,
  salvarMunicipiosDoUsuario,
  salvarPerfis,
} from '@/services/usuariosService'
import { usuarioLogado } from '@/auth/keycloak'

/**
 * Gaveta de edição dos perfis e das cidades de um usuário (T28.4 e US14).
 *
 * Abre quando recebe um `usuario`; fecha quando ele volta a ser null.
 * Emite 'fechar' e 'salvo' (com o usuário já atualizado, como o back devolve).
 * Só esconde/trava: quem barra de verdade é o back (SecurityConfig e UsuarioService).
 */
const props = defineProps({
  usuario: { type: Object, default: null },
})
const emit = defineEmits(['fechar', 'salvo'])

const marcados = ref([])
const todas = ref(true)
const cidades = ref([])
const cidadesAntes = ref({ todas: true, cidades: [] })
const carregandoCidades = ref(false)
const salvando = ref(false)
const erro = ref('')

// Cada vez que outro usuário é aberto, o formulário volta ao estado dele.
watch(
  () => props.usuario,
  async (u) => {
    marcados.value = u ? [...u.perfis] : []
    erro.value = ''
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

const mostraCidades = computed(() => marcados.value.includes('ANALISTA'))

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
          v-for="p in PERFIS"
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
        <p v-if="!restritoPorRegiao(marcados)" class="mt-3 text-xs text-slate-500">
          Com outro perfil além de Analista, a pessoa vê todas as cidades; esta lista só vale se ela ficar só como Analista.
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
