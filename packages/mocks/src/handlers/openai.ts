import { pipe } from "fp-ts/lib/function";
import * as T from "fp-ts/Task";
import { http, HttpResponse, StrictResponse } from "msw";
import OpenAI from "openai";

const handlers = [
  http.post(
    "https://api.openai.com/v1/chat/completions",
    ({
      request: _,
    }): Promise<StrictResponse<OpenAI.Chat.Completions.ChatCompletion>> => {
      return pipe(
        T.of(
          HttpResponse.json<OpenAI.Chat.Completions.ChatCompletion>({
            id: `chatcmpl-${new Date().toLocaleTimeString()}`,
            object: "chat.completion",
            created: Date.now(),
            model: "gpt-4o-2024-08-06",
            choices: [
              {
                index: 0,
                message: {
                  role: "assistant",
                  content: "Hi there! How can I assist you today?",
                  refusal: null,
                },
                logprobs: null,
                finish_reason: "stop",
              },
            ],
            usage: {
              prompt_tokens: 19,
              completion_tokens: 10,
              total_tokens: 29,
              prompt_tokens_details: {
                cached_tokens: 0,
              },
              completion_tokens_details: {
                reasoning_tokens: 0,
                accepted_prediction_tokens: 0,
                rejected_prediction_tokens: 0,
              },
            },
            system_fingerprint: "fp_6b68a8204b",
          }),
        ),
      )();
    },
  ),
];

export default handlers;
