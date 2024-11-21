import { CloudfrontDistribution } from "@cdktf/provider-aws/lib/cloudfront-distribution";
import { S3Bucket } from "@cdktf/provider-aws/lib/s3-bucket";
import { S3BucketWebsiteConfiguration } from "@cdktf/provider-aws/lib/s3-bucket-website-configuration";
import { TerraformStack } from "cdktf";
import { Construct } from "constructs";

import { Config } from "@/config";

export class FrontendStack extends TerraformStack {
  static readonly s3BucketId = "s3b";

  constructor(scope: Construct, id: string, config: Config["frontend"]) {
    super(scope, id);

    const bucket = new S3Bucket(this, FrontendStack.s3BucketId, {
      bucket: config.bucket,
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
