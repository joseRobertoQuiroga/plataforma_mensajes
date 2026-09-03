module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/helpers/'],
  clearMocks: true,
  openHandlesTimeout: 10000,
  transformIgnorePatterns: ['/node_modules/(?!(supertest)/)'],
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
};
