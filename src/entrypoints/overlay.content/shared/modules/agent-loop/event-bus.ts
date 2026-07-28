/**
 * Agent Loop Event Bus.
 *
 * Lightweight, typed pub/sub for decoupled communication between
 * agent loop modules (engine, tools, UI, future integrations).
 *
 * Design principles:
 * - Zero dependencies — pure TypeScript
 * - Strongly typed — all events defined in AgentEventMap
 * - Simple API — emit / on / once / off
 * - Safe — errors in listeners don't crash the bus
 *
 * Usage:
 *   import { agentEventBus } from './event-bus';
 *   agentEventBus.on('tool:executed', (data) => { ... });
 *   agentEventBus.emit('tool:executed', { toolName: 'execute_sql', ... });
 */

// ─── Event Map ───────────────────────────────────────────────────────────────

export interface AgentEventMap {
  // ── Loop lifecycle ─────────────────────────────────────────────────────
  'loop:started': { maxRounds: number; timestamp: number };
  'loop:round-started': { round: number };
  'loop:round-completed': { round: number; toolCallCount: number };
  'loop:ended': { reason: 'complete' | 'max_rounds' | 'user_stop' | 'error' | 'circuit_breaker'; totalRounds: number };
  'loop:paused': { reason: string };
  'loop:resumed': undefined;

  // ── Tool execution ─────────────────────────────────────────────────────
  'tool:executing': { toolName: string; params: Record<string, string> };
  'tool:executed': { toolName: string; success: boolean; result: string; durationMs: number };
  'tool:error': { toolName: string; error: string };

  // ── AI response ────────────────────────────────────────────────────────
  'ai:response-waiting': undefined;
  'ai:response-received': { textLength: number; toolCallCount: number };
  'ai:response-timeout': { timeoutMs: number };

  // ── Circuit breaker ────────────────────────────────────────────────────
  'circuit-breaker:loop-detected': { toolName: string; count: number; action: 'warn' | 'stop' };
  'circuit-breaker:failure-recorded': { toolName: string; consecutiveCount: number; totalCount: number; errorMessage?: string };
  'circuit-breaker:no-progress': { consecutiveCount: number };
  'circuit-breaker:reset': undefined;

  // ── User interaction ───────────────────────────────────────────────────
  'user:confirmation-requested': { sql: string };
  'user:confirmation-responded': { confirmed: boolean; sql: string };

  // ── Control ────────────────────────────────────────────────────────────
  'control:speed-mode-changed': { enabled: boolean };
  'control:instruction-injected': { instruction: string };
  'control:breakpoint-set': { round: number | null };

  // ── Launcher (Agent tab → editor) ──────────────────────────────────────
  /**
   * Ask the platform feature to stage an agent entry in the chat input.
   * `autoSend` sends it immediately; otherwise the user can add context first.
   */
  'launcher:run-entry': { entryId: string; userInput?: string; autoSend: boolean };
  'launcher:staged': { entryId: string; autoSend: boolean };
  'launcher:failed': { reason: 'no-editor' | 'unknown-entry' };

  // ── Generic ────────────────────────────────────────────────────────────
  'debug:log': { level: 'info' | 'warn' | 'error'; message: string; data?: unknown };
}

// ─── Types ───────────────────────────────────────────────────────────────────

type EventName = keyof AgentEventMap;
type EventData<E extends EventName> = AgentEventMap[E];
type Listener<E extends EventName> = (data: EventData<E>) => void;

interface ListenerEntry {
  fn: Function;
  once: boolean;
}

// ─── Event Bus Implementation ────────────────────────────────────────────────

class AgentEventBus {
  private listeners = new Map<EventName, ListenerEntry[]>();
  private _debugMode = false;

  /**
   * Subscribe to an event. Returns an unsubscribe function.
   */
  on<E extends EventName>(event: E, listener: Listener<E>): () => void {
    const entries = this.listeners.get(event) || [];
    entries.push({ fn: listener, once: false });
    this.listeners.set(event, entries);

    // Return unsubscribe function
    return () => this.off(event, listener);
  }

  /**
   * Subscribe to an event, auto-unsubscribing after the first call.
   */
  once<E extends EventName>(event: E, listener: Listener<E>): () => void {
    const entries = this.listeners.get(event) || [];
    entries.push({ fn: listener, once: true });
    this.listeners.set(event, entries);

    return () => this.off(event, listener);
  }

  /**
   * Unsubscribe a specific listener from an event.
   */
  off<E extends EventName>(event: E, listener: Listener<E>): void {
    const entries = this.listeners.get(event);
    if (!entries) return;

    const filtered = entries.filter((entry) => entry.fn !== listener);
    if (filtered.length === 0) {
      this.listeners.delete(event);
    } else {
      this.listeners.set(event, filtered);
    }
  }

  /**
   * Emit an event to all registered listeners.
   * Errors in listeners are caught and logged, never crash the bus.
   */
  emit<E extends EventName>(event: E, data: EventData<E>): void {
    if (this._debugMode) {
      console.log(`[AgentEventBus] ${event}`, data);
    }

    const entries = this.listeners.get(event);
    if (!entries || entries.length === 0) return;

    // Collect once-listeners to remove after iteration
    const toRemove: ListenerEntry[] = [];

    for (const entry of entries) {
      try {
        (entry.fn as Listener<E>)(data);
      } catch (error) {
        console.error(`[AgentEventBus] Error in listener for "${event}":`, error);
      }

      if (entry.once) {
        toRemove.push(entry);
      }
    }

    // Remove once-listeners
    if (toRemove.length > 0) {
      const remaining = entries.filter((e) => !toRemove.includes(e));
      if (remaining.length === 0) {
        this.listeners.delete(event);
      } else {
        this.listeners.set(event, remaining);
      }
    }
  }

  /**
   * Remove all listeners for a specific event, or all events if none specified.
   */
  removeAllListeners(event?: EventName): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Get count of listeners for an event (useful for debugging).
   */
  listenerCount(event: EventName): number {
    return this.listeners.get(event)?.length ?? 0;
  }

  /**
   * Enable/disable debug logging of all events.
   */
  setDebugMode(enabled: boolean): void {
    this._debugMode = enabled;
  }

  /** Whether debug mode is currently on */
  get debugMode(): boolean {
    return this._debugMode;
  }
}

// ─── Singleton Export ────────────────────────────────────────────────────────

/**
 * Global agent event bus instance.
 * Import this anywhere in the agent-loop module to subscribe or emit events.
 */
export const agentEventBus = new AgentEventBus();
