import Anthropic from "@anthropic-ai/sdk";
import { Logger } from "@aws-lambda-powertools/logger";
import {
  ChatRequest,
  RFC9457ErrorResponse,
  SuccessResponse,
} from "@contracts/index";
import {
  APIGatewayEvent,
  APIGatewayProxyResult,
  Context,
  Handler,
} from "aws-lambda";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import * as D from "io-ts/Decoder";
import OpenAI from "openai";

const ConfigD = D.partial({
  openai: D.struct({
    apiKey: D.string,
    model: D.string,
    stream: D.boolean,
  }),
  anthropic: D.struct({
    apiKey: D.string,
    model: D.string,
    stream: D.boolean,
  }),
  perplexity: D.struct({
    apiKey: D.string,
    model: D.string,
    baseURL: D.string,
    stream: D.boolean,
  }),
  logging: pipe(
    D.struct({
      enable: D.boolean,
    }),
    D.intersect(D.partial({ level: D.string })),
  ),
});

type Config = D.TypeOf<typeof ConfigD>;

// https://docs.powertools.aws.dev/lambda/typescript/latest/core/logger
const logger = new Logger();

const config: Config = (function (): Config {
  return pipe(
    E.fromNullable(new Error("CHAT_APP_CONFIG_JSON is not set"))(
      process.env.CHAT_APP_CONFIG_JSON,
    ),
    E.flatMap((configRaw) => {
      return E.tryCatch(
        () => JSON.parse(configRaw) as Config,
        (e: unknown) => {
          return e as Error;
        },
      );
    }),
    E.flatMap(ConfigD.decode),
    E.tap((config) => {
      if (config.logging?.enable) {
        // This is 'false' by default.
        process.env.POWERTOOLS_LOGGER_LOG_EVENT = "true";
      }
      return E.of(config);
    }),
    E.match(
      (e) => {
        if (e instanceof Error) {
          logger.error(e.message, e);
          throw e;
        }

        logger.error("Failed to decode JSON configuration", D.draw(e));
        throw new Error("Failed to decode JSON configuration");
      },
      (config) => config,
    ),
  );
})();

interface Plugin<
  T = { client: Anthropic | OpenAI; model: string; stream: boolean },
> {
  name: string;
  instance: T;
}

const plugins: Plugin[] = [];

function registerPlugin(
  name: string,
  instance: { client: Anthropic | OpenAI; model: string; stream: boolean },
) {
  plugins.push({ name, instance });
}

type InferVendor<Name extends string> = Name extends "anthropic"
  ? Anthropic
  : Name extends "openai"
  ? OpenAI
  : Name extends "perplexity"
  ? OpenAI
  : never;

