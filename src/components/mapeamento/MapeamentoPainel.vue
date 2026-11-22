<script setup>
import { computed, ref, watch } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import { useConfirmacao } from '@/composables/useConfirmacao'
import ColunasDetectadas from '@/components/mapeamento/ColunasDetectadas.vue'
import MapeamentosTabela from '@/components/mapeamento/MapeamentosTabela.vue'
import RegraForm from '@/components/mapeamento/RegraForm.vue'
import {
  listarColunas,
  listarMapeamentos,
  listarDominios,
  listarReferenciasCruzadas,
  listarDestinos,
  criarMapeamento,
  atualizarMapeamento,
  excluirMapeamento,
} from '@/services/mapeamentosService'

/**
 * Mapeamento de colunas de uma fonte: as colunas que chegaram, o formulário de
 * regras e as colunas já mapeadas.
 *
 * Como o ModalMapeamento era, este painel é o "cérebro" do mapeamento: ele
 * carrega os dados e distribui por props para os filhos de apresentação. Fica
 * na aba "Mapeamento" da página da fonte (ImportacaoView) e dentro do
 * ModalMapeamento.
 *
 * Emite 'alterado' sempre que um mapeamento é criado ou removido, para a tela
 * de fora atualizar o aviso de "colunas novas".
 */
const props = defineProps({
  /** a fonte inteira (precisa de id, sigla e nome) */
  fonte: { type: Object, default: null },
  /** false enquanto o painel estiver escondido: só carrega quando aparece */
  ativo: { type: Boolean, default: true },
})

const emit = defineEmits(['alterado'])

// --- Colunas detectadas e mapeamentos -----------------------------
const colunas = ref([])
const mapeamentos = ref([])
const carregando = ref(false)
const erro = ref('')

// --- Formulário de regras -----------------------------------------
const emEdicao = ref(null) // a coluna que está sendo mapeada, ou null
const regraEmEdicao = ref(null) // o mapeamento aberto para editar, ou null (mapeamento novo)
const salvando = ref(false)
const erroForm = ref('')
const sucesso = ref('')
const removendo = ref([]) // ids de mapeamentos sendo removidos
const dominios = ref([])
const referencias = ref([])
const destinos = ref([])
let apoioCarregado = false

// Uma fonte grava numa tabela só: a mais usada nos mapeamentos já feitos vira a sugestão.
const tabelaSugerida = computed(() => {
  const contagem = {}
  for (const m of mapeamentos.value) contagem[m.destinoTabela] = (contagem[m.destinoTabela] ?? 0) + 1
  return Object.entries(contagem).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
})
const camposUsados = computed(() => mapeamentos.value.map((m) => `${m.destinoTabela}.${m.campoDestino}`))

async function carregar() {
  if (!props.fonte) return
  carregando.value = true
  erro.value = ''
  try {
    // As duas listas andam juntas: remover um mapeamento muda as duas.
    const [c, m] = await Promise.all([listarColunas(props.fonte.id), listarMapeamentos(props.fonte.id)])
    colunas.value = c
    mapeamentos.value = m
  } catch (e) {
    colunas.value = []
    mapeamentos.value = []
    erro.value = e.message
  } finally {
    carregando.value = false
  }
}

// Domínios, referências e destinos mudam raramente: busca uma vez por abertura da tela.
async function carregarApoio() {
  if (apoioCarregado) return
  try {
    const [d, r, t] = await Promise.all([listarDominios(), listarReferenciasCruzadas(), listarDestinos()])
    dominios.value = d
    referencias.value = r
    destinos.value = t
    apoioCarregado = true
  } catch (e) {
    erroForm.value = `Não deu para carregar domínios, referências e destinos: ${e.message}`
  }
}

async function iniciarMapeamento(coluna) {
  sucesso.value = ''
  erroForm.value = ''
  regraEmEdicao.value = null
  emEdicao.value = coluna
  await carregarApoio()
}

/** Abre o formulário preenchido com um mapeamento já feito. */
async function editarMapeamento(mapeamento) {
  sucesso.value = ''
  erroForm.value = ''
  regraEmEdicao.value = mapeamento
  emEdicao.value = colunas.value.find((c) => c.id === mapeamento.colunaId) ?? {
    id: mapeamento.colunaId,
    nome: mapeamento.colunaNome,
  }
  await carregarApoio()
}

function cancelarMapeamento() {
  emEdicao.value = null
  regraEmEdicao.value = null
  erroForm.value = ''
}

