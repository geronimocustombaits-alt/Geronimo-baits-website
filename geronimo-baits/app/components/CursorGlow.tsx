"use client";

import { useEffect, useState } from "react";

export default function CursorGlow() {
  const [position, setPosition] = useState({ x: -200, y: -200 });

  useEffect(() => {
    const move = (e: MouseEvent) => {
      setPosition({
        x: e.clientX,
        y: e.clientY,
      });
    };

    window.addEventListener("mousemove", move);

    return () => {
      window.removeEventListener("mousemove", move);
    };
  }, []);

  return (
    <div
      className="pointer-events-none fixed z-[9999] h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-green-500/10 blur-3xl transition-all duration-300 ease-out"
      style={{
        left: position.x,
        top: position.y,
        boxShadow: "0 0 80px 30px rgba(34,197,94,0.15)",
      }}
    >
      <div className="absolute left-10 top-20 h-20 w-40 rounded-full bg-green-400/10 blur-2xl"></div>
      <div className="absolute left-0 top-28 h-16 w-52 rounded-full bg-green-500/10 blur-3xl"></div>
      <div className="absolute left-20 top-8 h-10 w-32 rounded-full bg-white/5 blur-2xl"></div>
    </div>
  );
}