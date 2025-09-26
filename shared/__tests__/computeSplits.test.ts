// @ts-nocheck
import { computeSplits } from '../expenses';

describe('computeSplits', () => {
  it('throws when amount is not positive', () => {
    const baseInput = {
      debtorIds: ['a'],
      sourceCurrency: 'USD',
      targetCurrency: 'USD',
      conversionRate: 1,
    };
    expect(() =>
      computeSplits({ ...baseInput, totalSourceMinorUnits: 0 }),
    ).toThrow('Amount must be > 0');
    expect(() =>
      computeSplits({ ...baseInput, totalSourceMinorUnits: -100 }),
    ).toThrow('Amount must be > 0');
  });

  it('throws when no debtors provided', () => {
    expect(() =>
      computeSplits({
        totalSourceMinorUnits: 1000,
        debtorIds: [],
        sourceCurrency: 'USD',
        targetCurrency: 'USD',
        conversionRate: 1,
      }),
    ).toThrow('Choose at least one person to split with');
  });

  it('splits evenly when divisible', () => {
    const result = computeSplits({
      totalSourceMinorUnits: 10000,
      debtorIds: ['a', 'b', 'c'],
      sourceCurrency: 'USD',
      targetCurrency: 'USD',
      conversionRate: 1,
    });
    expect(result.shares).toEqual([
      { userId: 'a', sourceMinorUnits: 2500, targetMinorUnits: 2500 },
      { userId: 'b', sourceMinorUnits: 2500, targetMinorUnits: 2500 },
      { userId: 'c', sourceMinorUnits: 2500, targetMinorUnits: 2500 },
    ]);
    expect(result.totalSourceMinorUnits).toBe(10000);
    expect(result.totalTargetMinorUnits).toBe(10000);
  });

  it('distributes remainder cents to earliest debtors', () => {
    const result = computeSplits({
      totalSourceMinorUnits: 1000,
      debtorIds: ['a', 'b'],
      sourceCurrency: 'USD',
      targetCurrency: 'USD',
      conversionRate: 1,
    });
    expect(result.shares).toEqual([
      { userId: 'a', sourceMinorUnits: 334, targetMinorUnits: 334 },
      { userId: 'b', sourceMinorUnits: 333, targetMinorUnits: 333 },
    ]);
  });

  it('sums of debtor amounts equal the total', () => {
    const amountCents = 12345;
    const debtors = ['a', 'b', 'c'];
    const result = computeSplits({
      totalSourceMinorUnits: amountCents,
      debtorIds: debtors,
      sourceCurrency: 'USD',
      targetCurrency: 'USD',
      conversionRate: 1,
    });
    const sum = result.shares.reduce(
      (total, split) => total + split.sourceMinorUnits,
      0,
    );

    expect(sum).toBe(amountCents);
    expect(result.totalSourceMinorUnits).toBe(amountCents);
  });

  it('is deterministic for the same debtor ordering', () => {
    const debtors = ['x', 'y', 'z'];
    const baseInput = {
      totalSourceMinorUnits: 101,
      debtorIds: debtors,
      sourceCurrency: 'USD',
      targetCurrency: 'USD',
      conversionRate: 1,
    };
    const firstRun = computeSplits(baseInput);
    const secondRun = computeSplits(baseInput);

    expect(secondRun).toEqual(firstRun);
  });

  it('supports all prompt examples', () => {
    expect(
      computeSplits({
        totalSourceMinorUnits: 2500,
        debtorIds: ['patrick'],
        sourceCurrency: 'USD',
        targetCurrency: 'USD',
        conversionRate: 1,
      }).shares,
    ).toEqual([{ userId: 'patrick', sourceMinorUnits: 1250, targetMinorUnits: 1250 }]);

    expect(
      computeSplits({
        totalSourceMinorUnits: 10000,
        debtorIds: ['jake', 'patch', 'eric'],
        sourceCurrency: 'USD',
        targetCurrency: 'USD',
        conversionRate: 1,
      }).shares,
    ).toEqual([
      { userId: 'jake', sourceMinorUnits: 2500, targetMinorUnits: 2500 },
      { userId: 'patch', sourceMinorUnits: 2500, targetMinorUnits: 2500 },
      { userId: 'eric', sourceMinorUnits: 2500, targetMinorUnits: 2500 },
    ]);

    expect(
      computeSplits({
        totalSourceMinorUnits: 1000,
        debtorIds: ['a', 'b'],
        sourceCurrency: 'USD',
        targetCurrency: 'USD',
        conversionRate: 1,
      }).shares,
    ).toEqual([
      { userId: 'a', sourceMinorUnits: 334, targetMinorUnits: 334 },
      { userId: 'b', sourceMinorUnits: 333, targetMinorUnits: 333 },
    ]);

    expect(
      computeSplits({
        totalSourceMinorUnits: 100,
        debtorIds: ['alpha'],
        sourceCurrency: 'USD',
        targetCurrency: 'USD',
        conversionRate: 1,
      }).shares,
    ).toEqual([{ userId: 'alpha', sourceMinorUnits: 50, targetMinorUnits: 50 }]);
  });

  it('converts using different currencies and rounds half up', () => {
    const result = computeSplits({
      totalSourceMinorUnits: 1099,
      debtorIds: ['debtor'],
      sourceCurrency: 'USD',
      targetCurrency: 'JPY',
      conversionRate: 150.555,
    });

    expect(result.totalTargetMinorUnits).toBeGreaterThan(0);
    expect(result.shares[0].targetMinorUnits).toBe(result.totalTargetMinorUnits);
  });

  it('adjusts converted remainders so the total matches', () => {
    const result = computeSplits({
      totalSourceMinorUnits: 100,
      debtorIds: ['a', 'b', 'c'],
      sourceCurrency: 'USD',
      targetCurrency: 'EUR',
      conversionRate: 0.3333,
    });

    const totalShares = result.shares.reduce(
      (sum, share) => sum + share.targetMinorUnits,
      0,
    );

    expect(totalShares).toBe(result.totalTargetMinorUnits);
  });
});
