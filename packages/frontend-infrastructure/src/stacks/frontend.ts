import { CloudfrontDistribution } from "@cdktf/provider-aws/lib/cloudfront-distribution";
import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { S3Bucket } from "@cdktf/provider-aws/lib/s3-bucket";
import { S3BucketWebsiteConfiguration } from "@cdktf/provider-aws/lib/s3-bucket-website-configuration";
import { TerraformStack } from "cdktf";
import { Construct } from "constructs";

import { Config } from "@/config";

export class Frontend extends TerraformStack {
  constructor(scope: Construct, name: string, config: Config) {
    super(scope, name);

    new AwsProvider(this, "aws", {
      region: config.region,
      profile: config.profile,
    });

    const bucket = new S3Bucket(this, "s3bucket", {
      bucket: config.frontend.bucket,
      versioning: { enabled: true },
    });

    new S3BucketWebsiteConfiguration(this, "s3bucketwebsiteconfiguration", {
      bucket: bucket.id,
      indexDocument: {
        suffix: "index.html",
      },
      errorDocument: {
        key: "index.html",
      },
    });

    new CloudfrontDistribution(this, "cloudfrontdistribution", {
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
