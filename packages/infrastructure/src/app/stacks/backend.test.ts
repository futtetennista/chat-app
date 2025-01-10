import { BackendStack, Config } from "@app/stacks/backend";
import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
// import { describe, expect, it } from "@jest/globals";
import { Testing } from "cdktf/lib/testing";
// Bring customer CDKTF matchers into scope.
// This is the only solution I found to make the Typescript compiler happy.
import type {} from "cdktf/lib/testing/adapters/jest";
import * as path from "path";

describe("BackendStack", () => {
  const config: Config = {
    accountId: "some-account-id",
    backend: {
      handler: "index.handler",
      name: "backend-function",
      runtime: "nodejs20.x",
      version: "1.0.0",
      codePath: path.resolve(__dirname, "../../../../backend/src"),
    },
    // accessKey: "some-access-key",
    // secretKey: "some-secret-key",
    region: "eu-west-1",
    roleArn: "arn:aws:iam::123456789012:role/role-name",
  };

  it("should create AWS provider", () => {
    const app = Testing.app();
    const stack = new BackendStack(app, "backend", config);
    const result = Testing.synth(stack);

    expect(result).toHaveProviderWithProperties(AwsProvider, {
      region: config.region,
    });
  });

  it.todo("should create S3 bucket for lambda function code");
  it.todo("should create IAM role and policy for lambda function");
  it.todo("should create lambda function");
  it.todo("should create API gateway");
  it.todo("should create CloudTrail");
});
