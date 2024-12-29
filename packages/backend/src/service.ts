import Anthropic from "@anthropic-ai/sdk";
import {
  ChatRequest,
  defaultModel,
  errorTypesMap as errorType,
  Model,
  modelMap,
  models,
  RFC9457ErrorResponse,
  SuccessResponse,
} from "@chat-app/contracts";
import * as E from "fp-ts/Either";
import * as IO from "fp-ts/IO";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import * as D from "io-ts/Decoder";
import OpenAI from "openai";

import { Config } from "@/config";
import * as plugins from "@/plugins";

interface ChatCallback {
  onError: (
    arg:
      | { _t: "unsupported"; message: string }
      | { _t: "network"; data: unknown }
      | { _t: "api"; data: Error | string },
  ) => void;
  onMissingConfig: (x: "openai" | "anthropic" | "perplexity") => void;
  afterResponse: (response: unknown) => void;
  beforeRequest?: (service: Model, request: ChatRequest) => void;
}

interface ChatService {
  validateBody: (
    x: string | null,
    callback?: {
      onValid?: (data: ChatRequest) => void;
      onInvalid?: (
        arg:
          | { _t: "decode"; error: D.DecodeError }
          | { _t: "empty_body"; message: string }
          | { _t: "unknown"; error: unknown }
          | {
              _t: "unsupported_model";
              message: string;
            },
      ) => void;
    },
  ) => E.Either<RFC9457ErrorResponse, ChatRequest>;

  chatTE: (
    data: ChatRequest,
    headers: Record<string, string | undefined>,
    callback?: ChatCallback,
  ) => TE.TaskEither<RFC9457ErrorResponse, SuccessResponse>;
}

/**
 * Instantiates a new ChatService.
 *
 * This function registers plugins using the supplied configuration.
 *
 * @returns {ChatService} The ChatService instance.
 */
export function mkService(
  config: Config,
  // { callback: _ }: { callback: Parameters<typeof plugins.registerPlugins>[1] },
): E.Either<RFC9457ErrorResponse, ChatService> {
  return pipe(
    plugins.registerPlugins(config),
    E.map(() => {
      return {
        chatTE,
        validateBody,
      };
    }),
  );
}

function chatTE(
  data: ChatRequest,
  headers: Record<string, string | undefined>,
  callback?: ChatCallback,
): TE.TaskEither<RFC9457ErrorResponse, SuccessResponse> {
  switch (modelMap[data.model]) {
    case "anthropic": {
      return chatAnthropic(data, callback);
    }
    case "openai": {
      return chatOpenAI(data, headers, { callback });
    }
    case "perplexity": {
      return chatPerplexity(data, headers, callback);
    }
    default: {
      return TE.left({
        detail: `'${data.model}' should be added to the supported models list`,
        status: "500",
        title: "Missing model",
        type: errorType.missingModel,
      });
    }
  }
}

function chatPerplexity(
  data: ChatRequest,
  headers: Record<string, string | undefined>,
  callback?: ChatCallback,
): TE.TaskEither<RFC9457ErrorResponse, SuccessResponse> {
  return pipe(
    TE.fromOption(() => undefined)(plugins.getPlugin("perplexity")),
    TE.matchE(
      () => {
        callback?.onMissingConfig("perplexity");
        return TE.left({
          detail: "",
          status: "501",
          title: "Perplexity not configured",
          type: errorType.perplexityNotConfigured,
        });
      },
      (plugin) => chatOpenAI(data, headers, { plugin, callback }),
    ),
  );
}

