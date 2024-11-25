#!/usr/bin/env tsx

import { App } from "cdktf";
import * as D from "io-ts/Decoder";
import * as path from "path";

import { Config } from "@/config";
import { BackendStack } from "@/stacks/backend";
import { FrontendStack } from "@/stacks/frontend";
import { IdentityStack } from "@/stacks/identity";

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
  // new AppStack(app, "app", config);
  new IdentityStack(app, "identity", config);
  new FrontendStack(app, "frontend", config);
  new BackendStack(app, "backend", {
    ...config,
    backend: {
      ...config.backend,
      codePath: path.resolve(__dirname, "../../backend/dist"),
    },
  });
  app.synth();
}

main();
