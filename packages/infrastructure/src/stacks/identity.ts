import { CognitoIdentityPool } from "@cdktf/provider-aws/lib/cognito-identity-pool";
import { CognitoIdentityPoolRolesAttachment } from "@cdktf/provider-aws/lib/cognito-identity-pool-roles-attachment";
import { IamRole } from "@cdktf/provider-aws/lib/iam-role";
import { IamRolePolicy } from "@cdktf/provider-aws/lib/iam-role-policy";
import { TerraformStack } from "cdktf";
import { Construct } from "constructs";

export class IdentityStack extends TerraformStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const identityPool = new CognitoIdentityPool(this, "cip_guest", {
      identityPoolName: "guest",
      allowUnauthenticatedIdentities: true,
    });

    const guestRole = new IamRole(this, "iamr_guest", {
      name: "guest",
      assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: {
              Federated: "cognito-identity.amazonaws.com",
            },
            Action: "sts:AssumeRoleWithWebIdentity",
            Condition: {
              StringEquals: {
                "cognito-identity.amazonaws.com:aud": identityPool.id,
              },
              "ForAnyValue:StringLike": {
                "cognito-identity.amazonaws.com:amr": "unauthenticated",
              },
            },
          },
        ],
      }),
    });

    // new IamRolePolicy(this, "iamrp_guest", {
    //   name: "guest",
    //   role: guestRole.id,
    //   policy: JSON.stringify({
    //     Version: "2012-10-17",
    //     Statement: [
    //       {
    //         Effect: "Allow",
    //         Action: ["mobileanalytics:PutEvents", "cognito-sync:*"],
    //         Resource: ["*"],
    //       },
    //     ],
    //   }),
    // });

    new IamRolePolicy(this, "aimrp_lambda_invoke", {
      name: "lambda_invoke",
      role: guestRole.id,
      policy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Action: ["lambda:InvokeFunction"],
            Resource: ["*"],
          },
        ],
      }),
    });

    new CognitoIdentityPoolRolesAttachment(this, "cipra_guest", {
      identityPoolId: identityPool.id,
      roles: {
        unauthenticated: guestRole.arn,
      },
    });
  }
}
