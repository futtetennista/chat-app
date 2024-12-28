import { DataAwsCallerIdentity } from "@cdktf/provider-aws/lib/data-aws-caller-identity";
import { IamOpenidConnectProvider } from "@cdktf/provider-aws/lib/iam-openid-connect-provider";
import { IamPolicy } from "@cdktf/provider-aws/lib/iam-policy";
import { IamRole } from "@cdktf/provider-aws/lib/iam-role";
import { IamRolePolicyAttachment } from "@cdktf/provider-aws/lib/iam-role-policy-attachment";
import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { LocalBackend, TerraformOutput, TerraformStack } from "cdktf";
import { Construct } from "constructs";
import * as path from "path";

export class TerraformRoleStack extends TerraformStack {
  private readonly oidcProviderURL = "token.actions.githubusercontent.com";

  constructor(
    scope: Construct,
    {
      accessKey,
      clientIdList = ["sts.amazonaws.com"],
      githubRepository,
      githubUsername,
      region,
      secretKey,
      thumbprintList = ["6938fd4d98bab03faadb97b34396831e3780aea1"],
    }: {
      accessKey: string;
      clientIdList?: string[];
      githubRepository: string;
      githubUsername: string;
      region: string;
      secretKey: string;
      thumbprintList?: string[];
    },
  ) {
    const id = "RoleStack";
    super(scope, id);

    new AwsProvider(this, "awsp", {
      region,
      // Use credentials of an admin user to create this stack
      accessKey,
      secretKey,
    });

    const arn = this.createGitHubOIDCProvider({
      clientIdList,
      thumbprintList,
    });

    const awsCallerIdentity = new DataAwsCallerIdentity(
      this,
      "awsCallerIdentity",
    );

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
        {
          Effect: "Allow",
          Principal: {
            AWS: `arn:aws:iam::${awsCallerIdentity.accountId}:user/${awsCallerIdentity.userId}`,
          },
          Action: "sts:AssumeRole",
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

    new TerraformOutput(this, "roleArn", {
      value: role.arn,
    });

    new LocalBackend(this, {
      path: path.join(__dirname, `../../../tfstate/${id}.tfstate`),
    });
  }

  // https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services#adding-the-identity-provider-to-aws
  createGitHubOIDCProvider({
    clientIdList,
    thumbprintList,
  }: {
    clientIdList: string[];
    thumbprintList: string[];
  }) {
    const oidcProvider = new IamOpenidConnectProvider(this, "iamoidcp", {
      url: `https://${this.oidcProviderURL}`,
      clientIdList,
      // GitHub's current thumbprint
      thumbprintList,
    });

    return oidcProvider.arn;
  }
}
