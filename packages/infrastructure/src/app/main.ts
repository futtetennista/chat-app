import { Config } from "@app/config";
import { BackendStack } from "@app/stacks/backend";
import { FrontendStack } from "@app/stacks/frontend";
import { IdentityStack } from "@app/stacks/identity";
import { App } from "cdktf";
import * as D from "io-ts/Decoder";
import * as path from "path";

interface Env {
  FRONTEND_INFRASTRUCTURE_JSON_CONFIG?: string;
  BACKEND_INFRASTRUCTURE_JSON_CONFIG?: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_ROLE_ARN?: string;
  AWS_REGION?: string;
  AWS_SECRET_ACCESS_KEY?: string;
}

function checkEnvironment(): Required<Env> {
  const requiredEnvVars = [
    "FRONTEND_INFRASTRUCTURE_JSON_CONFIG",
    "BACKEND_INFRASTRUCTURE_JSON_CONFIG",
    "AWS_ACCESS_KEY_ID",
    "AWS_REGION",
    "AWS_ROLEA_ARN",
    "AWS_SECRET_ACCESS_KEY",
  ];
  const [missingEnvVars, result] = requiredEnvVars.reduce<[string[], Env]>(
    ([missingEnvVars, result], envVar) => {
      if (
        undefined === process.env[envVar] ||
        process.env[envVar].length === 0
      ) {
        return [[...missingEnvVars, envVar], result];
      }

      return [missingEnvVars, { ...result, [envVar]: process.env[envVar] }];
    },
    [[], {}],
  );

  if (missingEnvVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingEnvVars.join(", ")}`,
    );
  }

  return result as Required<Env>;
}

function mkConfig({
  frontendConfig,
  backendConfig,
  accessKey,
  region,
  roleArn,
  secretKey,
}: {
  frontendConfig: string;
  backendConfig: string;
  accessKey: string;
  region: string;
  roleArn: string;
  secretKey: string;
}): Config {
  try {
    const frontendConfigRaw = JSON.parse(frontendConfig) as Config["frontend"];
    const backendConfigRaw = JSON.parse(backendConfig) as Config["backend"];

    const result = Config.decode({
      frontend: frontendConfigRaw,
      backend: backendConfigRaw,
      accessKey,
      region,
      roleArn,
      secretKey,
    });
    if (result._tag === "Left") {
      console.error(D.draw(result.left));
      throw new Error("Could not decode config");
    }

    console.log("✅ Config parsed successfully");
    return result.right;
  } catch (error) {
    console.error("❌ Could not parse config", error);
    throw new Error("Config is not valid JSON");
  }
}

function main() {
  const {
    FRONTEND_INFRASTRUCTURE_JSON_CONFIG: frontendConfig,
    BACKEND_INFRASTRUCTURE_JSON_CONFIG: backendConfig,
    AWS_ACCESS_KEY_ID: accessKey,
    AWS_REGION: region,
    AWS_ROLE_ARN: roleArn,
    AWS_SECRET_ACCESS_KEY: secretKey,
  } = checkEnvironment();

  const config: Config = mkConfig({
    frontendConfig,
    backendConfig,
    accessKey,
    secretKey,
    region,
    roleArn,
  });
  const app = new App();
  // new AppStack(app, "app", config);
  new IdentityStack(app, "identity", config);
  new FrontendStack(app, "frontend", config);
  new BackendStack(app, "backend", {
    ...config,
    backend: {
      ...config.backend,
      codePath: path.resolve(__dirname, "../../../backend/dist"),
    },
  });
  app.synth();
}

main();
