module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/helpers/'],
  clearMocks: true,
  openHandlesTimeout: 10000,
};
