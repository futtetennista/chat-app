import { CloudfrontDistribution } from "@cdktf/provider-aws/lib/cloudfront-distribution";
import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { S3Bucket } from "@cdktf/provider-aws/lib/s3-bucket";
import { S3BucketWebsiteConfiguration } from "@cdktf/provider-aws/lib/s3-bucket-website-configuration";
import { TerraformStack } from "cdktf";
import { Construct } from "constructs";

import { Config } from "@/config";

export class Frontend extends TerraformStack {
  static readonly s3BucketId = "s3b";

  constructor(scope: Construct, name: string, config: Config) {
    super(scope, name);

    new AwsProvider(this, "awsp", {
      region: config.region,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
      // assumeRole: [
      //   {
      //     roleArn: config.roleArn,
      //     sessionName: `TerraformSession-${new Date().toISOString()}`,
      //   },
      // ],
    });

    const bucket = new S3Bucket(this, Frontend.s3BucketId, {
      bucket: config.frontend.bucket,
    });

    new S3BucketWebsiteConfiguration(this, "s3bwc", {
      bucket: bucket.id,
      indexDocument: {
        suffix: "index.html",
      },
      errorDocument: {
        key: "index.html",
      },
    });

    new CloudfrontDistribution(this, "cfd", {
      enabled: true,
      defaultCacheBehavior: {
        allowedMethods: ["GET", "HEAD"],
        cachedMethods: ["GET", "HEAD"],
        targetOriginId: bucket.id,
        viewerProtocolPolicy: "redirect-to-https",
        forwardedValues: {
          queryString: false,
          cookies: { forward: "none" },
        },
      },
      origin: [
        {
          originId: bucket.id,
          domainName: bucket.bucketRegionalDomainName,
          s3OriginConfig: {
            originAccessIdentity: "",
          },
        },
      ],
      defaultRootObject: "index.html",
      priceClass: "PriceClass_100",
      restrictions: {
        geoRestriction: {
          restrictionType: "none",
        },
      },
      viewerCertificate: {
        cloudfrontDefaultCertificate: true,
      },
    });
  }
}
