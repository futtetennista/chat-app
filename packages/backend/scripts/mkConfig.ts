#!/usr/bin/env tsx

import { LogLevel } from "@aws-lambda-powertools/logger/types";
import { AnthropicModel, OpenAIModel } from "@chat-app/contracts";
import { Command } from "@commander-js/extra-typings";

import { Config } from "../src/config";

export default function (_cmd: Command) {
  return async function ({
    localDev,
    openaiModel,
    anthropicModel,
    stream = false,
  }: {
    localDev?: boolean;
    openaiModel: OpenAIModel[number];
    anthropicModel: AnthropicModel[number];
    stream?: boolean;
  }): Promise<void> {
    if (localDev) {
      // const envPath = path.resolve(__dirname, "../../../secret.env");
      // if (!fs.existsSync(envPath)) {
      //   return cmd.error(`File not found: ${envPath}`);
      // }

      const config = createConfig({
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

      console.log(JSON.stringify(config));
    }

    // if (missingVars.length > 0) {
    //   console.error(
    //     `\x1b[31mThe following environment variables are not set: ${missingVars.join(
    //       ", ",
    //     )}\x1b[0m`,
    //   );
    //   cmd.error(`Missing environment variables: ${missingVars.join(", ")}`);
    // }

    const config = createConfig({
      env: process.env,
      openaiModel,
      anthropicModel,
      stream,
    });

    if (process.env.CI === "true") {
      const core = await import("@actions/core");
      core.setOutput("config", config);
    }
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
