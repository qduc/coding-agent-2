module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    "**/*.test.ts"
  ],
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  roots: ["<rootDir>/src"],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(\\w-?)+\\/esm/)',
  ],
};
