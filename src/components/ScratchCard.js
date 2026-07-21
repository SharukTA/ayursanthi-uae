"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Canvas "foil" overlay the user scratches off to reveal the children beneath.
// Works with both mouse and touch. Fully reveals once ~50% is scratched.
export function ScratchCard({
  children,
  label = "Scratch to reveal",
  onReveal,
  className = "",
}) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const [revealed, setRevealed] = useState(false);

  const paintCover = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const { width, height } = wrap.getBoundingClientRect();
    if (!width || !height) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, width, height);
    g.addColorStop(0, "#565959");
    g.addColorStop(0.5, "#232f3e");
    g.addColorStop(1, "#131921");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
    // subtle sheen stripes
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    for (let x = -height; x < width; x += 26) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + height, height);
      ctx.lineTo(x + height + 10, height);
      ctx.lineTo(x + 10, 0);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 13px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, width / 2, height / 2);
  }, [label]);

  useEffect(() => {
    paintCover();
    const ro = new ResizeObserver(() => {
      if (!revealed) paintCover();
    });
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [paintCover, revealed]);

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    return { x: point.clientX - rect.left, y: point.clientY - rect.top };
  };

  const scratchAt = (x, y) => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.fill();
  };

  const scratchedPercent = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let cleared = 0;
    let total = 0;
    for (let i = 3; i < data.length; i += 64) {
      total++;
      if (data[i] === 0) cleared++;
    }
    return total ? cleared / total : 0;
  };

  const handleMove = (e) => {
    if (!drawingRef.current || revealed) return;
    const { x, y } = getPos(e);
    scratchAt(x, y);
  };

  const finish = () => {
    drawingRef.current = false;
    if (revealed) return;
    if (scratchedPercent() > 0.5) {
      setRevealed(true);
      onReveal?.();
    }
  };

  const handleDown = (e) => {
    drawingRef.current = true;
    handleMove(e);
  };

  return (
    <div ref={wrapRef} className={`relative overflow-hidden ${className}`}>
      {children}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 size-full transition-opacity duration-700 ${
          revealed ? "pointer-events-none opacity-0" : "cursor-grab opacity-100"
        }`}
        style={{ touchAction: "none" }}
        onMouseDown={handleDown}
        onMouseMove={handleMove}
        onMouseUp={finish}
        onMouseLeave={finish}
        onTouchStart={handleDown}
        onTouchMove={handleMove}
        onTouchEnd={finish}
      />
    </div>
  );
}
