import {
  APIGatewayEvent,
  APIGatewayProxyResult,
  Context,
  Handler,
} from "aws-lambda";
import { stat } from "fs";
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

async function chat(message: string) {
  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: message }],
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
    if (!event.body) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          errorMessage: "Hello",
          statusCode: 400,
        }),
      };
    }

    const eventPayload = JSON.parse(event.body);
    const result = await chat(eventPayload);
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        response: "Hello",
      }),
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
