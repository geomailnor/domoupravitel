// translate.js
import { bg } from './bg.js';

// Текущ език (за сега само български)
const translations = bg;

// Превод на статус
export function statusLabel(status) {
  return translations.status[status] || status;
}

// Превод на вид плащане
export function typeLabel(type) {
  return translations.type[type] || type;
}

// Форматира месец от '2026-09' на 'Септември 2026'
export function monthLabel(monthStr) {
  if (!monthStr) return '';
  const [year, month] = monthStr.split('-');
  const monthName = bg.months[month];
  return `${monthName} ${year}`;
}
export function monthNameOnly(monthStr) {
  if (!monthStr) return '';
  const [, month] = monthStr.split('-');
  return bg.months[month]; // Връща само името на месеца
}