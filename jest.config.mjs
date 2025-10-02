/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/shared', '<rootDir>/server', '<rootDir>/client'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/client/src/$1',
    '^@shared/(.*)$': '<rootDir>/shared/$1',
    '^\.\/vite$': '<rootDir>/server/__mocks__/vite.ts',
  },
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: 'tsconfig.jest.json',
        diagnostics: false,
      },
    ],
  },
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
};

export default config;