async function salvar(corpo) {
  salvando.value = true
  erroForm.value = ''
  try {
    if (regraEmEdicao.value) {
      await atualizarMapeamento(props.fonte.id, regraEmEdicao.value.id, corpo)
      sucesso.value = `Mapeamento de "${emEdicao.value.nome}" atualizado. Vale a partir do próximo processamento.`
    } else {
      await criarMapeamento(props.fonte.id, corpo)
      sucesso.value = `Coluna "${emEdicao.value.nome}" mapeada.`
    }
    emEdicao.value = null
    regraEmEdicao.value = null
    await carregar() // a coluna passa de "nova" para "mapeada"
    emit('alterado')
  } catch (e) {
    // 400 e 409 chegam com a mensagem pronta do back
    erroForm.value = e.message
  } finally {
    salvando.value = false
  }
}

const { confirmar } = useConfirmacao()

/** Remove um mapeamento: a coluna volta a ser "nova". */
async function remover(mapeamento) {
  const confirmado = await confirmar({
    titulo: 'Remover o mapeamento?',
    destaque: mapeamento.colunaNome,
    mensagem: 'A coluna volta a ficar sem destino e sem regras.',
    confirmar: 'Remover',
    tom: 'perigo',
    icone: 'lixeira',
  })
  if (!confirmado || removendo.value.includes(mapeamento.id)) return

  removendo.value.push(mapeamento.id)
  erroForm.value = ''
  sucesso.value = ''
  try {
    await excluirMapeamento(props.fonte.id, mapeamento.id)
    if (regraEmEdicao.value?.id === mapeamento.id) cancelarMapeamento()
    sucesso.value = `Mapeamento de "${mapeamento.colunaNome}" removido.`
    await carregar()
    emit('alterado')
  } catch (e) {
    erro.value = e.message
  } finally {
    removendo.value = removendo.value.filter((x) => x !== mapeamento.id)
  }
}

// Recarrega toda vez que aparece (ou troca de fonte aparecendo), para nunca
// mostrar dados de outra fonte. Esconder zera o formulário.
watch(
  () => [props.ativo, props.fonte?.id],
  ([ativo]) => {
    emEdicao.value = null
    regraEmEdicao.value = null
    erroForm.value = ''
    sucesso.value = ''
    if (ativo) carregar()
  },
  { immediate: true },
)
</script>

<template>
  <div>
    <div
      v-if="sucesso"
      class="mb-4 flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10
             px-4 py-2.5 text-sm text-emerald-300"
    >
      <AppIcon nome="check" class="h-4 w-4 shrink-0" />
      {{ sucesso }}
    </div>

    <h3 class="mb-3 text-sm font-semibold text-white">Colunas detectadas</h3>
    <ColunasDetectadas
      :colunas="colunas"
      :carregando="carregando"
      :erro="erro"
      :selecionada-id="emEdicao?.id ?? null"
      @selecionar="iniciarMapeamento"
      @tentar-novamente="carregar"
    />

    <section v-if="emEdicao" class="mt-5 border-t border-slate-800 pt-5">
      <h3 class="mb-3 text-sm font-semibold text-white">
        {{ regraEmEdicao ? 'Editar mapeamento de' : 'Mapear' }}
        <span class="font-mono text-cyan-300">{{ emEdicao.nome }}</span>
      </h3>
      <RegraForm
        :coluna="emEdicao"
        :regra="regraEmEdicao"
        :destinos="destinos"
        :tabela-sugerida="tabelaSugerida"
        :campos-usados="camposUsados"
        :dominios="dominios"
        :referencias="referencias"
        :salvando="salvando"
        :erro="erroForm"
        @salvar="salvar"
        @cancelar="cancelarMapeamento"
      />
    </section>

    <section v-if="!erro && !carregando" class="mt-5 border-t border-slate-800 pt-5">
      <h3 class="mb-3 text-sm font-semibold text-white">
        Colunas mapeadas
        <span class="ml-1 font-mono text-[11px] font-normal text-slate-500">
          {{ mapeamentos.length }}
        </span>
      </h3>
      <MapeamentosTabela
        :mapeamentos="mapeamentos"
        :removendo="removendo"
        :editando-id="regraEmEdicao?.id ?? null"
        @editar="editarMapeamento"
        @remover="remover"
      />
      <p class="mt-3 text-[11.5px] text-slate-500">
        Colunas sem mapeamento não se perdem: ficam guardadas como atributos de cada registro na
        quarentena e na zona bruta.
      </p>
    </section>
  </div>
</template>
