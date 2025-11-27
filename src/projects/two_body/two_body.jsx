import { useEffect, useRef, useState, useMemo } from "react";
import "./two_body.css";

// =============================================
// Two-Body Problem Visualizer (React, single file)
// v3: Adds initial-velocity sliders + "Make circular" helper.
// - Velocities are part of initialState (apply on Reset)
// - Helper computes circular orbit about the barycenter
// - Preserves stable RAF loop + non-huge canvas + no page yank
// =============================================

// Vector helpers
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const mul = (a, k) => ({ x: a.x * k, y: a.y * k });
const mag = (a) => Math.hypot(a.x, a.y);

// Physics helpers
const gravityAcc = (G, mOther, rSelfToOther) => {
    const r = mag(rSelfToOther) || 1e-9;
    const f = (G * mOther) / (r * r * r);
    return mul(rSelfToOther, f);
};

function rk4Step(state, dt, G) {
    // state = { p1:{x,y}, v1:{x,y}, p2:{x,y}, v2:{x,y}, m1, m2 }
    const deriv = (s) => {
        const r12 = sub(s.p2, s.p1);
        const a1 = gravityAcc(G, s.m2, r12);
        const a2 = mul(a1, -s.m1 / s.m2); // equal & opposite scaled by masses
        return { dp1: s.v1, dv1: a1, dp2: s.v2, dv2: a2 };
    };

    const S = state;
    const k1 = deriv(S);
    const S2 = {
        ...S,
        p1: add(S.p1, mul(k1.dp1, dt / 2)),
        v1: add(S.v1, mul(k1.dv1, dt / 2)),
        p2: add(S.p2, mul(k1.dp2, dt / 2)),
        v2: add(S.v2, mul(k1.dv2, dt / 2)),
    };
    const k2 = deriv(S2);
    const S3 = {
        ...S,
        p1: add(S.p1, mul(k2.dp1, dt / 2)),
        v1: add(S.v1, mul(k2.dv1, dt / 2)),
        p2: add(S.p2, mul(k2.dp2, dt / 2)),
        v2: add(S.v2, mul(k2.dv2, dt / 2)),
    };
    const k3 = deriv(S3);
    const S4 = {
        ...S,
        p1: add(S.p1, mul(k3.dp1, dt)),
        v1: add(S.v1, mul(k3.dv1, dt)),
        p2: add(S.p2, mul(k3.dp2, dt)),
        v2: add(S.v2, mul(k3.dv2, dt)),
    };
    const k4 = deriv(S4);

    return {
        ...S,
        p1: add(S.p1, mul(add(add(k1.dp1, mul(k2.dp1, 2)), add(mul(k3.dp1, 2), k4.dp1)), dt / 6)),
        v1: add(S.v1, mul(add(add(k1.dv1, mul(k2.dv1, 2)), add(mul(k3.dv1, 2), k4.dv1)), dt / 6)),
        p2: add(S.p2, mul(add(add(k1.dp2, mul(k2.dp2, 2)), add(mul(k3.dp2, 2), k4.dp2)), dt / 6)),
        v2: add(S.v2, mul(add(add(k1.dv2, mul(k2.dv2, 2)), add(mul(k3.dv2, 2), k4.dv2)), dt / 6)),
        t: (S.t ?? 0) + dt,
    };
}

function energy(state, G) {
    const { m1, m2, p1, p2, v1, v2 } = state;
    const r = mag(sub(p2, p1));
    const ke =
        0.5 * m1 * (v1.x * v1.x + v1.y * v1.y) +
        0.5 * m2 * (v2.x * v2.x + v2.y * v2.y);
    const pe = -G * m1 * m2 / (r || 1e-9);
    return { ke, pe, te: ke + pe };
}

