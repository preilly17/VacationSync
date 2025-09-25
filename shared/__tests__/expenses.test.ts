import {
  splitIncludePayer,
  computeCurrencyAwareSplits,
  convertMinor,
} from "@shared/expenses";

import { getCurrencyMeta } from "@shared/currency";
import { applyFeeToRate } from "@shared/fx";

describe("splitIncludePayer", () => {
  it("includes payer in divisor and excludes payer from map", () => {
    const shares = splitIncludePayer(10000, ["jake", "patch", "eric"]);
    expect(shares.size).toBe(3);
    expect([...shares.values()]).toEqual([2500, 2500, 2500]);
    const totalDebtorShare = [...shares.values()].reduce((sum, value) => sum + value, 0);
    expect(totalDebtorShare).toBe(7500);
  });

  it("distributes remainders to earliest debtors", () => {
    const shares = splitIncludePayer(1002, ["a", "b", "c"]);
    expect(shares.get("a")).toBe(251);
    expect(shares.get("b")).toBe(251);
    expect(shares.get("c")).toBe(250);
    const total = [...shares.values()].reduce((sum, value) => sum + value, 0);
    expect(total + Math.floor(1002 / 4)).toBe(1002); // payer share is implicit
  });
});

describe("computeCurrencyAwareSplits", () => {
  it("matches USD example where payer + 3 debtors split evenly", () => {
    const result = computeCurrencyAwareSplits(
      10000,
      ["jake", "patch", "eric"],
      "USD",
      "USD",
      "1",
    );

    expect(result.rows).toHaveLength(3);
    result.rows.forEach((row) => {
      expect(row.shareSrcMinor).toBe(2500);
      expect(row.shareTgtMinor).toBe(2500);
    });
    const payerShare = 10000 - result.rows.reduce((sum, row) => sum + row.shareSrcMinor, 0);
    expect(payerShare).toBe(2500);
    expect(result.totalTgtMinor).toBe(7500);
  });

  it("converts ¥10,000 JPY paid with USD requests at locked rate", () => {
    const result = computeCurrencyAwareSplits(
      10_000,
      ["jake", "patch", "eric"],
      "JPY",
      "USD",
      "0.006667",
    );

    const srcTotal = result.rows.reduce((sum, row) => sum + row.shareSrcMinor, 0);
    expect(srcTotal).toBe(7_500);

    expect(result.rows.map((row) => row.shareSrcMinor)).toEqual([
      2_500,
      2_500,
      2_500,
    ]);
    const targetShares = result.rows.map((row) => row.shareTgtMinor);
    expect(Math.max(...targetShares) - Math.min(...targetShares)).toBeLessThanOrEqual(1);

    const totalTgt = convertMinor(7_500, 0, 2, "0.006667");
    const tgtSum = targetShares.reduce((sum, amount) => sum + amount, 0);
    expect(tgtSum).toBe(totalTgt);
    expect(result.totalTgtMinor).toBe(totalTgt);
  });

  it("handles odd remainder yen converting to cents", () => {
    const result = computeCurrencyAwareSplits(
      1_001,
      ["jake"],
      "JPY",
      "USD",
      "0.006667",
    );

    expect(result.rows[0]).toEqual({
      userId: "jake",
      shareSrcMinor: 501,
      shareTgtMinor: convertMinor(501, 0, 2, "0.006667"),
    });
    const payerShare = 1_001 - result.rows[0].shareSrcMinor;
    expect(payerShare).toBe(500);
    expect(result.totalTgtMinor).toBe(convertMinor(501, 0, 2, "0.006667"));
  });

  it("ensures target rounding diff is reconciled in stable order", () => {
    const result = computeCurrencyAwareSplits(
      101,
      ["a", "b"],
      "JPY",
      "USD",
      "0.006667",
    );

    const totalTgt = convertMinor(68, 0, 2, "0.006667");
    const tgtSum = result.rows.reduce((sum, row) => sum + row.shareTgtMinor, 0);
    expect(tgtSum).toBe(totalTgt);
    expect(result.rows[0].shareTgtMinor >= result.rows[1].shareTgtMinor).toBe(true);
  });
});

it("uses currency metadata exponents", () => {
  const jpy = getCurrencyMeta("JPY");
  const usd = getCurrencyMeta("usd");
  expect(jpy.exponent).toBe(0);
  expect(usd.exponent).toBe(2);
});

it("applies FX markup using basis points", () => {
  expect(applyFeeToRate("0.006667", 80)).toBe("0.006720");
});
