import { expect, it } from 'vitest';

it.each(['0.00', '130000.00', '999999999999.99', '000001.01'])('preserves exact contract money %s', async value => {
  const { copMoney } = await import('./cop-money');
  expect(copMoney(value)).toBe(value);
});
it.each(['-1.00', '1', '1.1', '1.001', '1000000000000.00', ' 1.00', 'NaN'])('rejects non-contract money %s', async value => {
  const { copMoney } = await import('./cop-money');
  expect(() => copMoney(value)).toThrow(/Invalid COP money/);
});
it('formats cents and maximum precision without rounding', async () => {
  const { copMoney, formatCopMoney } = await import('./cop-money');
  expect(formatCopMoney(copMoney('999999999999.99'))).toBe('999.999.999.999,99');
  expect(formatCopMoney(copMoney('130000.01'))).toBe('130.000,01');
  expect(formatCopMoney(copMoney('0.00'))).toBe('0,00');
});