export default function TwoBodyVisualizer() {
    const [G, setG] = useState(1);

    // UI state
    const [m1, setM1] = useState(1);
    const [m2, setM2] = useState(1);
    const [distance, setDistance] = useState(2);
    const [dt, setDt] = useState(0.01);
    const [running, setRunning] = useState(false);
    const [zoom, setZoom] = useState(120);
    const [showTrails, setShowTrails] = useState(true);
    const [collide, setCollide] = useState(true);   // enable collisions
    const [e, setE] = useState(0.2);               // restitution [0..1]

    // NEW: Initial velocities (applied on Reset)
    const [v1x, setV1x] = useState(0);
    const [v1y, setV1y] = useState(0);
    const [v2x, setV2x] = useState(0);
    const [v2y, setV2y] = useState(0);

    // Derived initial state
    const initialState = useMemo(() => {
        // positions on x-axis
        const p1 = { x: -distance / 2, y: 0 };
        const p2 = { x:  distance / 2, y: 0 };

        // velocities from sliders
        const v1 = { x: v1x, y: v1y };
        const v2 = { x: v2x, y: v2y };

        return { p1, v1, p2, v2, m1, m2, t: 0 };
    }, [m1, m2, distance, v1x, v1y, v2x, v2y]);

    const [state, setState] = useState(initialState);
    const stateRef = useRef(state);
    useEffect(() => { stateRef.current = state; }, [state]);
    const [E0, setE0] = useState(() => energy(initialState, G));

    // Do NOT reset state when sliders change; only update masses live.
    useEffect(() => { setState((s) => ({ ...s, m1 })); }, [m1]);
    useEffect(() => { setState((s) => ({ ...s, m2 })); }, [m2]);

    // Trails
    const trail1Ref = useRef([]);
    const trail2Ref = useRef([]);

    // Canvas sizing
    const wrapRef = useRef(null);
    const canvasRef = useRef(null);

    // Mouse interactions
    const rafRef = useRef(0);
    const lastRef = useRef(0);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        let dragging = null; // "p1" or "p2"

        const toWorld = (x, y) => {
            const rect = canvas.getBoundingClientRect();
            const center = { x: rect.width / 2, y: rect.height / 2 };
            return {
                x: (x - center.x) / zoom,
                y: -(y - center.y) / zoom
            };
        };

        const handleDown = (e) => {
            const { x, y } = toWorld(e.offsetX, e.offsetY);
            const d1 = Math.hypot(x - stateRef.current.p1.x, y - stateRef.current.p1.y);
            const d2 = Math.hypot(x - stateRef.current.p2.x, y - stateRef.current.p2.y);
            const r1 = Math.max(4, 6 * Math.cbrt(stateRef.current.m1));
            const r2 = Math.max(4, 6 * Math.cbrt(stateRef.current.m2));
            if (d1 <= r1 / zoom) dragging = "p1";
            else if (d2 <= r2 / zoom) dragging = "p2";
        };

        const handleMove = (e) => {
            if (!dragging) return;
            const { x, y } = toWorld(e.offsetX, e.offsetY);
            setState((s) => ({
                ...s,
                [dragging]: { x, y },
                v1: { x: 0, y: 0 },
                v2: { x: 0, y: 0 },
            }));
        };

        const handleUp = () => (dragging = null);

        canvas.addEventListener("mousedown", handleDown);
        canvas.addEventListener("mousemove", handleMove);
        window.addEventListener("mouseup", handleUp);

        return () => {
            canvas.removeEventListener("mousedown", handleDown);
            canvas.removeEventListener("mousemove", handleMove);
            window.removeEventListener("mouseup", handleUp);
        };
    }, [zoom]);

    // Animation + collision
    useEffect(() => {
        const rWorld = (m) => {
            const px = Math.max(4, 6 * Math.cbrt(m));
            return px / zoom;
        };

        const resolveCollision = (S) => {
            const m1 = S.m1, m2 = S.m2;
            const p1 = { ...S.p1 }, p2 = { ...S.p2 };
            const v1 = { ...S.v1 }, v2 = { ...S.v2 };

            const r12 = { x: p2.x - p1.x, y: p2.y - p1.y };
            const dist = Math.hypot(r12.x, r12.y);
            const R = rWorld(m1) + rWorld(m2);
            if (dist === 0 || dist > R) return S;

            const n = { x: r12.x / dist, y: r12.y / dist };
            const relV = { x: v2.x - v1.x, y: v2.y - v1.y };
            const velAlongN = relV.x * n.x + relV.y * n.y;

            const inv1 = 1 / m1, inv2 = 1 / m2;
            const penetration = R - dist;
            const correction = { x: n.x * penetration / (inv1 + inv2), y: n.y * penetration / (inv1 + inv2) };
            S.p1 = { x: p1.x - correction.x * inv1, y: p1.y - correction.y * inv1 };
            S.p2 = { x: p2.x + correction.x * inv2, y: p2.y + correction.y * inv2 };

            if (velAlongN > 0) return S;

            const j = (-(1 + e) * velAlongN) / (inv1 + inv2);
            const J = { x: n.x * j, y: n.y * j };
            S.v1 = { x: v1.x - J.x * inv1, y: v1.y - J.y * inv1 };
            S.v2 = { x: v2.x + J.x * inv2, y: v2.y + J.y * inv2 };

            return S;
        };

        const step = (ts) => {
            if (!lastRef.current) lastRef.current = ts;
            const elapsed = ts - lastRef.current;
            lastRef.current = ts;

            if (running) {
                const simPerMs = dt / 16.6667; // 60fps nominal
                let accum = elapsed * simPerMs;
                let newState = stateRef.current;
                const maxSubSteps = 60;
                let count = 0;
                while (accum > 0 && count < maxSubSteps) {
                    const h = Math.min(accum, dt);
                    newState = rk4Step(newState, h, G);
                    if (collide) newState = resolveCollision(newState);
                    accum -= h;
                    count++;
                }
                stateRef.current = newState;
                setState(newState);

                if (showTrails) {
                    const t1 = trail1Ref.current;
                    const t2 = trail2Ref.current;
                    t1.push({ ...newState.p1 });
                    t2.push({ ...newState.p2 });
                    const MAX = 400;
                    if (t1.length > MAX) t1.shift();
                    if (t2.length > MAX) t2.shift();
                } else {
                    trail1Ref.current = [];
                    trail2Ref.current = [];
                }
            }

            draw();
            rafRef.current = requestAnimationFrame(step);
        };
        rafRef.current = requestAnimationFrame(step);
        return () => cancelAnimationFrame(rafRef.current);
    }, [running, dt, zoom, showTrails, collide, e]);

    // Drawing
    const draw = () => {
        const canvas = canvasRef.current;
        const wrap = wrapRef.current;
        if (!canvas || !wrap) return;
        const ctx = canvas.getContext("2d");

        const width = Math.floor(wrap.clientWidth);
        const height = 480;
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = Math.max(1, width);
            canvas.height = height;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const center = { x: canvas.width / 2, y: canvas.height / 2 };
        const toScreen = (p) => ({ x: center.x + p.x * zoom, y: center.y - p.y * zoom });

        // Grid
        ctx.save();
        ctx.globalAlpha = 0.15;
        const step = zoom;
        for (let x = center.x % step; x < canvas.width; x += step) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
        }
        for (let y = center.y % step; y < canvas.height; y += step) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
        }
        ctx.restore();

        // Trails
        if (showTrails) {
            const t1 = trail1Ref.current;
            const t2 = trail2Ref.current;
            if (t1.length > 1) {
                ctx.beginPath();
                let p = toScreen(t1[0]);
                ctx.moveTo(p.x, p.y);
                for (let i = 1; i < t1.length; i++) { p = toScreen(t1[i]); ctx.lineTo(p.x, p.y); }
                ctx.strokeStyle = "#2563eb"; ctx.globalAlpha = 0.7; ctx.stroke(); ctx.globalAlpha = 1;
            }
            if (t2.length > 1) {
                ctx.beginPath();
                let p = toScreen(t2[0]);
                ctx.moveTo(p.x, p.y);
                for (let i = 1; i < t2.length; i++) { p = toScreen(t2[i]); ctx.lineTo(p.x, p.y); }
                ctx.strokeStyle = "#ea580c"; ctx.globalAlpha = 0.7; ctx.stroke(); ctx.globalAlpha = 1;
            }
        }

        // Bodies
        const s1 = toScreen(stateRef.current.p1);
        const s2 = toScreen(stateRef.current.p2);
        const rPix1 = Math.max(4, 6 * Math.cbrt(m1));
        const rPix2 = Math.max(4, 6 * Math.cbrt(m2));

        ctx.beginPath(); ctx.arc(s1.x, s1.y, rPix1, 0, Math.PI * 2); ctx.fillStyle = "#1e40af"; ctx.fill();
        ctx.beginPath(); ctx.arc(s2.x, s2.y, rPix2, 0, Math.PI * 2); ctx.fillStyle = "#c2410c"; ctx.fill();

        // HUD
        const { ke, pe, te } = energy(stateRef.current, G);
        const rel = Math.abs((te - E0.te) / (E0.te || 1));
        ctx.fillStyle = "#111827";
        ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
        ctx.fillText(
            `t = ${stateRef.current.t.toFixed(2)}  KE = ${ke.toFixed(3)}  PE = ${pe.toFixed(3)}  TE = ${te.toFixed(3)}  |ΔE/TE₀| = ${(rel*100).toFixed(3)}%`,
            10, 18
        );
    };

    // Actions
    const handleReset = () => {
        trail1Ref.current = [];
        trail2Ref.current = [];
        setRunning(r => !r);
        setState((_) => ({ ...initialState }));
        setE0(energy(initialState, G));
        stateRef.current = initialState;
    };

    // NEW: helper to fill sliders with circular-orbit velocities (apply with Reset)
    const makeCircular = () => {
        // With p1 at -d/2 and p2 at +d/2 on x-axis, circular orbit is ±y velocities
        const vRel = Math.sqrt((G * (m1 + m2)) / distance);
        const v1_mag = vRel * (m2 / (m1 + m2));
        const v2_mag = vRel * (m1 / (m1 + m2));

        setV1x(0); setV2x(0);
        setV1y(+v1_mag);
        setV2y(-v2_mag);
    };

    return (
        <div className="tb-wrap">
            {/* Controls */}
            <div className="tb-controls">
                <div className="tb-card">
                    <div className="tb-card-title">Bodies</div>
                    <label className="tb-row">
                        <span className="tb-row-label">m₁</span>
                        <input type="range" min={0.2} max={50} step={0.1} value={m1} onChange={(e)=>setM1(parseFloat(e.target.value))} className="tb-range"/>
                        <span className="tb-num">{m1.toFixed(1)}</span>
                    </label>
                    <label className="tb-row">
                        <span className="tb-row-label">m₂</span>
                        <input type="range" min={0.2} max={50} step={0.1} value={m2} onChange={(e)=>setM2(parseFloat(e.target.value))} className="tb-range"/>
                        <span className="tb-num">{m2.toFixed(1)}</span>
                    </label>
                </div>

                <div className="tb-card">
                    <div className="tb-card-title">Initial Conditions</div>

                    <label className="tb-row">
                        <span className="tb-row-label">Separation d</span>
                        <input
                            type="range" min={0.5} max={30} step={0.1}
                            value={distance}
                            onChange={(e)=>setDistance(parseFloat(e.target.value))}
                            className="tb-range"
                        />
                        <span className="tb-num">{distance.toFixed(1)}</span>
                    </label>

                    <div className="tb-subtitle" style={{marginTop:8}}>Initial Velocities</div>

                    {/* Body 1 */}
                    <label className="tb-row">
                        <span className="tb-row-label">v₁x</span>
                        <input
                            type="range" min={-5} max={5} step={0.01}
                            value={v1x}
                            onChange={(e)=>setV1x(parseFloat(e.target.value))}
                            className="tb-range"
                        />
                        <span className="tb-num">{v1x.toFixed(2)}</span>
                    </label>
                    <label className="tb-row">
                        <span className="tb-row-label">v₁y</span>
                        <input
                            type="range" min={-5} max={5} step={0.01}
                            value={v1y}
                            onChange={(e)=>setV1y(parseFloat(e.target.value))}
                            className="tb-range"
                        />
                        <span className="tb-num">{v1y.toFixed(2)}</span>
                    </label>

                    {/* Body 2 */}
                    <label className="tb-row">
                        <span className="tb-row-label">v₂x</span>
                        <input
                            type="range" min={-5} max={5} step={0.01}
                            value={v2x}
                            onChange={(e)=>setV2x(parseFloat(e.target.value))}
                            className="tb-range"
                        />
                        <span className="tb-num">{v2x.toFixed(2)}</span>
                    </label>
                    <label className="tb-row">
                        <span className="tb-row-label">v₂y</span>
                        <input
                            type="range" min={-5} max={5} step={0.01}
                            value={v2y}
                            onChange={(e)=>setV2y(parseFloat(e.target.value))}
                            className="tb-range"
                        />
                        <span className="tb-num">{v2y.toFixed(2)}</span>
                    </label>

                    <div className="tb-btn-row" style={{marginTop:8}}>
                        <button type="button" onClick={makeCircular} className="tb-btn">Make circular</button>
                        <button type="button" onClick={handleReset} className="tb-btn">Reset (apply)</button>
                    </div>

                    <div className="tb-hint" style={{fontSize:12,opacity:.8,marginTop:6}}>
                        Velocities apply on reset. “Make circular” fills sliders for a stable orbit; press Reset to use them.
                    </div>
                </div>

                <div className="tb-card">
                    <div className="tb-card-title">Simulation</div>
                    <label className="tb-row">
                        <span className="tb-row-label">G</span>
                        <input
                            type="range" min={0.1} max={5} step={0.1}
                            value={G}
                            onChange={(e)=>setG(parseFloat(e.target.value))}
                            className="tb-range"
                        />
                        <span className="tb-num">{G.toFixed(1)}</span>
                    </label>
                    <label className="tb-row">
                        <span className="tb-row-label">Δt</span>
                        <input type="range" min={0.001} max={0.05} step={0.001} value={dt} onChange={(e)=>setDt(parseFloat(e.target.value))} className="tb-range"/>
                        <span className="tb-num">{dt.toFixed(3)}</span>
                    </label>
                    <label className="tb-row">
                        <span className="tb-row-label">Zoom</span>
                        <input type="range" min={10} max={240} step={1} value={zoom} onChange={(e)=>setZoom(parseFloat(e.target.value))} className="tb-range"/>
                        <span className="tb-num">{zoom.toFixed(0)}</span>
                    </label>
                    <label className="tb-check">
                        <input type="checkbox" checked={showTrails} onChange={(e)=>setShowTrails(e.target.checked)} />
                        <span>Show trails</span>
                    </label>
                    <label className="tb-check">
                        <input type="checkbox" checked={collide} onChange={(e)=>setCollide(e.target.checked)} />
                        <span>Enable Collisions</span>
                    </label>

                    <div className="tb-row">
                        <div className="tb-label">Elasticity (e)</div>
                        <input
                            type="range" min={0} max={1} step={0.05}
                            value={e} onChange={(ev)=>setE(parseFloat(ev.target.value))}
                            className="tb-range"
                        />
                        <span className="tb-num">{e.toFixed(2)}</span>
                    </div>
                </div>

                <div className="tb-btn-row">
                    <button type="button" onClick={()=>setRunning((r)=>!r)} className="tb-btn">{running ? "Pause" : "Play"}</button>
                    <button type="button" onClick={()=>{trail1Ref.current=[]; trail2Ref.current=[];}} className="tb-btn">Clear trails</button>
                    <button type="button" onClick={handleReset} className="tb-btn">Reset</button>
                </div>
            </div>

            {/* Canvas wrapper */}
            <div ref={wrapRef} className="tb-canvasWrap">
                <canvas ref={canvasRef} className="tb-canvas" />
            </div>

            {/* Tips */}
            <div className="tb-tips">
                Tips: Use "Make circular" then Reset for stable orbits. Reduce Δt if energy drift grows. Zoom adjusts world-to-screen scale (1 unit ≈ grid spacing). This demo uses G=1 and arbitrary units.
            </div>
        </div>
    );
}
