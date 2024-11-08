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
import * as TE from "fp-ts/TaskEither";
import * as C from "io-ts/Codec";
import * as D from "io-ts/Decoder";
import OpenAI from "openai";

const ConfigCodec = C.struct({
  openai: C.struct({
    apiKey: C.string,
    model: C.string,
    stream: C.literal("false"), // TODO: support streaming
  }),
  anthropic: C.struct({
    apiKey: C.string,
    model: C.string,
    stream: C.boolean,
  }),
  perplexity: C.struct({
    apiKey: C.string,
    model: C.string,
    baseURL: C.string,
    stream: C.boolean,
  }),
  logging: pipe(
    C.struct({
      enable: C.boolean,
    }),
    C.intersect(C.partial({ level: C.string }))
  ),
});

type Config = C.TypeOf<typeof ConfigCodec>;

const logger = new Logger();

const config: Config = (function () {
  const configRaw = process.env.CHAT_APP_CONFIG_JSON;
  if (!configRaw) {
    const error = new Error("CHAT_APP_CONFIG_JSON is not set");
    logger.error("Missing configuration error", error);
    throw error;
  }

  const result = ConfigCodec.decode(JSON.parse(configRaw));
  if (E.isLeft(result)) {
    logger.error("Invalid configuration error", D.draw(result.left));
    throw Error("Invalid configuration");
  }

  const config = result.right;
  if (config.logging.enable) {
    // This is 'false' by default.
    process.env.POWERTOOLS_LOGGER_LOG_EVENT = "true";
  }

  return config;
})();

const openai = (function () {
  const apiKey = config.openai.apiKey;
  if (!apiKey) {
    const error = new Error("Missing configuration: openai.apiKey");
    logger.error("Missing configuration error", error);
    throw error;
  }
  return new OpenAI({ apiKey });
})();

const perplexity = (function () {
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

  return new OpenAI({ apiKey, baseURL: config.perplexity.baseURL });
})();

const anthropic = (function () {
  const apiKey = config.anthropic.apiKey;
  if (!apiKey) {
    const error = new Error("Missing configuration: anthropic.apiKey");
    logger.error("Missing configuration error", error);
    throw error;
  }
  return new Anthropic({ apiKey });
})();

const commonHeaders = {
  "Content-Type": "application/json",
};

function validateBody(
  x: string | null
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
  data: ChatRequest
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
        detail: `Model "${data.model}" is not supported`,
      });
    }
  }
}

function chatPerplexity(
  data: ChatRequest
): TE.TaskEither<
  RFC9457ErrorResponse,
  { message: string; stopReason?: string }
> {
  return chatOpenAI(data, { client: perplexity });
}

function chatOpenAI(
  data: ChatRequest,
  { client }: { client: OpenAI } = { client: openai }
): TE.TaskEither<
  RFC9457ErrorResponse,
  { message: string; stopReason?: string }
> {
  return pipe(
    TE.tryCatch(
      () => {
        return client.chat.completions.create({
          model: config.openai.model,
          messages: [...data.history, { role: "user", content: data.message }],
          stream: Boolean(config.openai.stream),
        });
      },
      (e) => {
        const type = "tag:@chat-app:openai_error";
        logger.error(`Error type "${type}"`, e as Error);
        return {
          type,
          status: "500",
          title: "OpenAI error",
          detail: "message" in (e as any) ? (e as any).message : "",
        };
      }
    ),
    TE.tapIO((openaiResponse) => {
      logger.debug("OpenAI response", { openaiResponse });
      return TE.right(openaiResponse);
    }),
    TE.flatMap((openaiResponse) => {
      if (config.openai.stream) {
        return TE.right({
          message: "Streaming not implemented",
        });
      }

      const openaiNonStreamResponse =
        openaiResponse as OpenAI.Chat.Completions.ChatCompletion;
      if (
        !openaiNonStreamResponse.choices ||
        openaiNonStreamResponse.choices.length === 0 ||
        !openaiNonStreamResponse.choices[0].message.content
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

      return openaiNonStreamResponse.choices[0].finish_reason === "stop"
        ? TE.right({
            message: openaiNonStreamResponse.choices[0].message.content,
          })
        : TE.right({
            message: openaiNonStreamResponse.choices[0].message.content,
            stopReason: openaiNonStreamResponse.choices[0].finish_reason,
          });
    })
  );
}

function chatAnthropic(
  data: ChatRequest
): TE.TaskEither<
  RFC9457ErrorResponse,
  { message: string; stopReason?: string }
> {
  return pipe(
    TE.tryCatch(
      () =>
        anthropic.messages.create({
          max_tokens: 1024,
          messages: [...data.history, { role: "user", content: data.message }],
          model: config.anthropic.model,
        }),
      (e) => {
        if (e instanceof Anthropic.APIError) {
          const type = "tag:@chat-app:anthropic_api_error";
          logger.error(`Error type "${type}"`, e as Error);
          return {
            type,
            status: `${e.status}`,
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
      }
    ),
    TE.tapIO((message) => {
      logger.debug("Anthropic response", { message });
      return TE.right(message);
    }),
    TE.flatMap((message) => {
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
    })
  );
}

export const handler: Handler = async (
  event: APIGatewayEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  logger.addContext(context);
  logger.logEventIfEnabled(event);
  return pipe(
    TE.fromEither(validateBody(event.body)),
    TE.flatMap(chatTE),
    TE.match(
      (e) => {
        logger.error("Internal server error", e as any as Error);
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
      }
    )
  )();
};
