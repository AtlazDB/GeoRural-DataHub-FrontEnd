<script setup>
import { ref, computed } from 'vue'
import BaseButton from '@/components/BaseButton.vue'
import AppIcon from '@/components/AppIcon.vue'
import { formatarTamanho } from '@/utils/formato'

/**
 * ==================================================================
 * TODO 5 e TODO 6 — Upload com barra de progresso
 * ==================================================================
 * A barra já existe no template e lê a variável `progresso` (0 a 100).
 * O que falta é: (5) guardar o arquivo escolhido e (6) disparar o
 * envio avisando o pai.
 *
 * Assim como o formulário, este componente não chama o service
 * direto — ele emite 'enviar' e a ImportacaoView faz a chamada.
 */

const props = defineProps({
  fonte: { type: Object, default: null },
  enviando: { type: Boolean, default: false },
  progresso: { type: Number, default: 0 },
})

const emit = defineEmits(['enviar'])

const arquivo = ref(null)
const arrastando = ref(false)
const inputRef = ref(null)

const podeEnviar = computed(() => !!arquivo.value && !!props.fonte && !props.enviando)

function aoEscolher(evento) {
  arquivo.value = evento.target.files[0] ?? null
}

function aoSoltar(evento) {
  arrastando.value = false
  const arquivos = evento.dataTransfer?.files
  if (arquivos?.length) {
    // Reaproveita a mesma lógica do input, simulando o formato do evento
    aoEscolher({ target: { files: arquivos } })
  }
}

function enviar() {
  if (!podeEnviar.value) return
  emit('enviar', arquivo.value)
}

function limpar() {
  arquivo.value = null
  if (inputRef.value) inputRef.value.value = ''
}

defineExpose({ limpar })
</script>

<template>
  <div v-if="!fonte" class="rounded-xl border border-dashed border-slate-700 p-10 text-center">
    <AppIcon nome="camadas" traco="1.6" class="mx-auto h-7 w-7 text-slate-600" />
    <p class="mt-2 text-sm text-slate-400">Selecione uma fonte na lista ao lado</p>
    <p class="mt-1 text-xs text-slate-600">para enviar um arquivo para ela.</p>
  </div>

  <div v-else class="space-y-4">
    <div class="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs">
      <span class="text-slate-500">Enviando para</span>
      <span class="font-mono text-cyan-400">{{ fonte.sigla }}</span>
      <span class="text-slate-500 truncate">· {{ fonte.nome }}</span>
    </div>

    <!-- Área de arrastar e soltar -->
    <div
      :class="[
        'cursor-pointer rounded-xl border-[1.5px] border-dashed px-4 py-10 text-center transition',
        arrastando
          ? 'border-cyan-400 bg-cyan-400/[0.06]'
          : 'border-slate-500/50 bg-slate-950/30 hover:border-slate-400/70',
      ]"
      @click="inputRef?.click()"
      @dragover.prevent="arrastando = true"
      @dragleave.prevent="arrastando = false"
      @drop.prevent="aoSoltar"
    >
      <input
        ref="inputRef"
        type="file"
        class="hidden"
        accept=".csv,.zip,.geojson,.json,.shp,.xlsx,.txt"
        @change="aoEscolher"
      />

      <template v-if="arquivo">
        <AppIcon nome="arquivo" traco="1.8" class="mx-auto h-7 w-7 text-cyan-400" />
        <p class="mt-2 truncate text-sm font-medium text-slate-100">{{ arquivo.name }}</p>
        <p class="mt-0.5 font-mono text-[11px] text-slate-500">
          {{ formatarTamanho(arquivo.size) }}
        </p>
      </template>
      <template v-else>
        <AppIcon nome="upload" traco="1.8" class="mx-auto h-7 w-7 text-slate-500" />
        <p class="mt-2 text-sm font-medium text-slate-300">
          Arraste o arquivo ou clique para selecionar
        </p>
        <p class="mt-1 text-[11px] text-slate-500">
           ZIP, GeoJSON, CSV &middot; at&eacute; 500 MB
        </p>
      </template>
    </div>

    <!-- Barra de progresso: aparece durante o envio -->
    <div v-if="enviando || progresso > 0" class="space-y-1.5">
      <div class="flex items-center justify-between text-xs">
        <span class="text-slate-400">
          {{ progresso >= 100 ? 'Processando no servidor…' : 'Enviando…' }}
        </span>
        <span class="font-mono text-cyan-400">{{ progresso }}%</span>
      </div>
      <div class="h-2 rounded-full bg-slate-800 overflow-hidden">
        <div
          class="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-[width] duration-150"
          :style="{ width: progresso + '%' }"
        />
      </div>
    </div>

    <div class="flex items-center gap-2">
      <BaseButton class="flex-1" :disabled="!podeEnviar" :carregando="enviando" @click="enviar">
        <AppIcon v-if="!enviando" nome="upload" traco="2.2" class="h-4 w-4" />
        Iniciar importação
      </BaseButton>
      <BaseButton v-if="arquivo && !enviando" variante="fantasma" @click="limpar">
        Trocar arquivo
      </BaseButton>
    </div>
  </div>
</template>
