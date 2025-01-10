import { Command } from "@commander-js/extra-typings";

import { LambdaFunctionConfig } from "../src/app/config";

export default function (
  _cmd: Command,
  { printConfig }: { printConfig: boolean },
) {
  return async function ({
    functionName,
    handler,
    runtime,
    version,
  }: {
    functionName: string;
    handler: string;
    runtime: string;
    version: string;
  }): Promise<LambdaFunctionConfig> {
    const config: LambdaFunctionConfig = {
      handler,
      name: functionName,
      runtime,
      version,
    };

    if (process.env.CI === "true") {
      const core = await import("@actions/core");
      core.exportVariable("BACKEND_INFRASTRUCTURE_JSON_CONFIG", config);
    } else if (printConfig) {
      console.log(JSON.stringify(config));
    }

    return config;
  };
}
