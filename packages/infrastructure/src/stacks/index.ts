import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { TerraformStack } from "cdktf";
import { Construct } from "constructs";

import { Config } from "@/config";
import { BackendStack } from "@/stacks/backend";
import { FrontendStack } from "@/stacks/frontend";
import { IdentityStack } from "@/stacks/identity";

export class AppStack extends TerraformStack {
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
    new IdentityStack(this, "identity");
    new FrontendStack(this, "frontend", config.frontend);
    new BackendStack(this, "backend", config.backend);
  }
}
