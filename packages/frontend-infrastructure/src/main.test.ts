import { CloudfrontDistribution } from "@cdktf/provider-aws/lib/cloudfront-distribution";
import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { S3Bucket } from "@cdktf/provider-aws/lib/s3-bucket";
import { S3BucketWebsiteConfiguration } from "@cdktf/provider-aws/lib/s3-bucket-website-configuration";
import { describe, expect, it } from "@jest/globals";
import { Testing } from "cdktf";

import type { Config } from "@/config";
import { Frontend } from "@/stacks/frontend";

describe("Frontend", () => {
  const config: Config = {
    frontend: {
      bucket: "some-bucket-name",
    },
    region: "eu-west-1",
    accessKey: "your-access-key",
    profile: "your-profile",
    secretKey: "your-secret-key",
  };

  it("should create AWS provider", () => {
    const app = Testing.app();
    const stack = new Frontend(app, "frontend", config);
    const result = Testing.synth(stack);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    expect(result).toHaveProvider(AwsProvider);
  });

  it("should create S3 bucket", () => {
    const app = Testing.app();
    const stack = new Frontend(app, "frontend", config);
    const result = Testing.synth(stack);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    expect(result).toHaveResourceWithProperties(S3Bucket, {
      bucket: "some-bucket-name",
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    expect(result).toHaveResourceWithProperties(S3BucketWebsiteConfiguration, {
      index_document: { suffix: "index.html" },
      error_document: { key: "index.html" },
      bucket: expect.stringContaining("s3bucket.id"),
    });
  });

  it("should create CloudFront distribution", () => {
    const app = Testing.app();
    const stack = new Frontend(app, "frontend", config);
    const result = Testing.synth(stack);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    expect(result).toHaveResourceWithProperties(CloudfrontDistribution, {
      price_class: "PriceClass_100",
      // origin: expect.arrayContaining([
      //   expect.objectContaining({
      //     originId: expect.stringContaining("s3bucket.id"),
      //   }),
      // ]),
    });
  });
});
