const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const LOWER = 'abcdefghijklmnopqrstuvwxyz'
const DIGITS = '0123456789'
const SPECIAL = '!@#$%&*'
const ALL = UPPER + LOWER + DIGITS + SPECIAL

function randomChar(chars: string): string {
  return chars[Math.floor(Math.random() * chars.length)]
}

export function generateRandomPassword(length = 12): string {
  const required = [randomChar(UPPER), randomChar(LOWER), randomChar(DIGITS), randomChar(SPECIAL)]
  const rest = Array.from({ length: length - required.length }, () => randomChar(ALL))
  const chars = [...required, ...rest]
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}
