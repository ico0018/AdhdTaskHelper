"use client";

import { useState, type FormEvent } from "react";
import {
  focusCycleInputSchema,
  type FocusCycle,
  type FocusCycleInput,
} from "@/lib/models";
import { Modal } from "./ui";

export default function FocusCycleForm({
  cycle,
  today,
  onSave,
  onClose,
}: {
  cycle?: FocusCycle;
  today: string;
  onSave: (input: FocusCycleInput) => boolean;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(cycle?.title ?? "");
  const [startDate, setStartDate] = useState(cycle?.startDate ?? today);
  const [targetEndDate, setTargetEndDate] = useState(
    cycle?.targetEndDate ?? today,
  );
  const [error, setError] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = focusCycleInputSchema.safeParse({
      title,
      startDate,
      targetEndDate,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    if (onSave(parsed.data)) onClose();
  };
  return (
    <Modal title={cycle ? "修改本期主攻" : "创建本期主攻"} onClose={onClose}>
      <form className="task-form" onSubmit={submit}>
        <label>
          主攻名称
          <input
            autoFocus
            required
            maxLength={40}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如：乘法自动化"
          />
        </label>
        <label>
          开始日期
          <input
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </label>
        <label>
          预计结束日期
          <input
            type="date"
            required
            min={startDate}
            value={targetEndDate}
            onChange={(e) => setTargetEndDate(e.target.value)}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button className="primary full" type="submit" disabled={!title.trim()}>
          保存主攻周期
        </button>
      </form>
    </Modal>
  );
}
