import backendStatements from "@bootstrap/policies/policy_statements_backend.json";
import frontendStatements from "@bootstrap/policies/policy_statements_frontend.json";
import { IamGroup } from "@cdktf/provider-aws/lib/iam-group";
import { IamPolicy } from "@cdktf/provider-aws/lib/iam-policy";
import { IamUser } from "@cdktf/provider-aws/lib/iam-user";
import { IamUserGroupMembership } from "@cdktf/provider-aws/lib/iam-user-group-membership";
import { IamUserPolicyAttachment } from "@cdktf/provider-aws/lib/iam-user-policy-attachment";
import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { TerraformStack } from "cdktf";
import { Construct } from "constructs";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export class TerraformUserStack extends TerraformStack {
  constructor(
    scope: Construct,
    id: string,
    {
      region,
      accessKey,
      secretKey,
    }: {
      region: string;
      accessKey: string;
      secretKey: string;
    },
  ) {
    super(scope, id);

    new AwsProvider(this, "awsp", {
      accessKey,
      region,
      secretKey,
    });

    const policyName =
      process.env.POLICY_NAME?.toLowerCase() ?? "TerraformPolicy";

    const dir = fs.mkdtempSync(
      path.join(os.tmpdir(), "aws-terraform-boostrap"),
    );
    const policyPath = path.join(dir, `${policyName.toLowerCase()}.json`);

    const policyDocument = {
      Version: "2012-10-17",

      Statement: [...backendStatements, ...frontendStatements],
    };
    fs.writeFileSync(policyPath, JSON.stringify(policyDocument, null, 2));

    const policy = new IamPolicy(this, "iamp", {
      name: policyName,
      policy: JSON.stringify(policyDocument),
    });

    const userName = process.env.AWS_USERNAME ?? "TerraformUser";
    const groupName = process.env.AWS_GROUP_NAME ?? "TerraformGroup";

    const user = new IamUser(this, "aimu", {
      name: userName,
    });

    const group = new IamGroup(this, "iamg", {
      name: groupName,
    });

    new IamUserGroupMembership(this, "iamugm", {
      user: user.name,
      groups: [group.name],
    });

    new IamUserPolicyAttachment(this, "iamupa", {
      user: user.name,
      policyArn: policy.arn,
    });
  }
}
