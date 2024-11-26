import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { describe, expect, it } from "@jest/globals";
import { Testing } from "cdktf";

import { Config, IdentityStack } from "@/stacks/identity";

describe("IdentityStack", () => {
  const config: Config = {
    accessKey: "some-access-key",
    secretKey: "some-secret-key",
    region: "eu-west-1",
  };

  it("should create AWS provider", () => {
    const app = Testing.app();
    const stack = new IdentityStack(app, "identity", config);
    const result = Testing.synth(stack);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    expect(result).toHaveProviderWithProperties(AwsProvider, {
      region: config.region,
    });
  });
});