function getPlugin<Name extends string>(
  name: Name,
): O.Option<{
  client: InferVendor<Name>;
  model: string;
  stream: boolean;
}> {
  return pipe(
    O.fromNullable(plugins.find((plugin) => plugin.name === name)),
    O.map((plugin) => {
      return plugin.instance as {
        client: InferVendor<Name>;
        stream: boolean;
        model: string;
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

if (config.openai) {
  registerPlugin(
    "openai",
    (function () {
      const apiKey = config.openai.apiKey;
      if (!apiKey) {
        const error = new Error("Missing configuration: openai.apiKey");
        logger.error("Missing configuration error", error);
        throw error;
      }
      if (config.openai.stream) {
        logger.warn("Streaming not supported for OpenAI API");
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
        logger.error("Missing configuration error", error);
        throw error;
      }
      if (!config.perplexity.baseURL) {
        const error = new Error("Missing configuration: perplexity.baseURL");
        logger.error("Missing configuration error", error);
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
        logger.error("Missing configuration error", error);
        throw error;
      }
      if (config.anthropic.stream) {
        logger.warn("Streaming not supported for Anthropic API");
      }

      return {
        client: new Anthropic({ apiKey }),
        stream: config.anthropic.stream,
        model: config.anthropic.model,
      };
    })(),
  );
}

const commonHeaders = {
  "Content-Type": "application/json",
};

function validateBody(
  x: string | null,
): E.Either<RFC9457ErrorResponse, ChatRequest> {
  if (!x) {
    const type = "tag:@chat-app:empty_request_body";
    logger.error(`Error type ${type}`);
    return E.left({
      type,
      status: "400",
      title: "Invalid request body",
      detail: "Request body is empty",
    });
  }

  try {
    const validationResult = ChatRequest.decode(JSON.parse(x));
    if (E.isLeft(validationResult)) {
      const type = "tag:@chat-app:invalid_request_format";
      logger.error(`Error type ${type}`, {
        data: D.draw(validationResult.left),
      });
      return E.left({
        type,
        status: "400",
        detail: D.draw(validationResult.left),
        title: "Invalid request format",
      });
    }
    logger.debug("Request body", { data: validationResult.right });
    return E.right(validationResult.right);
  } catch (e) {
    const type = "tag:@chat-app:invalid_json";
    logger.error(`Error type "${type}"`, e as Error);
    return E.left({
      type,
      status: "400",
      title: "Invalid JSON in request body",
      detail: "",
    });
  }
}

function chatTE(
  data: ChatRequest,
): TE.TaskEither<
  RFC9457ErrorResponse,
  { message: string; stopReason?: string }
> {
  switch (data.model) {
    case "anthropic": {
      return chatAnthropic(data);
    }
    case "openai": {
      return chatOpenAI(data);
    }
    case "perplexity": {
      return chatPerplexity(data);
    }
    default: {
      const type = "tag:@chat-app:unsupported_model";
      logger.error(`Error type "${type}"`, { model: data.model });
      return TE.left({
        type,
        status: "400",
        title: "Unsupported model",
        detail: "",
        // detail: `Model "${data.model}" is not supported`,
      });
    }
  }
}

function chatPerplexity(
  data: ChatRequest,
): TE.TaskEither<
  RFC9457ErrorResponse,
  { message: string; stopReason?: string }
> {
  return pipe(
    TE.fromOption(() => undefined)(getPlugin("perplexity")),
    TE.matchE(
      () => {
        const type = "tag:@chat-app:perplexity_not_configured";
        logger.error(`Error type "${type}"`);
        return TE.left({
          type,
          status: "501",
          title: "Perplexity not configured",
          detail: "",
        });
      },
      (plugin) => chatOpenAI(data, plugin),
    ),
  );
}

function chatOpenAI(
  data: ChatRequest,
  plugin?: { client: OpenAI; model: string; stream: boolean },
): TE.TaskEither<
  RFC9457ErrorResponse,
  { message: string; stopReason?: string }
> {
  function _chatOpenAI({
    client,
    model,
    stream,
  }: {
    client: OpenAI;
    model: string;
    stream: boolean;
  }): TE.TaskEither<
    RFC9457ErrorResponse,
    { message: string; stopReason?: string }
  > {
    return pipe(
      TE.tryCatch(
        () => {
          return client.chat.completions.create({
            model,
            messages: [
              ...data.history,
              { role: "user", content: data.message },
            ],
            stream,
          });
        },
        (e) => {
          const type = "tag:@chat-app:openai_error";
          logger.error(`Error type "${type}"`, e as Error);
          return {
            type,
            status: "500",
            title: "OpenAI error",
            detail:
              typeof e === "object" && e !== null && "message" in e
                ? (e as { message: string }).message
                : "",
          };
        },
      ),
      TE.tapIO((openaiResponse) => {
        logger.debug("OpenAI response", { openaiResponse });
        return TE.right(openaiResponse);
      }),
      TE.flatMap((openaiResponse) => {
        if (stream) {
          return TE.right({
            message: "Streaming not implemented",
          });
        }

        const response =
          openaiResponse as OpenAI.Chat.Completions.ChatCompletion;
        if (
          response.choices.length === 0 ||
          !response.choices[0].message.content
        ) {
          const type = "tag:@chat-app:invalid_openai_response";
          logger.error(`Error type "${type}"`, { openaiResponse });
          return TE.left({
            type,
            title: "Invalid response from OpenAI",
            status: "500",
            detail: `OpenAI response: ${JSON.stringify(openaiResponse)}`,
          });
        }

        return response.choices[0].finish_reason === "stop"
          ? TE.right({
              message: response.choices[0].message.content,
            })
          : TE.right({
              message: response.choices[0].message.content,
              stopReason: response.choices[0].finish_reason,
            });
      }),
    );
  }

  return pipe(
    TE.fromNullable(undefined)(plugin),
    TE.orElse(() => TE.fromOption(() => undefined)(getPlugin("openai"))),
    TE.matchE(() => {
      const type = "tag:@chat-app:openai_not_configured";
      logger.error(`Error type "${type}"`);
      return TE.left({
        type,
        status: "501",
        title: "OpenAI not configured",
        detail: "",
      });
    }, _chatOpenAI),
  );
}

function chatAnthropic(
  data: ChatRequest,
): TE.TaskEither<
  RFC9457ErrorResponse,
  { message: string; stopReason?: string }
> {
  function _chatAnthropic({
    client,
    model,
    stream,
  }: {
    client: Anthropic;
    model: string;
    stream: boolean;
  }): TE.TaskEither<
    RFC9457ErrorResponse,
    { message: string; stopReason?: string }
  > {
    return pipe(
      TE.tryCatch(
        () =>
          client.messages.create({
            max_tokens: 1024,
            messages: [
              ...data.history,
              { role: "user", content: data.message },
            ],
            model,
            stream,
          }),
        (e) => {
          if (e instanceof Anthropic.APIError) {
            const type = "tag:@chat-app:anthropic_api_error";
            logger.error(`Error type "${type}"`, e as Error);
            return {
              type,
              status: e.status?.toString() ?? "500",
              title: `Anthropic API error: ${e.name}`,
              detail: e.message,
            };
          } else {
            const type = "tag:@chat-app:anthropic_other_error";
            logger.error(`Error type "${type}"`, e as Error);
            return {
              type,
              status: "400",
              title: `Anthropic API uncaught error`,
              detail: "", // e.message,
            };
          }
        },
      ),
      TE.tapIO((message) => {
        logger.debug("Anthropic response", { message });
        return TE.right(message);
      }),
      TE.flatMap((message) => {
        if (!("id" in message)) {
          const type = "tag:@chat-app:anthropic_streaming_not_supported_error";
          logger.error(`Error type "${type}"`);
          return TE.left({
            type,
            status: "501",
            title: `Anthropic API uncaught error`,
            detail: "", // e.message,
          });
        }

        return message.stop_reason === "end_turn"
          ? TE.right({
              message: message.content
                .map((m) => (m.type === "text" ? m.text : ""))
                .join("\n"),
            })
          : TE.right({
              message: message.content
                .map((m) => (m.type === "text" ? m.text : ""))
                .join("\n"),
              stopReason: message.stop_reason,
            });
      }),
    );
  }

  return pipe(
    TE.fromOption(() => undefined)(getPlugin("anthropic")),
    TE.matchE(() => {
      const type = "tag:@chat-app:anthropic_not_configured";
      logger.error(`Error type "${type}"`);
      return TE.left({
        type,
        status: "501",
        title: "Anthropic not configured",
        detail: "",
      });
    }, _chatAnthropic),
  );
}

export const handler: Handler = async (
  event: APIGatewayEvent,
  context: Context,
): Promise<APIGatewayProxyResult> => {
  logger.addContext(context);
  logger.logEventIfEnabled(event);

  if (
    process.env.NODE_ENV !== "production" &&
    process.env.USE_MOCKS === "true"
  ) {
    const { setupServer } = await import("msw/node");
    const { internal: handlers } = await import("@mocks/index.js");
    const server = setupServer(...handlers);
    server.listen();
  }

  return pipe(
    TE.fromEither(validateBody(event.body)),
    TE.flatMap(chatTE),
    TE.match(
      (e) => {
        logger.error(
          "Internal server error",
          e instanceof Error ? e : JSON.stringify(e),
        );
        return {
          statusCode: 500,
          headers: commonHeaders,
          body: RFC9457ErrorResponse.encode(e),
          // body: RFC9457ErrorResponse.encode({
          //   type: "tag:@chat-app:internal_error",
          //   status: "500",
          //   title: "Internal server error",
          //   detail: `An unexpected error occurred: ${e}`,
          // }),
        };
      },
      (response) => {
        logger.info("Response", { response });
        return {
          statusCode: 200,
          headers: commonHeaders,
          body: SuccessResponse.encode(response),
        };
      },
    ),
  )();
};
