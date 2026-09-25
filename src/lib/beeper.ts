export const BEEPER_MIN = 1;
export const BEEPER_MAX = 50;

export function beeperNumbers(): number[] {
  return Array.from(
    { length: BEEPER_MAX - BEEPER_MIN + 1 },
    (_, index) => BEEPER_MIN + index
  );
}
