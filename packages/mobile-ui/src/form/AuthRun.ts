import type { MascotPose } from "../brand/MascotArt";

/** What the shared recovery screens need from an app's action hook (customer `useAuthRun`, Dapur's equivalent). */
export type AuthRun = {
  busy: boolean;
  /** The failure's code, "" when none. */
  code: string;
  failures: number;
  /** The sentence for `FormError`, "" when none. */
  message: string;
  /** Seconds left of a rate-limit wait; the primary button is disabled while above 0. */
  wait: number;
  /** A failure worth "Coba lagi". */
  retryable: boolean;
  label(normal: string): string;
  run(action: () => Promise<unknown>): Promise<void>;
};

/** The mascot pose of a form: `melambai` until a failure, `bingung` after it, back on the next edit. */
export type FormPose = {
  pose: MascotPose;
  edit(set: (v: string) => void): (v: string) => void;
  press(checks: { submit: (go: () => void) => void }, go: () => void): void;
};
