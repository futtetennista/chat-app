import Anthropic from "@anthropic-ai/sdk";
import {
  errorTypesMap as errorType,
  Model,
  RFC9457ErrorResponse,
} from "@chat-app/contracts";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/Option";
import OpenAI from "openai";

import { Config } from "@/config";

interface Plugin<
  T = { client: Anthropic | OpenAI; model: string; stream: boolean },
> {
  name: string;
  instance: T;
}

const plugins: Plugin[] = [];

type InferVendor<Name extends string> = Name extends "anthropic"
  ? Anthropic
  : Name extends "openai"
    ? OpenAI
    : Name extends "perplexity"
      ? OpenAI
      : never;

/**
 * Retrieves a plugin by its name.
 *
 * @template Name - The type of the plugin name.
 * @param name - The name of the plugin to retrieve.
 * @returns An option containing the plugin details if found, otherwise none.
 *
 * The returned plugin details include:
 * - `client`: The client instance of the plugin.
 * - `model`: The model associated with the plugin.
 * - `stream`: A boolean indicating if streaming is enabled for the plugin.
 */
export function getPlugin<Name extends string>(
  name: Name,
): O.Option<{
  client: InferVendor<Name>;
  model: Model;
  stream: boolean;
}> {
  return pipe(
    O.fromNullable(plugins.find((plugin) => plugin.name === name)),
    O.map((plugin) => {
      return plugin.instance as {
        client: InferVendor<Name>;
        stream: boolean;
        model: Model;
      };
    }),
    // O.tap((plugin) => {
    //   if (plugin) {
    //     logger.error(`Plugin for '${name}' not found error`);
    //   }
    //   return O.of(plugin);
    // }),
  );
}

function registerPlugin(
  name: string,
  instance: { client: Anthropic | OpenAI; model: Model; stream: boolean },
) {
  plugins.push({ name, instance });
}

function mkOpenAIPlugin(
  config: Exclude<Config["openai"], undefined>,
): E.Either<
  RFC9457ErrorResponse,
  { client: OpenAI; model: Model; stream: boolean }
> {
  const apiKey = config.apiKey;
  if (!apiKey) {
    return E.left({
      detail: "",
      status: "500",
      title: "Missing configuration: openai.apiKey",
      type: errorType.pluginConfigurationApiKeyMissingError,
    });
  }
  if (config.stream) {
    return E.left({
      detail: "",
      status: "500",
      title: "Streaming not supported for OpenAI API",
      type: errorType.pluginConfigurationStreamUnsupportedError,
    });
  }

  return E.of({
    client: new OpenAI({ apiKey }),
    model: config.model,
    stream: config.stream,
  });
}

function mkPerplexityPlugin(
  config: Exclude<Config["perplexity"], undefined>,
): E.Either<
  RFC9457ErrorResponse,
  { client: OpenAI; model: Model; stream: boolean }
> {
  const apiKey = config.apiKey;
  if (!apiKey) {
    return E.left({
      detail: "",
      status: "500",
      title: "Missing configuration: perplexity.apiKey",
      type: errorType.pluginConfigurationApiKeyMissingError,
    });
  }
  if (!config.baseURL) {
    return E.left({
      detail: "",
      status: "500",
      title: "Missing configuration: perplexity.baseURL",
      type: errorType.pluginConfigurationBaseUrlMissingError,
    });
  }

  return E.of({
    client: new OpenAI({ apiKey, baseURL: config.baseURL }),
    model: config.model,
    stream: config.stream,
  });
}

function mkAnthropicPlugin(
  config: Exclude<Config["anthropic"], undefined>,
): E.Either<
  RFC9457ErrorResponse,
  { client: Anthropic; model: Model; stream: boolean }
> {
  const apiKey = config.apiKey;
  if (!apiKey) {
    return E.left({
      detail: "",
      status: "500",
      title: "Missing configuration: anthropic.apiKey",
      type: errorType.pluginConfigurationApiKeyMissingError,
    });
  }
  if (config.stream) {
    return E.left({
      detail: "",
      status: "500",
      title: "Streaming not supported for Anthropic API",
      type: errorType.pluginConfigurationStreamUnsupportedError,
    });
  }

  return E.of({
    client: new Anthropic({ apiKey }),
    stream: config.stream,
    model: config.model,
  });
}

/**
 * Registers plugins based on the provided configuration.
 *
 * @param {Config} config - The configuration object containing API keys and settings for various plugins.
 * @param {Object} [callback] - Optional callbacks for handling errors and unsupported features.
 *
 * @throws {Error} Throws an error if the required API key or other configuration is missing for any plugin.
 *
 * The function supports the following plugins:
 * - OpenAI: Requires `config.openai.apiKey`. Logs a warning if streaming is enabled as it is not supported.
 * - Perplexity: Requires `config.perplexity.apiKey` and `config.perplexity.baseURL`.
 * - Anthropic: Requires `config.anthropic.apiKey`. Logs a warning if streaming is enabled as it is not supported.
 */
export function registerPlugins(
  config: Config,
): E.Either<RFC9457ErrorResponse, unknown> {
  return pipe(
    E.of(config),
    E.bind("openAIPlugin", (config) => {
      if (config.openai) {
        return mkOpenAIPlugin(config.openai);
      }
      return E.of(undefined);
    }),
    E.bind("perplexityPlugin", (config) => {
      if (config.perplexity) {
        return mkPerplexityPlugin(config.perplexity);
      }
      return E.of(undefined);
    }),
    E.bind("anthropicPlugin", (config) => {
      if (config.anthropic) {
        return mkAnthropicPlugin(config.anthropic);
      }
      return E.of(undefined);
    }),
    E.tap(({ openAIPlugin, perplexityPlugin, anthropicPlugin }) => {
      if (openAIPlugin) {
        registerPlugin("openai", openAIPlugin);
      }
      if (perplexityPlugin) {
        registerPlugin("openai", perplexityPlugin);
      }
      if (anthropicPlugin) {
        registerPlugin("anthropic", anthropicPlugin);
      }
      return E.of(undefined);
    }),
    E.match(
      (e) => E.left(e),
      () => {
        return plugins.length === 0
          ? E.left({
              detail: "",
              status: "500",
              title: "No plugins registered",
              type: errorType.emptyPluginsError,
            })
          : E.of(undefined);
      },
    ),
  );
}
