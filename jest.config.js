export default {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  testEnvironment: 'node',
  testMatch: [
    "**/*.test.ts"
  ],
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  roots: ["<rootDir>/src"],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true
    }]
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  // Allow Jest to transform ES modules from node_modules
  transformIgnorePatterns: [
    'node_modules/(?!(chalk|ansi-styles)/)'
  ],
  // Handle ES module globals
  globals: {
    'ts-jest': {
      useESM: true
    }
  }
};