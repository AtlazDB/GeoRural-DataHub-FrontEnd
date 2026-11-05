<script setup>
import { computed, onMounted, ref } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import BaseButton from '@/components/BaseButton.vue'
import BaseCard from '@/components/BaseCard.vue'
import BaseModal from '@/components/BaseModal.vue'
import { desativarIndicador, listarIndicadores } from '@/services/indicadoresCadastrosService'
import { formatarDataHora } from '@/utils/formato'

// Nome de cada modelo de cálculo na tela (o back manda a sigla em inglês).
const MODELOS = {
  POINT_DENSITY: 'Densidade de pontos',
  AREA_COVERAGE: 'Cobertura de área',
}

const indicadores = ref([])
const carregando = ref(true)
const erro = ref('')

// Aviso depois de desativar: { tipo: 'sucesso' | 'erro', texto }
const aviso = ref(null)

// Indicador esperando a confirmação no modal (null = modal fechado).
const paraDesativar = ref(null)
const desativando = ref(false)

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

onMounted(carregar)
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
              <td class="py-3 pr-4 text-slate-400">#{{ ind.fonteId }}</td>
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
                <BaseButton
                  v-if="ind.active"
                  variante="fantasma"
                  tamanho="sm"
                  @click="paraDesativar = ind"
                >
                  Desativar
                </BaseButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </BaseCard>

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
