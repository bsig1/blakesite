// src/ChessApp.jsx

import { useState } from "react";
import ChessLobby from "./ChessLobby";
import ChessGame from "./ChessGame";

export default function ChessApp() {
  const [activeGameId, setActiveGameId] = useState(null);

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <ChessLobby
        activeGameId={activeGameId}
        onSelectGame={setActiveGameId}
      />
      <div style={{ flex: 1, padding: "1rem" }}>
        <ChessGame gameId={activeGameId} />
      </div>
    </div>
  );
}
