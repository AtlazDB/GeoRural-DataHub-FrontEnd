import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { iniciarAuth } from './auth/keycloak'
import 'leaflet/dist/leaflet.css'
import './assets/main.css'

// O app só monta depois do login: sem isso, as telas disparariam chamadas sem token.
iniciarAuth()
  .then(() => {
    createApp(App).use(router).mount('#app')
  })
  .catch((erro) => {
    console.error('Falha ao iniciar o login:', erro)
    document.getElementById('app').textContent =
      'Não foi possível conectar ao serviço de login (Keycloak). Verifique se ele está rodando.'
  })