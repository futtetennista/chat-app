/* eslint-disable */

/** @type {import('jest').Config} */
module.exports = {
  clearMocks: true,
  setupFilesAfterEnv: ["<rootDir>/jest.setup-after-env.js"],
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
