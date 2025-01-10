import { Config as ConfigBase } from "@app/config";
import { CloudfrontDistribution } from "@cdktf/provider-aws/lib/cloudfront-distribution";
import { Cloudtrail } from "@cdktf/provider-aws/lib/cloudtrail";
import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { S3Bucket } from "@cdktf/provider-aws/lib/s3-bucket";
import { S3BucketWebsiteConfiguration } from "@cdktf/provider-aws/lib/s3-bucket-website-configuration";
import { TerraformOutput, TerraformStack } from "cdktf";
import { Construct } from "constructs";

export type Config = Omit<ConfigBase, "backend" | "accessKey" | "secretKey">;

export class FrontendStack extends TerraformStack {
  static readonly s3BucketId = "s3bucket";

  constructor(scope: Construct, id: string, config: Config) {
    super(scope, id);

    new AwsProvider(this, "awsprovider", {
      region: config.region,
      // accessKey: config.accessKey,
      // secretKey: config.secretKey,
      assumeRole: [
        {
          roleArn: config.roleArn,
          sessionName: `TerraformSession-${new Date().toISOString()}`,
        },
      ],
    });

    const bucket = new S3Bucket(this, FrontendStack.s3BucketId, {
      bucketPrefix: "chat-app-frontend",
      serverSideEncryptionConfiguration: {
        rule: {
          applyServerSideEncryptionByDefault: {
            sseAlgorithm: "AES256",
          },
        },
      },
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

    const cfd = new CloudfrontDistribution(this, "cloudfrontdistribution", {
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

    new Cloudtrail(this, "cloudtrail", {
      name: "chat-app-frontend-trail",
      s3BucketName: bucket.id,
      // includeGlobalServiceEvents: true,
      isMultiRegionTrail: false,
      enableLogFileValidation: true,
      enableLogging: true,
      eventSelector: [
        {
          readWriteType: "All",
          includeManagementEvents: true,
          dataResource: [
            {
              type: "AWS::S3::Object",
              values: [`arn:aws:s3:::${bucket.bucket}/`],
            },
          ],
        },
      ],
    });

    new TerraformOutput(this, "distribution_id", {
      value: cfd.id,
    });
  }
}
