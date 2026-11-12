<script setup>
import BaseButton from '@/components/BaseButton.vue'
import AppIcon from '@/components/AppIcon.vue'
import { usePermissoes } from '@/composables/usePermissoes'

/**
 * Colunas já mapeadas: de onde vem, para onde vai e quais regras valem.
 *
 * Componente de APRESENTAÇÃO: não chama a API. Os botões só emitem
 * 'editar' e 'remover'; quem abre o formulário, confirma e exclui é o MapeamentoPainel.
 */
defineProps({
  mapeamentos: { type: Array, required: true },
  /** ids com remoção em andamento (o botão fica em "carregando") */
  removendo: { type: Array, default: () => [] },
  /** id do mapeamento aberto no formulário (a linha fica destacada) */
  editandoId: { type: Number, default: null },
})

defineEmits(['editar', 'remover'])

const { podeOperar } = usePermissoes()

/** As regras ligadas, em etiquetas curtas. */
function regrasDe(m) {
  const regras = []
  if (m.chave) regras.push('Chave')
  else if (m.obrigatorio) regras.push('Obrigatório')
  if (m.bloquearRegressao) regras.push('Bloq. regressão')
  if (m.validarCpfCnpj) regras.push('CPF/CNPJ')
  if (m.dominioCodigo) regras.push(`Domínio ${m.dominioCodigo}`)
  if (m.referenciaCruzada) regras.push(`Existe em ${m.referenciaCruzada}`)
  if (m.politicaGeometria) regras.push(m.politicaGeometria === 'QUARENTENA' ? 'Quarentena' : 'Corrigir e registrar')
  if (m.recortarPr) regras.push('Dentro do PR')
  return regras
}
</script>

<template>
  <div
    v-if="!mapeamentos.length"
    class="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400"
  >
    Nenhuma coluna mapeada ainda.
  </div>

  <ul v-else class="divide-y divide-slate-800/80">
    <li
      v-for="m in mapeamentos"
      :key="m.id"
      :class="[
        'flex items-center gap-3 py-2.5 first:pt-0 last:pb-0',
        editandoId === m.id && '-mx-2 rounded-lg bg-cyan-500/5 px-2',
      ]"
    >
      <div class="min-w-0 flex-1">
        <p class="font-mono text-sm text-slate-100">
          {{ m.colunaNome }}
          <span class="text-slate-600">→</span>
          <span class="text-cyan-300">{{ m.destinoTabela }}.{{ m.campoDestino }}</span>
          <span class="ml-1 text-[10px] uppercase text-slate-600">{{ m.tipoDado }}</span>
        </p>
        <div v-if="regrasDe(m).length" class="mt-1 flex flex-wrap gap-1.5">
          <span
            v-for="regra in regrasDe(m)"
            :key="regra"
            class="rounded-full border border-slate-700 bg-slate-800/40 px-2 py-0.5 text-[10px] text-slate-300"
          >
            {{ regra }}
          </span>
        </div>
      </div>

      <BaseButton
        v-if="podeOperar"
        variante="fantasma"
        tamanho="sm"
        class="shrink-0"
        :disabled="editandoId === m.id"
        @click="$emit('editar', m)"
      >
        <AppIcon nome="lapis" class="h-3 w-3" />
        Editar
      </BaseButton>
      <BaseButton
        v-if="podeOperar"
        variante="fantasma"
        tamanho="sm"
        class="shrink-0 text-rose-300 hover:text-rose-200"
        :carregando="removendo.includes(m.id)"
        @click="$emit('remover', m)"
      >
        <AppIcon v-if="!removendo.includes(m.id)" nome="lixeira" traco="2" class="h-3 w-3" />
        Remover
      </BaseButton>
    </li>
  </ul>
</template>