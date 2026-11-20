/**
 * Senha provisória aleatória (12 caracteres, sem os que confundem: 0/O, 1/l/I).
 * Usada no cadastro de usuário e na redefinição de senha: a pessoa troca no primeiro login.
 */
export function gerarSenhaProvisoria() {
  const letras = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const sorteio = crypto.getRandomValues(new Uint32Array(12))
  return Array.from(sorteio, (n) => letras[n % letras.length]).join('')
}
