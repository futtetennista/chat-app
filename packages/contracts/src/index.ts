import { pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/Option";
import * as C from "io-ts/Codec";
import * as D from "io-ts/Decoder";
import * as E from "io-ts/Encoder";

export const VendorD = D.literal(
  "openai",
  // "gpt-4",
  // "gpt-4o",
  // "gpt-4o-mini",
  "perplexity",
  "anthropic",
  // "claude-haiku",
);

export type Vendor = D.TypeOf<typeof VendorD>;

const VendorE: E.Encoder<string, Vendor> = {
  encode: (vendor) => JSON.stringify(vendor),
};

export const Vendor: C.Codec<unknown, string, Vendor> = C.make(
  VendorD,
  VendorE,
);
const anthropicHandles = ["c", "claude", "cld"];
const openaiHandles = ["chatgpt", "gpt"];
const perplexityHandles = ["p", "ppx"];
// export const modelHandles = [
//   ...anthropicHandles,
//   ...openaiHandles,
//   ...perplexityHandles,
// ];
export function modelHandleToVendor(handle: string): O.Option<Vendor> {
  if (anthropicHandles.includes(handle)) {
    return O.some("anthropic");
  }

  if (openaiHandles.includes(handle)) {
    return O.some("openai");
  }

  if (perplexityHandles.includes(handle)) {
    return O.some("perplexity");
  }

  return O.none;
}

export const models = ["anthropic", "openai", "perplexity"] as Vendor[];
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
  history: D.array(Message),
  vendor: D.literal("openai", "perplexity", "anthropic"),
});

export type ChatRequest = D.TypeOf<typeof ChatRequestD>;

const ChatRequestE: E.Encoder<string, ChatRequest> = {
  encode: (chatRequest) => JSON.stringify(chatRequest),
};

export const ChatRequest: C.Codec<unknown, string, ChatRequest> = C.make(
  ChatRequestD,
  ChatRequestE,
);

const SuccessResponseD = pipe(
  D.struct({
    message: D.string,
    model: D.string,
    // model: Vendor,
  }),
  D.intersect(D.partial({ stopReason: D.string })),
);

export type SuccessResponse = D.TypeOf<typeof SuccessResponseD>;

const SuccessResponseE: E.Encoder<string, SuccessResponse> = {
  encode: (successResponse) => JSON.stringify(successResponse),
};

export const SuccessResponse: C.Codec<unknown, string, SuccessResponse> =
  C.make(SuccessResponseD, SuccessResponseE);

const RFC9457ErrorResponseD = pipe(
  D.struct({
    type: D.string,
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
