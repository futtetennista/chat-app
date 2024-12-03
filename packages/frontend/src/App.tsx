import { defaultModel, type Model } from "@chat-app/contracts";
import React from "react";
import styled from "styled-components";
import { v4 } from "uuid";

import Chat from "./components/ChatV2";

const AppContainer = styled.div`
  display: flex;
  // flex-direction: column;
  // overflow: hidden;
  // height: 100%;
  // width: 100%;

  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  // width: 100%;
  // height: 100vh;
  overflow: hidden;

  justify-content: space-between;
  padding: 30px;
  background-color: #f0f0f0;
`;

const App: React.FC = () => {
  console.log("App component rendered");
  const [model, setModel] = React.useState<Model>(defaultModel);
  const [chatId, setChatId] = React.useState<string>(v4());

  React.useEffect(() => {
    const storedChatId = sessionStorage.getItem("app.currentChatId");
    if (!storedChatId) {
      console.log("No chatId found in sessionStorage, generating a new one");
      sessionStorage.setItem("app.currentChatId", chatId);
      setChatId(chatId);
    } else {
      console.log("Found chatId in sessionStorage", storedChatId);
      setChatId(storedChatId);
    }
  }, []);

  return (
    <AppContainer>
      {chatId && <Chat modelState={[model, setModel]} chatId={chatId} />}
    </AppContainer>
  );
};

export default App;
