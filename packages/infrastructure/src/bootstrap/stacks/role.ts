import { IamOpenidConnectProvider } from "@cdktf/provider-aws/lib/iam-openid-connect-provider";
import { IamPolicy } from "@cdktf/provider-aws/lib/iam-policy";
import { IamRole } from "@cdktf/provider-aws/lib/iam-role";
import { IamRolePolicyAttachment } from "@cdktf/provider-aws/lib/iam-role-policy-attachment";
import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { TerraformStack } from "cdktf";
import { Construct } from "constructs";

export class TerraformRoleStack extends TerraformStack {
  private readonly oidcProviderURL = "token.actions.githubusercontent.com";

  constructor(
    scope: Construct,
    id: string,
    {
      region,
      accessKey,
      secretKey,
      githubRepository,
      githubUsername,
    }: {
      region: string;
      accessKey: string;
      secretKey: string;
      githubRepository: string;
      githubUsername: string;
    },
  ) {
    super(scope, id);

    new AwsProvider(this, "awsp", {
      region,
      // Use credentials of an admin user to create this stack
      accessKey,
      secretKey,
      // assumeRole: [
      //   {
      //     roleArn: config.roleArn,
      //     sessionName: `TerraformSession-${new Date().toISOString()}`,
      //   },
      // ],
    });

    const arn = this.createGitHubOIDCProvider();

    const trustPolicyJSON = {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: {
            Federated: arn,
          },
          Action: "sts:AssumeRoleWithWebIdentity",
          Condition: {
            StringEquals: {
              [`${this.oidcProviderURL}:sub`]: `repo:${githubUsername}/${githubRepository}:ref:refs/*`,
              [`${this.oidcProviderURL}:aud`]: "sts.amazonaws.com",
            },
          },
        },
      ],
    };

    const policy = new IamPolicy(this, "iamp", {
      name: "TrustPolicy",
      policy: JSON.stringify(trustPolicyJSON),
    });

    const role = new IamRole(this, "iamr", {
      name: process.env.AWS_IAM_ROLE_NAME ?? "GitHubActionsRole",
      assumeRolePolicy: JSON.stringify(trustPolicyJSON),
      description:
        "IAM role for GitHub Actions to deploy resources via Terraform",
    });

    new IamRolePolicyAttachment(this, "iamrpa", {
      role: role.name,
      policyArn: policy.arn,
    });
  }

  createGitHubOIDCProvider() {
    const oidcProvider = new IamOpenidConnectProvider(this, "iamoidcp", {
      url: this.oidcProviderURL,
      clientIdList: process.env.AWS_OIDC_GITHUB_CLIENT_ID_CSV
        ? process.env.AWS_OIDC_GITHUB_CLIENT_ID_CSV.split(",")
        : ["sts.amazonaws.com"],
      // GitHub's current thumbprint
      thumbprintList: process.env.AWS_OIDC_GITHUB_THUMBPRINT_CSV
        ? process.env.AWS_OIDC_GITHUB_THUMBPRINT_CSV.split(",")
        : ["6938fd4d98bab03faadb97b34396831e3780aea1"],
    });

    return oidcProvider.arn;
  }
}
