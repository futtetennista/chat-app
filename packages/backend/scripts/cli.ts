import { Argument, Command, Option } from "@commander-js/extra-typings";
import * as fs from "fs";
import * as path from "path";

import bundle from "./bundle";
import mkConfig, {
  AnthropicModels,
  anthropicModels,
  OpenAIModels,
  openAIModels,
} from "./mkConfig";

function main() {
  const cli = new Command();

  cli
    .command("bundle")
    .description("Bundle the lambda function")
    .addArgument(
      new Argument("<environment>").choices(["prod", "non-prod"] as const),
    )
    .action(bundle(cli));

  cli
    .command("config:create")
    .description("Create the config file.")
    .option("--local-dev", "Create config for local dev", false)
    .addOption(
      new Option(
        "--openai-model <name>",
        "OpenAI model (pick 'gpt-4o-mini' for a general-purpose, fast model)",
      )
        .choices<OpenAIModels>(openAIModels)
        .makeOptionMandatory(),
      // .default<OpenAIModels[number]>("gpt-4o-mini"),
    )
    // https://docs.anthropic.com/en/docs/about-claude/models#model-comparison-table
    .addOption(
      new Option(
        "--anthropic-model <name>",
        "Anthropic model (pick 'claude-3-haiku-latest' for a general-purpose, fast model)",
      )
        .choices<AnthropicModels>(anthropicModels)
        // .default<AnthropicModels[number]>("claude-3-haiku-latest"),
        .makeOptionMandatory(),
    )
    .option("--stream", "Use streaming API", false)
    .helpOption("-h, --help")
    .action(mkConfig(cli));

  const { version } = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "../package.json"), "utf-8"),
  ) as { version: string };

  cli
    .allowExcessArguments(false)
    .allowUnknownOption(false)
    .version(version)
    .parse();
}

main();
