"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import type { Database, Task, TaskPreparation } from "@/lib/models";
import {
  BREATH_CYCLE_MS,
  REQUIRED_BREATHS,
  breathingProgress,
  visibleElapsed,
} from "@/lib/breathing";
import { startPreparedTask } from "@/lib/flow";
import { BackButton, TaskIcon } from "./ui";
import QuietPet from "./quiet-pet";

export default function Preparation({
  task,
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
  const [phase, setPhase] = useState<"materials" | "needs" | "breathing">("materials");
  const [needsWater, setNeedsWater] = useState(false);
  const [needsToilet, setNeedsToilet] = useState(false);
  const [breathStartedAt, setBreathStartedAt] = useState<number | null>(null);
  const [breathCompletedAt, setBreathCompletedAt] = useState<number | null>(
    null,
  );
  const [run, setRun] = useState({ id: 0, target: REQUIRED_BREATHS });
  const [elapsed, setElapsed] = useState(0);
  const [guidedBreaths, setGuidedBreaths] = useState(0);
  const [guidedBreathingMs, setGuidedBreathingMs] = useState(0);
  const guide = breathingProgress(elapsed, run.target);
  const allReady =
    estimate !== null &&
    task.timeOptions.includes(estimate) &&
    task.materials.every((m) => checked.includes(m));

  useEffect(() => {
    if (breathStartedAt === null || breathCompletedAt !== null) return;
    let counted = 0;
    let previous = performance.now();
    let visible = !document.hidden;
    let finished = false;
    const update = () => {
      const now = performance.now();
      counted = visibleElapsed(counted, previous, now, visible);
      previous = now;
      visible = !document.hidden;
      setElapsed(counted);
      if (!finished && counted >= run.target * BREATH_CYCLE_MS) {
        finished = true;
        setGuidedBreaths((count) => count + run.target);
        setGuidedBreathingMs(
          (duration) => duration + run.target * BREATH_CYCLE_MS,
        );
        setBreathCompletedAt(Date.now());
      }
    };
    const interval = setInterval(update, 100);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", update);
    };
  }, [breathStartedAt, breathCompletedAt, run]);

  return (
    <div className="decision-screen preparation-screen">
      <BackButton
        onClick={
          phase === "materials"
            ? onBack
            : () => {
                setPhase(phase === "breathing" ? "needs" : "materials");
                setBreathStartedAt(null);
                setBreathCompletedAt(null);
                setElapsed(0);
                setGuidedBreaths(0);
                setGuidedBreathingMs(0);
                setRun((current) => ({
                  id: current.id + 1,
                  target: REQUIRED_BREATHS,
                }));
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
              {task.timeOptions.map((m) => (
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
            <button
              className="primary full"
              disabled={!allReady}
              onClick={() => {
                setPhase("needs");
              }}
            >
              准备好了
              <Check size={20} />
            </button>
          </>
        ) : phase === "needs" ? (
          <section className="needs-preparation">
            <h1>要喝水、上厕所吗？</h1>
            <div className="needs-options">
              <button className={`need-option ${needsWater ? "selected" : ""}`} aria-pressed={needsWater} onClick={() => setNeedsWater(!needsWater)}>
                <span aria-hidden="true">🥤</span>喝水
              </button>
              <button className={`need-option ${needsToilet ? "selected" : ""}`} aria-pressed={needsToilet} onClick={() => setNeedsToilet(!needsToilet)}>
                <span aria-hidden="true">🚽</span>上厕所
              </button>
            </div>
            {(needsWater || needsToilet) && <p>准备好再继续</p>}
            <button className="primary full" onClick={() => {
              setBathroomReady(true);
              setPhase("breathing");
              setBreathStartedAt(Date.now());
              setBreathCompletedAt(null);
              setElapsed(0);
              setGuidedBreaths(0);
              setGuidedBreathingMs(0);
              setRun((current) => ({ id: current.id + 1, target: REQUIRED_BREATHS }));
            }}>准备好了</button>
          </section>
        ) : (
          <section className="breathing-preparation">
            <h1>{breathCompletedAt === null ? "深呼吸" : "准备开始"}</h1>
            <p className="breath-count">
              {breathCompletedAt === null
                ? `第 ${guide.breath} 次 / ${run.target} 次`
                : "深呼吸完成了"}
            </p>
            <QuietPet />
            <div className="breathing-visual">
              <div
                className={`breathing-orb ${breathCompletedAt !== null ? "settled" : ""}`}
                aria-hidden="true"
                style={{
                  transform: `scale(${breathCompletedAt === null ? guide.scale : 0.8})`,
                }}
              />
              <div className="breathing-guide" aria-live="polite">
                {breathCompletedAt === null ? (
                  <>
                    <strong>{guide.seconds}</strong>
                    <span>{guide.cue}</span>
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
            {breathCompletedAt !== null && (
              <button
                className="secondary full breathe-again"
                onClick={() => {
                  setElapsed(0);
                  setRun((current) => ({ id: current.id + 1, target: 1 }));
                  setBreathCompletedAt(null);
                }}
              >
                再呼吸一次
              </button>
            )}
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
                  guidedBreaths,
                  guidedBreathingMs,
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
              现在开始
            </button>
          </section>
        )}
      </div>
    </div>
  );
}

