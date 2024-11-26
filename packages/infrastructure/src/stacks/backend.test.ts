import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { describe, expect, it } from "@jest/globals";
import { Testing } from "cdktf";
import * as path from "path";

import { BackendStack, Config } from "@/stacks/backend";

describe("BackendStack", () => {
  const config: Config = {
    backend: {
      handler: "index.handler",
      name: "backend-function",
      runtime: "nodejs20.x",
      version: "1.0.0",
      codePath: path.resolve(__dirname, "../../../backend/src"),
    },
    accessKey: "some-access-key",
    secretKey: "some-secret-key",
    region: "eu-west-1",
  };

  it("should create AWS provider", () => {
    const app = Testing.app();
    const stack = new BackendStack(app, "backend", config);
    const result = Testing.synth(stack);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    expect(result).toHaveProviderWithProperties(AwsProvider, {
      region: config.region,
    });
  });
});
