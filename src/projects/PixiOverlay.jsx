// PixiOverlay.jsx
import { useEffect, useRef } from "react";
import * as PIXI from "pixi.js";

// --- helpers ---
const SQ = ["a","b","c","d","e","f","g","h"];
function sqToRC(sq) {
    // "a1" -> {c:0,r:0} bottom-left origin; we’ll orient later
    const file = sq[0].toLowerCase();
    const rank = parseInt(sq[1], 10);
    return { c: SQ.indexOf(file), r: rank - 1 };
}

function rcToPixels({ r, c }, size, flipped) {
    const S = size / 8;
    let x = c * S;
    let y = (7 - r) * S; // a1 at bottom-left
    if (flipped) {
        x = (7 - c) * S;
        y = r * S;
    }
    return { x: x + S / 2, y: y + S / 2, S };
}

export default function PixiOverlay({ flipped = false, highlights = [], arrow }) {
    const mountRef = useRef(null);
    const appRef = useRef(null);
    const roRef = useRef(null);

    useEffect(() => {
        const app = new PIXI.Application({
            antialias: true,
            backgroundAlpha: 0,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
        });
        appRef.current = app;
        mountRef.current.appendChild(app.view);

        // ensure canvas overlays and doesn’t block clicks, unless you want it to
        Object.assign(app.view.style, {
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            zIndex: 10,
        });

        // Resize to parent
        const resize = () => {
            const rect = mountRef.current.getBoundingClientRect();
            app.renderer.resize(rect.width, rect.height);
            drawOnce(); // redraw on resize
        };
        roRef.current = new ResizeObserver(resize);
        roRef.current.observe(mountRef.current);
        resize();

        // simple drawing layers
        const bgLayer = new PIXI.Container(); // for fills/highlights
        const fxLayer = new PIXI.Container(); // for arrows/anim
        app.stage.addChild(bgLayer, fxLayer);

        // drawing functions
        function drawHighlights() {
            bgLayer.removeChildren();
            const g = new PIXI.Graphics();
            const { width, height } = app.renderer;
            // no-op if 0 size
            if (width === 0 || height === 0) return;

            highlights.forEach((sq) => {
                const { r, c } = sqToRC(sq);
                const { x, y, S } = rcToPixels({ r, c }, Math.min(width, height), flipped);
                const radius = Math.max(6, S * 0.18);
                g.beginFill(0xffc107, 0.45);
                g.drawCircle(x, y, radius);
                g.endFill();
            });

            bgLayer.addChild(g);
        }

        function drawArrow() {
            fxLayer.removeChildren();
            if (!arrow?.from || !arrow?.to) return;

            const g = new PIXI.Graphics();
            const { width, height } = app.renderer;
            const size = Math.min(width, height);

            const a = rcToPixels(sqToRC(arrow.from), size, flipped);
            const b = rcToPixels(sqToRC(arrow.to),   size, flipped);

            // line
            g.lineStyle(6, 0x29b6f6, 0.9);
            g.moveTo(a.x, a.y);
            g.lineTo(b.x, b.y);

            // arrowhead
            const head = 14;
            const angle = Math.atan2(b.y - a.y, b.x - a.x);
            g.beginFill(0x29b6f6, 0.9);
            g.moveTo(b.x, b.y);
            g.lineTo(b.x - head * Math.cos(angle - Math.PI / 6), b.y - head * Math.sin(angle - Math.PI / 6));
            g.lineTo(b.x - head * Math.cos(angle + Math.PI / 6), b.y - head * Math.sin(angle + Math.PI / 6));
            g.lineTo(b.x, b.y);
            g.endFill();

            fxLayer.addChild(g);
        }

        function drawOnce() {
            drawHighlights();
            drawArrow();
        }

        // expose for prop changes
        app._drawOnce = drawOnce;

        return () => {
            roRef.current?.disconnect();
            app.destroy(true, true);
        };
    }, [flipped]); // re-init only if orientation changes

    // Re-draw when props change
    useEffect(() => {
        appRef.current?._drawOnce?.();
    }, [highlights, arrow]);

    return (
        <div
            ref={mountRef}
            style={{
                position: "absolute",
                inset: 0,
                zIndex: 10,
            }}
        />
    );
}
