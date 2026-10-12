import { expect, it } from 'vitest';
import { copMoney } from '../model/cop-money';
import { formatCopMoney } from './format-cop-money';

it.each([
  ['es-CO', '130.000,01'], ['en-US', '130,000.01'],
  ['de-DE', '130.000,01'], ['ar-EG', '١٣٠٬٠٠٠٫٠١'],
])('uses %s grouping, decimal separator and digits without rounding', (locale, expected) => {
  const format: (value: ReturnType<typeof copMoney>, locale?: string) => string = formatCopMoney;
  expect(format(copMoney('130000.01'), locale)).toBe(expected);
});
it('preserves zero cents and maximum contract precision', () => {
  expect(formatCopMoney(copMoney('0.00'))).toBe('0,00');
  expect(formatCopMoney(copMoney('999999999999.99'))).toBe('999.999.999.999,99');
});
