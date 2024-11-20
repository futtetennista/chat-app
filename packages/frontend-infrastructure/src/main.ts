#!/usr/bin/env -S node --import @swc-node/register/esm-register

import { App } from "cdktf";
import * as D from "io-ts/Decoder";

import { Config } from "@/config";
import { Frontend } from "@/stacks/frontend";

function parseConfig(): Config {
  if (!process.env.FRONTEND_INFRASTRUCTURE_JSON_CONFIG) {
    console.error("FRONTEND_INFRASTRUCTURE_JSON_CONFIG is not defined");
    process.exit(1);
  }
  try {
    const json = JSON.parse(
      process.env.FRONTEND_INFRASTRUCTURE_JSON_CONFIG,
    ) as Config;

    const configOrError = Config.decode(json);
    if (configOrError._tag === "Left") {
      console.error(D.draw(configOrError.left));
      process.exit(1);
    }

    console.log("✅ Config parsed successfully");
    return configOrError.right;
  } catch (error) {
    console.error("Could not parse config", error);
    process.exit(1);
  }
}

function main() {
  const config: Config = parseConfig();
  const app = new App();
  new Frontend(app, "frontend", config);
  app.synth();
}

main();
