// src/ChessGame.jsx

import "./ChessGame.css";

import { useRef, useState, useEffect } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";

import { Amplify } from "aws-amplify";
import outputs from "../../../amplify_outputs.json";
Amplify.configure(outputs);

import { generateClient } from "aws-amplify/data";
import { fetchUserAttributes } from "aws-amplify/auth";

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

function getGameScore(chessGame) {
    switch (getGameStatus(chessGame)) {
        case "CHECKMATE": return 1;
        case "STALEMATE": return 0.5;
        case "DRAW_THREEFOLD": return 0.5;
        case "DRAW_INSUFFICIENT_MATERIAL": return 0.5;
        case "DRAW": return 0.5;
        default: return NaN;
    }
}

// Expected score of player A vs player B
function expectedScore(ratingA, ratingB) {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Update Elo for a two-player game.
 *
 * scoreWhite: 1   = white win
 *             0.5 = draw
 *             0   = black win
 *
 * Returns [newWhite, newBlack]
 */
function updateEloPair(whiteElo, blackElo, scoreWhite, K = 32) {
    const scoreBlack = 1 - scoreWhite;

    const expWhite = expectedScore(whiteElo, blackElo);
    const expBlack = expectedScore(blackElo, whiteElo);

    const newWhite = Math.round(whiteElo + K * (scoreWhite - expWhite));
    const newBlack = Math.round(blackElo + K * (scoreBlack - expBlack));

    return [newWhite, newBlack];
}

function isPromotionMove(gameEngine, sourceSquare, targetSquare) {
    const piece = gameEngine.get(sourceSquare); // chess.js: { type, color } or null
    if (!piece || piece.type !== "p") return false;

    const targetRank = targetSquare[1]; // "1".."8"

    // White promotes on rank 8, black promotes on rank 1
    if (piece.color === "w" && targetRank === "8") return true;
    if (piece.color === "b" && targetRank === "1") return true;

    return false;
}


export default function ChessGame({ gameId, onGameDeleted }) {
    const chessRef = useRef(new Chess());

    // Auth info
    const playerIdRef = useRef(null); // Cognito userId (sub)
    const [playerName, setPlayerName] = useState(null);
    const [authLoaded, setAuthLoaded] = useState(false);

    // Game & UI state
    const [position, setPosition] = useState(chessRef.current.fen());
    const [message, setMessage] = useState("");
    const [gameModel, setGameModel] = useState(null); // current Game row
    const [moveFrom, setMoveFrom] = useState("");
    const [optionSquares, setOptionSquares] = useState({});
    const [opening, setOpening] = useState("");
    const [eloByUserId, setEloByUserId] = useState({});
    const [pendingPromotion, setPendingPromotion] = useState(null);
    const [boardOrientation, setBoardOrientation] = useState("white");

    // Move list state
    const [moves, setMoves] = useState([]);

    // separate "view" FEN for jumping around history
    const [viewFen, setViewFen] = useState(null);

    // Load current user from Amplify Auth
    useEffect(() => {
        async function loadUser() {
            try {
                const attrs = await fetchUserAttributes();

                // Stable player id (sub)
                const sub = attrs.sub;
                playerIdRef.current = sub || "guest";

                // Choose a display name
                const displayName =
                    attrs.preferred_username ||
                    attrs.name ||
                    (attrs.email ? attrs.email.split("@")[0] : null) ||
                    sub ||
                    "Guest";

                setPlayerName(displayName);
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
                { authMode: "identityPool" } // force identityPool
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
                        drawOfferBy: null,
                    },
                    { authMode: "identityPool" }
                );
            }

            // 2. Live subscription to this Game
            sub = client.models.Game
                .observeQuery(
                    { filter: { id: { eq: gameId } } },
                    { authMode: "identityPool" }
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

    // Subscribe to Moves for this game (for move list)
    useEffect(() => {
        if (!gameId) return;

        let sub;

        async function subscribeMoves() {
            sub = client.models.Move
                .observeQuery(
                    { filter: { gameId: { eq: gameId } } },
                    { authMode: "identityPool" }
                )
                .subscribe({
                    next: ({ items }) => {
                        // Sort by createdAt ascending so moves are in order
                        const sorted = [...items].sort((a, b) => {
                            const aTime = a.createdAt || "";
                            const bTime = b.createdAt || "";
                            return aTime.localeCompare(bTime);
                        });
                        setMoves(sorted);
                    },
                    error: (err) => {
                        console.error("Move.observeQuery error:", err);
                    },
                });
        }

        subscribeMoves();

        return () => {
            if (sub) sub.unsubscribe();
        };
    }, [gameId]);

    // Derived role info
    const playerId = playerIdRef.current;
    const isWhite =
        !!playerId &&
        playerId !== "guest" &&
        gameModel?.whitePlayerId === playerId;

    const isBlack =
        !!playerId &&
        playerId !== "guest" &&
        gameModel?.blackPlayerId === playerId;

    // Auto-orient board when you join as a color
    useEffect(() => {
        if (isWhite) {
            setBoardOrientation("white");
        } else if (isBlack) {
            setBoardOrientation("black");
        }
        // if spectator, don't auto-change orientation
    }, [isWhite, isBlack]);

    useEffect(() => {
        async function loadElos() {
            if (!gameModel) return;

            const ids = [
                gameModel.whitePlayerId,
                gameModel.blackPlayerId,
            ].filter(Boolean);

            if (!ids.length) return;

            try {

                const results = await Promise.all(
                    ids.map((id) =>
                        client.models.UserElo.get({ id }, { authMode: "identityPool" })
                    )
                );

                const newMap = {};
                results.forEach((resp, i) => {
                    const id = ids[i];
                    if (resp.data?.elo != null) {
                        newMap[id] = resp.data.elo;
                    }
                });

                setEloByUserId((prev) => ({ ...prev, ...newMap }));
            } catch (err) {
                console.error("[ELO] Failed to load elos for players", err);
            }
        }

        loadElos();
    }, [gameModel]);

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
                update.whitePlayerName = playerName;
                if (update.status === "WAITING") update.status = "IN_PROGRESS";
            } else if (color === "black") {
                if (gameModel.blackPlayerId && gameModel.blackPlayerId !== playerId) {
                    setMessage("Black is already taken.");
                    return;
                }

                update.blackPlayerId = playerId;
                update.blackPlayerName = playerName;
                if (update.status === "WAITING") update.status = "IN_PROGRESS";
            }

            await client.models.Game.update(update, {
                authMode: "identityPool",
            });

            // Auto-flip immediately on join as color
            if (color === "black") {
                setBoardOrientation("black");
            } else if (color === "white") {
                setBoardOrientation("white");
            }

            setMessage(`Joined as ${color}.`);
        } catch (e) {
            console.error("Failed to join game:", e);
            setMessage("Failed to join game.");
        }
    }

    // auth mode: keep this consistent with your other models
    const ELO_AUTH = { authMode: "identityPool" }; // or "userPool" if that’s what works

    async function updateElo(turn, score) {
        // Only handle decisive games for now; your getGameScore
        // is giving 1 for "game over" and NaN/0 otherwise.
        if (score !== 1) return;

        if (!gameModel) return;

        const whiteUserId = gameModel.whitePlayerId;
        const blackUserId = gameModel.blackPlayerId;

        if (!whiteUserId || !blackUserId) {
            console.warn("[ELO] Missing player ids, skipping update");
            return;
        }

        // Determine whiteScore from who just moved.
        // `turn` is the side that made the move (before move was applied).
        // - if turn === "w", white just played and won -> whiteScore = 1
        // - if turn === "b", black just played and won -> whiteScore = 0
        const whiteScore = turn === "w" ? 1 : 0;

        try {
            // 1. Get current Elos (default to 1200 if missing)
            const [whiteResp, blackResp] = await Promise.all([
                client.models.UserElo.get({ id: whiteUserId }, { authMode: "identityPool" }),
                client.models.UserElo.get({ id: blackUserId }, { authMode: "identityPool" }),
            ]);

            if (whiteResp.errors?.length) {
                console.error("[ELO] get white Elo error", whiteResp.errors);
                return;
            }
            if (blackResp.errors?.length) {
                console.error("[ELO] get black Elo error", blackResp.errors);
                return;
            }

            const whiteElo = whiteResp.data?.elo ?? 1200;
            const blackElo = blackResp.data?.elo ?? 1200;

            // 2. Compute new Elos
            const [newWhiteElo, newBlackElo] = updateEloPair(
                whiteElo,
                blackElo,
                whiteScore
            );

            // 3. Write back
            const [whiteUpdate, blackUpdate] = await Promise.all([
                client.models.UserElo.update(
                    { id: whiteUserId, elo: newWhiteElo },
                    { authMode: "identityPool" }
                ),
                client.models.UserElo.update(
                    { id: blackUserId, elo: newBlackElo },
                    { authMode: "identityPool" }
                ),
            ]);

            if (whiteUpdate.errors?.length || blackUpdate.errors?.length) {
                console.error("[ELO] update Elo errors", {
                    white: whiteUpdate.errors,
                    black: blackUpdate.errors,
                });
                return;
            }

            console.log("[ELO] Updated", {
                white: { id: whiteUserId, from: whiteElo, to: newWhiteElo },
                black: { id: blackUserId, from: blackElo, to: newBlackElo },
            });
        } catch (err) {
            console.error("[ELO] Failed to update Elo", err);
        }
    }

    // --- MOVE HANDLER WITH TURN ENFORCEMENT ---

    async function applyMove({ from, to, promotion }) {
        const gameEngine = chessRef.current;

        // Do the actual chess.js move
        const move = gameEngine.move({
            from,
            to,
            promotion: promotion || "q", // default to queen if not specified
        });

        if (!move) return false;

        const newFen = gameEngine.fen();
        const status = getGameStatus(gameEngine);
        const score = getGameScore(gameEngine);
        const turnBefore = move.color; // "w" or "b" who just moved
        const newTurn = gameEngine.turn();

        // Elo update if your getGameScore says it's over
        if (score) {
            await updateElo(turnBefore, score);
        }

        setPosition(newFen);
        setMessage("Sending move to backend...");

        const now = new Date().toISOString();

        // 1. Save Move row
        await client.models.Move.create(
            {
                gameId,
                from,
                to,
                san: move.san,
                fenAfter: newFen,
                createdAt: now,
            },
            { authMode: "identityPool" }
        );

        // 2. Update Game row
        await client.models.Game.update(
            {
                ...gameModel,
                fen: newFen,
                turn: newTurn,
                status,
                drawOfferBy: null,
            },
            { authMode: "identityPool" }
        );

        if (status === "IN_PROGRESS") {
            setMessage("Move sent!");
        } else {
            setMessage(`Move sent – game over: ${status}`);
        }

        return true;
    }


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

        // forced en passant logic (keep what you had, if you want)
        const legalMoves = gameEngine.moves({ verbose: true });
        const enPassantMoves = legalMoves.filter((m) => m.isEnPassant());
        if (enPassantMoves.length > 0) {
            const isAttemptingEnPassant = enPassantMoves.some(
                (m) => m.from === sourceSquare && m.to === targetSquare
            );
            if (!isAttemptingEnPassant) {
                setMessage("En passant is available. You *must* play it.");
                return false;
            }
        }

        // custom promotion hook
        if (isPromotionMove(gameEngine, sourceSquare, targetSquare)) {
            // save move and show promotion dialog
            setPendingPromotion({
                from: sourceSquare,
                to: targetSquare,
                color: turn, // "w" or "b"
            });
            // Tell react-chessboard we will handle it later
            return false;
        }

        // Normal move (no promotion)
        try {
            const ok = await applyMove({ from: sourceSquare, to: targetSquare });
            return !!ok;
        } catch (err) {
            console.error("onPieceDrop error", err);
            if (err?.message?.includes("Invalid move")) {
                setMessage("Invalid move.");
            }
            return false;
        }
    }



    // Show possible moves from a square (yellow source + dots on targets)
    function getMoveOptions(square) {
        const gameEngine = chessRef.current;
        if (!gameEngine) return false;

        const moves = gameEngine.moves({
            square,
            verbose: true,
        });


        const newSquares = {};

        for (const move of moves) {
            const fromPiece = gameEngine.get(square);
            const toPiece = gameEngine.get(move.to);

            const isCapture = toPiece && fromPiece && toPiece.color !== fromPiece.color;

            newSquares[move.to] = {
                background: isCapture
                    ? "radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)"
                    : "radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)",
                borderRadius: "50%",
            };
        }

        // Highlight the origin square in yellow
        newSquares[square] = {
            background: "rgba(255, 255, 0, 0.4)",
        };

        setOptionSquares(newSquares);
        return true;
    }


    function onSquareClick({ square, piece }) {
        // Don’t allow moves while viewing history
        if (viewFen) {
            setMessage(
                "You are viewing an earlier position. Click 'Back to live' to resume playing."
            );
            return;
        }

        const gameEngine = chessRef.current;
        if (!gameModel || !gameEngine) return;

        // ---- FIRST CLICK: choose a piece ----
        if (!moveFrom) {
            if (!piece) return; // clicked empty square

            const pieceColor = piece[0]; // "w" or "b"
            const turn = gameEngine.turn(); // "w" or "b"

            // enforce turn
            if (turn === "w" && !isWhite) return;
            if (turn === "b" && !isBlack) return;

            // enforce color
            if (pieceColor === "w" && !isWhite) return;
            if (pieceColor === "b" && !isBlack) return;

            const hasOptions = getMoveOptions(square);
            if (hasOptions) {
                setMoveFrom(square);
            }
            return;
        }

        // ---- ALREADY HAVE A SELECTION ----

        // Clicking the SAME square → deselect
        if (square === moveFrom) {
            setMoveFrom("");
            setOptionSquares({});
            return;
        }

        // Clicking ANOTHER of your own pieces → switch selection immediately
        if (piece) {
            const pieceColor = piece['pieceType'][0]; // "w" or "b"
            const turn = gameEngine.turn();
            const isYourPiece =
                (pieceColor === "w" && isWhite) || (pieceColor === "b" && isBlack);
            if (isYourPiece && turn === pieceColor) {

                const hasOptions = getMoveOptions(square);
                setMoveFrom(hasOptions ? square : "");
                return; // don't try to move from old moveFrom
            }
        }

        // treat this as a destination square and try to move
        const sourceSquare = moveFrom;
        const targetSquare = square;

        const result = handlePieceDrop({ sourceSquare, targetSquare });

        if (result) {
            // legal move → clear highlights
            setMoveFrom("");
            setOptionSquares({});
            return;
        }

        // illegal move → if we clicked some other piece (like opponent’s),
        // just clear selection (or you can keep the old behavior)
        if (piece) {
            const hasOptions = getMoveOptions(square);
            setMoveFrom(hasOptions ? square : "");
        } else {
            setMoveFrom("");
            setOptionSquares({});
        }
    }


    // wrapper so we block moves while viewing history
    function handlePieceDrop(args) {
        if (viewFen) {
            setMessage(
                "You are viewing an earlier position. Click 'Back to live' to resume playing."
            );
            return false;
        }
        return onPieceDrop(args);
    }

    // --- RESET GAME ---

    // --- PLAY AGAIN (RESET + FLIP COLORS) ---

    async function resetGame() {
        if (!gameId || !gameModel) return;

        setMessage("Starting a new game with colors flipped...");

        const fresh = new Chess();
        const freshFen = fresh.fen();

        // 1. Delete all existing moves for this game
        const movesRes = await client.models.Move.list(
            {
                filter: { gameId: { eq: gameId } },
            },
            { authMode: "identityPool" }
        );

        await Promise.all(
            movesRes.data.map((m) =>
                client.models.Move.delete(
                    { id: m.id },
                    { authMode: "identityPool" }
                )
            )
        );

        // 2. Flip colors: white <-> black (IDs and names)
        const newWhitePlayerId = gameModel.blackPlayerId || null;
        const newBlackPlayerId = gameModel.whitePlayerId || null;
        const newWhitePlayerName = gameModel.blackPlayerName || null;
        const newBlackPlayerName = gameModel.whitePlayerName || null;

        const hasBothPlayers = !!(newWhitePlayerId && newBlackPlayerId);
        const newStatus = hasBothPlayers ? "IN_PROGRESS" : "WAITING";

        // 3. Update Game row with fresh starting position + flipped colors
        await client.models.Game.update(
            {
                ...gameModel,
                fen: freshFen,
                turn: "w",
                status: newStatus,
                whitePlayerId: newWhitePlayerId,
                whitePlayerName: newWhitePlayerName,
                blackPlayerId: newBlackPlayerId,
                blackPlayerName: newBlackPlayerName,
            },
            { authMode: "identityPool" }
        );

        // 4. Update local chess + UI state
        chessRef.current = fresh;
        setPosition(freshFen);
        setViewFen(null); // back to live board

        setMessage("New game started – colors flipped.");
    }

    // Flip board button handler
    function flipBoard() {
        setBoardOrientation((prev) => (prev === "white" ? "black" : "white"));
    }

    // click handler to jump to a move's FEN
    function jumpToFen(fen, moveLabel) {
        if (!fen) return;
        setViewFen(fen);
        setMessage(`Viewing position after ${moveLabel}`);
    }

    function brating(rating) {
        if (rating <= 900) {
            return "💀"
        }
        return (
            0.12 +
            (1 / 11.42) *
            Math.log((2445.31 / (rating - 900)) - 1)
        ).toFixed(2);
    }

    // renderSeatRow: label that can act as a join button when seat is free
    function renderSeatRow(color) {

        const isWhiteColor = color === "white";

        const label = isWhiteColor ? "White" : "Black";
        const name = isWhiteColor
            ? gameModel?.whitePlayerName
            : gameModel?.blackPlayerName;

        const playerId = isWhiteColor
            ? gameModel?.whitePlayerId
            : gameModel?.blackPlayerId;

        const seatTaken = !!playerId;
        const youAreColor = isWhiteColor ? isWhite : isBlack;
        const canJoin = !seatTaken && !youAreColor;

        const handleClick = () => {
            if (canJoin) {
                joinAs(color);
            }
        };

        const elo = playerId ? eloByUserId[playerId] : null;

        // apply transformation
        let displayText;
        if (name) {
            if (elo != null) {
                displayText = `${name} (MCBAC ${brating(elo)})`;
            } else {
                displayText = `${name} (Unrated)`;
            }
        } else {
            displayText = canJoin ? "Click to join" : "—";
        }

        return (
            <button
                type="button"
                onClick={handleClick}
                disabled={!canJoin || !authLoaded}
                style={{
                    marginTop: "8px",
                    marginBottom: "8px",
                    background: "none",
                    border: "none",
                    padding: 0,
                    textAlign: "left",
                    font: "inherit",
                    cursor: canJoin ? "pointer" : "default",
                    color: canJoin ? "#4caf50" : "inherit",
                }}
            >
                <strong>{label}:</strong>{" "}
                {displayText}
            </button>
        );
    }


    async function deleteGame() {
        if (!gameId) return;

        const confirmed = window.confirm(
            "Are you sure you want to permanently delete this game?\nThis cannot be undone."
        );
        if (!confirmed) return;

        setMessage("Deleting game...");

        try {
            // 1. Delete all moves
            const movesRes = await client.models.Move.list(
                { filter: { gameId: { eq: gameId } } },
                { authMode: "identityPool" }
            );

            await Promise.all(
                movesRes.data.map((m) =>
                    client.models.Move.delete({ id: m.id }, { authMode: "identityPool" })
                )
            );

            // 2. Delete game itself
            await client.models.Game.delete(
                { id: gameId },
                { authMode: "identityPool" }
            );

            setMessage("Game deleted.");

            // Call parent callback so it can clear selection
            if (typeof onGameDeleted === "function") {
                onGameDeleted();
            }

        } catch (err) {
            console.error("Failed to delete game:", err);
            setMessage("Failed to delete game.");
        }
    }
    async function offerDraw() {
        if (!gameModel || !authLoaded) return;

        if (!isWhite && !isBlack) {
            setMessage("Only players can offer a draw.");
            return;
        }

        if (gameModel.status !== "IN_PROGRESS") {
            setMessage("Game is not in progress.");
            return;
        }

        const youColor = isWhite ? "white" : "black";
        const oppColor = youColor === "white" ? "black" : "white";
        const currentOffer = gameModel.drawOfferBy || null;

        try {
            if (!currentOffer) {
                // No offer yet → create one
                await client.models.Game.update(
                    {
                        ...gameModel,
                        drawOfferBy: youColor,
                    },
                    { authMode: "identityPool" }
                );
                setMessage("Draw offer sent.");
            } else if (currentOffer === oppColor) {
                // Opponent has offered → you are accepting the draw
                await client.models.Game.update(
                    {
                        ...gameModel,
                        status: "DRAW_AGREED",
                        drawOfferBy: null,
                    },
                    { authMode: "identityPool" }
                );
                setMessage("Draw agreed.");
            } else if (currentOffer === youColor) {
                // You already offered
                setMessage("You have already offered a draw.");
            } else {
                setMessage("Unable to change draw offer state.");
            }
        } catch (e) {
            console.error("Failed to offer/accept draw:", e);
            setMessage("Failed to update draw state.");
        }
    }

    async function updateEloAfterResign(winnerWhite) {
        const whiteUserId = gameModel.whitePlayerId;
        const blackUserId = gameModel.blackPlayerId;

        if (!whiteUserId || !blackUserId) {
            console.warn("[ELO] Missing player IDs during resign, skipping Elo update");
            return;
        }

        // Determine white’s score:
        // winnerWhite = true  → whiteScore = 1
        // winnerWhite = false → whiteScore = 0
        const whiteScore = winnerWhite ? 1 : 0;

        try {

            // Get current Elos
            const [whiteResp, blackResp] = await Promise.all([
                client.models.UserElo.get({ id: whiteUserId }, { authMode: "identityPool" }),
                client.models.UserElo.get({ id: blackUserId }, { authMode: "identityPool" }),
            ]);

            const whiteElo = whiteResp.data?.elo ?? 1200;
            const blackElo = blackResp.data?.elo ?? 1200;

            // Compute new ratings
            const [newWhiteElo, newBlackElo] = updateEloPair(whiteElo, blackElo, whiteScore);

            // Write updates
            await Promise.all([
                client.models.UserElo.update({ id: whiteUserId, elo: newWhiteElo }, { authMode: "identityPool" }),
                client.models.UserElo.update({ id: blackUserId, elo: newBlackElo }, { authMode: "identityPool" }),
            ]);

            console.log("[ELO] Updated after resignation:", {
                white: `${whiteElo} → ${newWhiteElo}`,
                black: `${blackElo} → ${newBlackElo}`,
            });
        } catch (err) {
            console.error("[ELO] Failed to update Elo after resign:", err);
        }
    }

    async function resign() {
        if (!gameModel || !authLoaded) return;

        if (!isWhite && !isBlack) {
            setMessage("Only players can resign.");
            return;
        }

        if (gameModel.status !== "IN_PROGRESS") {
            setMessage("Game is not in progress.");
            return;
        }

        const confirmed = window.confirm("Are you sure you want to resign?");
        if (!confirmed) return;

        const status = isWhite ? "WHITE_RESIGNED" : "BLACK_RESIGNED";

        try {
            // 1. Update Elo BEFORE updating the game row
            await updateEloAfterResign(
      /* winnerWhite = */ !isWhite // if white resigns → black wins → winnerWhite=false
            );

            // 2. Mark game as resigned
            await client.models.Game.update(
                {
                    ...gameModel,
                    status,
                    drawOfferBy: null,
                },
                { authMode: "identityPool" }
            );

            setMessage("You resigned.");
        } catch (e) {
            console.error("Failed to resign:", e);
            setMessage("Failed to resign.");
        }
    }


    useEffect(() => {
        async function fetchOpening() {
            if (!position) return;
            const url = `https://explorer.lichess.ovh/masters?fen=${encodeURIComponent(position)}`;
            const res = await fetch(url);
            const data = await res.json();
            setOpening(data.opening || null);
        }
        fetchOpening();
    }, [position]);

    async function handlePromotionChoice(promotionPiece) {
        if (!pendingPromotion) return;

        const { from, to } = pendingPromotion;

        setPendingPromotion(null); // close the dialog

        try {
            await applyMove({ from, to, promotion: promotionPiece });
        } catch (err) {
            console.error("Promotion move failed", err);
            setMessage("Failed to apply promotion move.");
        }
    }




    if (!gameId) {
        return <p>Select a game from the lobby to begin.</p>;
    }

    // Role Label
    let role;
    if (isWhite && isBlack) {
        role = "You are Both Players";
    } else if (isWhite) {
        role = "You are White";
    } else if (isBlack) {
        role = "You are Black";
    } else {
        role = "You are a Spectator";
    }
    const roleLabel = role;



    const boardOptions = {
        position: viewFen || position,
        onPieceDrop: handlePieceDrop,
        onSquareClick,              //click-to-move handler
        boardOrientation: boardOrientation,
        squareStyles: optionSquares //highlight styles
    };

    // which side's label is on top/bottom depends on orientation
    const topColor = boardOrientation === "white" ? "black" : "white";
    const bottomColor = boardOrientation === "white" ? "white" : "black";

    // build move pairs like "1. e4 e5" and keep fenAfter
    const movePairs = [];
    for (let i = 0; i < moves.length; i += 2) {
        const whiteMove = moves[i];
        const blackMove = moves[i + 1];
        movePairs.push({
            number: i / 2 + 1,
            whiteSan: whiteMove?.san || "",
            blackSan: blackMove?.san || "",
            whiteFenAfter: whiteMove?.fenAfter || null,
            blackFenAfter: blackMove?.fenAfter || null,
        });
    }

    const isActive = gameModel?.status === "IN_PROGRESS";
    const youArePlayer = isWhite || isBlack;
    const youColor = isWhite ? "white" : isBlack ? "black" : null;
    const oppColor = youColor === "white" ? "black" : "white";

    let drawLabel = "Offer Draw";
    let drawDisabled = false;

    if (isActive && youArePlayer && gameModel?.drawOfferBy) {
        if (gameModel.drawOfferBy === oppColor) {
            drawLabel = "Accept Draw";
        } else if (gameModel.drawOfferBy === youColor) {
            drawLabel = "Draw Offered";
            drawDisabled = true;
        }
    }

    return (
        <>
            <h1>Multiplayer Chess</h1>

            <h3 style={{ marginBottom: "1rem", fontStyle: "italic" }}>
                {roleLabel}
            </h3>

            {/* BOARD + LABELS + MOVES */}
            <div
                className="board_icons"
                style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "flex-start",
                    gap: "1.5rem",
                    marginTop: "1rem",
                }}
            >
                {/* ROTATE BUTTON TO LEFT OF BOARD */}
                <div
                    style={{
                        minWidth: "170px",
                        display: "flex",
                        justifyContent: "flex-end",
                        alignItems: "flex-start",
                    }}
                >
                    <button
                        onClick={flipBoard}
                        title="Flip Board"
                        style={{
                            fontSize: "1.5rem",
                            padding: "0.25rem 0.5rem",
                            cursor: "pointer",
                            background: "none",
                            border: "none",
                            outline: "none",
                            marginTop: "50px",
                        }}
                        onFocus={(e) => e.target.blur()}
                    >
                        ↻
                    </button>
                </div>

                {/* BOARD COLUMN */}
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                    }}
                >
                    {/* TOP LABEL */}
                    {renderSeatRow(topColor)}

                    {/* BOARD */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            marginTop: "0.25rem",
                        }}
                    >
                        <div className="chess_wrapper">
                            <Chessboard options={boardOptions} />
                                        {pendingPromotion && (
                                <div
                                    style={{
                                    position: "fixed",
                                    inset: 0,
                                    background: "rgba(0, 0, 0, 0.5)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    zIndex: 999,
                                    }}
                                >
                                    <div
                                    style={{
                                        background: "#222",
                                        padding: "1rem",
                                        borderRadius: "8px",
                                        display: "flex",
                                        gap: "0.5rem",
                                    }}
                                    >
                                    {["q", "r", "b", "n"].map((piece) => (
                                        <button
                                        key={piece}
                                        onClick={() => handlePromotionChoice(piece)}
                                        style={{
                                            fontSize: "2rem",
                                            padding: "0.5rem 0.75rem",
                                            cursor: "pointer",
                                            background: "#333",
                                            border: "1px solid #555",
                                            borderRadius: "4px",
                                        }}
                                        >
                                        {piece === "q" && "♕"}
                                        {piece === "r" && "♖"}
                                        {piece === "b" && "♗"}
                                        {piece === "n" && "♘"}
                                        </button>
                                    ))}
                                    </div>
                                </div>
                                )}
                        </div>
                    </div>

                    {/* BOTTOM LABEL */}
                    {renderSeatRow(bottomColor)}

                    {/*Back to live button when in history mode */}
                    {viewFen && (
                        <button
                            type="button"
                            onClick={() => {
                                setViewFen(null);
                                setMoveFrom("");
                                setOptionSquares({});
                                setMessage("Back to live position.");
                            }}
                            style={{ marginTop: "0.5rem" }}
                        >
                            Back to live position
                        </button>
                    )}
                </div>

                {/* MOVE LIST COLUMN */}
                <div
                    style={{
                        minWidth: "170px",
                        maxHeight: "400px",
                        border: "1px solid #444",
                        borderRadius: "6px",
                        padding: "0.5rem",
                        fontSize: "0.9rem",
                        overflowY: "auto",
                        marginTop: "50px",
                    }}
                >
                    <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>
                        Moves
                    </div>

                    {movePairs.length === 0 ? (
                        <div style={{ opacity: 0.6 }}>No moves yet</div>
                    ) : (
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <tbody>
                                {movePairs.map((m) => (
                                    <tr key={m.number}>
                                        <td
                                            style={{
                                                paddingRight: "0.25rem",
                                                textAlign: "right",
                                                width: "2.5rem",
                                            }}
                                        >
                                            {m.number}.
                                        </td>
                                        <td
                                            style={{
                                                paddingRight: "0.25rem",
                                                cursor: m.whiteFenAfter
                                                    ? "pointer"
                                                    : "default",
                                                textDecoration: m.whiteFenAfter
                                                    ? "underline"
                                                    : "none",
                                            }}
                                            onClick={() =>
                                                m.whiteFenAfter &&
                                                jumpToFen(
                                                    m.whiteFenAfter,
                                                    `${m.number}. ${m.whiteSan}`
                                                )
                                            }
                                        >
                                            {m.whiteSan}
                                        </td>
                                        <td
                                            style={{
                                                cursor: m.blackFenAfter
                                                    ? "pointer"
                                                    : "default",
                                                textDecoration: m.blackFenAfter
                                                    ? "underline"
                                                    : "none",
                                            }}
                                            onClick={() =>
                                                m.blackFenAfter &&
                                                jumpToFen(
                                                    m.blackFenAfter,
                                                    `${m.number}... ${m.blackSan}`
                                                )
                                            }
                                        >
                                            {m.blackSan}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            <div
                style={{
                    marginTop: "1rem",
                    display: "flex",
                    justifyContent: "center",
                }}
            >
                {isActive && youArePlayer ? (
                    <div>
                        <button
                            type="button"
                            onClick={resign}
                            style={{
                                padding: "0.25rem 0.75rem",
                                backgroundColor: "#c62828",
                                color: "white",
                                borderRadius: "4px",
                                cursor: "pointer",
                                marginRight: ".7rem"
                            }}
                        >
                            Resign
                        </button>
                        <button
                            type="button"
                            onClick={offerDraw}
                            disabled={drawDisabled}
                            style={{ padding: "0.25rem 0.75rem" }}
                        >
                            {drawLabel}
                        </button>
                    </div>
                ) : (
                    <div>
                        <button
                            type="button"
                            onClick={resetGame}
                            style={{ padding: "0.25rem 0.75rem", marginRight: ".7rem" }}
                        >
                            Play Again
                        </button>
                        <button
                            type="button"
                            onClick={deleteGame}
                            style={{
                                padding: "0.25rem 0.75rem",
                                backgroundColor: "#c62828",
                                color: "white",
                                borderRadius: "4px",
                                cursor: "pointer",

                            }}
                        >
                            Delete Game
                        </button>
                    </div>
                )}
            </div>



            {opening ? (
                <p>Opening: {opening.name}</p>
            ) : ""
            }

            <p>{message}</p>
        </>
    );
}
