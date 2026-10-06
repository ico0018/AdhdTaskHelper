"use client";

import { useEffect, useState } from "react";
import type { Database } from "@/lib/models";
import { journeyForDate } from "@/lib/flow";

export default function TaskJourney({
  db,
  date,
  advance = false,
}: {
  db: Database;
  date: string;
  advance?: boolean;
}) {
  const { total, completed } = journeyForDate(db, date);
  const [arrived, setArrived] = useState(!advance);
  useEffect(() => {
    if (!advance) return;
    const timer = window.setTimeout(() => setArrived(true), 80);
    return () => window.clearTimeout(timer);
  }, [advance]);
  if (!total) return null;
  const columns = Math.min(total + 1, 5);
  const rows = Math.ceil((total + 1) / columns);
  const point = (index: number) => {
    const row = Math.floor(index / columns);
    const column = row % 2 ? columns - 1 - (index % columns) : index % columns;
    return { x: 30 + column * 68, y: 66 + row * 82 };
  };
  const position = point(arrived ? completed : Math.max(0, completed - 1));
  const home = point(total);
  return (
    <svg
      className="task-journey"
      viewBox={`0 0 ${columns * 68 - 8} ${rows * 82 + 20}`}
      role="img"
      aria-label={`完成 ${completed} 项，共 ${total} 项，走 ${total} 格到小房子`}
    >
      <polyline
        points={Array.from({ length: total + 1 }, (_, i) => {
          const p = point(i);
          return `${p.x},${p.y}`;
        }).join(" ")}
        fill="none"
        stroke="#d5cfbc"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={point(0).x} cy={point(0).y} r="5" fill="#aaa68e" />
      {Array.from({ length: total }, (_, i) => {
        const p = point(i + 1);
        return (
          <rect
            key={i}
            x={p.x - 13}
            y={p.y - 12}
            width="26"
            height="24"
            rx="6"
            fill={i < completed ? "#e7ce7e" : "#fffefa"}
            stroke={i < completed ? "#b39e60" : "#d5cfbc"}
            strokeWidth="1.5"
          />
        );
      })}
      <g transform={`translate(${home.x},${home.y - 17})`} aria-hidden="true">
        <path
          d="M-19-5 0-21 19-5"
          fill="#e9ba8d"
          stroke="#9b775d"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M-15-7v24h30V-7"
          fill="#faf2d9"
          stroke="#9b775d"
          strokeWidth="2"
        />
        <path
          d="M-5 17V5H5v12"
          fill="#d1b68a"
          stroke="#9b775d"
          strokeWidth="1.5"
        />
      </g>
      <g
        className={`journey-person ${advance ? "advancing" : ""}`}
        style={{
          transform: `translate(${position.x}px, ${position.y - 18}px)`,
        }}
        aria-hidden="true"
      >
        <circle
          cy="-23"
          r="7"
          fill="#e8c5a2"
          stroke="#917758"
          strokeWidth="1.5"
        />
        <path
          d="M-7-24q1-10 12-4"
          fill="none"
          stroke="#675440"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path d="M-5-13 5-13 8 0H-8Z" fill="#c78c68" />
        <path
          d="m-5-9-7 7m17-7 7 7M-4 0l-3 9M4 0l3 9"
          fill="none"
          stroke="#917758"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
export function Confetti() {
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: 18 }, (_, i) => (
        <i
          key={i}
          style={{
            left: `${5 + i * 5}%`,
            animationDelay: `${(i % 5) * 0.08}s`,
            background: ["#dec76b", "#bea587", "#a8bb8e", "#ce9876"][i % 4],
          }}
        />
      ))}
    </div>
  );
}

