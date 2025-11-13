// PixiChessBoard.jsx
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import * as PIXI from "pixi.js";

// a..h -> 0..7
const fileToX = (file) => "abcdefgh".indexOf(file);
// rank (1..8) -> y index with a8 at top-left
const rankToY = (rank) => 8 - rank;
// 0..63 -> "a1".., with 0 expected at a8 (top-left)
const idxToSquare = (idx) => {
    const file = "abcdefgh"[idx % 8];
    const rank = 8 - Math.floor(idx / 8);
    return `${file}${rank}`;
};
const squareToIdx = (sq) => {
    return fileToX(sq[0]) + rankToY(sq[1]) * 8;
};



const defaultColors = {
    light: 0xEEEED2,
    dark: 0x769656,
    lastMove: 0xF7EC6C,
    selected_color: 0xF7EC6C
};

const pieceKey = (color, type) => `${color}-${type}`;

// IMPORTANT: put images in /public/chess_pieces/
const PIECE_IMAGES = [
    "white-king", "white-queen", "white-rook", "white-bishop", "white-knight", "white-pawn",
    "black-king", "black-queen", "black-rook", "black-bishop", "black-knight", "black-pawn",
].reduce((acc, k) => ({ ...acc, [k]: `/chess_pieces/${k}.png` }), {});

async function loadTexture(path) {
    try {
        const tex = await PIXI.Assets.load(path);
        return tex;
    } catch (err) {
        console.error("Failed to load texture:", path, err);
        return null;
    }
}

const SPRITE_SCALE = 1;

