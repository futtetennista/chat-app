import { Command } from "@commander-js/extra-typings";
import * as fs from "fs";
import * as path from "path";

import mkBackendConfig from "./mkBackendConfig";
import mkFrontendConfig from "./mkFrontendConfig";

function mkConfig(cmd: Command) {
  return async function ({
    handler,
    name,
    runtime,
    version,
    awsBucket,
    awsRegion,
  }: {
    handler: string;
    name: string;
    runtime: string;
    version: string;
    awsBucket: string;
    awsRegion: string;
  }): Promise<void> {
    const config = {
      backend: mkBackendConfig(cmd, { printConfig: false })({
        handler,
        name,
        runtime,
        version,
      }),
      frontend: mkFrontendConfig(cmd, { printConfig: false })({
        awsBucket,
      }),
      awsRegion,
      accessKey: process.env.AWS_ACCESS_KEY_ID,
      secretKey: process.env.AWS_SECRET_ACCESS_KEY,
    };

    if (process.env.CI === "true") {
      const core = await import("@actions/core");
      core.exportVariable("BACKEND_INFRASTRUCTURE_JSON_CONFIG", config);
    } else {
      console.log(JSON.stringify(config));
    }
  }
}

function main() {
  const cli = new Command();

  cli
    .command("config:backend:create")
    .description("Create the config file for the backend stack.")
    .requiredOption("--handler <handler>", "Handler function", process.env.AWS_LAMBDA_FUNC_HANDLER)
    .requiredOption("--name <name>", "Function name", process.env.AWS_LAMBDA_FUNC_NAME)
    .requiredOption("--runtime <runtime>", "Runtime", process.env.AWS_LAMBDA_FUNC_RUNTIME)
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    .requiredOption("--version <version>", "Version", process.env.AWS_LAMBDA_FUNC_VERSION || undefined)
    .action(async (options) => {
      await mkBackendConfig(cli, { printConfig: true })(options);
    });

  cli
    .command("config:frontend:create")
    .description("Create the config file for the frontend stack.")
    .requiredOption(
      "--aws-bucket <name>",
      "S3 bucket",
      process.env.AWS_S3_BUCKET_NAME,
    )
    .helpOption("-h, --help")
    .action(async (options) => {
      await mkFrontendConfig(cli, { printConfig: true })(options);
    });

  cli
    .command("config:create")
    .description("Create the config file for all the stacks.")
    .requiredOption("--handler <handler>", "Handler function", process.env.AWS_LAMBDA_FUNC_HANDLER)
    .requiredOption("--name <name>", "Function name", process.env.AWS_LAMBDA_FUNC_NAME)
    .requiredOption("--runtime <runtime>", "Runtime", process.env.AWS_LAMBDA_FUNC_RUNTIME)
    .requiredOption("--version <version>", "Version", process.env.AWS_LAMBDA_FUNC_VERSION)
    .requiredOption(
      "--aws-region <region>",
      "AWS region",
      process.env.AWS_REGION,
    )
    .requiredOption(
      "--aws-bucket <name>",
      "S3 bucket",
      process.env.AWS_S3_BUCKET_NAME,
    )
    .action(mkConfig(cli));

  const { version } = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "../package.json"), "utf-8"),
  ) as { version: string };

  cli
    .allowExcessArguments(false)
    .allowUnknownOption(false)
    .version(version)
    .parse();
}

main();
