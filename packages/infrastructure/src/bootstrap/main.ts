import { TerraformRoleStack } from "@bootstrap/stacks/role";
import { TerraformUserStack } from "@bootstrap/stacks/user";
import { App } from "cdktf/lib/app";

interface Env {
  AWS_REGION?: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  GITHUB_USERNAME?: string;
  GITHUB_REPOSITORY?: string;
}

function checkEnvironment(): Required<Env> {
  const requiredEnvVars = [
    "AWS_REGION",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "GITHUB_USERNAME",
    "GITHUB_REPOSITORY",
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

function main() {
  const {
    AWS_REGION: region,
    AWS_ACCESS_KEY_ID: accessKey,
    AWS_SECRET_ACCESS_KEY: secretKey,
    GITHUB_USERNAME: githubUsername,
    GITHUB_REPOSITORY: githubRepository,
  } = checkEnvironment();

  const app = new App();

  const policyName = process.env.AWS_USER_POLICY_NAME;
  const userName = process.env.AWS_USERNAME;
  const groupName = process.env.AWS_GROUP_NAME;
  new TerraformUserStack(app, {
    accessKey,
    groupName,
    policyName,
    region,
    secretKey,
    userName,
  });

  const clientIdList = process.env.AWS_OIDC_GITHUB_CLIENT_ID_CSV;
  const thumbprintList = process.env.AWS_OIDC_GITHUB_THUMBPRINT_CSV;
  new TerraformRoleStack(app, {
    accessKey,
    clientIdList: clientIdList?.split(","),
    githubRepository,
    githubUsername,
    region,
    secretKey,
    thumbprintList: thumbprintList?.split(","),
  });

  app.synth();
}

if (require.main === module) {
  main();
}
