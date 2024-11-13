import type { Vendor } from "@chat-app/contracts";
import * as O from "fp-ts/Option";

const anthropicHandles = ["c", "claude", "cld"];
const openaiHandles = ["chatgpt", "gpt"];
const perplexityHandles = ["p", "ppx"];
export const modelHandles = [
  ...anthropicHandles,
  ...openaiHandles,
  ...perplexityHandles,
];
export function modelHandleToModel(handle: string): O.Option<Vendor> {
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

export const apiPath = "/api/chat";
