/* eslint-disable */

/** @type {import('jest').Config} */
module.exports = {
  clearMocks: true,
  testPathIgnorePatterns: [
    "<rootDir>/src/__tests__/",
    "<rootDir>/tests-examples/",
  ],
  transform: {
    "^.+\\.(t|j)sx?$": "@swc/jest",
  },
};
