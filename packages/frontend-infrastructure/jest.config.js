/** @type {import('jest').Config} */
// eslint-disable-next-line no-undef
module.exports = {
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
