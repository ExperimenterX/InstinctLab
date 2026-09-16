import { createContext } from "react";
import type { SimCore, SnapshotRing } from "@instinct/lab-sim";
import type { Clock } from "../clock.js";
import type { LabBus } from "../bus/lab-bus.js";
import type { LabStore } from "../state/lab-store.js";
import type { SessionStore } from "../state/session-store.js";

/**
 * The runtime bundle for one session. Built ONCE per sessionId and never rebuilt — rebuilding
 * would remount the canvas and reset the simulation mid-experiment.
 */
export interface LabRuntime {
  sim: SimCore;
  clock: Clock;
  bus: LabBus;
  labStore: LabStore;
  sessionStore: SessionStore;
  snapshots: SnapshotRing;
  dispose(): void;
}

export const LabRuntimeContext = createContext<LabRuntime | null>(null);
