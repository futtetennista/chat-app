import { pipe } from "fp-ts/lib/function";
import * as C from "io-ts/Codec";
import * as D from "io-ts/Decoder";
import * as E from "io-ts/Encoder";

const MessageD = D.struct({
  role: D.union(D.literal("user"), D.literal("assistant")),
  content: D.string,
  timestamp: D.number,
});

export type Message = D.TypeOf<typeof MessageD>;

const MessageE: E.Encoder<string, Message> = {
  encode: (message) =>
    JSON.stringify({
      role: message.role,
      content: message.content,
      timestamp: message.timestamp,
    }),
};

export const Message: C.Codec<unknown, string, Message> = C.make(
  MessageD,
  MessageE,
);

const ChatRequestD = D.struct({
  message: D.string,
  history: D.array(Message),
  model: D.union(
    D.literal("openai"),
    D.literal("perplexity"),
    D.literal("anthropic"),
  ),
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
  }),
  D.intersect(D.partial({ stopReason: D.string })),
);

export type SuccessResponse = D.TypeOf<typeof SuccessResponseD>;

const SuccessResponseE: E.Encoder<string, SuccessResponse> = {
  encode: (successResponse) => JSON.stringify(successResponse.message),
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

export const VendorD = D.union(
  D.literal("openai"),
  D.literal("perplexity"),
  D.literal("anthropic"),
);

export type Vendor = D.TypeOf<typeof VendorD>;

const VendorE: E.Encoder<string, Vendor> = {
  encode: (vendor) => JSON.stringify(vendor),
};

export const Vendor: C.Codec<unknown, string, Vendor> = C.make(
  VendorD,
  VendorE,
);
