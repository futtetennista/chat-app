import * as Either from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/Option";
import * as C from "io-ts/Codec";
import * as D from "io-ts/Decoder";
import * as E from "io-ts/Encoder";

export const anthropicDefaultModel: AnthropicModel = "claude-3-5-haiku-latest";
export const anthropicModels = [
  "claude-3-opus-latest",
  "claude-3-sonnet-latest",
  "claude-3-haiku-latest",
  "claude-3-5-sonnet-latest",
  "claude-3-5-haiku-latest",
] as const;

export const AnthropicModelD = D.literal(
  ...anthropicModels,
  //   "claude-3-opus-latest",
  //   "claude-3-sonnet-latest",
  //   "claude-3-haiku-latest",
  //   "claude-3-5-sonnet-latest",
  //   "claude-3-5-haiku-latest",
);
export type AnthropicModel = D.TypeOf<typeof AnthropicModelD>;

export const openaiDefaultModel: OpenAIModel = "o1-mini";
export const openaiModels = [
  "gpt-4o",
  "gpt-4o-mini",
  "o1-preview",
  "o1-mini",
] as const;

export const OpenAIModelD = D.literal(
  ...openaiModels,
  // "gpt-4o",
  // "gpt-4o-mini",
  // "o1-preview",
  // "o1-mini",
);
export type OpenAIModel = D.TypeOf<typeof OpenAIModelD>;

export const perplexityModels = ["perplexity"] as const;
export const PerplexityModelD = D.literal(...perplexityModels);
export type PerplexityModel = D.TypeOf<typeof PerplexityModelD>;

export const perplexityDefaultModel: PerplexityModel = "perplexity";
export const ModelD = D.union(
  ...[AnthropicModelD, OpenAIModelD, PerplexityModelD],
);
export type Model = D.TypeOf<typeof ModelD>;

export const defaultModel: Model = "o1-mini";
export const defaultModels: Model[] = ["o1-mini", "claude-3-5-haiku-latest"];

const ModelE: E.Encoder<string, Model> = {
  encode: (model) => JSON.stringify(model),
};

export const Model: C.Codec<unknown, string, Model> = C.make(ModelD, ModelE);

export const modelMap: Record<
  OpenAIModel | AnthropicModel | PerplexityModel,
  "openai" | "anthropic" | "perplexity"
> = Object.fromEntries(
  Object.entries({
    ...Object.fromEntries(anthropicModels.map((model) => [model, "anthropic"])),
    ...Object.fromEntries(openaiModels.map((model) => [model, "openai"])),
    ...Object.fromEntries(
      perplexityModels.map((model) => [model, "perplexity"]),
    ),
  }),
) as Record<
  OpenAIModel | AnthropicModel | PerplexityModel,
  "openai" | "anthropic" | "perplexity"
>;

const handleMap: Record<string, "openai" | "anthropic" | "perplexity"> = {
  c: "anthropic",
  claude: "anthropic",
  cld: "anthropic",
  chatgpt: "openai",
  gpt: "openai",
  p: "perplexity",
  ppx: "perplexity",
};

export function resolveModel(maybeModel: string): Either.Either<string, Model> {
  function resolveModelFromHandle(
    vendor: "openai" | "anthropic" | "perplexity" | undefined,
  ): O.Option<Model> {
    switch (vendor) {
      case "openai": {
        return O.some(openaiDefaultModel);
      }
      case "anthropic": {
        return O.some(anthropicDefaultModel);
      }
      case "perplexity": {
        return O.some(perplexityDefaultModel);
      }
      default: {
        return O.none;
      }
    }
  }

  return pipe(
    Either.fromOption(() => maybeModel)(
      resolveModelFromHandle(handleMap[maybeModel]),
    ),
    Either.orElse(() => {
      return anthropicModels.includes(maybeModel as AnthropicModel)
        ? Either.right(maybeModel as AnthropicModel)
        : Either.left(maybeModel);
    }),
    Either.orElse(() => {
      return openaiModels.includes(maybeModel as OpenAIModel)
        ? Either.right(maybeModel as OpenAIModel)
        : Either.left(maybeModel);
    }),
    Either.orElse(() => {
      return perplexityModels.includes(maybeModel as PerplexityModel)
        ? Either.right(maybeModel as PerplexityModel)
        : Either.left(maybeModel);
    }),
  );
}

export const models: Model[] = [...anthropicModels, ...openaiModels];

export const MessageD = pipe(
  D.struct({
    role: D.literal("user", "assistant"),
    content: D.string,
  }),
  D.intersect(D.partial({ timestamp: D.number })),
);

export type Message = D.TypeOf<typeof MessageD>;

const MessageE: E.Encoder<string, Message> = {
  encode: (message) => JSON.stringify(message),
};

export const Message: C.Codec<unknown, string, Message> = C.make(
  MessageD,
  MessageE,
);

const ChatRequestD = D.struct({
  message: D.string,
  history: D.readonly(D.array(Message)),
  models: D.readonly(D.array(Model)),
});

export type ChatRequest = D.TypeOf<typeof ChatRequestD>;

const ChatRequestE: E.Encoder<string, ChatRequest> = {
  encode: (chatRequest) => JSON.stringify(chatRequest),
};

export const ChatRequest: C.Codec<unknown, string, ChatRequest> = C.make(
  ChatRequestD,
  ChatRequestE,
);

const SuccessResponseD = D.readonly(
  D.array(
    pipe(
      D.struct({
        message: D.string,
        model: Model,
      }),
      D.intersect(D.partial({ stopReason: D.string })),
    ),
  ),
);
export type SuccessResponse = D.TypeOf<typeof SuccessResponseD>;

