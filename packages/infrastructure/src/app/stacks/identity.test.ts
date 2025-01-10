import { Config, IdentityStack } from "@app/stacks/identity";
import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
// import { describe, expect, it } from "@jest/globals";
import { Testing } from "cdktf/lib/testing";
// Bring customer CDKTF matchers into scope.
// This is the only solution I found to make the Typescript compiler happy.
import type {} from "cdktf/lib/testing/adapters/jest";

describe("IdentityStack", () => {
  const config: Config = {
    accountId: "some-account-id",
    region: "eu-west-1",
    accessKey: "some-access-key",
    secretKey: "some-secret-key",
    roleArn: "arn:aws:iam::123456789012:role/role-name",
  };

  it("should create AWS provider", () => {
    const app = Testing.app();
    const stack = new IdentityStack(app, "identity", config);
    const result = Testing.synth(stack);

    expect(result).toHaveProviderWithProperties(AwsProvider, {
      region: config.region,
    });
  });
});
