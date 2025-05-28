module.exports = {
  preset: 'ts-jest/presets/js-with-ts',
  testEnvironment: 'node',
  testMatch: [
    "**/*.test.ts"
  ],
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  roots: ["<rootDir>/src"],
  transformIgnorePatterns: [],
};
