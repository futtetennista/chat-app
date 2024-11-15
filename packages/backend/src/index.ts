import Anthropic from "@anthropic-ai/sdk";
import { ChatRequest, RFC9457ErrorResponse } from "@chat-app/contracts";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import * as D from "io-ts/Decoder";
import OpenAI from "openai";

import * as config from "@/config";
import * as plugins from "@/plugins";

function validateBody(
  x: string | null,
): E.Either<RFC9457ErrorResponse, ChatRequest> {
  if (!x) {
    const type = "tag:@chat-app:empty_request_body";
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

interface Logger {
  debug(message: string, data: string | Error): void;
  error(message: string, data: string | Error): void;
  warn(message: string, data: string | Error): void;
}

interface ChatService {
  readonly logger: Logger;

  chatTE: (
    data: ChatRequest,
  ) => TE.TaskEither<
    RFC9457ErrorResponse,
    { message: string; stopReason?: string }
  >;
}

export function mkService(logger: Logger): ChatService {
  function chatTE(
    data: ChatRequest,
  ): TE.TaskEither<
    RFC9457ErrorResponse,
    { message: string; stopReason?: string }
  > {
    switch (data.model) {
      case "anthropic": {
        return chatAnthropic(data, logger);
      }
      case "openai": {
        return chatOpenAI(data, logger);
      }
      case "perplexity": {
        return chatPerplexity(data, logger);
      }
      default: {
        const type = "tag:@chat-app:unsupported_model";
        logger.error(`Error type "${type}"`, data.model);
        return TE.left({
          type,
          status: "400",
          title: "Unsupported model",
          detail: "",
        });
      }
    }
  }

  plugins.registerPlugins(config.mkConfig());

  return {
    logger,
    chatTE,
  };
}

function chatPerplexity(
  data: ChatRequest,
  logger: Logger,
): TE.TaskEither<
  RFC9457ErrorResponse,
  { message: string; stopReason?: string }
> {
  return pipe(
    TE.fromOption(() => undefined)(plugins.getPlugin("perplexity")),
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
      (plugin) => chatOpenAI(data, logger, plugin),
    ),
  );
}

function chatOpenAI(
  data: ChatRequest,
  logger: Logger,
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
    TE.orElse(() =>
      TE.fromOption(() => undefined)(plugins.getPlugin("openai")),
    ),
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
  logger: Logger,
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
    TE.fromOption(() => undefined)(plugins.getPlugin("anthropic")),
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
