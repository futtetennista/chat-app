#!/usr/bin/env tsx

import { LogLevel } from "@aws-lambda-powertools/logger/types";
import { AnthropicModel, OpenAIModel } from "@chat-app/contracts";
import { Command } from "@commander-js/extra-typings";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

import { Config } from "../src/config";

export default function (cmd: Command) {
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
      const envPath = path.resolve(__dirname, "../../../secret.env");
      if (fs.existsSync(envPath)) {
        const result = dotenv.config({ path: envPath });

        if (result.error) {
          cmd.error(`Error loading environment variables from ${envPath}`);
        }

        if (!result.parsed) {
          cmd.error("No environment variables loaded");
        }

        const config = createConfig({
          env: {
            ...result.parsed,
            LOG_LEVEL: process.env.LOG_LEVEL ?? "debug",
          },
          openaiModel,
          anthropicModel,
          stream,
        });

        console.log(JSON.stringify(config));
      } else {
        cmd.error(`File not found: ${envPath}`);
      }
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