const PixiChessBoard = forwardRef(function PixiChessBoard(
    {
        boardState,        // Array(64): null or { color: "white"|"black", type: "pawn"|"rook"|... }
        colors = defaultColors,
        onSquareClick,
    },
    ref
) {

    const mountRef = useRef(null);
    const appRef = useRef(null);
    const texturesRef = useRef({});
    const squaresLayerRef = useRef(null);
    const piecesLayerRef = useRef(null);
    const highlightLayerRef = useRef(null);
    const pieceSpritesRef = useRef(new Map());
    const lastMoveRef = useRef({ from: null, to: null });
    const selected = useRef(null);
    const selected_square = useRef(null);
    const dragRef = useRef({
        spr: null,         // the sprite being dragged
        fromIndex: null,   // 0..63 where drag started (optional)
        offset: null,      // pointer->sprite local offset
    });

    const [ready, setReady] = useState(false);
    const [squareSize, setSquareSize] = useState(0);

    // Build Pixi app once (or when size/colors change meaningfully)
    useEffect(() => {
        let destroyed = false;

        (async () => {
            const app = new PIXI.Application();
            await app.init({
                backgroundAlpha: 0,
                antialias: true,
            });
            if (destroyed) { app.destroy(true); return; }

            // predictable sizing
            app.canvas.style.width = "100%";
            app.canvas.style.height = "100%";
            app.canvas.style.display = "block";
            app.canvas.style.margin = "0 auto";
            app.renderer.resolution = Math.min(window.devicePixelRatio || 1, 2);

            appRef.current = app;
            if (mountRef.current) mountRef.current.appendChild(app.canvas);

            // layers
            const squaresLayer = new PIXI.Container();
            const highlightLayer = new PIXI.Container();
            const piecesLayer = new PIXI.Container();

            // enable zIndex to work
            app.stage.sortableChildren = true;
            piecesLayer.sortableChildren = true;

            // set z-order
            squaresLayer.zIndex = 0;
            highlightLayer.zIndex = 1;
            piecesLayer.zIndex = 2;

            // refs
            squaresLayerRef.current = squaresLayer;
            highlightLayerRef.current = highlightLayer;
            piecesLayerRef.current = piecesLayer;

            // add to stage
            app.stage.addChild(squaresLayer);
            app.stage.addChild(highlightLayer);
            app.stage.addChild(piecesLayer);

            // draw static board
            drawBoard(squaresLayer, squareSize, colors);

            // enable stage pointer events
            app.stage.eventMode = "static";

            // DRAG MOVE
            app.stage.on("pointermove", (e) => {
                const d = dragRef.current;
                if (!d.spr) return;

                // convert pointer to sprite's parent space
                const parentPoint = d.spr.parent.toLocal(e.global);
                d.spr.position.set(parentPoint.x - d.offset.x, parentPoint.y - d.offset.y);
            });

            // DRAG END (drop anywhere)
            const endDrag = () => {
                const d = dragRef.current;
                if (!d.spr) return;

                d.spr.alpha = 1;
                d.spr.zIndex = 1;
                d.spr.cursor = "grab";
                dragRef.current = { spr: null, fromIndex: null, offset: null };

                const { x, y } = d.spr;
                const idx = Math.floor(y / squareSize) * 8 + Math.floor(x / squareSize);
                d.spr.position.set(
                    (idx % 8) * squareSize + squareSize / 2,
                    Math.floor(idx / 8) * squareSize + squareSize / 2
                );
                highlightSquare(idx);
            };

            app.stage.on("pointerup", endDrag);
            app.stage.on("pointerupoutside", endDrag);


            // Pixi is ready; pieces effect can run now
            setReady(true);
        })();

        return () => {
            destroyed = true;
            setReady(false);
            if (appRef.current) {
                appRef.current.destroy(true, { children: true });
                appRef.current = null;
            }
        };
    }, [colors, squareSize, onSquareClick]);

    // Observe container resize
    useEffect(() => {
        if (!mountRef.current || !appRef.current) return;
        const resizeObserver = new ResizeObserver((entries) => {
            const { width, height } = entries[0].contentRect;
            const size = Math.min(width, height);
            appRef.current.renderer.resize(size, size);
            appRef.current.canvas.style.width = `${size}px`;
            appRef.current.canvas.style.height = `${size}px`;
            setSquareSize(size / 8);

            if (ready) drawBoard(squaresLayerRef.current, size / 8, colors);
        });

        resizeObserver.observe(mountRef.current);
        return () => resizeObserver.disconnect();
    }, [ready, colors]);

    // Load textures & render pieces after ready + boardState present
    useEffect(() => {
        if (!ready || !boardState) return;

        (async () => {
            // collect textures needed by current board
            const needed = new Set();
            boardState.forEach((cell) => {
                if (cell && cell.color && cell.type) needed.add(pieceKey(cell.color, cell.type));
            });

            // lazy-load textures
            for (const key of needed) {
                if (!texturesRef.current[key]) {
                    const tex = await loadTexture(PIECE_IMAGES[key]);
                    if (tex) texturesRef.current[key] = tex;
                }
            }

            // clear previous sprites
            piecesLayerRef.current.removeChildren();
            pieceSpritesRef.current.clear();

            // draw sprites
            for (let i = 0; i < 64; i++) {
                const cell = boardState[i];
                if (!cell) continue;

                const key = pieceKey(cell.color, cell.type);
                const tex = texturesRef.current[key];
                if (!tex) continue;

                const spr = new PIXI.Sprite(tex);
                spr.anchor.set(0.5);

                const fileIdx = i % 8;
                const rankIdx = Math.floor(i / 8);
                const cx = fileIdx * squareSize + squareSize / 2;
                const cy = rankIdx * squareSize + squareSize / 2;
                spr.x = cx;
                spr.y = cy;

                // fit inside square
                const scale = Math.min(
                    (squareSize * SPRITE_SCALE) / spr.texture.width,
                    (squareSize * SPRITE_SCALE) / spr.texture.height
                );
                spr.scale.set(scale);

                spr.zIndex = 1;

                // --- ONLY PIECES show grab/drag cursor ---
                spr.eventMode = "static";     // enable pointer events on the sprite
                spr.cursor = "grab";          // open hand on hover
                const ev = appRef.current?.renderer?.events;
                if (!ev) continue;

                spr.eventMode = "static";
                spr.cursor = "grab";

                spr.on("pointerdown", (e) => {
                    // start drag
                    const offset = e.getLocalPosition(spr);         // where inside the sprite you grabbed
                    dragRef.current = { spr, fromIndex: i, offset }; // i is your current 0..63 loop index

                    spr.alpha = 0.85;
                    spr.zIndex = 999;
                    spr.cursor = "grabbing";

                    if (selected_square.current) {
                        highlightLayerRef.current.removeChild(selected_square.current);
                        selected_square.current = null;
                    }
                    selected.current = i;
                    selected_square.current = highlightSquare(i, colors.selected_color);
                });

                spr.on("pointerup", () => queueMicrotask(() => ev.setCursor("grab")));
                spr.on("pointerupoutside", () => queueMicrotask(() => ev.setCursor("grab")));

                const square = idxToSquare(i);
                pieceSpritesRef.current.set(square, spr);
                piecesLayerRef.current.addChild(spr);
            }
        })();
    }, [ready, boardState, squareSize]);

    // Highlight helpers
    const drawLastMove = (from, to) => {
        const layer = highlightLayerRef.current;
        layer.removeChildren();
        if (!from || !to) return;

        [from, to].forEach((sq) => {
            highlightSquare(squareToIdx(sq));
        });
    };

    function highlightSquare(index, color = 0xF7EC6C) {
        if (index < 0 || index > 63) return;

        const s = squareSize;
        const fileIdx = index % 8;        // 0..7 (a..h)
        const rankIdx = Math.floor(index / 8); // 0..7 (top to bottom, a8→h1)

        const g = new PIXI.Graphics()
            .rect(fileIdx * s, rankIdx * s, s, s)
            .fill({ color: color, alpha: 0.5 });

        highlightLayerRef.current.addChild(g);
        return g;
    }


    // Imperative API: move animation + highlight controls
    useImperativeHandle(ref, () => ({
        move: (from, to, opts = {}) => {
            const app = appRef.current;
            const spr = pieceSpritesRef.current.get(from);
            if (!app || !spr) return false;

            const duration = (opts.duration ?? 350) / 1000;
            const target = squareCenter(to, squareSize);

            // capture
            const captured = pieceSpritesRef.current.get(to);
            if (captured) {
                piecesLayerRef.current.removeChild(captured);
                captured.destroy();
                pieceSpritesRef.current.delete(to);
            }

            spr.zIndex = 10;
            const start = { x: spr.x, y: spr.y };
            let t = 0;

            const tick = () => {
                const deltaSec = app.ticker.deltaMS / 1000;
                t += deltaSec;
                const a = Math.min(t / duration, 1);
                const s = a * a * (3 - 2 * a); // smoothstep

                spr.x = lerp(start.x, target.x, s);
                spr.y = lerp(start.y, target.y, s);

                if (a >= 1) {
                    app.ticker.remove(tick);
                    spr.zIndex = 1;
                    pieceSpritesRef.current.delete(from);
                    pieceSpritesRef.current.set(to, spr);
                    lastMoveRef.current = { from, to };
                    drawLastMove(from, to);
                }
            };

            app.ticker.add(tick);
            return true;
        },

        highlight: (from, to) => drawLastMove(from, to),
        clearHighlight: () => {
            highlightLayerRef.current.removeChildren();
            lastMoveRef.current = { from: null, to: null };
        },
    }));

    // Center the canvas within this wrapper
    return (
        <div
            ref={mountRef}
            style={{
                width: "100%",
                height: "100%",
                display: "grid",
                placeItems: "center",
            }}
        />
    );

    function drawBoard(layer, s, palette) {
        layer.removeChildren();

        for (let r = 0; r < 8; r++) {
            for (let f = 0; f < 8; f++) {
                const dark = (f + r) % 2 === 1;
                const square = new PIXI.Graphics()
                    .rect(f * s, r * s, s, s)
                    .fill(dark ? palette.dark : palette.light);

                // compute algebraic name (a8 top-left)
                const file = "abcdefgh"[f];
                const rank = 8 - r;
                const squareName = `${file}${rank}`;

                // squares stay default cursor, but are still clickable
                square.eventMode = "static";
                square.cursor = "default";

                // left + right click detection
                square.on("pointerdown", (e) => {
                    const button = e.button === 2 ? "right" : "left";
                    onSquareClick?.(squareName, button);
                });


                layer.addChild(square);
            }
        }

        // prevent browser context menu on right-click over the canvas
        layer.stage?.view?.addEventListener("contextmenu", (e) => e.preventDefault());
    }

    function squareCenter(square, s) {
        const fx = fileToX(square[0]);
        const ry = rankToY(parseInt(square[1], 10));
        return { x: fx * s + s / 2, y: ry * s + s / 2 };
    }

    function lerp(a, b, t) {
        return a + (b - a) * t;
    }
});

export default PixiChessBoard;
