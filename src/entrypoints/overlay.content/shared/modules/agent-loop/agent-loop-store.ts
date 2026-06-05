/**
 * Agent Loop runtime state store (Zustand).
 * Manages execution state, round tracking, tool results, and confirmation flow.
 * Not persisted — resets on page reload.
 */

import { create } from 'zustand';
import type { AgentLoopStatus, ToolCallResult, PendingConfirmation } from './types';

export interface AgentLoopStoreState {
  /** Current loop status */
  status: AgentLoopStatus;
  /** Current round number (1-based) */
  currentRound: number;
  /** Maximum rounds before auto-pause */
  maxRounds: number;
  /** Currently executing tool name */
  currentTool: string | null;
  /** Results from the current round */
  currentResults: ToolCallResult[];
  /** History of all rounds */
  history: Array<{ round: number; results: ToolCallResult[] }>;
  /** Error message (for error/paused states) */
  errorMessage: string | null;
  /** Whether a DB snapshot was created in this session */
  snapshotCreated: boolean;
  /** Pending write confirmation (UI renders dialog when non-null) */
  pendingConfirmation: PendingConfirmation | null;

  // Actions
  start: (maxRounds: number) => void;
  nextRound: () => void;
  setStatus: (status: AgentLoopStatus) => void;
  setCurrentTool: (tool: string | null) => void;
  addResult: (result: ToolCallResult) => void;
  pause: (reason?: string) => void;
  resume: () => void;
  stop: () => void;
  reset: () => void;
  setError: (message: string) => void;
  setSnapshotCreated: (created: boolean) => void;
  setPendingConfirmation: (confirmation: PendingConfirmation | null) => void;
}

export const useAgentLoopStore = create<AgentLoopStoreState>((set, get) => ({
  status: 'idle',
  currentRound: 0,
  maxRounds: 20,
  currentTool: null,
  currentResults: [],
  history: [],
  errorMessage: null,
  snapshotCreated: false,
  pendingConfirmation: null,

  start: (maxRounds) =>
    set({
      status: 'waiting_ai',
      currentRound: 1,
      maxRounds,
      currentTool: null,
      currentResults: [],
      history: [],
      errorMessage: null,
    }),

  nextRound: () =>
    set((state) => ({
      history: [...state.history, { round: state.currentRound, results: state.currentResults }],
      currentRound: state.currentRound + 1,
      currentResults: [],
      currentTool: null,
    })),

  setStatus: (status) => set({ status }),

  setCurrentTool: (tool) => set({ currentTool: tool }),

  addResult: (result) =>
    set((state) => ({
      currentResults: [...state.currentResults, result],
    })),

  pause: (reason) =>
    set({
      status: 'paused',
      errorMessage: reason || null,
    }),

  resume: () =>
    set({
      status: 'waiting_ai',
      errorMessage: null,
    }),

  stop: () =>
    set((state) => ({
      status: 'idle',
      currentTool: null,
      // Preserve history for viewing
      history:
        state.currentResults.length > 0
          ? [...state.history, { round: state.currentRound, results: state.currentResults }]
          : state.history,
    })),

  reset: () =>
    set({
      status: 'idle',
      currentRound: 0,
      maxRounds: 20,
      currentTool: null,
      currentResults: [],
      history: [],
      errorMessage: null,
      snapshotCreated: false,
      pendingConfirmation: null,
    }),

  setError: (message) =>
    set({
      status: 'error',
      errorMessage: message,
    }),

  setSnapshotCreated: (created) => set({ snapshotCreated: created }),

  setPendingConfirmation: (confirmation) => set({ pendingConfirmation: confirmation }),
}));
