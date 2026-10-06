"use client";

import { useState, type FormEvent } from "react";
import {
  type Task,
  type TaskInput,
  type TaskType,
  taskTypes,
  typeLabels,
  timeOptionsSchema,
} from "@/lib/models";
import { Modal } from "./ui";

const commonMaterials = ["铅笔", "橡皮", "尺子", "作业本", "练习册", "语文书", "数学书", "英语书", "点读笔", "草稿纸"];

export default function TaskForm({
  task,
  onSave,
  onClose,
}: {
  task?: Task;
  onSave: (input: TaskInput) => boolean;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [type, setType] = useState<TaskType>(task?.type ?? "math");
  const [priority, setPriority] = useState(task?.priority ?? 2);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>(
    task?.materials.filter((item) => commonMaterials.includes(item)) ?? [],
  );
  const [materials, setMaterials] = useState(
    task?.materials.filter((item) => !commonMaterials.includes(item)).join("\n") ?? "",
  );
  const [timeOptions, setTimeOptions] = useState(
    (task?.timeOptions ?? [10, 20, 30]).map(String),
  );
  const [timeError, setTimeError] = useState("");
  const [materialError, setMaterialError] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const list = [
      ...new Set([
        ...selectedMaterials,
        ...materials
          .split(/[\n,，、]/)
          .map((item) => item.trim())
          .filter(Boolean),
      ]),
    ];
    if (list.length > 30 || list.some((item) => item.length > 40)) {
      setMaterialError("最多 30 项材料，每项最多 40 字。");
      return;
    }
    const parsedTimes = timeOptionsSchema.safeParse(
      timeOptions.map((value) => Number(value)),
    );
    if (!parsedTimes.success) {
      setTimeError("请设置三个不同的整数时间，每个 1–180 分钟。");
      return;
    }
    if (
      onSave({
        title,
        description,
        type,
        priority,
        materials: list,
        timeOptions: [...parsedTimes.data].sort((a, b) => a - b),
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
            {type === "reading" && (
              <option value="reading" hidden>原任务类型</option>
            )}
            {taskTypes.filter((t) => t !== "reading").map((t) => (
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
        <fieldset className="time-options-fieldset">
          <legend>孩子可选的时间（分钟）</legend>
          <div className="parent-time-options">
            {timeOptions.map((value, index) => (
              <label key={index}>
                选项 {index + 1}
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={180}
                  step={1}
                  required
                  value={value}
                  onChange={(e) => {
                    setTimeOptions(
                      timeOptions.map((item, i) =>
                        i === index ? e.target.value : item,
                      ),
                    );
                    setTimeError("");
                  }}
                />
              </label>
            ))}
          </div>
          {timeError && <p role="alert">{timeError}</p>}
        </fieldset>
        <fieldset className="material-options-fieldset">
          <legend>准备材料</legend>
          <div className="parent-material-options">
            {commonMaterials.map((item) => (
              <label className="material-check" key={item}>
                <input
                  type="checkbox"
                  checked={selectedMaterials.includes(item)}
                  onChange={(e) => {
                    setSelectedMaterials(e.target.checked
                      ? [...selectedMaterials, item]
                      : selectedMaterials.filter((value) => value !== item));
                    setMaterialError("");
                  }}
                />
                <span>{item}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label>
          其他材料
          <textarea
            rows={4}
            maxLength={1230}
            value={materials}
            onChange={(e) => {
              setMaterials(e.target.value);
              setMaterialError("");
            }}
            placeholder="特殊用品，每行一项"
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

