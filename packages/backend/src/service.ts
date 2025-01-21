import Anthropic from "@anthropic-ai/sdk";
import {
  ChatErrorResponse,
  ChatRequest,
  ChatSuccessResponse,
  defaultModel,
  Model,
  modelMap,
  models,
  VendorSuccessResponse,
} from "@chat-app/contracts";
import * as A from "fp-ts/Array";
import * as E from "fp-ts/Either";
import * as IO from "fp-ts/IO";
import { pipe } from "fp-ts/lib/function";
import * as T from "fp-ts/Task";
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
  ) => E.Either<ChatErrorResponse, ChatRequest>;

  chatTE: (
    data: ChatRequest,
    headers: Record<string, string | undefined>,
    callback?: ChatCallback,
  ) => TE.TaskEither<ChatErrorResponse, ChatSuccessResponse>;
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
): E.Either<ChatErrorResponse, ChatService> {
  return pipe(
    plugins.registerPlugins(config),
    E.map(() => ({
      chatTE,
      validateBody,
    })),
  );
}

function chatTE(
  data: ChatRequest,
  headers: Record<string, string | undefined>,
  callback?: ChatCallback,
): TE.TaskEither<ChatErrorResponse, ChatSuccessResponse> {
  function toTaskEither(model: Model) {
    switch (modelMap[model]) {
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
        return TE.left<ChatErrorResponse>({
          detail: `'${model}' is not one of the supported models: ${models.join(", ")}`,
          status: "400",
          title: "Unsupported model",
          type: "tag:@chat-app:unsupported_model",
        });
      }
    }
  }

  return pipe(
    // TE.sequenceArray(
    // A.sequence(T.ApplicativePar)(
    // A.wilt(T.ApplicativePar)<Model, ChatErrorResponse, SimpleSuccessResponse>(
    A.wilt(T.ApplicativePar)(toTaskEither)([...data.models]),
    T.map((x) => {
      return x.right.length === 0
        ? E.left<ChatErrorResponse>({
            type: "tag:@chat-app:composite_error",
            title: `Composite error of: ${x.left.map(({ title }) => title).join(", ")}`,
            status: x.left.some(({ status }) => status === "400")
              ? "400"
              : "500",
            detail: "Look at the 'errors' property for more details",
            errors: x.left,
          })
        : E.right({
            responses: x.right,
            errors: x.left,
          });
    }),
  );
}

function chatPerplexity(
  data: ChatRequest,
  headers: Record<string, string | undefined>,
  callback?: ChatCallback,
): TE.TaskEither<ChatErrorResponse, VendorSuccessResponse> {
  return pipe(
    TE.fromOption(() => undefined)(plugins.getPlugin("perplexity")),
    TE.matchE(
      () => {
        callback?.onMissingConfig("perplexity");
        return TE.left<ChatErrorResponse>({
          status: "501",
          title: "Perplexity not configured",
          type: "tag:@chat-app:perplexity_not_configured",
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
): TE.TaskEither<ChatErrorResponse, VendorSuccessResponse> {
  function _chatOpenAI({
    client,
    model,
    stream,
  }: {
    client: OpenAI;
    model: Model;
    stream: boolean;
  }): TE.TaskEither<ChatErrorResponse, VendorSuccessResponse> {
    return pipe(
      TE.Do,
      TE.tapIO(() => {
        return TE.fromIO(IO.of(callback?.beforeRequest?.(model, data)));
      }),
      TE.map(() => {
        return stream
          ? TE.left<{ error: ChatErrorResponse }>({
              error: {
                status: "501",
                title: "Streaming not implemented",
                type: "tag:@chat-app:streaming_not_implemented",
              },
            })
          : TE.right(undefined);
      }),
      TE.bind("response", () =>
        TE.tryCatch<ChatErrorResponse, OpenAI.Chat.Completions.ChatCompletion>(
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
              detail:
                typeof error === "object" &&
                error !== null &&
                "message" in error
                  ? (error as { message: string }).message
                  : "",
              status: "500",
              title: "OpenAI upstream error",
              type: "tag:@chat-app:openai_error",
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
          return TE.left<ChatErrorResponse>({
            detail: `OpenAI response: ${JSON.stringify(response)}`,
            status: "500",
            title: "Invalid response from OpenAI",
            type: "tag:@chat-app:openai_error",
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
      return TE.left<ChatErrorResponse>({
        status: "501",
        title: "OpenAI not configured",
        type: "tag:@chat-app:provider_not_configured",
      });
    }, _chatOpenAI),
  );
}

function chatAnthropic(
  data: ChatRequest,
  _callback?: ChatCallback,
): TE.TaskEither<ChatErrorResponse, VendorSuccessResponse> {
  function _chatAnthropic(
    client: Anthropic,
    model: string,
  ): TE.TaskEither<ChatErrorResponse, VendorSuccessResponse> {
    return pipe(
      TE.tryCatch<ChatErrorResponse, Anthropic.Message>(
        () =>
          client.messages.create({
            max_tokens: 1024,
            messages: [
              ...data.history,
              { role: "user", content: data.message },
            ],
            model,
            stream: false,
          }) as Promise<Anthropic.Message>,
        (e) => {
          if (e instanceof Anthropic.APIError) {
            return {
              detail: e.message,
              status: e.status?.toString() ?? "500",
              title: `Anthropic API error: ${e.name}`,
              type: "tag:@chat-app:anthropic_api_error",
            };
          } else {
            return {
              status: "400",
              title: `Anthropic API uncaught error`,
              type: "tag:@chat-app:anthropic_other_error",
            };
          }
        },
      ),
      TE.flatMap((response) => {
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
        return TE.left<ChatErrorResponse>({
          status: "501",
          title: "Anthropic not configured",
          type: "tag:@chat-app:provider_not_configured",
        });
      },
      ({ client, model }) => _chatAnthropic(client, model),
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
): E.Either<ChatErrorResponse, ChatRequest> {
  if (!x) {
    return E.left<ChatErrorResponse>({
      detail: `Request body must be an instance of ChatRequest. Example:
{
  "model": ${defaultModel},
  "message": "Hello, world!",
  "history": []
}
`,
      status: "400",
      title: "Empty request body",
      type: "tag:@chat-app:empty_request_body",
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
            return E.left<ChatErrorResponse>({
              status: "400",
              title: "Invalid JSON in request body",
              type: "tag:@chat-app:invalid_json",
            });
          }
          case "decode": {
            return E.left<ChatErrorResponse>({
              detail: D.draw(error.error),
              status: "400",
              title: "Invalid request format",
              type: "tag:@chat-app:invalid_request_format",
            });
          }
          default: {
            const _exhaustiveCheck: never = error;
            return _exhaustiveCheck;
          }
        }
      },
      ({ bodyDecoded }) => {
        return E.of(bodyDecoded);
      },
    ),
  );
}
