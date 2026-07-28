/**
 * Engine Registry — module-level handle to the currently active engine.
 *
 * The engine is created inside the platform feature component (AgentLoopFeature),
 * but UI that lives elsewhere (the Agent sidebar tab) needs to stop / resume /
 * continue it. Mutating only the Zustand store is not enough: the engine holds
 * its own abort controller and loop state, so store-only "stop" left the engine
 * running in the background.
 */

import type { AgentLoopEngine } from './AgentLoopEngine';

let activeEngine: AgentLoopEngine | null = null;

export function setActiveEngine(engine: AgentLoopEngine | null): void {
  activeEngine = engine;
}

export function getActiveEngine(): AgentLoopEngine | null {
  return activeEngine;
}

export function clearActiveEngine(engine?: AgentLoopEngine): void {
  // Only clear if it's still the same instance (avoids clobbering a newer engine)
  if (!engine || activeEngine === engine) {
    activeEngine = null;
  }
}
