import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { describe, expect, it } from "@jest/globals";
import { Testing } from "cdktf";

import { Config } from "@/config";
import { AppStack } from "@/stacks";

describe("AppStack", () => {
  const config: Config = {
    frontend: {
      bucket: "some-bucket-name",
    },
    backend: {},
    region: "eu-west-1",
    accessKey: "some-access-key",
    secretKey: "some-secret-key",
  };

  it("should create AWS provider", () => {
    const app = Testing.app();
    const stack = new AppStack(app, "app", config);
    const result = Testing.synth(stack);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    expect(result).toHaveProvider(AwsProvider);
  });
});
