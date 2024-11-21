import { CloudfrontDistribution } from "@cdktf/provider-aws/lib/cloudfront-distribution";
import { S3Bucket } from "@cdktf/provider-aws/lib/s3-bucket";
import { S3BucketWebsiteConfiguration } from "@cdktf/provider-aws/lib/s3-bucket-website-configuration";
import { describe, expect, it } from "@jest/globals";
import { Testing } from "cdktf";

import { Config } from "@/config";
import { FrontendStack } from "@/stacks/frontend";

describe("FrontendStack", () => {
  const config: Config = {
    frontend: {
      bucket: "some-bucket-name",
    },
    backend: {},
    accessKey: "some-access-key",
    secretKey: "some-secret-key",
    region: "eu-west-1",
  };

  it("should create S3 bucket", () => {
    const app = Testing.app();
    const stack = new FrontendStack(app, "frontend", config);
    const result = Testing.synth(stack);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    expect(result).toHaveResourceWithProperties(S3Bucket, {
      bucket: config.frontend.bucket,
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    expect(result).toHaveResourceWithProperties(S3BucketWebsiteConfiguration, {
      index_document: { suffix: "index.html" },
      error_document: { key: "index.html" },
      bucket: expect.stringContaining(`${FrontendStack.s3BucketId}.id`),
    });
  });

  it("should create CloudFront distribution", () => {
    const app = Testing.app();
    const stack = new FrontendStack(app, "frontend", config);
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
