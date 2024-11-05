import React, { useState } from "react";

import { Chat } from "@/components/Chat";
import { Model, models } from "@/types";

const App: React.FC = () => {
  const [defaultModel, setDefaultModel] = useState<Model>(models[0]);

  return (
    <div className="h-screen">
      <div className="bg-gray-100 p-4">
        <select
          value={defaultModel}
          onChange={(e) => {
            const model = models.find((name) => name === e.target.value);
            if (model) {
              setDefaultModel(model);
            }
          }}
          className="p-2 rounded"
        >
          {models.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
      </div>
      <Chat defaultModel={defaultModel} />
    </div>
  );
};

export default App;
