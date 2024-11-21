import { IamRole } from "@cdktf/provider-aws/lib/iam-role";
import { LambdaFunction } from "@cdktf/provider-aws/lib/lambda-function";
import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { Resource as NullResource } from "@cdktf/provider-null/lib/resource";
import { TerraformStack } from "cdktf";
import { Construct } from "constructs";
import path from "path";

import { Config } from "@/config";

export class BackendStack extends TerraformStack {
  constructor(scope: Construct, id: string, config: Config) {
    super(scope, id);

    new AwsProvider(this, "aws", {
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

    const buildLambdaFunction = new NullResource(
      this,
      "build_lambda_function",
      {
        triggers: {
          build_number: Date.now().toString(),
        },

        provisioners: [
          {
            type: "local-exec",
            command: `sam build && \
              mkdir -p ./dist && \
              zip -r ./dist/bundle.zip .aws-sam/build/sendMessage`,
          },
        ],
      },
    );

    const lambdaRole = new IamRole(this, "iam_for_lambda", {
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

    new LambdaFunction(this, "tf_lambda_func", {
      filename: path.resolve(__dirname, "../../../backend/dist/bundle.zip"),
      handler: "index.handler",
      runtime: "nodejs20",
      functionName: "sendMessage",
      role: lambdaRole.arn,
      dependsOn: [buildLambdaFunction],
    });

    new NullResource(
      this,
      "sam_metadata_aws_lambda_function_publish_book_review",
      {
        triggers: {
          resource_name: "aws_lambda_function.sendMessage",
          resource_type: "ZIP_LAMBDA_FUNCTION",
          original_source_code: path.join(__dirname, "../../../backend/src"),
          built_output_path: path.join(__dirname, "../../../backend/dist"),
        },
        dependsOn: [buildLambdaFunction],
      },
    );
  }
}
