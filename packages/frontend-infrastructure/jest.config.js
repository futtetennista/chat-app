/* eslint-disable */

/** @type {import('jest').Config} */
module.exports = {
  clearMocks: true,
  resetMocks: true,
  setupFilesAfterEnv: ["<rootDir>/jest.setup-after-env.js"],
  reporters:
    process.env["CI"] === "true"
      ? [["github-actions", { silent: false }], "summary"]
      : undefined,
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": [
      "@swc/jest",
      {
        // jsc: {
        //   parser: {
        //     syntax: "typescript",
        //   },
        //   baseUrl: "./src",
        //   paths: {
        //     "@/*": ["./*"],
        //   },
        // },
      },
    ],
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
};
