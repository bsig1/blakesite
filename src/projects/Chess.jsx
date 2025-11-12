// Chess.jsx
import { useMemo, useRef, useState } from "react";
import PixiChessBoard from "./PixiChessBoard.jsx";
import "./Chess.css";

const files = ["a","b","c","d","e","f","g","h"];

class Piece {
  constructor(color, piece_type) {
    this.color = color;
    this.type = piece_type;
  }
  get_sprite() {
    return `/chess_pieces/${this.color}-${this.type}.png`;
  }
}

class ChessBoard {
  constructor() {
    this.state = Array(64).fill(null);
    this.initialize();
  }
  initialize() {
    const backRank = ["rook","knight","bishop","queen","king","bishop","knight","rook"];
    for (let i = 0; i < 8; i++) {
      this.state[56 + i] = new Piece("white", backRank[i]);
      this.state[48 + i] = new Piece("white", "pawn");
    }
    for (let i = 0; i < 8; i++) {
      this.state[i] = new Piece("black", backRank[i]);
      this.state[8 + i] = new Piece("black", "pawn");
    }
  }
}

function toPixiState(board) {
  // Convert your board.state (index 0..63) to an array of {color,type} or null
  return board.state.map((p) => (p ? { color: p.color, type: p.type } : null));
}

const Chess = () => {
  const boardObj = useMemo(() => new ChessBoard(), []);
  const [boardState] = useState(() => toPixiState(boardObj));
  const pixiRef = useRef(null);

  const demoMove = () => {
    // Animate e2 -> e4
    pixiRef.current.move("e2", "e4", { duration: 200 });
  };

  return (
    <>
      <h1 className="page-title">Chess</h1>
      <div className="chess_wrapper" style={{ gap: 16 }}>
        <PixiChessBoard
          ref={pixiRef}
          boardState={boardState}
          size={500}
            onSquareClick={(sq, button) => {
            if (button === "right") console.log("Right-clicked:", sq);
            else console.log("Left-clicked:", sq);
        }}
        />
        </div>
        <div className="controls">
          <button onClick={demoMove}>Animate e2 → e4</button>
        </div>
      
    </>
  );
};

export default Chess;
