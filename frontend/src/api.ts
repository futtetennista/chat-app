import type { Message, Model } from "@/shared";
import { apiPath } from "@/shared";

export default {
  async sendMessage({
    model,
    message,
    history,
  }: {
    model: Model;
    message: string;
    history: Message[];
  }): Promise<string> {
    console.log(`Sending message "${message}"" to model "${model}"`);

    const response = await fetch(apiPath, {
      method: "POST",
      body: JSON.stringify({ message, history, model }),
    });
    const data = await response.json();
    return data.response;
  },
};
