import { Message, Model } from "@/types";

export default {
  async sendMessage({
    model: _1,
    message: _2,
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
    return "Hello, world!";
  },
};
