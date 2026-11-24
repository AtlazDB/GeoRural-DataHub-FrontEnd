/**
 * Traçados dos ícones em SVG, no mesmo desenho do protótipo: contorno de
 * 24×24, sem preenchimento. Cada entrada é a lista de comandos `d` dos
 * <path> que formam o ícone.
 *
 * Fica fora do AppIcon.vue porque `defineProps()` não enxerga variáveis
 * declaradas dentro do <script setup> — e o validador da prop precisa
 * consultar este mapa.
 */
export const icones = {
  sol: [
    'M12 8a4 4 0 1 0 0 8a4 4 0 0 0 0-8z',
    'M12 2v2', 'M12 20v2', 'M4.9 4.9l1.4 1.4', 'M17.7 17.7l1.4 1.4',
    'M2 12h2', 'M20 12h2', 'M4.9 19.1l1.4-1.4', 'M17.7 6.3l1.4-1.4',
  ],
  lua: ['M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z'],
  local: [
    'M12 21c-4.4-3.6-7-7.2-7-11a7 7 0 0 1 14 0c0 3.8-2.6 7.4-7 11z',
    'M14.6 10a2.6 2.6 0 1 1-5.2 0 2.6 2.6 0 0 1 5.2 0z',
  ],
  camadas: ['M12 3l9 4.5-9 4.5-9-4.5L12 3z', 'M3 12l9 4.5 9-4.5', 'M3 16.5l9 4.5 9-4.5'],
  mais: ['M12 5v14', 'M5 12h14'],
  upload: ['M12 16V4', 'M7 9l5-5 5 5', 'M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3'],
  arquivo: ['M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z', 'M14 3v5h5'],
  check: ['M5 13l4 4L19 7'],
  alerta: [
    'M10.3 4.3 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z',
    'M12 9v4',
    'M12 17h.01',
  ],
  atualizar: ['M21 12a9 9 0 1 1-3-6.7', 'M21 4v6h-6'],
  executar: ['M7 5v14l11-7L7 5z'],
  parar: ['M6 6h12v12H6z'],
  lixeira: ['M4 7h16', 'M10 11v6', 'M14 11v6', 'M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12', 'M9 7V4h6v3'],
  mapa: ['M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z', 'M9 4v14', 'M15 6v14'],
  tabela: ['M4 4h16v16H4z', 'M4 10h16', 'M4 15h16', 'M10 10v10'],
  // Dashboard: quatro blocos de tamanhos diferentes, como um painel de cartões.
  painel: ['M4 4h7v9H4z', 'M13 4h7v5h-7z', 'M13 11h7v9h-7z', 'M4 15h7v5H4z'],
  // Usuários e perfis: duas pessoas (cabeça e ombros).
  usuarios: [
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1',
    'M16 3.1a4 4 0 0 1 0 7.8',
    'M18 14a6 6 0 0 1 4 6v1',
  ],
  rastro: [
    'M8.5 6a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z',
    'M8.5 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z',
    'M20.5 12a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z',
    'M6 8.5v7',
    'M8.3 7.2l7.4 3.6',
    'M8.3 16.8l7.4-3.6',
  ],
  seta: ['M5 12h14', 'M13 6l6 6-6 6'],
  voltar: ['M19 12H5', 'M11 6l-6 6 6 6'],
  lapis: ['M4 20h4L19 9l-4-4L4 16v4z', 'M13.5 6.5l4 4'],
  escudo: ['M12 3l8 4v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V7l8-4z', 'M12 8v5', 'M12 16h.01'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  fechar: ['M6 6l12 12', 'M18 6 6 18'],
}
