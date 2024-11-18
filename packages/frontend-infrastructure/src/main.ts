import { App } from "cdktf";
import * as D from "io-ts/Decoder";

import { Config } from "@/config";
import { Frontend } from "@/stacks/frontend";

const config: Config = (function parseConfig() {
  if (!process.env.FRONTEND_STACK_JSON_CONFIG) {
    console.error("FRONTEND_STACK_JSON_CONFIG is not defined");
    process.exit(1);
  }

  try {
    const json = JSON.parse(process.env.FRONTEND_STACK_JSON_CONFIG) as Config;
    const configOrError = Config.decode(json);
    if (configOrError._tag === "Left") {
      console.error(D.draw(configOrError.left));
      process.exit(1);
    }

    return configOrError.right;
  } catch (error) {
    console.error("Could not parse config", error);
    process.exit(1);
  }
})();

const app = new App();
new Frontend(app, "frontend", config);
app.synth();
