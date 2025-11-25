// src/ChessLobby.jsx

import { useEffect, useState } from "react";
import { Amplify } from "aws-amplify";
import outputs from "../../amplify_outputs.json";
Amplify.configure(outputs);

import { generateClient } from "aws-amplify/data";
import { Chess } from "chess.js";

const client = generateClient();

export default function ChessLobby({ activeGameId, onSelectGame }) {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let sub;

    async function subscribe() {
      setLoading(true);
      setError("");

      sub = client.models.Game.observeQuery(
        {},
        { authMode: "identityPool" }
    ).subscribe({
          next: ({ items }) => {
            // Sort by createdAt desc (newest first) if present
            const sorted = [...items].sort((a, b) => {
              if (!a.createdAt || !b.createdAt) return 0;
              return a.createdAt < b.createdAt ? 1 : -1;
            });
            setGames(sorted);
            setLoading(false);
          },
          error: (err) => {
            console.error("Game lobby observeQuery error:", err);
            setError("Failed to load games");
            setLoading(false);
          },
        });
    }

    subscribe();

    return () => {
      if (sub) sub.unsubscribe();
    };
  }, []);

  async function createNewGame() {
    try {
      setCreating(true);
      setError("");

      const now = new Date().toISOString();
      const chess = new Chess();

      const res = await client.models.Game.create({
        // let Amplify generate id, or pass your own if you prefer
        fen: chess.fen(),
        turn: "w",
        status: "WAITING", // lobby view: not yet started
        createdAt: now,
      });

      const newGame = res.data;
      onSelectGame(newGame.id);
    } catch (e) {
      console.error("Failed to create game:", e);
      setError("Could not create game");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div
      style={{
        padding: "1rem",
        borderRight: "1px solid #ddd",
        minWidth: "320px",
      }}
    >
      <h2>Chess Lobby</h2>

      <button onClick={createNewGame} disabled={creating}>
        {creating ? "Creating..." : "Create New Game"}
      </button>

      {loading && <p>Loading games...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {!loading && games.length === 0 && <p>No games yet. Create one!</p>}

      <ul style={{ listStyle: "none", padding: 0, marginTop: "1rem" }}>
        {games.map((g) => {
          const isActive = g.id === activeGameId;
          return (
            <li
              key={g.id}
              style={{
                padding: "0.5rem 0.75rem",
                marginBottom: "0.25rem",
                borderRadius: "8px",
                border: "1px solid #ddd",
                background: isActive ? "#505050ff" : "#313030ff",
                cursor: "pointer",
              }}
              onClick={() => onSelectGame(g.id)}
            >
              <div style={{ fontWeight: 600 }}>
                Game {g.id.slice(0, 8)}
                {" · "}
                <span>
                  {g.status === "IN_PROGRESS"
                    ? "In Progress"
                    : g.status === "WAITING"
                    ? "Waiting"
                    : g.status}
                </span>
              </div>
              <div style={{ fontSize: "0.85rem", opacity: 0.8 }}>
                Turn:{" "}
                {g.status === "IN_PROGRESS"
                  ? g.turn === "w"
                    ? "White"
                    : "Black"
                  : "-"}
              </div>
              <div style={{ fontSize: "0.8rem", opacity: 0.7 }}>
                White: {g.whitePlayerId || "—"} | Black:{" "}
                {g.blackPlayerId || "—"}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
