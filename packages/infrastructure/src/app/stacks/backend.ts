import { Config as ConfigBase } from "@app/config";
import { Apigatewayv2Api } from "@cdktf/provider-aws/lib/apigatewayv2-api";
import { Cloudtrail } from "@cdktf/provider-aws/lib/cloudtrail";
import { IamRole } from "@cdktf/provider-aws/lib/iam-role";
import { IamRolePolicyAttachment } from "@cdktf/provider-aws/lib/iam-role-policy-attachment";
import { LambdaFunction } from "@cdktf/provider-aws/lib/lambda-function";
import { LambdaPermission } from "@cdktf/provider-aws/lib/lambda-permission";
import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { S3Bucket } from "@cdktf/provider-aws/lib/s3-bucket";
import { S3Object } from "@cdktf/provider-aws/lib/s3-object";
import {
  AssetType,
  TerraformAsset,
  TerraformOutput,
  TerraformStack,
} from "cdktf";
import { Construct } from "constructs";

export type Config = Omit<
  ConfigBase,
  "frontend" | "accessKey" | "secretKey"
> & {
  backend: Required<ConfigBase["backend"]>;
};

export class BackendStack extends TerraformStack {
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

    const asset = new TerraformAsset(this, "terraformasset_codearchive", {
      path: config.backend.codePath,
      type: AssetType.ARCHIVE,
    });

    const bucket = new S3Bucket(this, "s3bucket", {
      bucketPrefix: "chat-app-backend",
      serverSideEncryptionConfiguration: {
        rule: {
          applyServerSideEncryptionByDefault: {
            sseAlgorithm: "AES256",
          },
        },
      },
    });

    const lambdaArchive = new S3Object(this, "s3object", {
      bucket: bucket.bucket,
      key: `${config.backend.version}/${asset.fileName}`,
      source: asset.path,
    });

    const role = new IamRole(this, "iamrole_assumerole", {
      assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Action: "sts:AssumeRole",
            Principal: {
              Service: "lambda.amazonaws.com",
            },
            Effect: "Allow",
            Sid: "",
          },
        ],
      }),
    });

    new IamRolePolicyAttachment(this, "iamrolepolicyatttachment", {
      policyArn:
        "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
      role: role.name,
    });

    const lambdaFunction = new LambdaFunction(this, "lambdafunction", {
      functionName: config.backend.name,
      s3Bucket: bucket.bucket,
      s3Key: lambdaArchive.key,
      handler: config.backend.handler,
      runtime: config.backend.runtime,
      role: role.arn,
    });

    const apiGateway = new Apigatewayv2Api(this, "apigatewayv2api", {
      name: `${config.backend.name}-api-gateway`,
      protocolType: "HTTP",
      target: lambdaFunction.arn,
    });

    new LambdaPermission(this, "lambdapermission_invokefunction", {
      functionName: lambdaFunction.functionName,
      action: "lambda:InvokeFunction",
      principal: "apigateway.amazonaws.com",
      sourceArn: `${apiGateway.executionArn}/*/*`,
    });

    new Cloudtrail(this, "cloudtrail", {
      name: "chat-app-backend-trail",
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
            {
              type: "AWS::Lambda::Function",
              values: [
                `arn:aws:lambda:${config.region}:${config.accountId}:function:${config.backend.name}`,
              ],
            },
          ],
        },
      ],
    });

    new TerraformOutput(this, "endpoint_url", {
      value: apiGateway.apiEndpoint,
    });

    // const buildLambdaFunction = new NullResource(
    //   this,
    //   "build_lambda_function",
    //   {
    //     triggers: {
    //       build_number: Date.now().toString(),
    //     },

    //     provisioners: [
    //       {
    //         type: "local-exec",
    //         command: `sam build && \
    //           mkdir -p ./dist && \
    //           zip -r ./dist/bundle.zip .aws-sam/build/chat`,
    //       },
    //     ],
    //   },
    // );

    // const lambdaRole = new IamRole(this, "iam_for_lambda", {
    //   assumeRolePolicy: JSON.stringify({
    //     Version: "2012-10-17",
    //     Statement: [
    //       {
    //         Action: "sts:AssumeRole",
    //         Principal: {
    //           Service: "lambda.amazonaws.com",
    //         },
    //         Effect: "Allow",
    //         Sid: "",
    //       },
    //     ],
    //   }),
    // });

    // new LambdaFunction(this, "tf_lambda_func", {
    //   filename: path.resolve(__dirname, "../../../backend/dist/bundle.zip"),
    //   handler: "index.handler",
    //   runtime: "nodejs20",
    //   functionName: "chat",
    //   role: lambdaRole.arn,
    //   dependsOn: [buildLambdaFunction],
    // });

    // new NullResource(
    //   this,
    //   "sam_metadata_aws_lambda_function_publish_book_review",
    //   {
    //     triggers: {
    //       resource_name: "aws_lambda_function.chat",
    //       resource_type: "ZIP_LAMBDA_FUNCTION",
    //       original_source_code: path.join(__dirname, "../../../backend/src"),
    //       built_output_path: path.join(__dirname, "../../../backend/dist"),
    //     },
    //     dependsOn: [buildLambdaFunction],
    //   },
    // );
  }
}
