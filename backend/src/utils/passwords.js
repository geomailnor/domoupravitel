// backend/src/utils/passwords.js
/**
 * Генерира случайна парола с безопасни символи.
 * Изключва 0, O, I, l (бъркат се с други).
 */
export function generatePassword(length = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}