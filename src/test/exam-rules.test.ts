import { describe, expect, it } from "vitest";

import { formatClock, MAX_SCORE, remainingSeconds } from "@/lib/exam";

describe("exam rules", () => {
  it("scores out of 60 (30 questions x 2 points)", () => {
    expect(MAX_SCORE).toBe(60);
  });

  it("a fresh session shows a 20:00 countdown", () => {
    const start = Date.UTC(2026, 0, 1, 9, 0, 0);
    const expires = start + 20 * 60 * 1000;
    expect(formatClock(remainingSeconds(expires, start))).toBe("20:00");
  });

  it("hits 00:00 exactly at expiry and never goes negative", () => {
    const expires = Date.UTC(2026, 0, 1, 9, 20, 0);
    expect(remainingSeconds(expires, expires)).toBe(0);
    expect(remainingSeconds(expires, expires + 5000)).toBe(0);
  });

  it("uses the server clock offset, not the device clock", () => {
    const expires = Date.UTC(2026, 0, 1, 9, 20, 0);
    // Device clock is 2 minutes behind the server.
    const deviceNow = expires - 3 * 60 * 1000;
    expect(remainingSeconds(expires, deviceNow, 2 * 60 * 1000)).toBe(60);
  });
});
