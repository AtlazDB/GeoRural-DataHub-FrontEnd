<script setup>
import { computed, onMounted, ref } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import BaseButton from '@/components/BaseButton.vue'
import BaseCard from '@/components/BaseCard.vue'
import BaseModal from '@/components/BaseModal.vue'
import IndicadorForm from '@/components/indicadores/IndicadorForm.vue'
import { usePermissoes } from '@/composables/usePermissoes'
import { listarFontes } from '@/services/fontesService'
import {
  buscarPorMunicipio,
  cadastrarIndicador,
  calcularIndicador,
  desativarIndicador,
  listarIndicadores,
} from '@/services/indicadoresCadastrosService'
import { formatarDataHora, formatarNumero } from '@/utils/formato'

// Nome de cada modelo de cálculo na tela (o back manda a sigla em inglês).
const MODELOS = {
  POINT_DENSITY: 'Densidade de pontos',
  AREA_COVERAGE: 'Cobertura de área',
  BASE_COVERAGE: 'Cobertura dentro de uma camada',
}

const { podeOperar } = usePermissoes()

const indicadores = ref([])
const carregando = ref(true)
const erro = ref('')

// Aviso depois de desativar: { tipo: 'sucesso' | 'erro', texto }
const aviso = ref(null)

// Indicador esperando a confirmação no modal (null = modal fechado).
const paraDesativar = ref(null)
const desativando = ref(false)

// Cadastro: fontes para o formulário e para mostrar o nome da fonte na lista.
const fontes = ref([])
const cadastroAberto = ref(false)
const salvando = ref(false)
const erroCadastro = ref(null) // { mensagem, campos }

const nomeDaFonte = computed(() => Object.fromEntries(fontes.value.map((f) => [f.id, f.sigla])))

async function carregarFontes() {
  try {
    fontes.value = await listarFontes()
  } catch {
    // Sem as fontes, a lista mostra só o número e o formulário avisa ao abrir.
  }
}

function abrirCadastro() {
  erroCadastro.value = null
  cadastroAberto.value = true
}

async function salvarIndicador(corpo) {
  salvando.value = true
  erroCadastro.value = null
  try {
    const novo = await cadastrarIndicador(corpo)
    indicadores.value.push(novo)
    cadastroAberto.value = false
    aviso.value = { tipo: 'sucesso', texto: `O indicador ${novo.code} foi cadastrado.` }
  } catch (e) {
    const resposta = e.original?.response
    // 409 = sigla repetida: o back não manda `campos`, então a sigla é marcada aqui.
    const campos = resposta?.status === 409 ? ['code'] : (resposta?.data?.campos ?? [])
    erroCadastro.value = { mensagem: e.message, campos }
  } finally {
    salvando.value = false
  }
}

// Ativos primeiro; dentro de cada grupo, pela sigla.
const ordenados = computed(() =>
  [...indicadores.value].sort(
    (a, b) => Number(b.active) - Number(a.active) || a.code.localeCompare(b.code),
  ),
)

async function carregar() {
  carregando.value = true
  erro.value = ''
  try {
    indicadores.value = await listarIndicadores()
  } catch (e) {
    erro.value = e.message
  } finally {
    carregando.value = false
  }
}

// Sigla do indicador cujo cálculo está sendo disparado (só enquanto o back responde).
const calculandoCode = ref(null)

// O back só dispara a DAG no Airflow e responde 202: o cálculo em si leva minutos.
async function calcular(indicador) {
  calculandoCode.value = indicador.code
  try {
    await calcularIndicador(indicador.code)
    aviso.value = {
      tipo: 'sucesso',
      texto: `O cálculo de ${indicador.code} começou no Airflow e leva alguns minutos. Depois, os resultados aparecem no card do imóvel, em Consulta.`,
    }
  } catch (e) {
    aviso.value = { tipo: 'erro', texto: e.message }
  } finally {
    calculandoCode.value = null
  }
}

