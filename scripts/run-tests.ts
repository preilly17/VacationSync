import { promises as fs } from "fs";
import path from "path";
import { pathToFileURL } from "url";

type TestCase = { name: string; fn: () => unknown | Promise<unknown> };
const tests: TestCase[] = [];
const describeStack: string[] = [];

function fullName(name: string): string {
  return [...describeStack, name].join(" › ");
}

(globalThis as any).describe = (name: string, fn: () => void) => {
  describeStack.push(name);
  try {
    fn();
  } finally {
    describeStack.pop();
  }
};

(globalThis as any).it = (name: string, fn: () => unknown) => {
  tests.push({ name: fullName(name), fn });
};
(globalThis as any).test = (globalThis as any).it;

class AssertionError extends Error {}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

(globalThis as any).expect = (received: unknown) => ({
  toBe(expected: unknown) {
    if (received !== expected) {
      throw new AssertionError(`Expected ${received} to be ${expected}`);
    }
  },
  toEqual(expected: unknown) {
    const rec = JSON.stringify(received);
    const exp = JSON.stringify(expected);
    if (rec !== exp) {
      throw new AssertionError(`Expected ${rec} to equal ${exp}`);
    }
  },
  toHaveLength(expected: number) {
    if (!isObject(received) && !Array.isArray(received)) {
      throw new AssertionError(`Value has no length`);
    }
    const length = (received as any).length;
    if (length !== expected) {
      throw new AssertionError(`Expected length ${expected} but received ${length}`);
    }
  },
  toBeLessThanOrEqual(expected: number) {
    if (!(typeof received === "number" && received <= expected)) {
      throw new AssertionError(`Expected ${received} ≤ ${expected}`);
    }
  },
});

async function collectTests(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const resolved = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectTests(resolved)));
    } else if (/\.test\.ts$/.test(entry.name)) {
      files.push(resolved);
    }
  }
  return files;
}

async function run() {
  const roots = ["shared"];
  for (const root of roots) {
    const dir = path.join(process.cwd(), root);
    try {
      const files = await collectTests(dir);
      for (const file of files) {
        await import(pathToFileURL(file).href);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  let passed = 0;
  let failed = 0;
  for (const test of tests) {
    try {
      await test.fn();
      console.log(`✓ ${test.name}`);
      passed += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`✗ ${test.name}`);
      console.error(`  ${message}`);
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