const SuccessResponseE: E.Encoder<string, SuccessResponse> = {
  encode: (successResponse) => JSON.stringify(successResponse),
};

export const SuccessResponse: C.Codec<unknown, string, SuccessResponse> =
  C.make(SuccessResponseD, SuccessResponseE);

export const errorTypes = [
  "tag:@chat-app:anthropic_api_error",
  "tag:@chat-app:anthropic_other_error",
  "tag:@chat-app:configuration_decode_error",
  "tag:@chat-app:configuration_not_found_error",
  "tag:@chat-app:configuration_parse_error",
  "tag:@chat-app:empty_plugins_error",
  "tag:@chat-app:empty_request_body",
  "tag:@chat-app:i_am_a_teapot",
  "tag:@chat-app:invalid_json",
  "tag:@chat-app:invalid_openai_response",
  "tag:@chat-app:invalid_request_format",
  "tag:@chat-app:missing_model",
  "tag:@chat-app:openai_error",
  "tag:@chat-app:perplexity_not_configured",
  "tag:@chat-app:plugin_configuration_api_key_missing_error",
  "tag:@chat-app:plugin_configuration_base_url_missing_error",
  "tag:@chat-app:plugin_configuration_stream_unsupported_error",
  "tag:@chat-app:provider_not_configured",
  "tag:@chat-app:streaming_not_implemented",
  "tag:@chat-app:unsupported_model",
] as const;

const ErrorTypeD = D.literal(...errorTypes);

// This doesn't compile…
// const ErrorTypeD = D.union(...errorTypes.map(D.literal));
// So we have to do it manually…
// const ErrorTypeD = D.union(
//   D.literal(errorTypes.anthropicApiError),
//   D.literal(errorTypes.anthropicNotConfigured),
//   D.literal(errorTypes.anthropicOtherError),
//   D.literal(errorTypes.anthropicStreamingNotSupportedError),
//   D.literal(errorTypes.emptyRequestBody),
//   D.literal(errorTypes.invalidJson),
//   D.literal(errorTypes.invalidOpenaiResponse),
//   D.literal(errorTypes.invalidRequestFormat),
//   D.literal(errorTypes.missingModel),
//   D.literal(errorTypes.openaiError),
//   D.literal(errorTypes.openaiNotConfigured),
//   D.literal(errorTypes.perplexityNotConfigured),
//   D.literal(errorTypes.streamingNotImplemented),
//   D.literal(errorTypes.unsupportedModel),
// );
// This is to avoid errors downstream e.g.
// Type '"tag:@chat-app:missing_model"' is not assignable to type '"tag:@chat-app:perplexity_not_configured"'

// Another way to avoid the compile error is to create a helper map
// type ErrorTypeSuffix =
//   (typeof errorTypes)[number] extends `tag:@chat-app:${infer S}` ? S : never;
// type CamelCase<S extends string> = S extends `${infer Head}_${infer Tail}`
//   ? `${Head}${Capitalize<CamelCase<Tail>>}`
//   : S;

// function toCamelCase(x: ErrorType): CamelCase<ErrorTypeSuffix> {
//   return x
//     .replace(/tag:@chat-app:/, "")
//     .toLowerCase()
//     .replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())
//     .replace(/^./, (letter) =>
//       letter.toLowerCase(),
//     ) as CamelCase<ErrorTypeSuffix>;
// }

// const errorTypesMap: Record<
//   CamelCase<ErrorTypeSuffix>,
//   ErrorType
// > = errorTypes.reduce(
//   (acc, errorType) => ({ ...acc, [toCamelCase(errorType)]: errorType }),
//   // eslint-disable-next-line @typescript-eslint/prefer-reduce-type-parameter
//   {} as Partial<Record<CamelCase<ErrorTypeSuffix>, ErrorType>>,
// ) as Record<CamelCase<ErrorTypeSuffix>, ErrorType>;

export type ErrorType = D.TypeOf<typeof ErrorTypeD>;

const RFC9457ErrorResponseD = pipe(
  D.struct({
    type: ErrorTypeD,
    status: D.string,
    title: D.string,
    detail: D.string,
  }),
  D.intersect(
    D.partial({
      instance: D.string,
    }),
  ),
);

export type RFC9457ErrorResponse = D.TypeOf<typeof RFC9457ErrorResponseD>;

const RFC9457ErrorResponseE: E.Encoder<string, RFC9457ErrorResponse> = {
  encode: (errorResponse) => JSON.stringify(errorResponse),
};

const okTag = "ok";
const koTag = "ko";

type ChatResponseT =
  | { _t: typeof okTag; data: SuccessResponse }
  | { _t: typeof koTag; error: RFC9457ErrorResponse };

export const RFC9457ErrorResponse: C.Codec<
  unknown,
  string,
  RFC9457ErrorResponse
> = C.make(RFC9457ErrorResponseD, RFC9457ErrorResponseE);

const ChatResponseD: D.Decoder<unknown, ChatResponseT> = D.sum("_t")({
  [okTag]: D.struct({ _t: D.literal(okTag), data: SuccessResponse }),
  [koTag]: D.struct({ _t: D.literal(koTag), error: RFC9457ErrorResponse }),
});

export type ChatResponse = D.TypeOf<typeof ChatResponseD>;

const ChatResponseE: E.Encoder<string, ChatResponseT> = {
  encode: (chatResponse) => JSON.stringify(chatResponse),
};

export const ChatResponse: C.Codec<unknown, string, ChatResponse> = C.make(
  ChatResponseD,
  ChatResponseE,
);