// Agregação por município (D4): o indicador aberto no modal e as linhas que o back devolveu.
const porMunicipio = ref(null) // { indicador, linhas, carregando, erro, filtro }

const linhasMunicipio = computed(() => {
  const p = porMunicipio.value
  if (!p?.linhas) return []
  const filtro = p.filtro.trim().toLowerCase()
  return filtro ? p.linhas.filter((l) => (l.name ?? 'sem município').toLowerCase().includes(filtro)) : p.linhas
})

async function abrirPorMunicipio(indicador) {
  porMunicipio.value = { indicador, linhas: null, carregando: true, erro: '', filtro: '' }
  try {
    porMunicipio.value.linhas = await buscarPorMunicipio(indicador.code)
  } catch (e) {
    porMunicipio.value.erro = e.message
  } finally {
    porMunicipio.value.carregando = false
  }
}

async function confirmarDesativacao() {
  const indicador = paraDesativar.value
  desativando.value = true
  try {
    await desativarIndicador(indicador.code)
    // O back responde 204 sem corpo: marca aqui em vez de recarregar a lista toda.
    indicador.active = false
    aviso.value = { tipo: 'sucesso', texto: `O indicador ${indicador.code} foi desativado.` }
  } catch (e) {
    aviso.value = { tipo: 'erro', texto: e.message }
  } finally {
    desativando.value = false
    paraDesativar.value = null
  }
}

onMounted(() => {
  carregar()
  carregarFontes()
})
</script>

