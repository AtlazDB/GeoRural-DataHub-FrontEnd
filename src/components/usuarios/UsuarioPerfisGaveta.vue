<script setup>
import { computed, ref, watch } from 'vue'
import BaseGaveta from '@/components/BaseGaveta.vue'
import BaseButton from '@/components/BaseButton.vue'
import { salvarPerfis } from '@/services/usuariosService'
import { usuarioLogado } from '@/auth/keycloak'

/**
 * Gaveta de edição dos perfis de um usuário (T28.4).
 *
 * Abre quando recebe um `usuario`; fecha quando ele volta a ser null.
 * Emite 'fechar' e 'salvo' (com o usuário já atualizado, como o back devolve).
 * Só esconde/trava: quem barra de verdade é o back (SecurityConfig e UsuarioService).
 */
const props = defineProps({
  usuario: { type: Object, default: null },
})
const emit = defineEmits(['fechar', 'salvo'])

// Mesma lista do back (UsuarioServiceImpl.PERFIS_DO_SISTEMA). Se a matriz de permissões mudar,
// atualize também as descrições.
const PERFIS = [
  { codigo: 'OPERADOR_DADOS', rotulo: 'Operador de dados', descricao: 'Importa e processa dados: fontes, arquivos, mapeamentos, quarentena e indicadores.' },
  { codigo: 'ANALISTA', rotulo: 'Analista', descricao: 'Consulta o mapa, os imóveis e os indicadores, sem alterar dados.' },
  { codigo: 'AUDITOR', rotulo: 'Auditor', descricao: 'Acompanha fontes, quarentena e rastreabilidade, sem alterar dados.' },
  { codigo: 'GESTOR', rotulo: 'Gestor', descricao: 'Acesso total, inclusive a gestão de usuários.' },
]

const marcados = ref([])
const salvando = ref(false)
const erro = ref('')

// Cada vez que outro usuário é aberto, os checkboxes voltam ao estado dele.
watch(
  () => props.usuario,
  (u) => {
    marcados.value = u ? [...u.perfis] : []
    erro.value = ''
    salvando.value = false
  },
  { immediate: true },
)

// É a própria pessoa logada? (compara o nome de usuário do token com o da linha)
const eVoce = computed(
  () => !!props.usuario && usuarioLogado()?.usuario === props.usuario.username,
)

const mudou = computed(() => {
  const antes = [...(props.usuario?.perfis ?? [])].sort().join()
  const agora = [...marcados.value].sort().join()
  return antes !== agora
})

async function salvar() {
  salvando.value = true
  erro.value = ''
  try {
    const atualizado = await salvarPerfis(props.usuario.id, marcados.value)
    emit('salvo', atualizado)
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
        A mudança vale no próximo login dela (ou em até 15 minutos, se ela estiver conectada).
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
      <BaseButton :carregando="salvando" :disabled="!mudou" @click="salvar">Salvar perfis</BaseButton>
    </template>
  </BaseGaveta>
</template>