/* eslint-disable */

/** @type {import('jest').Config} */
module.exports = {
  clearMocks: true,
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  resetMocks: true,
  reporters:
    process.env["CI"] === "true"
      ? [["github-actions", { silent: false }], "summary"]
      : undefined,
  setupFilesAfterEnv: ["<rootDir>/jest.setup-after-env.js"],
  transform: {
    "^.+\\.(t|j)sx?$": "@swc/jest",
  },
};
