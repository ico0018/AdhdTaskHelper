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
        <path d="M-15-10q-8-5-7-10" fill="none" stroke="#819b9b" strokeWidth="3" strokeLinecap="round" />
        <ellipse cx="-3" cy="-13" rx="17" ry="13" fill="#b4cccc" stroke="#819b9b" strokeWidth="1.5" />
        <rect x="-14" y="-7" width="8" height="15" rx="4" fill="#b4cccc" stroke="#819b9b" strokeWidth="1.5" />
        <rect x="5" y="-7" width="8" height="15" rx="4" fill="#b4cccc" stroke="#819b9b" strokeWidth="1.5" />
        <circle cx="10" cy="-23" r="13" fill="#b4cccc" stroke="#819b9b" strokeWidth="1.5" />
        <ellipse cx="1" cy="-21" rx="10" ry="12" fill="#c6dddd" stroke="#819b9b" strokeWidth="1.5" />
        <ellipse cx="1" cy="-20" rx="6" ry="8" fill="#e5c5bb" />
        <path d="M18-19q8 13 3 19q-4 4-7-1" fill="none" stroke="#819b9b" strokeWidth="8" strokeLinecap="round" />
        <path d="M18-19q8 13 3 19q-4 4-7-1" fill="none" stroke="#b4cccc" strokeWidth="5" strokeLinecap="round" />
        <circle cx="15" cy="-26" r="2" fill="#394b4c" />
        <circle cx="18" cy="-21" r="3" fill="#e5b6a8" />
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

