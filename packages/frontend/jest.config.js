/* eslint-disable */

/** @type {import('jest').Config} */
module.exports = {
  clearMocks: true,
  resetMocks: true,
  reporters:
    process.env["CI"] === "true"
      ? [["github-actions", { silent: false }], "summary"]
      : undefined,
  testPathIgnorePatterns: [
    "<rootDir>/src/__tests__/",
    "<rootDir>/tests-examples/",
  ],
  transform: {
    "^.+\\.(t|j)sx?$": "@swc/jest",
  },
};
