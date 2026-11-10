
<template>
  <div class="indicadores">
    <header class="cabecalho">
      <div>
        <h1>Indicadores Municipais</h1>
        <p>Indicadores ambientais agregados por município do Paraná.</p>
      </div>

      <button
        class="botao-exportar"
        @click="exportarCsv"
        :disabled="carregando"
      >
        Exportar CSV
      </button>
    </header>

    <section class="filtros">
      <label for="estado">Estado:</label>

      <select id="estado" v-model="estado" disabled>
        <option value="PR">Paraná</option>
      </select>

      <button @click="buscarIndicadores" :disabled="carregando">
        Consultar
      </button>
    </section>

    <p v-if="carregando" class="mensagem">
      Carregando indicadores...
    </p>

    <p v-else-if="erro" class="erro">
      {{ erro }}
    </p>

    <div v-else class="tabela-container">
      <table>
        <thead>
          <tr>
            <th>Município</th>
            <th>Estado</th>
            <th>Código IBGE</th>
            <th>Indicador</th>
            <th>Total de imóveis</th>
            <th>Área de Reserva Legal (ha)</th>
            <th>Área total (ha)</th>
            <th>Valor municipal</th>
            <th>Conformes</th>
            <th>Críticos</th>
          </tr>
        </thead>

        <tbody>
          <tr
            v-for="item in indicadores"
            :key="`${item.codIbge}-${item.indicador}`"
          >
            <td>{{ item.municipio }}</td>
            <td>{{ item.estado }}</td>
            <td>{{ item.codIbge }}</td>
            <td>{{ item.indicador }}</td>
            <td>{{ item.totalImoveis }}</td>
            <td>{{ item.areaReservaLegalHa }}</td>
            <td>{{ item.areaTotalImoveisHa }}</td>
            <td>{{ item.valorMunicipal }}</td>
            <td>{{ item.totalConformes }}</td>
            <td>{{ item.totalCriticos }}</td>
          </tr>

          <tr v-if="indicadores.length === 0">
            <td colspan="10" class="vazio">
              Nenhum indicador municipal encontrado para o Paraná.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import http from '@/services/http'

const indicadores = ref([])
const estado = ref('PR')
const carregando = ref(false)
const erro = ref('')

async function buscarIndicadores() {
  carregando.value = true
  erro.value = ''

  try {
    const response = await http.get('/indicadores/municipais', {
      params: {
        estado: estado.value,
      },
    })

    indicadores.value = response.data
  } catch (error) {
    console.error('Erro ao consultar indicadores:', error)
    erro.value =
      error.message || 'Não foi possível carregar os indicadores municipais.'
  } finally {
    carregando.value = false
  }
}

async function exportarCsv() {
  erro.value = ''

  try {
    const response = await http.get('/indicadores/municipais/exportar', {
      params: {
        estado: estado.value,
      },
      responseType: 'blob',
    })

    const url = URL.createObjectURL(response.data)
    const link = document.createElement('a')

    link.href = url
    link.download = 'indicadores-municipais-parana.csv'

    document.body.appendChild(link)
    link.click()
    link.remove()

    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Erro ao exportar CSV:', error)
    erro.value = error.message || 'Não foi possível exportar os indicadores.'
  }
}

onMounted(buscarIndicadores)
</script>

<style scoped>
.indicadores {
  padding: 24px;
}

.cabecalho {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}

h1 {
  margin: 0 0 8px;
}

.cabecalho p {
  color: #888;
  margin: 0;
}

.filtros {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}

select,
button {
  padding: 10px 14px;
  border-radius: 6px;
  cursor: pointer;
}

select:disabled {
  cursor: not-allowed;
  opacity: 0.8;
}

.botao-exportar {
  background: #16794b;
  color: white;
  border: none;
}

.botao-exportar:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.tabela-container {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  color: #20252b;
}

th,
td {
  padding: 12px;
  border-bottom: 1px solid #ddd;
  text-align: left;
  white-space: nowrap;
  color: #20252b;
}

th {
  background: #f2f4f5;
  color: #20252b;
  font-weight: 600;
}

.vazio,
.mensagem {
  text-align: center;
  padding: 24px;
  color: #888;
}

.erro {
  color: #c62828;
}
</style>
