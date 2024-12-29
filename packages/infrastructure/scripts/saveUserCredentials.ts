import sdk from "@1password/sdk";
import * as fs from "fs";
import * as path from "path";

export default async function saveUserCredentials({
  accessKeyId,
  secretAccessKey,
}: {
  accessKeyId: string;
  secretAccessKey: string;
}): Promise<void> {
  if (!process.env.OP_SERVICE_ACCOUNT_TOKEN) {
    throw new Error("OP_SERVICE_ACCOUNT_TOKEN is required");
  }

  const client = await sdk.createClient({
    auth: process.env.OP_SERVICE_ACCOUNT_TOKEN,
    integrationName: "ChatApp 1Password Client",
    integrationVersion: "v1.0.0",
  });
  void client.items.create({
    vaultId: "chat-app",
    title: "aws-user",
    category: sdk.ItemCategory.Login,
    fields: [
      {
        fieldType: sdk.ItemFieldType.Text,
        id: "access-key-id",
        title: "access-key-id",
        value: accessKeyId,
      },
      {
        fieldType: sdk.ItemFieldType.Text,
        id: "secret-access-key",
        title: "secret-access-key",
        value: secretAccessKey,
      },
    ],
  });

  fs.writeFileSync(
    path.join(__dirname, "../../../.app.env"),
    `AWS_ACCESS_KEY_ID = op://chat-app/aws-user/access-key-id
AWS_SECRET_ACCESS_KEY = op://chat-app/aws-user/secret-access-key
`,
    "utf8",
  );
}
