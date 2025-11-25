import { Chessboard } from "react-chessboard";
import { useState, useRef } from "react";
import { Chess } from "chess.js";
import "./Chess.css";

export default function AutoSizeBoard() {
  // --- chess.js game state (from the top example) ---
  const chessGameRef = useRef(new Chess());
  const chessGame = chessGameRef.current;

  const [chessPosition, setChessPosition] = useState(chessGame.fen());

  // unified onPieceDrop used by both boards
  const onPieceDrop = ({ sourceSquare, targetSquare, piece }) => {
    // targetSquare can be null if dropped off board
    if (!targetSquare) return false;

    // chess.js move handling (from the top example)
    try {
      const move = chessGame.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q", // always promote to queen for now
      });

      if (!move) return false;

      setChessPosition(chessGame.fen());
      return true; // accept the move
    } catch {
      return false; // illegal => snap back
    }
  };

  // allow white to only drag white pieces
  const canDragPieceWhite = ({ piece }) => piece.pieceType[0] === "w";

  // allow black to only drag black pieces
  const canDragPieceBlack = ({ piece }) => piece.pieceType[0] === "b";

  // base options shared by both boards
  const baseOptions = {
    position: chessPosition,
    onPieceDrop,
  };

  const whiteBoardOptions = {
    ...baseOptions,
    canDragPiece: canDragPieceWhite,
    boardOrientation: "white",
    id: "multiplayer-white",
  };

  const blackBoardOptions = {
    ...baseOptions,
    canDragPiece: canDragPieceBlack,
    boardOrientation: "black",
    id: "multiplayer-black",
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        alignItems: "center",
      }}
    >


      {/* Two synchronized boards (top example) */}
      <div
        style={{
          display: "flex",
          gap: "20px",
          justifyContent: "center",
          flexWrap: "wrap",
          padding: "10px",
        }}
      >
        <div>
          <p style={{ textAlign: "center" }}>White&apos;s perspective</p>
          <div className="chess_wrapper">{/* e.g. max-width in CSS */}
            <Chessboard options={whiteBoardOptions} />
          </div>
        </div>

        <div>
          <p style={{ textAlign: "center" }}>Black&apos;s perspective</p>
          <div className="chess_wrapper">
            <Chessboard options={blackBoardOptions} />
          </div>
        </div>
      </div>
    </div>
  );
}
