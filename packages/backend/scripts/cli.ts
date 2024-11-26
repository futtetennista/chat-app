import { Argument, Command, Option } from "@commander-js/extra-typings";

import bundle from "./bundle";
import mkConfigFromEnv, { AnthropicModel, OpenAIModel } from "./mkConfig";

async function main() {
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
    .option<"--local-dev", boolean>("--local-dev", "Output file")
    .addOption(
      new Option("--openai-model <name>")
        .choices<OpenAIModel[]>([
          "gpt-4o",
          "gpt-4o-mini",
          "o1-preview",
          "o1-mini",
        ])
        .default("gpt-4o-mini"),
    )
    // https://docs.anthropic.com/en/docs/about-claude/models#model-comparison-table
    .addOption(
      new Option("--anthropic-model <name>")
        .choices<AnthropicModel[]>([
          "claude-3-opus-latest",
          "claude-3-sonnet-latest",
          "claude-3-haiku-latest",
          "claude-3-5-sonnet-latest",
          "claude-3-5-haiku-latest",
        ])
        .default("claude-3-sonnet-latest"),
    )
    .option("--stream", "Use streaming API", false)
    .helpOption("-h, --help")
    .action(({ anthropicModel, openaiModel, ...rest }) => {
      return mkConfigFromEnv(cli)({
        ...rest,
        anthropicModel: anthropicModel as AnthropicModel,
        openaiModel: openaiModel as OpenAIModel,
      });
    });

  const {
    default: { version },
  } = await import("../package.json");

  cli
    .allowExcessArguments(false)
    .allowUnknownOption(false)
    .version(version)
    .parse();
}

void main();
