"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import type { Database, Task, TaskPreparation } from "@/lib/models";
import { startPreparedTask } from "@/lib/flow";
import { BackButton, TaskIcon } from "./ui";
import QuietPet from "./quiet-pet";

export default function Preparation({
  task,
  bathroomReminder,
  commit,
  onBack,
}: {
  task: Task;
  bathroomReminder: boolean;
  commit: (transform: (db: Database) => Database) => boolean;
  onBack: () => void;
}) {
  const [estimate, setEstimate] = useState<number | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [bathroomReady, setBathroomReady] = useState(false);
  const [phase, setPhase] = useState<"materials" | "breathing">("materials");
  const [breathStartedAt, setBreathStartedAt] = useState<number | null>(null);
  const [breathCompletedAt, setBreathCompletedAt] = useState<number | null>(
    null,
  );
  const [remaining, setRemaining] = useState(3);
  const allReady =
    estimate !== null &&
    task.materials.every((m) => checked.includes(m)) &&
    (!bathroomReminder || bathroomReady);

  useEffect(() => {
    if (breathStartedAt === null || breathCompletedAt !== null) return;
    const update = () => {
      const now = Date.now();
      setRemaining(
        Math.max(0, Math.ceil((breathStartedAt + 3000 - now) / 1000)),
      );
      if (now >= breathStartedAt + 3000) setBreathCompletedAt(now);
    };
    const interval = setInterval(update, 100);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", update);
    };
  }, [breathStartedAt, breathCompletedAt]);

  return (
    <div className="decision-screen preparation-screen">
      <BackButton
        onClick={
          phase === "materials"
            ? onBack
            : () => {
                setPhase("materials");
                setBreathStartedAt(null);
                setBreathCompletedAt(null);
                setRemaining(3);
              }
        }
        label={phase === "materials" ? "返回任务" : "返回准备"}
      />
      <div className="decision-content">
        {phase === "materials" ? (
          <>
            <TaskIcon type={task.type} />
            <h1>{task.title}</h1>
            {task.description && (
              <p className="task-description">{task.description}</p>
            )}
            <h2>需要多久？</h2>
            <div className="estimate-grid">
              {[10, 20, 30].map((m) => (
                <button
                  className={`estimate-option ${estimate === m ? "selected" : ""}`}
                  aria-pressed={estimate === m}
                  onClick={() => setEstimate(m)}
                  key={m}
                >
                  <strong>{m}</strong>
                  <span>分钟</span>
                </button>
              ))}
            </div>
            {task.materials.length > 0 && (
              <section className="materials-list" aria-label="准备材料">
                <h2>准备材料</h2>
                {task.materials.map((material) => (
                  <label className="material-check" key={material}>
                    <input
                      type="checkbox"
                      checked={checked.includes(material)}
                      onChange={(e) =>
                        setChecked(
                          e.target.checked
                            ? [...checked, material]
                            : checked.filter((m) => m !== material),
                        )
                      }
                    />
                    <span>{material}</span>
                  </label>
                ))}
              </section>
            )}
            {bathroomReminder && (
              <section className="bathroom-preparation">
                <h2>要上厕所、喝水吗？</h2>
                <label className="material-check">
                  <input
                    type="checkbox"
                    checked={bathroomReady}
                    onChange={(e) => setBathroomReady(e.target.checked)}
                  />
                  <span>已经准备好了</span>
                </label>
              </section>
            )}
            <button
              className="primary full"
              disabled={!allReady}
              onClick={() => {
                setPhase("breathing");
                setBreathStartedAt(Date.now());
                setBreathCompletedAt(null);
                setRemaining(3);
              }}
            >
              准备好了
              <Check size={20} />
            </button>
          </>
        ) : (
          <section className="breathing-preparation">
            <h1>{breathCompletedAt === null ? "深呼吸" : "准备开始"}</h1>
            <QuietPet />
            <div className="breathing-visual">
              <div
                className={`breathing-orb ${breathCompletedAt !== null ? "settled" : ""}`}
                aria-hidden="true"
              />
              <div className="breathing-guide" aria-live="polite">
                {breathCompletedAt === null ? (
                  <>
                    <strong>{remaining}</strong>
                    <span>{remaining >= 2 ? "慢慢吸气" : "轻轻呼气"}</span>
                  </>
                ) : (
                  <Check size={28} />
                )}
              </div>
            </div>
            <p className="start-guidance">
              我们努力一次完成。
              <br />
              有困难再来找我，我会一直陪着你。
            </p>
            <button
              className="primary full"
              disabled={breathCompletedAt === null}
              onClick={() => {
                if (
                  estimate === null ||
                  breathStartedAt === null ||
                  breathCompletedAt === null
                )
                  return;
                const preparation: TaskPreparation = {
                  materials: checked,
                  bathroomAndWaterChecked: bathroomReady,
                  breathStartedAt,
                  breathCompletedAt,
                };
                commit((db) =>
                  startPreparedTask(
                    db,
                    task.id,
                    estimate,
                    preparation,
                    Date.now(),
                  ),
                );
              }}
            >
              正式开始
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
