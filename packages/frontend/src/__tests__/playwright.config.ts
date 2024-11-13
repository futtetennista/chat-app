import { PlaywrightTestConfig } from "@playwright/test";

const config: PlaywrightTestConfig = {
  testDir: "./tests",
  timeout: 30000,
  use: {
    baseURL: `http://localhost:${process.env.REACT_APP_PORT ?? "3000"}`,
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
    {
      name: "firefox",
      use: { browserName: "firefox" },
    },
  ],
};
export default config;
