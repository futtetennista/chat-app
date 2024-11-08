import type { Request, Response } from "@contracts/index";
import {
  APIGatewayEvent,
  APIGatewayProxyResult,
  Context,
  Handler,
} from "aws-lambda";
// import OpenAI from "openai";

// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY,
// });

// async function chat(
//   message: string,
//   history: Array<{ role: string; content: string }>,
// ) {
//   const response = await openai.chat.completions.create({
//     model: "gpt-3.5-turbo",
//     messages: [...history, { role: "user", content: message }],
//     stream: false,
//   });

//   return response.choices[0].message;
// }

async function chat(rawBody: string | null): Promise<Response> {
  function validateBody(
    x: string | null,
  ):
    | { result: "valid"; value: Request }
    | { result: "invalid"; value: Response } {
    if (!x) {
      return {
        result: "invalid",
        value: {
          status: "error",
          statusCode: 400,
          error: "Invalid request body (empty)",
          code: "empty_request_body",
        },
      };
    }

    let parsedBody;
    try {
      parsedBody = JSON.parse(x);
      if (!parsedBody.message || typeof parsedBody.message !== "string") {
        return {
          result: "invalid",
          value: {
            statusCode: 400,
            error: "Invalid request format: message property must be a string",
            code: "invalid_message",
          },
        };
      }
      return { result: "valid", value: parsedBody };
    } catch (_: unknown) {
      return {
        result: "invalid",
        value: {
          status: "error",
          statusCode: 400,
          error: "Invalid JSON in request body",
          code: "invalid_json",
        },
      };
    }
  }

  const { result, value } = validateBody(rawBody);
  if (result === "invalid") {
    return value;
  }

  const request = JSON.parse(value) as Request;
  void request;
  // const response = await openai.chat.completions.create({
  //   model: "gpt-3.5-turbo",
  //   messages: [{ role: "user", content: request.message }],
  //   stream: false,
  // });

  return {
    status: "success",
    message: "To be implemented",
  };
}

export const handler: Handler = async (
  event: APIGatewayEvent,
  context: Context,
): Promise<APIGatewayProxyResult> => {
  console.log("event", JSON.stringify(event, null, 2));
  console.log("context", context);

  try {
    const response = await chat(event.body);
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        error: "Hello",
        statusCode: 500,
      }),
    };
  }
};
