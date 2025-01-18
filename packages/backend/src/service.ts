import Anthropic from "@anthropic-ai/sdk";
import {
  ChatRequest,
  defaultModel,
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
): TE.TaskEither<RFC9457ErrorResponse, SuccessResponse> {
  return pipe(
    TE.sequenceArray(
      data.models.map((model) => {
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
            return TE.left<RFC9457ErrorResponse>({
              detail: `'${model}' is not one of the supported models: ${models.join(", ")}`,
              status: "400",
              title: "Unsupported model",
              type: "tag:@chat-app:unsupported_model",
            });
          }
        }
      }),
    ),
  );
}

function chatPerplexity(
  data: ChatRequest,
  headers: Record<string, string | undefined>,
  callback?: ChatCallback,
): TE.TaskEither<RFC9457ErrorResponse, SuccessResponse[number]> {
  return pipe(
    TE.fromOption(() => undefined)(plugins.getPlugin("perplexity")),
    TE.matchE(
      () => {
        callback?.onMissingConfig("perplexity");
        return TE.left<RFC9457ErrorResponse>({
          detail: "",
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
): TE.TaskEither<RFC9457ErrorResponse, SuccessResponse[number]> {
  function _chatOpenAI({
    client,
    model,
    stream,
  }: {
    client: OpenAI;
    model: Model;
    stream: boolean;
  }): TE.TaskEither<RFC9457ErrorResponse, SuccessResponse[number]> {
    return pipe(
      TE.Do,
      TE.tapIO(() => {
        return TE.fromIO(IO.of(callback?.beforeRequest?.(model, data)));
      }),
      TE.map(() => {
        return stream
          ? TE.left<{ error: RFC9457ErrorResponse }>({
              error: {
                detail: "",
                status: "501",
                title: "Streaming not implemented",
                type: "tag:@chat-app:streaming_not_implemented",
              },
            })
          : TE.right(undefined);
      }),
      TE.bind("response", () =>
        TE.tryCatch<
          RFC9457ErrorResponse,
          OpenAI.Chat.Completions.ChatCompletion
        >(
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
          return TE.left<RFC9457ErrorResponse>({
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
      return TE.left<RFC9457ErrorResponse>({
        detail: "",
        status: "501",
        title: "OpenAI not configured",
        type: "tag:@chat-app:provider_not_configured",
      });
    }, _chatOpenAI),
  );
}

function chatAnthropic(
  data: ChatRequest,
  callback?: ChatCallback,
): TE.TaskEither<RFC9457ErrorResponse, SuccessResponse[number]> {
  function _chatAnthropic(
    client: Anthropic,
    model: string,
    {
      stream,
    }: {
      stream: boolean;
    },
  ): TE.TaskEither<RFC9457ErrorResponse, SuccessResponse[number]> {
    return pipe(
      TE.tryCatch<RFC9457ErrorResponse, Anthropic.Message>(
        () =>
          client.messages.create({
            max_tokens: 1024,
            messages: [
              ...data.history,
              { role: "user", content: data.message },
            ],
            model,
            stream,
          }) as Promise<Anthropic.Message>,
        (e) => {
          if (e instanceof Anthropic.APIError) {
            callback?.onError({ _t: "api", data: e });
            return {
              detail: e.message,
              status: e.status?.toString() ?? "500",
              title: `Anthropic API error: ${e.name}`,
              type: "tag:@chat-app:anthropic_api_error",
            };
          } else {
            callback?.onError({ _t: "network", data: e });
            return {
              detail: "", // e.message,
              status: "400",
              title: `Anthropic API uncaught error`,
              type: "tag:@chat-app:anthropic_other_error",
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
          return TE.left<RFC9457ErrorResponse>({
            detail: "", // e.message,
            status: "501",
            title: `Anthropic API uncaught error`,
            type: "tag:@chat-app:streaming_not_implemented",
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
        return TE.left<RFC9457ErrorResponse>({
          detail: "",
          status: "501",
          title: "Anthropic not configured",
          type: "tag:@chat-app:provider_not_configured",
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
    return E.left<RFC9457ErrorResponse>({
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
            return E.left<RFC9457ErrorResponse>({
              detail: "",
              status: "400",
              title: "Invalid JSON in request body",
              type: "tag:@chat-app:invalid_json",
            });
          }
          case "decode": {
            return E.left<RFC9457ErrorResponse>({
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
