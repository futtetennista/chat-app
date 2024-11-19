/* eslint-disable */
module.exports = {
  clearMocks: true,
  resetMocks: true,
  reporters:
    process.env["CI"] === "true"
      ? [["github-actions", { silent: false }], "summary"]
      : undefined,
  transform: {
    // "^.+\\.(t|j)sx?$": "ts-jest",
    "^.+\\.(t|j)sx?$": "@swc/jest",
  },
};
