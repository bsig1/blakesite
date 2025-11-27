import { useState, useEffect } from "react";
import ChessLobby from "./ChessLobby";
import ChessGame from "./ChessGame";

export default function ChessApp() {
  const [activeGameId, setActiveGameId] = useState(() => {
    if (typeof window === "undefined") return null; // SSR safety
    return window.localStorage.getItem("activeGameId");
  });

  // whenever activeGameId changes, sync it to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (activeGameId) {
      window.localStorage.setItem("activeGameId", activeGameId);
    } else {
      window.localStorage.removeItem("activeGameId");
    }
  }, [activeGameId]);

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <ChessLobby
        activeGameId={activeGameId}
        onSelectGame={setActiveGameId}
      />
      <div style={{ flex: 1, padding: "1rem" }}>
        <ChessGame
          gameId={activeGameId}
          onGameDeleted={() => setActiveGameId(null)}
        />
      </div>
    </div>
  );
}
