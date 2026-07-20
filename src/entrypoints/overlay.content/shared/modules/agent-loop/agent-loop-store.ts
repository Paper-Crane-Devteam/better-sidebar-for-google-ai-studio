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

  // ─── Control Panel Runtime Extensions ────────────────────────────────
  /** Speed mode — auto-approve everything */
  speedMode: boolean;
  /** Whether speed mode risk warning was shown this session */
  speedModeWarningShown: boolean;
  /** Breakpoint round (null = no breakpoint) */
  breakpointRound: number | null;
  /** Accumulated token estimation */
  tokenEstimation: number;
  /** User instruction to inject into next round */
  pendingInstruction: string | null;
  /** Whether the control panel popover is open */
  panelOpen: boolean;

  /** View rendering mode: 'custom' (our overlay) or 'original' (native DOM) */
  viewMode: 'custom' | 'original';

  // Actions
  setViewMode: (mode: 'custom' | 'original') => void;
  start: (maxRounds: number) => void;
  nextRound: () => void;
  setStatus: (status: AgentLoopStatus) => void;
  setCurrentTool: (tool: string | null) => void;
  addResult: (result: ToolCallResult) => void;
  removeLastResult: () => void;
  pause: (reason?: string) => void;
  resume: () => void;
  stop: () => void;
  reset: () => void;
  setError: (message: string) => void;
  setSnapshotCreated: (created: boolean) => void;
  setPendingConfirmation: (confirmation: PendingConfirmation | null) => void;
  setSpeedMode: (enabled: boolean) => void;
  setSpeedModeWarningShown: () => void;
  setBreakpointRound: (round: number | null) => void;
  addTokens: (count: number) => void;
  resetTokens: () => void;
  setPendingInstruction: (instruction: string | null) => void;
  setPanelOpen: (open: boolean) => void;
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

  // Control Panel runtime extensions
  speedMode: false,
  speedModeWarningShown: false,
  breakpointRound: null,
  tokenEstimation: 0,
  pendingInstruction: null,
  panelOpen: false,
  viewMode: 'custom',

  setViewMode: (mode) => set({ viewMode: mode }),

  start: (maxRounds) =>
    set({
      status: 'waiting_ai',
      currentRound: 1,
      maxRounds,
      currentTool: null,
      currentResults: [],
      history: [],
      errorMessage: null,
      tokenEstimation: 0,
      speedMode: false,
      pendingInstruction: null,
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

  removeLastResult: () =>
    set((state) => ({
      currentResults: state.currentResults.slice(0, -1),
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
      speedMode: false,
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
      speedMode: false,
      speedModeWarningShown: false,
      breakpointRound: null,
      tokenEstimation: 0,
      pendingInstruction: null,
      panelOpen: false,
    }),

  setError: (message) =>
    set({
      status: 'error',
      errorMessage: message,
    }),

  setSnapshotCreated: (created) => set({ snapshotCreated: created }),

  setPendingConfirmation: (confirmation) => set({ pendingConfirmation: confirmation }),

  // Control Panel actions
  setSpeedMode: (enabled) => set({ speedMode: enabled }),
  setSpeedModeWarningShown: () => set({ speedModeWarningShown: true }),
  setBreakpointRound: (round) => set({ breakpointRound: round }),
  addTokens: (count) => set((state) => ({ tokenEstimation: state.tokenEstimation + count })),
  resetTokens: () => set({ tokenEstimation: 0 }),
  setPendingInstruction: (instruction) => set({ pendingInstruction: instruction }),
  setPanelOpen: (open) => set({ panelOpen: open }),
}));
