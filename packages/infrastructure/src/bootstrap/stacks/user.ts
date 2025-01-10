import backendStatements from "@bootstrap/policies/policy_statements_backend.json";
import frontendStatements from "@bootstrap/policies/policy_statements_frontend.json";
import { IamGroup } from "@cdktf/provider-aws/lib/iam-group";
import { IamPolicy } from "@cdktf/provider-aws/lib/iam-policy";
import { IamUser } from "@cdktf/provider-aws/lib/iam-user";
import { IamUserGroupMembership } from "@cdktf/provider-aws/lib/iam-user-group-membership";
import { IamUserPolicyAttachment } from "@cdktf/provider-aws/lib/iam-user-policy-attachment";
import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { LocalBackend, TerraformOutput, TerraformStack } from "cdktf";
import { Construct } from "constructs";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export class TerraformUserStack extends TerraformStack {
  constructor(
    scope: Construct,
    {
      accessKey,
      groupName = "TerraformGroup",
      policyName = "TerraformPolicy",
      region,
      secretKey,
      userName = "TerraformUser",
    }: {
      accessKey: string;
      groupName?: string;
      policyName?: string;
      region: string;
      secretKey: string;
      userName?: string;
    },
  ) {
    const id = "UserStack";
    super(scope, id);

    new AwsProvider(this, "awsp", {
      accessKey,
      region,
      secretKey,
    });

    const dir = fs.mkdtempSync(
      path.join(os.tmpdir(), "aws-terraform-boostrap"),
    );
    const policyPath = path.join(dir, `${policyName.toLowerCase()}.json`);

    const policyDocument = {
      Version: "2012-10-17",

      Statement: [...backendStatements, ...frontendStatements],
    };
    fs.writeFileSync(policyPath, JSON.stringify(policyDocument, null, 2));

    const policy = new IamPolicy(this, "iamPolicy", {
      name: policyName,
      policy: JSON.stringify(policyDocument),
    });

    const user = new IamUser(this, "aimUser", {
      name: userName,
    });

    const group = new IamGroup(this, "iamGroup", {
      name: groupName,
    });

    new IamUserGroupMembership(this, "iamUserGroupMemebership", {
      user: user.name,
      groups: [group.name],
    });

    new IamUserPolicyAttachment(this, "iamUserPolicyAttachment", {
      user: user.name,
      policyArn: policy.arn,
    });

    new TerraformOutput(this, "userArn", {
      value: user.arn,
    });

    // TODO: create the access key in a separate script to be able to save it in 1Password
    // const userAccessKey = new IamAccessKey(this, "accessKey", {
    //   user: user.name,
    // });

    // new TerraformOutput(this, "accessKeyId", {
    //   value: userAccessKey.id,
    // });

    // new TerraformOutput(this, "secretAccessKey", {
    //   value: userAccessKey.secret,
    //   sensitive: true,
    // });

    new LocalBackend(this, {
      path: path.join(__dirname, `../../../tfstate/${id}.tfstate`),
    });
  }
}
