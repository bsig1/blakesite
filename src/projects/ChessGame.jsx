// src/ChessGame.jsx

import "./Chess.css";

import { useRef, useState, useEffect } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";

import { Amplify } from "aws-amplify";
import outputs from "../../amplify_outputs.json";
Amplify.configure(outputs);

import { generateClient } from "aws-amplify/data";
import { getCurrentUser } from "aws-amplify/auth";

const client = generateClient();

// Helper to derive Game.status from chess.js state
function getGameStatus(chessGame) {
  if (chessGame.isCheckmate()) return "CHECKMATE";
  if (chessGame.isStalemate()) return "STALEMATE";
  if (chessGame.isThreefoldRepetition()) return "DRAW_THREEFOLD";
  if (chessGame.isInsufficientMaterial()) return "DRAW_INSUFFICIENT_MATERIAL";
  if (chessGame.isDraw()) return "DRAW";
  return "IN_PROGRESS";
}

export default function ChessGame({ gameId }) {
  const chessRef = useRef(new Chess());

  // Auth info
  const playerIdRef = useRef(null); // Cognito userId (sub)
  const [playerName, setPlayerName] = useState(null);
  const [authLoaded, setAuthLoaded] = useState(false);

  // Game & UI state
  const [position, setPosition] = useState(chessRef.current.fen());
  const [message, setMessage] = useState("");
  const [gameModel, setGameModel] = useState(null); // current Game row

  // Load current user from Amplify Auth
  useEffect(() => {
    async function loadUser() {
      try {
        const { userId, username } = await getCurrentUser();
        playerIdRef.current = userId;
        setPlayerName(username || userId);
      } catch (e) {
        console.log("Not signed in or Auth not configured:", e);
        playerIdRef.current = "guest";
        setPlayerName("Guest");
      } finally {
        setAuthLoaded(true);
      }
    }

    loadUser();
  }, []);

  // Ensure Game exists, then subscribe to it as the source of truth
  useEffect(() => {
    if (!gameId) return;

    let sub;

    async function initAndSubscribe() {
      const now = new Date().toISOString();

      // 1. Ensure there's a Game row for this gameId
      let gameRes = await client.models.Game.get(
        { id: gameId },
        { authMode: "identityPool" } // 👈 force identityPool
      );

      if (!gameRes.data) {
        const freshChess = new Chess();
        gameRes = await client.models.Game.create(
          {
            id: gameId,
            fen: freshChess.fen(),
            turn: "w",
            status: "WAITING", // waiting for players to join
            createdAt: now,
          },
          { authMode: "identityPool" } // 👈
        );
      }

      // 2. Live subscription to this Game
      sub = client.models.Game
        .observeQuery(
          { filter: { id: { eq: gameId } } },
          { authMode: "identityPool" } // 👈
        )
        .subscribe({
          next: ({ items }) => {
            if (!items || items.length === 0) return;

            const game = items[0];
            setGameModel(game);

            const g = new Chess();
            g.load(game.fen);
            chessRef.current = g;
            setPosition(g.fen());

            const statusText =
              game.status === "IN_PROGRESS"
                ? `Turn: ${game.turn === "w" ? "White" : "Black"}`
                : `Game status: ${game.status}`;

            setMessage(`Synced game. ${statusText}`);
          },
          error: (err) => {
            console.error("Game.observeQuery error:", err);
            setMessage("Error syncing game");
          },
        });
    }

    initAndSubscribe();

    return () => {
      if (sub) sub.unsubscribe();
    };
  }, [gameId]);

  // Derived role info
  const playerId = playerIdRef.current;
  const isWhite = gameModel?.whitePlayerId === playerId;
  const isBlack = gameModel?.blackPlayerId === playerId;

  // --- JOIN HANDLERS ---

  async function joinAs(color) {
    if (!gameModel || !authLoaded) return;
    if (!playerId || playerId === "guest") {
      setMessage("You must be signed in to join a color.");
      return;
    }

    try {
      const update = { ...gameModel };

      if (color === "white") {
        if (gameModel.whitePlayerId && gameModel.whitePlayerId !== playerId) {
          setMessage("White is already taken.");
          return;
        }
        update.whitePlayerId = playerId;
        if (update.status === "WAITING") update.status = "IN_PROGRESS";
      } else if (color === "black") {
        if (gameModel.blackPlayerId && gameModel.blackPlayerId !== playerId) {
          setMessage("Black is already taken.");
          return;
        }
        update.blackPlayerId = playerId;
        if (update.status === "WAITING") update.status = "IN_PROGRESS";
      }

      await client.models.Game.update(update, {
        authMode: "identityPool", // 👈
      });
      setMessage(`Joined as ${color}.`);
    } catch (e) {
      console.error("Failed to join game:", e);
      setMessage("Failed to join game.");
    }
  }

  // --- MOVE HANDLER WITH TURN ENFORCEMENT ---

  async function onPieceDrop({ sourceSquare, targetSquare }) {
    const gameEngine = chessRef.current;

    if (!gameModel) {
      console.warn("No game model yet, ignoring move");
      return false;
    }

    if (gameModel.status !== "IN_PROGRESS") {
      setMessage("Game is not in progress.");
      return false;
    }

    const turn = gameEngine.turn(); // "w" or "b"
    if (turn === "w" && !isWhite) {
      setMessage("It's White's turn.");
      return false;
    }
    if (turn === "b" && !isBlack) {
      setMessage("It's Black's turn.");
      return false;
    }

    try {
      const move = gameEngine.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      });

      if (!move) return false;

      const newFen = gameEngine.fen();
      const status = getGameStatus(gameEngine);
      const newTurn = gameEngine.turn();

      setPosition(newFen);
      setMessage("Sending move to backend...");

      const now = new Date().toISOString();

      // 1. Save Move row
      await client.models.Move.create(
        {
          gameId,
          from: sourceSquare,
          to: targetSquare,
          san: move.san,
          fenAfter: newFen,
          createdAt: now,
        },
        { authMode: "identityPool" } // 👈
      );

      // 2. Update Game row with new FEN + turn + status
      await client.models.Game.update(
        {
          ...gameModel,
          fen: newFen,
          turn: newTurn,
          status,
        },
        { authMode: "identityPool" } // 👈
      );

      if (status === "IN_PROGRESS") {
        setMessage("Move sent!");
      } else {
        setMessage(`Move sent – game over: ${status}`);
      }

      return true;
    } catch (e) {
      console.error("Illegal move or error:", e);
      return false;
    }
  }

  // --- RESET GAME ---

  async function resetGame() {
    if (!gameId) return;

    setMessage("Resetting game...");

    const fresh = new Chess();
    const freshFen = fresh.fen();

    const movesRes = await client.models.Move.list(
      {
        filter: { gameId: { eq: gameId } },
      },
      { authMode: "identityPool" } // 👈
    );

    await Promise.all(
      movesRes.data.map((m) =>
        client.models.Move.delete({ id: m.id }, { authMode: "identityPool" })
      )
    );

    if (gameModel) {
      await client.models.Game.update(
        {
          ...gameModel,
          fen: freshFen,
          turn: "w",
          status: "WAITING", // back to lobby state
        },
        { authMode: "identityPool" } // 👈
      );
    }

    chessRef.current = fresh;
    setPosition(freshFen);

    setMessage("Game reset – all moves cleared");
  }

  const chessboardOptions = {
    position,
    onPieceDrop,
  };

  if (!gameId) {
    return <p>Select a game from the lobby to begin.</p>;
  }

  const roleLabel = isWhite
    ? "You are White"
    : isBlack
    ? "You are Black"
    : "You are a spectator";

  return (
    <>
      <h1>Amplify Multiplayer Chess (Prototype)</h1>

      <div style={{ marginBottom: "0.5rem" }}>
        <p>
          Logged in as: <strong>{playerName ?? "Loading..."}</strong>
        </p>
        <strong>{roleLabel}</strong>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
        {!isWhite && !gameModel?.whitePlayerId && (
          <button onClick={() => joinAs("white")} disabled={!authLoaded}>
            Join as White
          </button>
        )}
        {!isBlack && !gameModel?.blackPlayerId && (
          <button onClick={() => joinAs("black")} disabled={!authLoaded}>
            Join as Black
          </button>
        )}
      </div>

      <div className="chess_wrapper" style={{ padding: "1rem" }}>
        <Chessboard options={chessboardOptions} />
      </div>

      <button onClick={resetGame} style={{ marginTop: "1rem" }}>
        Reset game (clear moves)
      </button>

      <p>{message}</p>

      {gameModel && (
        <p>
          <strong>Status:</strong> {gameModel.status}{" "}
          {gameModel.status === "IN_PROGRESS" &&
            `(Turn: ${gameModel.turn === "w" ? "White" : "Black"})`}
        </p>
      )}
    </>
  );
}
