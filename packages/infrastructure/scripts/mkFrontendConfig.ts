import { Command } from "@commander-js/extra-typings";

import { FrontendConfig } from "../src/app/config";

export default function (
  _cmd: Command,
  { printConfig }: { printConfig: boolean },
) {
  return async function ({
    bucketName,
  }: {
    bucketName: string;
  }): Promise<FrontendConfig> {
    const config: FrontendConfig = {
      bucket: bucketName,
    };

    if (process.env.CI === "true") {
      const core = await import("@actions/core");
      core.exportVariable("FRONTEND_INFRASTRUCTURE_JSON_CONFIG", config);
    }

    if (process.env.CI !== "true" && printConfig) {
      console.log(JSON.stringify(config));
    }

    return config;
  };
}
