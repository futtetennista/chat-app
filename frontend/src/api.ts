import type { Request, Response } from "@contracts/index";

import { apiPath } from "@/constants";

export default {
  async sendMessage({ model, message, history }: Request): Promise<Response> {
    console.log(`Sending message "${message}"" to model "${model}"`);

    const response = await fetch(apiPath, {
      method: "POST",
      body: JSON.stringify({ message, history, model }),
    });
    const data = await response.json();
    return data.response;
  },
};
