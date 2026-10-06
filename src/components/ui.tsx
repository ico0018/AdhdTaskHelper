"use client";

import {
  BookOpen,
  Calculator,
  PenLine,
  Backpack,
  Languages,
  Shapes,
  ArrowLeft,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import type { TaskType } from "@/lib/models";

const icons: Record<TaskType, LucideIcon> = {
  math: Calculator,
  chinese: BookOpen,
  reading: BookOpen,
  english: Languages,
  writing: PenLine,
  organization: Backpack,
  other: Shapes,
};
export function TaskIcon({
  type,
  small = false,
}: {
  type: TaskType;
  small?: boolean;
}) {
  const Icon = icons[type];
  return (
    <span className={`task-icon ${type} ${small ? "small" : ""}`}>
      <Icon aria-hidden="true" size={small ? 21 : 28} strokeWidth={1.7} />
    </span>
  );
}
export function BackButton({
  onClick,
  label = "回到今天",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button className="back-button" onClick={onClick}>
      <ArrowLeft size={18} aria-hidden="true" />
      {label}
    </button>
  );
}
export function Modal({
  title,
  children,
  onClose,
  className = "",
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const scrollY = window.scrollY;
    const body = document.body;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    const rootOverflow = document.documentElement.style.overflow;
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    element?.showModal();
    return () => {
      element?.close();
      Object.assign(body.style, previous);
      document.documentElement.style.overflow = rootOverflow;
      window.scrollTo(0, scrollY);
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`modal ${className}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="modal-title"
    >
      <div className="modal-header">
        <h2 id="modal-title">{title}</h2>
        <button aria-label="关闭" className="icon-button" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function formatMinutes(minutes: number): string {
  if (minutes < 1) return "不到 1";
  return String(Math.round(minutes * 10) / 10);
}
export function QuietLandscape() {
  return (
    <svg
      className="landscape"
      viewBox="0 0 240 160"
      fill="none"
      aria-hidden="true"
    >
      <path d="M42 138V79a78 78 0 0 1 156 0v59" fill="#f4e8c8" />
      <circle cx="157" cy="48" r="19" fill="#e9bd62" />
      <path
        d="M42 103c30-34 59-24 87 1 24-23 42-29 69-11v45H42z"
        fill="#cbd2b4"
      />
      <path d="M42 123c29-21 67-17 91-3 22-8 41-7 65 2v16H42z" fill="#aebc91" />
      <path
        d="M112 138c17-10 37-13 27-22-12-9-19-13-15-21"
        stroke="#fbf5e6"
        strokeWidth="12"
      />
      <path
        d="M36 139h169"
        stroke="#9d9275"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M66 104V85m0 9-6-5m6 10 7-6"
        stroke="#8b9b6f"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M31 64h16m-8-8v16M205 108h10m-5-5v10"
        stroke="#c9b992"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

