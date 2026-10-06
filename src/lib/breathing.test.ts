import { describe, expect, it } from "vitest";
import { breathingProgress, visibleElapsed } from "./breathing";
describe("complete guided breathing cycles", () => {
  it("guides inhale and exhale for all three rounds before enabling start", () => {
    expect(breathingProgress(0, 3)).toMatchObject({
      complete: false,
      breath: 1,
      cue: "慢慢吸气",
      seconds: 4,
    });
    expect(breathingProgress(4000, 3)).toMatchObject({
      complete: false,
      breath: 1,
      cue: "慢慢呼气",
      seconds: 4,
    });
    expect(breathingProgress(8000, 3)).toMatchObject({
      complete: false,
      breath: 2,
      cue: "慢慢吸气",
    });
    expect(breathingProgress(20000, 3)).toMatchObject({
      complete: false,
      breath: 3,
      cue: "慢慢呼气",
    });
    expect(breathingProgress(23999, 3).complete).toBe(false);
    expect(breathingProgress(24000, 3).complete).toBe(true);
    expect(breathingProgress(60000, 3).breath).toBe(3);
  });
  it("requires a full eight seconds for another breath", () => {
    expect(breathingProgress(7999, 1).complete).toBe(false);
    expect(breathingProgress(8000, 1).complete).toBe(true);
  });
  it("excludes hidden gaps and resumes from the same guide progress", () => {
    let elapsed = visibleElapsed(0, 0, 4000, true);
    elapsed = visibleElapsed(elapsed, 4000, 64000, false);
    expect(elapsed).toBe(4000);
    expect(breathingProgress(elapsed, 3)).toMatchObject({
      breath: 1,
      cue: "慢慢呼气",
    });
    expect(visibleElapsed(elapsed, 64000, 68000, true)).toBe(8000);
    expect(visibleElapsed(elapsed, 64000, 60000, true)).toBe(4000);
  });
});

