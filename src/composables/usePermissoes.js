import { podeAcessar } from '@/auth/keycloak'

/**
 * O que a pessoa logada pode FAZER dentro das telas que ela consegue abrir (botões de ação).
 * Só esconde: quem barra de verdade é o back (SecurityConfig). Se a matriz mudar lá, mude aqui.
 *
 * Uso, em qualquer componente:
 *   const { podeOperar } = usePermissoes()
 *   <BaseButton v-if="podeOperar" ...>
 */
const PERFIS_QUE_OPERAM = ['OPERADOR_DADOS', 'GESTOR']

export function usePermissoes() {
  return {
    // Criar, editar, excluir, processar, calcular, corrigir... (tudo que escreve dados).
    podeOperar: podeAcessar(PERFIS_QUE_OPERAM),
  }
}