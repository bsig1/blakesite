import React, { useEffect, useRef, useState } from "react";
import "./Project_2048.css"

function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}

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

    function initializeBoard() {
        let newBoard = [];
        for (let y = 0; y < 4; y++) {
            let row = [];
            for (let x = 0; x < 4; x++) {
                row.push(new Tile(-1, x, y));
            }
            newBoard.push(row);
        }

        generateTile(newBoard);
        generateTile(newBoard);

        return newBoard;
    }

    const tileImages = new Map();

    // Custom tile image mapping based on value
    const getTileImage = (value) => {
        const imageMapping = {
            2: "/sprites_2048/tile_1.png",
            4: "/sprites_2048/tile_2.png",
            8: "/sprites_2048/tile_3.png", // Tile 8 corresponds to tile_3.png
            16: "/sprites_2048/tile_4.png",
            32: "/sprites_2048/tile_5.png",
            64: "/sprites_2048/tile_6.png",
            128: "/sprites_2048/tile_7.png",
            256: "/sprites_2048/tile_8.png",
            512: "/sprites_2048/tile_9.png",
            1024: "/sprites_2048/tile_10.png",
            2048: "/sprites_2048/tile_11.png",
        };

        return imageMapping[value] || "/sprites_2048/tile_1.png"; // Default to tile_1.png if no mapping found
    };

    // Preload tile images for rendering
    function preloadTileImages() {
        for (let i = 1; i <= 11; i++) {
            const img = new Image();
            img.src = getTileImage(2 ** i);
            tileImages.set(2 ** i, img);
        }
    }

    function generateTile(state) {
        let value = getRandomInt(10) === 9 ? 4 : 2;
        let empty = [];
        for (let row of state) {
            for (let tile of row) {
                if (tile.value === -1) {
                    empty.push(tile);
                }
            }
        }

        if (empty.length > 0) {
            let randomTile = empty[getRandomInt(empty.length)];
            randomTile.value = value;
        }
    }

    const cloneBoard = (original) => {
        return original.map((row) =>
            row.map((tile) => new Tile(tile.value, tile.x, tile.y))
        );
    };

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

        makeMove(direction);
    }

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
                // move
                next.value = current.value;
                current.value = -1;
                moved = true;
                return true;
            } else if (next.value === current.value && !next.merged && !current.merged) {
                // merge
                next.value *= 2;
                next.merged = true;
                current.value = -1;
                moved = true;
                return true;
            }

            return false;
        };

        // Repeat until no more tiles move
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

    const drawBoard = (ctx, board) => {
        const tileSize = 100;

        // Clear the canvas before redrawing
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        for (let row of board) {
            for (let tile of row) {
                if (tile.value !== -1) {
                    const imgSrc = getTileImage(tile.value); // Get image path based on value
                    const img = new Image();

                    img.src = imgSrc;

                    // Add an onload handler to draw the image when it's ready
                    img.onload = () => {
                        ctx.drawImage(img, tile.x * tileSize, tile.y * tileSize, tileSize, tileSize);
                    };

                    // Handle image load failure
                    img.onerror = (err) => {
                        console.error(`Failed to load image for tile ${tile.value}`, err);
                        // Fallback to drawing a grey square if the image fails
                        ctx.fillStyle = "#ccc";
                        ctx.fillRect(tile.x * tileSize, tile.y * tileSize, tileSize, tileSize);
                        ctx.fillStyle = "#000"; // Optional: Add the tile number on top of the gray square
                        ctx.font = "48px Comic Sans MS";
                        ctx.fillText(tile.value, tile.x * tileSize + tileSize / 2, tile.y * tileSize + tileSize / 2);
                    };

                    // Optional: Draw the number directly if the image doesn't load
                    if (!img.complete) {
                        ctx.fillStyle = "#ccc";
                        ctx.fillRect(tile.x * tileSize, tile.y * tileSize, tileSize, tileSize);
                        ctx.fillStyle = "#000";
                        ctx.fillText(tile.value, tile.x * tileSize + tileSize / 2, tile.y * tileSize + tileSize / 2);
                    }
                }
            }
        }
    };

    useEffect(() => {
        preloadTileImages();
    }, []);

    useEffect(() => {
        const handle = (e) => handleKeyDown(e);
        window.addEventListener("keydown", handle);
        return () => window.removeEventListener("keydown", handle);
    });

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");

        if (ctx) {
            drawBoard(ctx, board); // Draw the updated board on the canvas
        }
    }, [board]);

    return (
        <>
            <h1 className="page-title">2048</h1>
            <canvas
                ref={canvasRef}
                width={400}
                height={400}
                style={{ border: "1px solid black" }}
            />
        </>
    );
};

export default Board;
