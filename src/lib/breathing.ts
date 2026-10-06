export const BREATH_PHASE_MS = 4000;
export const BREATH_CYCLE_MS = BREATH_PHASE_MS * 2;
export const REQUIRED_BREATHS = 3;
export function breathingProgress(elapsedMs: number, targetBreaths: number) {
  const duration = targetBreaths * BREATH_CYCLE_MS;
  const elapsed = Math.max(0, Math.min(elapsedMs, duration));
  const complete = elapsed >= duration;
  const within = elapsed % BREATH_CYCLE_MS;
  const inhaling = within < BREATH_PHASE_MS;
  const phaseElapsed = within % BREATH_PHASE_MS;
  return {
    complete,
    breath: Math.min(targetBreaths, Math.floor(elapsed / BREATH_CYCLE_MS) + 1),
    cue: inhaling ? "慢慢吸气" : "慢慢呼气",
    seconds: Math.ceil((BREATH_PHASE_MS - phaseElapsed) / 1000),
    scale:
      0.72 +
      0.28 *
        (inhaling
          ? phaseElapsed / BREATH_PHASE_MS
          : 1 - phaseElapsed / BREATH_PHASE_MS),
  };
}
// The breathing guide counts visible elapsed time; study timing still uses absolute timestamps.
export function visibleElapsed(
  elapsed: number,
  previous: number,
  now: number,
  wasVisible: boolean,
) {
  return elapsed + (wasVisible ? Math.max(0, now - previous) : 0);
}

