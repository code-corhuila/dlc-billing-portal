import type { CopMoney } from '../model/cop-money';

export function formatCopMoney(value: CopMoney, locale = 'es-CO'): string {
  const [whole, cents] = value.split('.');
  const amount = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const digits = new Intl.NumberFormat(locale, { useGrouping: false, minimumIntegerDigits: 2, maximumFractionDigits: 0 });
  const fraction = digits.format(BigInt(cents));
  return amount.formatToParts(BigInt(whole)).map(part => part.type === 'fraction' ? fraction : part.value).join('');
}
