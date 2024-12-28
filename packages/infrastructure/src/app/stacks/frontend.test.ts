import { Config, FrontendStack } from "@app/stacks/frontend";
import { CloudfrontDistribution } from "@cdktf/provider-aws/lib/cloudfront-distribution";
import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { S3Bucket } from "@cdktf/provider-aws/lib/s3-bucket";
import { S3BucketWebsiteConfiguration } from "@cdktf/provider-aws/lib/s3-bucket-website-configuration";
// Import the vanilla expect function from Jest to have typings for asymmetric matchers.
import { expect as expect_ } from "@jest/globals";
import { Testing } from "cdktf/lib/testing";
// Bring customer CDKTF matchers into scope.
// This is the only solution I found to make the Typescript compiler happy.
import type {} from "cdktf/lib/testing/adapters/jest";

describe("FrontendStack", () => {
  const config: Config = {
    frontend: {
      bucket: "some-bucket-name",
    },
    // accessKey: "some-access-key",
    // secretKey: "some-secret-key",
    region: "eu-west-1",
    roleArn: "arn:aws:iam::123456789012:role/role-name",
  };

  it("should create AWS provider", () => {
    const app = Testing.app();
    const stack = new FrontendStack(app, "frontend", config);
    const result = Testing.synth(stack);

    expect(result).toHaveProviderWithProperties(AwsProvider, {
      region: config.region,
    });
  });

  it("should create S3 bucket", () => {
    const app = Testing.app();
    const stack = new FrontendStack(app, "frontend", config);
    const result = Testing.synth(stack);

    expect(result).toHaveResourceWithProperties(S3Bucket, {});

    expect(result).toHaveResourceWithProperties(S3BucketWebsiteConfiguration, {
      index_document: { suffix: "index.html" },
      error_document: { key: "index.html" },
      bucket: expect_.stringContaining(`${FrontendStack.s3BucketId}.id`),
    });
  });

  it("should create CloudFront distribution", () => {
    const app = Testing.app();
    const stack = new FrontendStack(app, "frontend", config);
    const result = Testing.synth(stack);

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
