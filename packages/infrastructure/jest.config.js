/* eslint-disable */

/** @type {import('jest').Config} */
module.exports = {
  clearMocks: true,
  moduleNameMapper: {
    "^@app/(.*)$": "<rootDir>/src/app/$1",
    "^@bootstrap/(.*)$": "<rootDir>/src/bootstrap/$1",
  },
  resetMocks: true,
  reporters:
    process.env["CI"] === "true"
      ? [["github-actions", { silent: false }], "summary"]
      : undefined,
  // Specify the root directories for Jest to scan for tests
  roots: ["<rootDir>/src"],
  // Define the patterns Jest uses to detect test files
  testMatch: ["**/__tests__/**/*.[jt]s", "**/?(*.)+(spec|test).[tj]s"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup-after-env.js"],
  transform: {
    "^.+\\.(t|j)sx?$": "@swc/jest",
  },
};
