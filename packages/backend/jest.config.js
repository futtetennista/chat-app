/* eslint-disable */

/** @type {import('jest').Config} */
module.exports = {
  clearMocks: true,
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@chat-app/scripts/(.*)$": "<rootDir>/scripts/$1",
  },
  reporters:
    process.env["CI"] === "true"
      ? [["github-actions", { silent: false }], "summary"]
      : undefined,
  resetMocks: true,
  // Specify the root directories for Jest to scan for tests
  roots: ["<rootDir>/src", "<rootDir>/scripts"],
  // Define the patterns Jest uses to detect test files
  testMatch: ["**/__tests__/**/*.[jt]s", "**/?(*.)+(spec|test).[tj]s"],
  transform: {
    "^.+\\.(t|j)s$": "@swc/jest",
  },
};
