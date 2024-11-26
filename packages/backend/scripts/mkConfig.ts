#!/usr/bin/env tsx

import { LogLevel } from "@aws-lambda-powertools/logger/types";
import { Command } from "@commander-js/extra-typings";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

import { Config } from "../src/config";

export type AnthropicModel =
  | "claude-3-opus-latest"
  | "claude-3-sonnet-latest"
  | "claude-3-haiku-latest"
  | "claude-3-5-sonnet-latest"
  | "claude-3-5-haiku-latest";

export type OpenAIModel = "gpt-4o" | "gpt-4o-mini" | "o1-preview" | "o1-mini";

export default function (cmd: Command) {
  return async function ({
    localDev,
    openaiModel,
    anthropicModel,
    stream,
  }: {
    localDev: boolean;
    openaiModel: OpenAIModel;
    anthropicModel: AnthropicModel;
    stream: boolean;
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
          env: result.parsed,
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
  openaiModel: OpenAIModel;
  anthropicModel: AnthropicModel;
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
