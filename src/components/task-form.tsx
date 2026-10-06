"use client";

import { useState, type FormEvent } from "react";
import {
  type Task,
  type FocusCycle,
  type TaskInput,
  type TaskType,
  taskTypes,
  typeLabels,
} from "@/lib/models";
import { Modal } from "./ui";

export default function TaskForm({
  task,
  focusCycle,
  onSave,
  onClose,
}: {
  task?: Task;
  focusCycle?: FocusCycle;
  onSave: (input: TaskInput) => boolean;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [type, setType] = useState<TaskType>(task?.type ?? "math");
  const [priority, setPriority] = useState(task?.priority ?? 2);
  const [materials, setMaterials] = useState(task?.materials.join("\n") ?? "");
  const [belongsToCycle, setBelongsToCycle] = useState(
    !!focusCycle && task?.focusCycleId === focusCycle.id,
  );
  const [materialError, setMaterialError] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const list = [
      ...new Set(
        materials
          .split(/[\n,，、]/)
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    ];
    if (list.length > 30 || list.some((item) => item.length > 40)) {
      setMaterialError("最多 30 项材料，每项最多 40 字。");
      return;
    }
    if (
      onSave({
        title,
        description,
        type,
        priority,
        materials: list,
        focusCycleId: belongsToCycle && focusCycle ? focusCycle.id : null,
      })
    )
      onClose();
  };
  return (
    <Modal title={task ? "编辑任务" : "添加一件事"} onClose={onClose}>
      <form onSubmit={submit} className="task-form">
        <label>
          任务名称
          <input
            autoFocus
            required
            maxLength={40}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如：数学作业"
          />
        </label>
        <label>
          简单说说要做什么<span className="optional">选填</span>
          <input
            maxLength={120}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="例如：完成练习册 P18"
          />
        </label>
        <label>
          任务类型
          <select
            value={type}
            onChange={(e) => setType(e.target.value as TaskType)}
          >
            {taskTypes.map((t) => (
              <option key={t} value={t}>
                {typeLabels[t]}
              </option>
            ))}
          </select>
        </label>
        <label>
          重要程度
          <select
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
          >
            <option value={1}>优先做</option>
            <option value={2}>普通</option>
            <option value={3}>稍后做</option>
          </select>
        </label>
        {focusCycle && (
          <label className="cycle-assignment">
            <input
              type="checkbox"
              checked={belongsToCycle}
              onChange={(e) => setBelongsToCycle(e.target.checked)}
            />
            <span>属于本期主攻：{focusCycle.title}</span>
          </label>
        )}
        <label>
          准备材料
          <textarea
            rows={4}
            maxLength={1230}
            value={materials}
            onChange={(e) => {
              setMaterials(e.target.value);
              setMaterialError("");
            }}
            placeholder={"尺子\n铅笔\n橡皮\n作业本"}
          />
        </label>
        <p className="form-note">
          每行一项，最多 30 项，每项最多 40 字。孩子开始前会逐项勾选。
        </p>
        {materialError && <p role="alert">{materialError}</p>}
        <button className="primary full" type="submit" disabled={!title.trim()}>
          保存任务
        </button>
      </form>
    </Modal>
  );
}