<template>
  <div class="space-y-5">
    <div
      v-if="aviso"
      :class="[
        'flex items-start justify-between gap-3 rounded-xl border px-4 py-2.5 text-sm',
        aviso.tipo === 'erro'
          ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
          : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
      ]"
    >
      <span>{{ aviso.texto }}</span>
      <button class="text-xs underline underline-offset-2" @click="aviso = null">Fechar</button>
    </div>

    <BaseCard
      titulo="Indicadores cadastrados"
      icone="tabela"
      destaque
      :contagem="carregando || erro ? '' : String(indicadores.length)"
      descricao="Indicadores montados a partir de uma fonte de dados, um modelo de cálculo pronto e faixas de status. O IRL e o IFC, que são fixos, continuam no card do imóvel."
    >
      <template #acoes>
        <BaseButton v-if="podeOperar" tamanho="sm" @click="abrirCadastro">+ Novo indicador</BaseButton>
      </template>

      <!-- Carregando -->
      <div v-if="carregando" class="space-y-2">
        <div v-for="n in 4" :key="n" class="h-12 animate-pulse rounded-xl bg-slate-800/30" />
      </div>

      <!-- Erro -->
      <div v-else-if="erro" class="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm">
        <p class="font-medium text-red-300">Não deu para carregar os indicadores</p>
        <p class="mt-1 text-red-300/70">{{ erro }}</p>
        <button
          class="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-red-200 underline underline-offset-2"
          @click="carregar"
        >
          <AppIcon nome="atualizar" traco="2.4" class="h-3.5 w-3.5" />
          Tentar de novo
        </button>
      </div>

      <!-- Vazio -->
      <div v-else-if="!indicadores.length" class="rounded-xl border border-dashed border-slate-700 p-8 text-center">
        <p class="text-sm text-slate-400">Nenhum indicador cadastrado ainda.</p>
      </div>

      <!-- Lista -->
      <div v-else class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="text-[11px] uppercase tracking-wide text-slate-500">
            <tr class="border-b border-slate-800">
              <th class="py-2 pr-4 font-semibold">Sigla</th>
              <th class="py-2 pr-4 font-semibold">Nome</th>
              <th class="py-2 pr-4 font-semibold">Modelo</th>
              <th class="py-2 pr-4 font-semibold">Unidade</th>
              <th class="py-2 pr-4 font-semibold">Fonte</th>
              <th class="py-2 pr-4 font-semibold">Cadastrado em</th>
              <th class="py-2 pr-4 font-semibold">Situação</th>
              <th class="py-2"><span class="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="ind in ordenados"
              :key="ind.code"
              :class="['border-b border-slate-800/60', !ind.active && 'opacity-60']"
            >
              <td class="py-3 pr-4 font-mono font-semibold text-cyan-300">{{ ind.code }}</td>
              <td class="py-3 pr-4 text-slate-100">
                {{ ind.name }}
                <p v-if="ind.description" class="text-xs text-slate-500">{{ ind.description }}</p>
              </td>
              <td class="py-3 pr-4 text-slate-300">{{ MODELOS[ind.calculationModel] ?? ind.calculationModel }}</td>
              <td class="py-3 pr-4 font-mono text-slate-300">{{ ind.unit }}</td>
              <td class="py-3 pr-4 font-mono text-slate-400">{{ nomeDaFonte[ind.fonteId] ?? `#${ind.fonteId}` }}</td>
              <td class="py-3 pr-4 text-slate-400 tabular-nums">{{ formatarDataHora(ind.createdAt) }}</td>
              <td class="py-3 pr-4">
                <span
                  :class="[
                    'inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                    ind.active
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                      : 'border-slate-500/40 bg-slate-500/10 text-slate-400',
                  ]"
                >
                  {{ ind.active ? 'Ativo' : 'Inativo' }}
                </span>
              </td>
              <td class="py-3 text-right">
                <div class="flex justify-end gap-2">
                  <!-- Todos os perfis veem (é leitura). Inativo também: os resultados já calculados continuam valendo. -->
                  <BaseButton variante="fantasma" tamanho="sm" @click="abrirPorMunicipio(ind)">
                    Por município
                  </BaseButton>
                  <!-- Calcular e desativar: só quem opera (T25), e só em indicador ativo. -->
                  <template v-if="ind.active && podeOperar">
                  <BaseButton
                    variante="secundario"
                    tamanho="sm"
                    :carregando="calculandoCode === ind.code"
                    :disabled="!!calculandoCode"
                    @click="calcular(ind)"
                  >
                    Calcular
                  </BaseButton>
                  <BaseButton variante="fantasma" tamanho="sm" @click="paraDesativar = ind">
                    Desativar
                  </BaseButton>
                  </template>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </BaseCard>

    <BaseModal
      :aberto="cadastroAberto"
      titulo="Novo indicador"
      descricao="Escolha a fonte, o modelo de cálculo e as faixas de status. Cadastrar não calcula: o cálculo é um passo à parte."
      largura="max-w-2xl"
      @fechar="cadastroAberto = false"
    >
      <p v-if="!fontes.length" class="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
        Não deu para carregar as fontes. Confira se o back está rodando e abra o formulário de novo.
      </p>
      <!-- v-if: o formulário recomeça vazio a cada abertura -->
      <IndicadorForm
        v-if="cadastroAberto"
        :fontes="fontes"
        :salvando="salvando"
        :erro="erroCadastro"
        @salvar="salvarIndicador"
        @cancelar="cadastroAberto = false"
      />
    </BaseModal>

    <BaseModal
      :aberto="!!porMunicipio"
      :titulo="porMunicipio ? `${porMunicipio.indicador.code} por município` : ''"
      descricao="O resultado mais recente de cada imóvel, agrupado pelo município dele. Média = média simples do valor dos imóveis; soma = soma do numerador (focos, hectares cobertos...)."
      largura="max-w-4xl"
      @fechar="porMunicipio = null"
    >
      <template v-if="porMunicipio">
        <div v-if="porMunicipio.carregando" class="space-y-2">
          <div v-for="n in 4" :key="n" class="h-9 animate-pulse rounded-lg bg-slate-800/30" />
        </div>
        <p v-else-if="porMunicipio.erro" class="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          {{ porMunicipio.erro }}
        </p>
        <p v-else-if="!porMunicipio.linhas.length" class="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">
          Este indicador ainda não foi calculado. Use "Calcular" e volte depois de alguns minutos.
        </p>
        <template v-else>
          <input
            v-model="porMunicipio.filtro"
            class="input mb-3"
            placeholder="Buscar município"
            aria-label="Buscar município"
          />
          <div class="max-h-[60vh] overflow-auto">
            <table class="w-full text-left text-sm">
              <thead class="sticky top-0 bg-slate-900 text-[11px] uppercase tracking-wide text-slate-500">
                <tr class="border-b border-slate-800">
                  <th class="py-2 pr-3 font-semibold">Município</th>
                  <th class="py-2 pr-3 text-right font-semibold">Imóveis</th>
                  <th class="py-2 pr-3 text-right font-semibold text-emerald-400/80">Conforme</th>
                  <th class="py-2 pr-3 text-right font-semibold text-amber-400/80">Alerta</th>
                  <th class="py-2 pr-3 text-right font-semibold text-rose-400/80">Crítico</th>
                  <th class="py-2 pr-3 text-right font-semibold">Validação</th>
                  <th class="py-2 pr-3 text-right font-semibold">Média ({{ porMunicipio.indicador.unit }})</th>
                  <th class="py-2 text-right font-semibold">Soma</th>
                </tr>
              </thead>
              <tbody class="tabular-nums">
                <tr v-for="l in linhasMunicipio" :key="l.codIbge ?? 'sem'" class="border-b border-slate-800/60">
                  <td class="py-2 pr-3 text-slate-100">
                    <template v-if="l.name">{{ l.name }} <span class="text-xs text-slate-500">{{ l.state }}</span></template>
                    <span v-else class="italic text-slate-500">Sem município</span>
                  </td>
                  <td class="py-2 pr-3 text-right text-slate-300">{{ formatarNumero(l.properties) }}</td>
                  <td class="py-2 pr-3 text-right text-emerald-300">{{ formatarNumero(l.conforme) }}</td>
                  <td class="py-2 pr-3 text-right text-amber-300">{{ formatarNumero(l.alerta) }}</td>
                  <td class="py-2 pr-3 text-right text-rose-300">{{ formatarNumero(l.critico) }}</td>
                  <td class="py-2 pr-3 text-right text-slate-400">{{ formatarNumero(l.validacao) }}</td>
                  <td class="py-2 pr-3 text-right text-slate-200">{{ formatarNumero(l.averageValue) }}</td>
                  <td class="py-2 text-right text-slate-400">{{ formatarNumero(l.numeratorSum) }}</td>
                </tr>
              </tbody>
            </table>
            <p v-if="!linhasMunicipio.length" class="py-4 text-center text-sm text-slate-500">Nenhum município com esse nome.</p>
          </div>
        </template>
      </template>
    </BaseModal>

    <BaseModal
      :aberto="!!paraDesativar"
      titulo="Desativar indicador"
      largura="max-w-md"
      @fechar="paraDesativar = null"
    >
      <p v-if="paraDesativar" class="text-sm text-slate-300">
        Desativar <span class="font-mono font-semibold text-cyan-300">{{ paraDesativar.code }}</span>
        ({{ paraDesativar.name }})?
      </p>
      <p class="mt-2 text-sm text-slate-400">
        Ele deixa de ser calculado, mas não é apagado: os resultados já calculados continuam
        aparecendo. Não dá para reativar, e a sigla não pode ser usada de novo.
      </p>

      <template #rodape>
        <BaseButton variante="fantasma" :disabled="desativando" @click="paraDesativar = null">
          Cancelar
        </BaseButton>
        <BaseButton :carregando="desativando" @click="confirmarDesativacao">Desativar</BaseButton>
      </template>
    </BaseModal>
  </div>
</template>