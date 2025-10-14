import './Chess.css';

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
        // Back rank order for both sides
        const backRank = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"];

        for (let i = 0; i < 8; i++) {
            this.state[56 + i] = new Piece("white", backRank[i]);
            this.state[48 + i] = new Piece("white", "pawn");
        }

        // Black pieces (top, rank 8 and 7)
        for (let i = 0; i < 8; i++) {
            this.state[i] = new Piece("black", backRank[i]);
            this.state[8 + i] = new Piece("black", "pawn");
        }
    }

    get_square(rank, file) {
        const idx = (8 - rank) * 8 + files.indexOf(file);
        return this.state[idx];
    }
}

const Chess = () => {
    const ranks = [8,7,6,5,4,3,2,1];
    const board = new ChessBoard();

    const squares = [];
    for (const rank of ranks) {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const square = `${file}${rank}`;
            const dark = ((i + (8 - rank)) % 2 === 1);
            const piece = board.get_square(rank, file);
            const bg = piece ? `url(${piece.get_sprite()})` : "none";

            squares.push(
                <div
                    key={square}
                    className={dark ? 'black-square' : 'white-square'}
                    aria-label={`square ${square}`}
                    style={{
                        backgroundImage: bg,
                        backgroundSize: "contain",
                        backgroundPosition: "center",
                        backgroundRepeat: "no-repeat",
                    }}
                ></div>
            );
        }
    }

    return (
        <>
            <h1 className="page-title">Chess</h1>
            <div className="chess_wrapper">
                <div className="ranks">
                    {ranks.map((r) => <div key={r}>{r}</div>)}
                </div>
                <div className="chess_board">{squares}</div>
                <div className="files">
                    {files.map((f) => <div key={f}>{f.toUpperCase()}</div>)}
                </div>
            </div>
        </>
    );
};

export default Chess;
