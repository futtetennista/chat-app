import { Message, Model } from "@/types";

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

    const response = await fetch("/api", {
      method: "POST",
      body: JSON.stringify({ message, history, model }),
    });
    const data = await response.json();
    return data.response;
  },
};
