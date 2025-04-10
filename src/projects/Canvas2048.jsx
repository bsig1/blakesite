import React, { useEffect, useRef, useState } from "react";

// Function to get a random integer (used for tile generation)
function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}

// Tile class to represent each tile's properties
class Tile {
    constructor(value, x, y) {
        this._value = value;
        this._x = x;
        this._y = y;
    }
    get x() {
        return this._x;
    }
    get y() {
        return this._y;
    }
    get value() {
        return this._value;
    }
    set value(new_value) {
        this._value = new_value;
    }
}

const Board = () => {
    const canvasRef = useRef(null);
    const [board, setBoard] = useState(initializeBoard());
    const [tileImages, setTileImages] = useState(new Map());

    // Initialize the board with empty tiles
    function initializeBoard() {
        let newBoard = [];
        for (let y = 0; y < 4; y++) {
            let row = [];
            for (let x = 0; x < 4; x++) {
                row.push(new Tile(-1, x, y));  // -1 means empty
            }
            newBoard.push(row);
        }

        generateTile(newBoard);  // Generate an initial tile
        generateTile(newBoard);  // Generate a second tile
        return newBoard;
    }

    // Preload tile images into the state map
    useEffect(() => {
        const images = new Map();
        const loadImage = (src, index) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.src = src;
                img.onload = () => {
                    images.set(index, img);  // Map the image to its value
                    resolve();
                };
            });
        };

        const loadAllImages = async () => {
            const promises = [];
            for (let i = 1; i <= 15; i++) {  // Assuming tiles range from 2 to 32768
                const src = `/sprites/tile_${i}.png`;  // Image paths for tiles
                promises.push(loadImage(src, i));
            }
            await Promise.all(promises);  // Wait until all images are loaded
            setTileImages(images);  // Update state with all loaded images
        };

        loadAllImages();
    }, []);

    // Generate a new tile at a random empty spot on the board
    function generateTile(state) {
        let value = getRandomInt(10) === 9 ? 4 : 2;  // 10% chance of 4, otherwise 2
        let empty = [];
        for (let row of state) {
            for (let tile of row) {
                if (tile.value === -1) {
                    empty.push(tile);  // Find all empty spots
                }
            }
        }

        if (empty.length > 0) {
            let randomTile = empty[getRandomInt(empty.length)];
            randomTile.value = value;  // Place a new tile with value 2 or 4
        }
    }

    // Handle key down events for moving tiles
    function handleKeyDown(event) {
        let direction;

        switch (event.key) {
            case "a":
                direction = [-1, 0];
                break;
            case "d":
                direction = [1, 0];
                break;
            case "w":
                direction = [0, -1];
                break;
            case "s":
                direction = [0, 1];
                break;
            default:
                return;
        }

        makeMove(direction);  // Make the move based on the direction
    }

    // Make a move and apply it to the board
    function makeMove([dx, dy]) {
        const newBoard = cloneBoard(board);
        let moved = false;
        let keepMoving = true;

        const tryMove = (x, y) => {
            const current = newBoard[y][x];
            if (current.value === -1) return false;

            const nx = x + dx;
            const ny = y + dy;

            if (nx < 0 || nx >= 4 || ny < 0 || ny >= 4) return false;

            const next = newBoard[ny][nx];
            if (next.value === -1) {
                // Move the tile
                next.value = current.value;
                current.value = -1;
                moved = true;
                return true;
            } else if (next.value === current.value && !next.merged && !current.merged) {
                // Merge the tiles
                next.value *= 2;
                next.merged = true;
                current.value = -1;
                moved = true;
                return true;
            }

            return false;
        };

        // Repeat the move process until no more tiles can move
        while (keepMoving) {
            keepMoving = false;

            const range = [0, 1, 2, 3];
            const reversed = [3, 2, 1, 0];

            const rows = dy > 0 ? reversed : range;
            const cols = dx > 0 ? reversed : range;

            for (let y of rows) {
                for (let x of cols) {
                    if (tryMove(x, y)) {
                        keepMoving = true;
                    }
                }
            }
        }

        // Clear merge flags after move
        for (let row of newBoard) {
            for (let tile of row) {
                tile.merged = false;
            }
        }

        if (moved) {
            generateTile(newBoard);
            setBoard(newBoard);
        }
    }

    // Clone the board to prevent mutation
    const cloneBoard = (original) => {
        return original.map((row) =>
            row.map((tile) => new Tile(tile.value, tile.x, tile.y))
        );
    };

    // Draw the board onto the canvas
    const drawBoard = (ctx, board) => {
        const tileSize = 100;

        // Clear the canvas before drawing the new board
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); // Clear the entire canvas

        for (let row of board) {
            for (let tile of row) {
                if (tile.value !== -1) {
                    const index = Math.log2(tile.value);  // tile_1 = 2, tile_2 = 4, etc.
                    const img = tileImages.get(index);  // Get the image for the tile value

                    if (img && img.complete) {
                        ctx.drawImage(img, tile.x * tileSize, tile.y * tileSize, tileSize, tileSize);
                    } else {
                        // Fallback if the image isn't loaded yet
                        ctx.fillStyle = "#ccc";  // Placeholder color
                        ctx.fillRect(tile.x * tileSize, tile.y * tileSize, tileSize, tileSize);
                        ctx.fillStyle = "#000";  // Draw the tile value as text
                        ctx.font = "48px sans-serif";
                        ctx.textAlign = "center";
                        ctx.textBaseline = "middle";
                        ctx.fillText(tile.value, tile.x * tileSize + tileSize / 2, tile.y * tileSize + tileSize / 2);
                    }
                }
            }
        }
    };

    // Listen for keydown events to move the tiles
    useEffect(() => {
        const handle = (e) => handleKeyDown(e);
        window.addEventListener("keydown", handle);
        return () => window.removeEventListener("keydown", handle);
    }, [board]);

    // Draw the board every time the board changes
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");

        if (ctx) {
            drawBoard(ctx, board);  // Draw the updated board on the canvas
        }
    }, [board]);

    return (
        <canvas
            ref={canvasRef}
            width={400}
            height={400}
            style={{ border: "1px solid black" }}
        />
    );
};

export default Board;