function chatOpenAI(
  data: ChatRequest,
  headers: Record<string, string | undefined>,
  {
    plugin,
    callback,
  }: {
    plugin?: { client: OpenAI; model: Model; stream: boolean };
    callback?: ChatCallback;
  },
): TE.TaskEither<RFC9457ErrorResponse, SuccessResponse> {
  function _chatOpenAI({
    client,
    model,
    stream,
  }: {
    client: OpenAI;
    model: Model;
    stream: boolean;
  }): TE.TaskEither<RFC9457ErrorResponse, SuccessResponse> {
    return pipe(
      TE.Do,
      TE.tapIO(() => {
        return TE.fromIO(IO.of(callback?.beforeRequest?.(model, data)));
      }),
      TE.map(() => {
        return stream
          ? TE.left({
              error: {
                detail: "",
                status: "501",
                title: "Streaming not implemented",
                type: errorType.streamingNotImplemented,
              },
            })
          : TE.right(undefined);
      }),
      TE.bind("response", () =>
        TE.tryCatch(
          () => {
            return client.chat.completions.create(
              {
                model,
                messages: [
                  ...data.history,
                  { role: "user", content: data.message },
                ],
                stream,
              },
              { headers },
            ) as Promise<OpenAI.Chat.Completions.ChatCompletion>;
          },
          (error) => {
            callback?.onError({ _t: "network", data: error });
            return {
              type: errorType.openaiError,
              status: "500",
              title: "OpenAI upstream error",
              detail:
                typeof error === "object" &&
                error !== null &&
                "message" in error
                  ? (error as { message: string }).message
                  : "",
            };
          },
        ),
      ),
      TE.tapIO(({ response }) => {
        return TE.fromIO(IO.of(callback?.afterResponse(response)));
      }),
      TE.flatMap(({ response }) => {
        if (
          response.choices.length === 0 ||
          !response.choices[0].message.content
        ) {
          callback?.onError({ _t: "api", data: JSON.stringify(response) });
          return TE.left({
            detail: `OpenAI response: ${JSON.stringify(response)}`,
            status: "500",
            title: "Invalid response from OpenAI",
            type: errorType.invalidOpenaiResponse,
          });
        }

        return response.choices[0].finish_reason === "stop"
          ? TE.right({
              model: response.model as Model,
              message: response.choices[0].message.content,
            })
          : TE.right({
              model: response.model as Model,
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
      callback?.onMissingConfig("openai");
      return TE.left({
        detail: "",
        status: "501",
        title: "OpenAI not configured",
        type: errorType.openaiNotConfigured,
      });
    }, _chatOpenAI),
  );
}

function chatAnthropic(
  data: ChatRequest,
  callback?: ChatCallback,
): TE.TaskEither<RFC9457ErrorResponse, SuccessResponse> {
  function _chatAnthropic(
    client: Anthropic,
    model: string,
    {
      stream,
    }: {
      stream: boolean;
    },
  ): TE.TaskEither<RFC9457ErrorResponse, SuccessResponse> {
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
            callback?.onError({ _t: "api", data: e });
            return {
              detail: e.message,
              status: e.status?.toString() ?? "500",
              title: `Anthropic API error: ${e.name}`,
              type: errorType.anthropicApiError,
            };
          } else {
            callback?.onError({ _t: "network", data: e });
            return {
              detail: "", // e.message,
              status: "400",
              title: `Anthropic API uncaught error`,
              type: errorType.anthropicOtherError,
            };
          }
        },
      ),
      TE.tapIO((response) => {
        callback?.afterResponse(response);
        return TE.right(response);
      }),
      TE.flatMap((response) => {
        if (!("id" in response)) {
          callback?.onError({
            _t: "unsupported",
            message: "Streaming not supported",
          });
          return TE.left({
            detail: "", // e.message,
            status: "501",
            title: `Anthropic API uncaught error`,
            type: errorType.anthropicStreamingNotSupportedError,
          });
        }

        return response.stop_reason === "end_turn"
          ? TE.right({
              model: response.model as Model,
              message: response.content
                .map((m) => (m.type === "text" ? m.text : ""))
                .join("\n"),
            })
          : TE.right({
              model: response.model as Model,
              message: response.content
                .map((m) => (m.type === "text" ? m.text : ""))
                .join("\n"),
              stopReason: response.stop_reason,
            });
      }),
    );
  }

  return pipe(
    TE.fromOption(() => undefined)(plugins.getPlugin("anthropic")),
    TE.matchE(
      () => {
        callback?.onMissingConfig("anthropic");
        return TE.left({
          detail: "",
          status: "501",
          title: "Anthropic not configured",
          type: errorType.anthropicNotConfigured,
        });
      },
      ({ client, model, stream }) => _chatAnthropic(client, model, { stream }),
    ),
  );
}

function validateBody(
  x: string | null,
  _:
    | {
        onValid?: (data: ChatRequest) => void;
        onInvalid?: (
          arg:
            | { _t: "empty_body"; message: string }
            | { _t: "unknown"; error: unknown }
            | { _t: "unsupported_model"; message: string }
            | { _t: "decode"; error: D.DecodeError },
        ) => void;
      }
    | undefined,
): E.Either<RFC9457ErrorResponse, ChatRequest> {
  if (!x) {
    return E.left({
      detail: `Request body must be an instance of ChatRequest. Example:
{
  "model": ${defaultModel},
  "message": "Hello, world!",
  "history": []
}
`,
      status: "400",
      title: "Empty request body",
      type: errorType.emptyRequestBody,
    });
  }

  return pipe(
    E.Do,
    E.bind("bodyParsed", () =>
      E.tryCatch<{ _t: "parse"; error: unknown }, ChatRequest>(
        () => JSON.parse(x) as ChatRequest,
        (error: unknown) => ({ _t: "parse", error }),
      ),
    ),
    E.bindW("bodyDecoded", ({ bodyParsed }) => {
      return pipe(
        ChatRequest.decode(bodyParsed),
        E.mapLeft<D.DecodeError, { _t: "decode"; error: D.DecodeError }>(
          (error) => ({
            _t: "decode",
            error,
          }),
        ),
      );
    }),
    E.match(
      (error) => {
        switch (error._t) {
          case "parse": {
            return E.left({
              detail: "",
              status: "400",
              title: "Invalid JSON in request body",
              type: errorType.invalidJson,
            });
          }
          case "decode": {
            return E.left({
              detail: D.draw(error.error),
              status: "400",
              title: "Invalid request format",
              type: errorType.invalidRequestFormat,
            });
          }
          default: {
            const _exhaustiveCheck: never = error;
            return _exhaustiveCheck;
          }
        }
      },
      ({ bodyDecoded }) => {
        if (!models.includes(bodyDecoded.model)) {
          return E.left({
            detail: `'${bodyDecoded.model}' is not one of the supported models: ${models.join(", ")}`,
            status: "400",
            title: "Unsupported model",
            type: errorType.unsupportedModel,
          });
        }

        return E.of(bodyDecoded);
      },
    ),
  );
}
