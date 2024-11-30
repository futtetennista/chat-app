/* eslint-disable */

/** @type {import('jest').Config} */
module.exports = {
  clearMocks: true,
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  reporters:
    process.env["CI"] === "true"
      ? [["github-actions", { silent: false }], "summary"]
      : undefined,
  resetMocks: true,
  transform: {
    "^.+\\.(t|j)sx?$": "@swc/jest",
  },
};
