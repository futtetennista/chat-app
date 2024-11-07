import type { Request, Response } from "@contracts/index";
import {
  APIGatewayEvent,
  APIGatewayProxyResult,
  Context,
  Handler,
} from "aws-lambda";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

async function chat(body: string): Promise<Response> {
  if (!body) {
    return {
      status: "error",
      statusCode: 400,
      errorMessage: "Invalid request body (empty)",
      errorCode: "empty_request_body",
    };
  }

  let request;
  try {
    request = JSON.parse(body);
    if (!request.message || typeof request.message !== "string") {
      return {
        status: "error",
        statusCode: 400,
        errorMessage:
          "Invalid request format: message property must be a string",
        errorCode: "invalid_message",
      };
    }
  } catch (_: unknown) {
    return {
      status: "error",
      statusCode: 400,
      errorMessage: "Invalid JSON in request body",
      errorCode: "invalid_json",
    };
  }

  const request = JSON.parse(body) as Request;
  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: request.message }],
    stream: false,
  });

  return response.choices[0].message;
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
        errorMessage: "Hello",
        statusCode: 500,
      }),
    };
  }
};
