import Anthropic from "@anthropic-ai/sdk";
import { ChatRequest, RFC9457ErrorResponse, Vendor } from "@chat-app/contracts";
import * as E from "fp-ts/Either";
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
  onMissingConfig: (x: Vendor) => void;
  afterResponse: (response: unknown) => void;
  beforeRequest?: (service: Vendor, request: ChatRequest) => void;
}

interface ChatService {
  validateBody: (
    x: string | null,
    callback: {
      onValid: (data: ChatRequest) => void;
      onInvalid: (
        arg:
          | { _t: "decode"; error: D.DecodeError }
          | { _t: "empty_body"; message: string }
          | { _t: "unknown"; error: unknown }
          | {
              _t: "unsupported_vendor";
              message: string;
            },
      ) => void;
    },
  ) => E.Either<RFC9457ErrorResponse, ChatRequest>;

  chatTE: (
    data: ChatRequest,
    callback: ChatCallback,
  ) => TE.TaskEither<
    RFC9457ErrorResponse,
    { message: string; stopReason?: string }
  >;
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
  { callback }: { callback: Parameters<typeof plugins.registerPlugins>[1] },
): ChatService {
  plugins.registerPlugins(config, callback);

  return {
    chatTE,
    validateBody,
  };
}

function chatTE(
  data: ChatRequest,
  callback?: ChatCallback,
): TE.TaskEither<
  RFC9457ErrorResponse,
  { message: string; stopReason?: string }
> {
  switch (data.vendor) {
    case "anthropic": {
      return chatAnthropic(data, callback);
    }
    case "openai": {
      return chatOpenAI(data, { callback });
    }
    case "perplexity": {
      return chatPerplexity(data, callback);
    }
    default: {
      const _exhaustiveCheck = data.vendor;
      return _exhaustiveCheck;
    }
  }
}

function chatPerplexity(
  data: ChatRequest,
  callback?: ChatCallback,
): TE.TaskEither<
  RFC9457ErrorResponse,
  { message: string; stopReason?: string }
> {
  return pipe(
    TE.fromOption(() => undefined)(plugins.getPlugin("perplexity")),
    TE.matchE(
      () => {
        callback?.onMissingConfig("perplexity");
        return TE.left({
          type: "tag:@chat-app:perplexity_not_configured",
          status: "501",
          title: "Perplexity not configured",
          detail: "",
        });
      },
      (plugin) => chatOpenAI(data, { plugin, callback }),
    ),
  );
}

function chatOpenAI(
  data: ChatRequest,
  {
    plugin,
    callback,
  }: {
    plugin?: { client: OpenAI; model: string; stream: boolean };
    callback?: ChatCallback;
  },
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
        (error) => {
          callback?.onError({ _t: "network", data: error });
          return {
            type: "tag:@chat-app:openai_error",
            status: "500",
            title: "OpenAI error",
            detail:
              typeof error === "object" && error !== null && "message" in error
                ? (error as { message: string }).message
                : "",
          };
        },
      ),
      TE.tapIO((response) => {
        callback?.afterResponse(response);
        return TE.right(response);
      }),
      TE.flatMap((responseUntyped) => {
        if (stream) {
          return TE.right({
            message: "Streaming not implemented",
          });
        }

        const response =
          responseUntyped as OpenAI.Chat.Completions.ChatCompletion;
        if (
          response.choices.length === 0 ||
          !response.choices[0].message.content
        ) {
          callback?.onError({ _t: "api", data: JSON.stringify(response) });
          return TE.left({
            type: "tag:@chat-app:invalid_openai_response",
            title: "Invalid response from OpenAI",
            status: "500",
            detail: `OpenAI response: ${JSON.stringify(response)}`,
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

  callback?.beforeRequest?.("openai", data);

  return pipe(
    TE.fromNullable(undefined)(plugin),
    TE.orElse(() =>
      TE.fromOption(() => undefined)(plugins.getPlugin("openai")),
    ),
    TE.matchE(() => {
      callback?.onMissingConfig("openai");
      return TE.left({
        type: "tag:@chat-app:openai_not_configured",
        status: "501",
        title: "OpenAI not configured",
        detail: "",
      });
    }, _chatOpenAI),
  );
}

function chatAnthropic(
  data: ChatRequest,
  callback?: ChatCallback,
): TE.TaskEither<
  RFC9457ErrorResponse,
  { message: string; stopReason?: string }
> {
  function _chatAnthropic(
    client: Anthropic,
    model: string,
    {
      stream,
    }: {
      stream: boolean;
    },
  ): TE.TaskEither<
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
            callback?.onError({ _t: "api", data: e });
            return {
              type: "tag:@chat-app:anthropic_api_error",
              status: e.status?.toString() ?? "500",
              title: `Anthropic API error: ${e.name}`,
              detail: e.message,
            };
          } else {
            callback?.onError({ _t: "network", data: e });
            return {
              type: "tag:@chat-app:anthropic_other_error",
              status: "400",
              title: `Anthropic API uncaught error`,
              detail: "", // e.message,
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
            type: "tag:@chat-app:anthropic_streaming_not_supported_error",
            status: "501",
            title: `Anthropic API uncaught error`,
            detail: "", // e.message,
          });
        }

        return response.stop_reason === "end_turn"
          ? TE.right({
              message: response.content
                .map((m) => (m.type === "text" ? m.text : ""))
                .join("\n"),
            })
          : TE.right({
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
          type: "tag:@chat-app:anthropic_not_configured",
          status: "501",
          title: "Anthropic not configured",
          detail: "",
        });
      },
      ({ client, model, stream }) => _chatAnthropic(client, model, { stream }),
    ),
  );
}

const supportedModels: Vendor[] = ["openai", "perplexity", "anthropic"];

function validateBody(
  x: string | null,
  {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    onInvalid = () => {},
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    onValid = () => {},
  }: {
    onValid: (data: ChatRequest) => void;
    onInvalid: (
      arg:
        | { _t: "empty_body"; message: string }
        | { _t: "unknown"; error: unknown }
        | { _t: "unsupported_vendor"; message: string }
        | { _t: "decode"; error: D.DecodeError },
    ) => void;
  },
): E.Either<RFC9457ErrorResponse, ChatRequest> {
  if (!x) {
    onInvalid({ _t: "empty_body", message: "Request body is empty" });
    return E.left({
      type: "tag:@chat-app:empty_request_body",
      status: "400",
      title: "Empty request body",
      detail: `Request body must be an instance of ChatRequest. Example:
{
  "vendor": "openai",
  "message": "Hello, world!",
  "history": []
}
`,
    });
  }

  try {
    const validationResult = ChatRequest.decode(JSON.parse(x));
    if (E.isLeft(validationResult)) {
      onInvalid({ _t: "decode", error: validationResult.left });
      return E.left({
        type: "tag:@chat-app:invalid_request_format",
        status: "400",
        detail: D.draw(validationResult.left),
        title: "Invalid request format",
      });
    }
    if (!supportedModels.includes(validationResult.right.vendor)) {
      onInvalid({
        _t: "unsupported_vendor",
        message: `Unsupported vendor: ${validationResult.right.vendor}`,
      });
      return E.left({
        type: "tag:@chat-app:unsupported_model",
        status: "400",
        title: "Unsupported model",
        detail: "",
      });
    }

    onValid(validationResult.right);
    return E.right(validationResult.right);
  } catch (e) {
    onInvalid({ _t: "unknown", error: e });
    return E.left({
      type: "tag:@chat-app:invalid_json",
      status: "400",
      title: "Invalid JSON in request body",
      detail: "",
    });
  }
}
