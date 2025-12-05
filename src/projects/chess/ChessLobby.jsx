import { useEffect, useState } from "react";
import { Amplify } from "aws-amplify";
import outputs from "../../../amplify_outputs.json";
Amplify.configure(outputs);

import { generateClient } from "aws-amplify/data";
import { Chess } from "chess.js";

import "./ChessLobby.css";

const client = generateClient();

export default function ChessLobby({ activeGameId, onSelectGame }) {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const [isOpen, setIsOpen] = useState(true);

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
    return () => sub?.unsubscribe();
  }, []);

  async function createNewGame() {
    try {
      setCreating(true);
      setError("");

      const chess = new Chess();
      const now = new Date().toISOString();
      const ttlSeconds = 24 * 60 * 60;
      const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;

      const res = await client.models.Game.create({
        fen: chess.fen(),
        turn: "w",
        status: "WAITING",
        createdAt: now,
        expiresAt,
      });

      if (res.errors?.length || !res.data) {
        setError("Could not create game");
        return;
      }

      onSelectGame(res.data.id);
    } catch (e) {
      setError("Could not create game");
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    if (!loading && activeGameId) {
      const exists = games.some((g) => g.id === activeGameId);
      if (!exists) onSelectGame(null);
    }
  }, [loading, games, activeGameId, onSelectGame]);

  return (
    <div className={`chess-lobby ${isOpen ? "is-open" : "is-closed"}`}>
      <div className="lobby-header">
        <button
          className="toggle-button"
          onClick={() => setIsOpen((p) => !p)}
        >
          {isOpen ? "Hide ▾" : "Show ▸"}
        </button>
      </div>

      {isOpen && (
        <>
          <h2 className="lobby-title">Chess Lobby</h2>

          <div className="lobby-subheader">
            <h2 className="games-title">Games:</h2>

            <button
              className="create-game-button"
              onClick={createNewGame}
              disabled={creating}
            >
              {creating ? "Creating..." : "Create New Game"}
            </button>
          </div>

          {loading && <p className="lobby-text">Loading games...</p>}
          {error && <p className="lobby-error">{error}</p>}
          {!loading && games.length === 0 && (
            <p className="lobby-text">No games yet. Create one!</p>
          )}

          <ul className="games-list">
            {games.map((g) => (
              <li
                key={g.id}
                className={`game-item ${
                  g.id === activeGameId ? "active" : ""
                }`}
                onClick={() => onSelectGame(g.id)}
              >
                <div className="game-status">
                  {g.status === "IN_PROGRESS"
                    ? "In Progress"
                    : g.status === "WAITING"
                    ? "Waiting"
                    : g.status}
                </div>

                <div className="game-turn">
                  Turn:{" "}
                  {g.status === "IN_PROGRESS"
                    ? g.turn === "w"
                      ? "White"
                      : "Black"
                    : "-"}
                </div>

                <div className="game-players">
                  White: {g.whitePlayerName || "—"} | Black:{" "}
                  {g.blackPlayerName || "—"}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
