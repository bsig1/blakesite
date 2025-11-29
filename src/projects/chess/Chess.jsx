import { useState, useEffect } from "react";
import ChessLobby from "./ChessLobby";
import ChessGame from "./ChessGame";

import { generateClient } from "aws-amplify/data";
import { fetchUserAttributes } from "aws-amplify/auth";

const client = generateClient();

async function ensureUserElo() {
  try {
    if (typeof window === "undefined") return;

    // 1. Get logged-in user
    const attrs = await fetchUserAttributes().catch(() => null);
    if (!attrs || !attrs.sub) {
      console.log("[ELO] No logged-in user, skipping Elo init");
      return;
    }

    const userId = attrs.sub;

    const authOptions = { authMode: "userPool" };

    // 2. Try to GET existing UserElo
    const getResp = await client.models.UserElo.get({ id: userId }, authOptions);

    if (getResp.errors && getResp.errors.length) {
      console.error("[ELO] get UserElo GraphQL error:", getResp.errors);
      return; // don’t try to create if we can’t even read
    }

    if (getResp.data) {
      console.log("[ELO] Existing Elo for", userId, "=>", getResp.data.elo);
      return;
    }

    // 3. Create default Elo if missing
    const createResp = await client.models.UserElo.create(
      { id: userId, elo: 1200 },
      authOptions
    );

    if (createResp.errors && createResp.errors.length) {
      console.error("[ELO] create UserElo GraphQL error:", createResp.errors);
      return;
    }

    console.log("[ELO] Created new UserElo for", userId, "=>", createResp.data.elo);
  } catch (err) {
    console.error("[ELO] Failed to ensure user Elo", err);
  }
}


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

  // On first mount of the chess app, ensure the user has an Elo row
  useEffect(() => {
    ensureUserElo();
  }, []);

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
