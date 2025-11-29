import { useEffect, useState } from "react";
import { Amplify } from "aws-amplify";
import outputs from "../../../amplify_outputs.json";
Amplify.configure(outputs);

import { generateClient } from "aws-amplify/data";
import { Chess } from "chess.js";

const client = generateClient();

export default function ChessLobby({ activeGameId, onSelectGame }) {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const [isOpen, setIsOpen] = useState(true);

  // Single subscription with TTL filtering
  useEffect(() => {
    let sub;

    async function subscribe() {
      setLoading(true);
      setError("");

      sub = client.models.Game
        .observeQuery({}, { authMode: "identityPool" })
        .subscribe({
          next: ({ items }) => {
            const nowSec = Math.floor(Date.now() / 1000);

            // Filter out expired games (or keep all if expiresAt is not set)
            const valid = items.filter(
              (g) => !g.expiresAt || g.expiresAt > nowSec
            );

            const sorted = [...valid].sort((a, b) => {
              if (!a.createdAt || !b.createdAt) return 0;
              return a.createdAt < b.createdAt ? 1 : -1;
            });

            setGames(sorted);
            setLoading(false);
          },
          error: (err) => {
            console.error("[LOBBY] Game lobby observeQuery error:", err);
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

  // Create new game with safe result handling
  async function createNewGame() {
    try {
      setCreating(true);
      setError("");

      const chess = new Chess();
      const now = new Date().toISOString();

      const ttlSeconds = 1 * 24 * 60 * 60; // 1 day
      const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;

      const res = await client.models.Game.create({
        fen: chess.fen(),
        turn: "w",
        status: "WAITING",
        createdAt: now,
        expiresAt,
      });

      console.log("[CREATE GAME] result:", res);

      // If backend rejected the create, data will be null and errors set
      if (res.errors && res.errors.length > 0) {
        console.error("[CREATE GAME] errors:", res.errors);
        setError("Could not create game (server error)");
        return;
      }

      if (!res.data) {
        console.error("[CREATE GAME] no data returned:", res);
        setError("Could not create game");
        return;
      }

      onSelectGame(res.data.id);
    } catch (e) {
      console.error("Failed to create game:", e);
      setError("Could not create game");
    } finally {
      setCreating(false);
    }
  }

  // if the remembered activeGameId no longer exists, clear it
  useEffect(() => {
    if (!loading && activeGameId) {
      const exists = games.some((g) => g.id === activeGameId);
      if (!exists) {
        onSelectGame(null);
      }
    }
  }, [loading, games, activeGameId, onSelectGame]);

  return (
    <div
      style={{
        padding: "1rem",
        borderRight: isOpen ? "1px solid #ddd" : "none",
      }}
    >
      {/* Toggle */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: "0.5rem",
        }}
      >
        <button
          style={{
            marginLeft: "auto",
            fontSize: "0.85rem",
            padding: "0.25rem 0.5rem",
            cursor: "pointer",
          }}
          onClick={() => setIsOpen((p) => !p)}
        >
          {isOpen ? "Hide ▾" : "Show ▸"}
        </button>
      </div>

      {/* Collapsible content */}
      {isOpen && (
        <>
          <h2 style={{ marginBottom: "30px" }}>Chess Lobby</h2>
          <h2 style={{ marginBottom: "30px" }}>Games: </h2>
          <button
            style={{ marginLeft: "auto" }}
            onClick={createNewGame}
            disabled={creating}
          >
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
                    White: {g.whitePlayerName || "—"} | Black:{" "}
                    {g.blackPlayerName || "—"}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
