import * as Console from "fp-ts/Console";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { http, HttpResponse } from "msw";
import OpenAI from "openai";

const handlers = [
  http.post(
    "https://api.openai.com/v1/chat/completions",
    async ({
      request,
    }) /* : Promise<StrictResponse<OpenAI.Chat.Completions.ChatCompletion>> */ => {
      return pipe(
        TE.Do,
        TE.tapIO(() => Console.log({ headers: request.headers })),
        TE.tap(
          (): TE.TaskEither<
            {
              error: {
                type: string;
                name: string;
                status: string;
              };
            },
            undefined
          > => {
            return /(1|true|on)/.test(
              request.headers.get("X-Chat-App-Test-Failure") ?? "",
            )
              ? TE.left({
                  error: {
                    type: "test_error",
                    name: "TestError",
                    status: "400",
                  },
                })
              : TE.right(undefined);
          },
        ),
        TE.bind("requestBody", () =>
          TE.tryCatch(
            async () =>
              (await request.json()) as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
            () => ({
              error: {
                type: "bad_request_error",
                name: "BadRequestError",
                status: "400",
              },
            }),
          ),
        ),
        TE.tapIO(({ requestBody }) => Console.log({ requestBody })),
        TE.match(
          (error) => HttpResponse.json(error, { status: 400 }),
          ({ requestBody }) =>
            HttpResponse.json<OpenAI.Chat.Completions.ChatCompletion>({
              id: `chatcmpl-${new Date().toLocaleTimeString()}`,
              object: "chat.completion",
              created: Date.now(),
              model: requestBody.model,
              choices: [
                {
                  index: 0,
                  message: {
                    role: "assistant",
                    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                    content: `[echo] ${requestBody.messages.slice(-1).map((x) => x.content)}`,
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
