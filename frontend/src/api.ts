import { Message, Model } from "@/types";

export default {
  async sendMessage({
    model,
    message,
    history: _3,
  }: {
    model: Model;
    message: string;
    history: Message[];
  }): Promise<string> {
    // const response = await fetch(`/api?model=${model}`, {
    //   method: "POST",
    //   body: JSON.stringify({ message, history }),
    // });
    // const data = await response.json();
    // return data.response;
    console.log(`Sending message "${message}"" to model "${model}"`);

    return "Hello, world!";
  },
};
