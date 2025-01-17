#!/usr/bin/env tsx

import { LogLevel } from "@aws-lambda-powertools/logger/types";
import { AnthropicModel, OpenAIModel } from "@chat-app/contracts";
import { Command } from "@commander-js/extra-typings";

import { Config } from "../src/config";

export default function (_cmd: Command) {
  return async function ({
    anthropicModel,
    localDev,
    openaiModel,
    stream = false,
  }: {
    anthropicModel: AnthropicModel[number];
    localDev?: boolean;
    openaiModel: OpenAIModel[number];
    stream?: boolean;
  }): Promise<void> {
    let config: Config;

    if (localDev) {
      // const envPath = path.resolve(__dirname, "../../../secret.env");
      // if (!fs.existsSync(envPath)) {
      //   return cmd.error(`File not found: ${envPath}`);
      // }

      config = createConfig({
        env: {
          OPENAI_API_KEY: process.env.OPENAI_API_KEY,
          ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
          PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY,
          PERPLEXITY_BASE_URL: process.env.PERPLEXITY_BASE_URL,
          LOG_LEVEL: process.env.LOG_LEVEL ?? "debug",
        },
        openaiModel,
        anthropicModel,
        stream,
      });
    }

    // if (missingVars.length > 0) {
    //   console.error(
    //     `\x1b[31mThe following environment variables are not set: ${missingVars.join(
    //       ", ",
    //     )}\x1b[0m`,
    //   );
    //   cmd.error(`Missing environment variables: ${missingVars.join(", ")}`);
    // }

    config = createConfig({
      env: process.env,
      openaiModel,
      anthropicModel,
      stream,
    });

    if (process.env.CI === "true") {
      const core = await import("@actions/core");
      core.setOutput("config", config);
      return;
    }

    console.log(JSON.stringify(config));
  };
}

function createConfig({
  env,
  openaiModel,
  anthropicModel,
  perplexityModel,
  stream,
}: {
  env: {
    LOG_LEVEL?: string;
    OPENAI_API_KEY?: string;
    ANTHROPIC_API_KEY?: string;
    PERPLEXITY_API_KEY?: string;
    PERPLEXITY_BASE_URL?: string;
  };
  openaiModel: OpenAIModel[number];
  anthropicModel: AnthropicModel[number];
  perplexityModel?: string;
  stream: boolean;
}): Config {
  const config: Config = {};

  if (env.LOG_LEVEL) {
    Object.assign(config, {
      logging: {
        level: env.LOG_LEVEL as LogLevel,
      },
    });
  }

  if (env.OPENAI_API_KEY) {
    Object.assign(config, {
      openai: {
        apiKey: env.OPENAI_API_KEY,
        model: openaiModel,
        stream,
      },
    });
  }

  if (env.ANTHROPIC_API_KEY) {
    Object.assign(config, {
      anthropic: {
        apiKey: env.ANTHROPIC_API_KEY,
        model: anthropicModel,
        stream,
      },
    });
  }

  if (env.PERPLEXITY_API_KEY) {
    Object.assign(config, {
      perplexity: {
        apiKey: env.PERPLEXITY_API_KEY,
        model: perplexityModel ?? "",
        baseURL: env.PERPLEXITY_BASE_URL ?? "",
        stream,
      },
    });
  }

  return config;
}
