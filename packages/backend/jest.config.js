/* eslint-disable */

/** @type {import('jest').Config} */
module.exports = {
  clearMocks: true,
  reporters:
    process.env["CI"] === "true"
      ? [["github-actions", { silent: false }], "summary"]
      : undefined,
  resetMocks: true,
  transform: {
    "^.+\\.(t|j)sx?$": "@swc/jest",
  },
};
