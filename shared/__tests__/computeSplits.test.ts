// @ts-nocheck
import { computeSplits } from '../expenses';

describe('computeSplits', () => {
  it('throws when amount is not positive', () => {
    expect(() => computeSplits(0, ['a'])).toThrow('Amount must be > 0');
    expect(() => computeSplits(-100, ['a'])).toThrow('Amount must be > 0');
  });

  it('throws when no debtors provided', () => {
    expect(() => computeSplits(1000, [])).toThrow(
      'Choose at least one person to split with',
    );
  });

  it('splits evenly when divisible', () => {
    const result = computeSplits(10000, ['a', 'b', 'c']);
    expect(result).toEqual([
      { userId: 'a', amountCents: 2500 },
      { userId: 'b', amountCents: 2500 },
      { userId: 'c', amountCents: 2500 },
    ]);
  });

  it('distributes remainder cents to earliest debtors', () => {
    const result = computeSplits(1000, ['a', 'b']);
    expect(result).toEqual([
      { userId: 'a', amountCents: 334 },
      { userId: 'b', amountCents: 333 },
    ]);
  });

  it('sums of debtor amounts equal the total', () => {
    const amountCents = 12345;
    const debtors = ['a', 'b', 'c'];
    const result = computeSplits(amountCents, debtors);
    const sum = result.reduce((total, split) => total + split.amountCents, 0);

    expect(sum).toBe(amountCents);
  });

  it('is deterministic for the same debtor ordering', () => {
    const debtors = ['x', 'y', 'z'];
    const firstRun = computeSplits(101, debtors);
    const secondRun = computeSplits(101, debtors);

    expect(secondRun).toEqual(firstRun);
  });

  it('supports all prompt examples', () => {
    expect(computeSplits(2500, ['patrick'])).toEqual([
      { userId: 'patrick', amountCents: 1250 },
    ]);

    expect(computeSplits(10000, ['jake', 'patch', 'eric'])).toEqual([
      { userId: 'jake', amountCents: 2500 },
      { userId: 'patch', amountCents: 2500 },
      { userId: 'eric', amountCents: 2500 },
    ]);

    expect(computeSplits(1000, ['a', 'b'])).toEqual([
      { userId: 'a', amountCents: 334 },
      { userId: 'b', amountCents: 333 },
    ]);

    expect(computeSplits(100, ['alpha'])).toEqual([
      { userId: 'alpha', amountCents: 50 },
    ]);
  });
});
