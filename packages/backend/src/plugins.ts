import Anthropic from "@anthropic-ai/sdk";
import { Model } from "@chat-app/contracts";
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

const onEmptyPluginsMessage = "No plugins registered.";

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
  callback: {
    onEmptyPlugins: (message: typeof onEmptyPluginsMessage) => void;
    onError: (error: { _t: "apiKey" | "baseURL"; error: Error }) => void;
    onUnsupported: (message: string) => void;
  },
) {
  if (config.openai) {
    registerPlugin(
      "openai",
      (function () {
        const apiKey = config.openai.apiKey;
        if (!apiKey) {
          const error = new Error("Missing configuration: openai.apiKey");
          callback.onError({ _t: "apiKey", error });
          throw error;
        }
        if (config.openai.stream) {
          callback.onUnsupported("Streaming not supported for OpenAI API");
        }
        return {
          client: new OpenAI({ apiKey }),
          model: config.openai.model,
          stream: config.openai.stream,
        };
      })(),
    );
  }

  if (config.perplexity) {
    registerPlugin(
      "perplexity",
      (function () {
        const apiKey = config.perplexity.apiKey;
        if (!apiKey) {
          const error = new Error("Missing configuration: perplexity.apiKey");
          callback.onError({ _t: "apiKey", error });
          throw error;
        }
        if (!config.perplexity.baseURL) {
          const error = new Error("Missing configuration: perplexity.baseURL");
          callback.onError({ _t: "baseURL", error });
          throw error;
        }

        return {
          client: new OpenAI({ apiKey, baseURL: config.perplexity.baseURL }),
          model: config.perplexity.model,
          stream: config.perplexity.stream,
        };
      })(),
    );
  }

  if (config.anthropic) {
    registerPlugin(
      "anthropic",
      (function () {
        const apiKey = config.anthropic.apiKey;
        if (!apiKey) {
          const error = new Error("Missing configuration: anthropic.apiKey");
          callback.onError({ _t: "apiKey", error });
          throw error;
        }
        if (config.anthropic.stream) {
          callback.onUnsupported("Streaming not supported for Anthropic API");
        }

        return {
          client: new Anthropic({ apiKey }),
          stream: config.anthropic.stream,
          model: config.anthropic.model,
        };
      })(),
    );
  }

  if (plugins.length === 0) {
    callback.onEmptyPlugins(onEmptyPluginsMessage);
  }
}
