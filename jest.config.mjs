/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/shared', '<rootDir>/server', '<rootDir>/client'],
  moduleNameMapper: {
    '^@shared/(.*)$': '<rootDir>/shared/$1',
    '^\.\/vite$': '<rootDir>/server/__mocks__/vite.ts',
    '^@/hooks/useAuth$': '<rootDir>/client/src/__mocks__/useAuth.ts',
    '^@/hooks/use-toast$': '<rootDir>/client/src/__mocks__/use-toast.ts',
    '^@/hooks/use-trip-realtime$': '<rootDir>/client/src/__mocks__/use-trip-realtime.ts',
    '^wouter$': '<rootDir>/client/src/__mocks__/wouter.tsx',
    '^@/(.*)$': '<rootDir>/client/src/$1',
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
