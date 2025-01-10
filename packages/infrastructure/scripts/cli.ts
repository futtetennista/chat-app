import { Config } from "@app/config";
import { Command } from "@commander-js/extra-typings";
import * as fs from "fs";
import * as path from "path";

import mkBackendConfig from "./mkBackendConfig";
import mkFrontendConfig from "./mkFrontendConfig";

function checkEnv(envVars: string[]): string[] {
  return envVars.reduce<string[]>((tally, envVar) => {
    return process.env[envVar] ? tally : [...tally, envVar];
  }, []);
}

function mkConfig(cmd: Command) {
  return async function ({
    accountId,
    bucketName,
    region,
    roleArn,
    functionName,
    handler,
    runtime,
    version,
  }: {
    accountId: string;
    bucketName: string;
    functionName: string;
    handler: string;
    region: string;
    roleArn: string;
    runtime: string;
    version: string;
  }): Promise<void> {
    const missingEnvVars = checkEnv([
      "AWS_ACCESS_KEY_ID",
      "AWS_SECRET_ACCESS_KEY",
    ]);
    if (missingEnvVars.length > 0) {
      return cmd.error(
        `The following required environment variable(s) are not set: ${missingEnvVars.join(", ")}`,
      );
    }

    const config: Config = {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      accessKey: process.env.AWS_ACCESS_KEY_ID!,
      accountId,
      backend: await mkBackendConfig(cmd, { printConfig: false })({
        handler,
        functionName,
        runtime,
        version,
      }),
      frontend: await mkFrontendConfig(cmd, { printConfig: false })({
        bucketName: bucketName,
      }),
      region,
      roleArn,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      secretKey: process.env.AWS_SECRET_ACCESS_KEY!,
    };

    if (process.env.CI === "true") {
      const core = await import("@actions/core");
      core.exportVariable("BACKEND_INFRASTRUCTURE_JSON_CONFIG", config);
    } else {
      console.log(JSON.stringify(config));
    }
  };
}

function main() {
  const cli = new Command();

  cli
    .command("config:backend:create")
    .description("Create the config file for the backend stack.")
    .requiredOption(
      "--handler <handler>",
      "Handler function",
      process.env.AWS_LAMBDA_FUNC_HANDLER,
    )
    .requiredOption(
      "--function-name <name>",
      "Function name",
      process.env.AWS_LAMBDA_FUNC_NAME,
    )
    .requiredOption(
      "--runtime <runtime>",
      "Runtime",
      process.env.AWS_LAMBDA_FUNC_RUNTIME,
    )
    .requiredOption(
      "--version <version>",
      "Version",
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      process.env.AWS_LAMBDA_FUNC_VERSION || undefined,
    )
    .action(async (options) => {
      await mkBackendConfig(cli, { printConfig: true })(options);
    });

  cli
    .command("config:frontend:create")
    .description("Create the config file for the frontend stack.")
    .requiredOption(
      "--bucket-name <name>",
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
    .requiredOption(
      "--handler <handler>",
      "Handler function",
      process.env.AWS_LAMBDA_FUNC_HANDLER,
    )
    .requiredOption(
      "--function-name <name>",
      "Function name",
      process.env.AWS_LAMBDA_FUNC_NAME,
    )
    .requiredOption(
      "--runtime <runtime>",
      "Runtime",
      process.env.AWS_LAMBDA_FUNC_RUNTIME,
    )
    .requiredOption(
      "--version <version>",
      "Version",
      process.env.AWS_LAMBDA_FUNC_VERSION,
    )
    .requiredOption(
      "--account-id <id>",
      "The account ID of the AWS account",
      process.env.AWS_ACCOUNT_ID,
    )
    .requiredOption("--region <region>", "AWS region", process.env.AWS_REGION)
    .requiredOption(
      "--bucket-name <name>",
      "S3 bucket",
      process.env.AWS_S3_BUCKET_NAME,
    )
    .requiredOption(
      "--role-arn <name>",
      "The ARN of the role to assume",
      process.env.AWS_ROLE_ARN,
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
