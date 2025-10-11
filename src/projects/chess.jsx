

import './Chess.css';

const Chess = () => {
    const files = ["a","b","c","d","e","f","g","h"];
    const ranks = [8,7,6,5,4,3,2,1];

    return (
        <>
            <h1 className="page-title">Chess</h1>
            <div className="chess_board">
                {ranks.map((rank) =>
                    files.map((file, i) => {
                        const dark = ((i + (8 - rank)) % 2 === 0); // <-- parity fix
                        const square = `${file}${rank}`;
                        return (
                            <div
                                key={square}
                                className={dark ? 'black-square' : 'white-square'}
                                aria-label={`square ${square}`}
                            >
                                {square}
                            </div>
                        );
                    })
                )}
            </div>
        </>
    );
};

export default Chess;


export default Chess;