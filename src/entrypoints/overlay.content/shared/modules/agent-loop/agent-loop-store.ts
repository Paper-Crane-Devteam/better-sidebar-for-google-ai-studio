/**
 * Agent Loop runtime state store (Zustand).
 * Manages execution state, round tracking, tool results, and the approval flow.
 * Not persisted — resets on page reload.
 */

import { create } from 'zustand';
import { useAgentViewStore } from './agent-view-store';
import type {
  AgentLoopStatus,
  AgentEndReason,
  ToolCallResult,
  PendingApproval,
  ExecutedCall,
} from './types';

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

  /**
   * Steps run unattended when the loop stopped to check in, or null.
   *
   * Doubles as the flag telling a routine check-in apart from a fault: both are
   * `paused`, but one is "still going, have a look" and the other is "something
   * broke". Non-null always carries the count, so the UI never has to reconstruct it.
   */
  checkInSteps: number | null;
  /** Whether a DB snapshot was created in this session */
  snapshotCreated: boolean;
  /**
   * Tool call waiting for the user's go-ahead.
   *
   * Rendered in two places at once: on the call's own card in the chat (where the
   * SQL is already in front of you) and in the Agent tab. The tab copy is the
   * fallback — cards only exist in our own conversation view, and the user can
   * switch back to Gemini's native rendering mid-task.
   */
  pendingApproval: PendingApproval | null;

  /**
   * "Approve the rest of this response" — cleared on every new round.
   *
   * A response often carries several queries; approving each one separately is the
   * friction that makes people turn the safety net off entirely.
   */
  approveRestOfRound: boolean;

  // ─── Control Panel Runtime Extensions ────────────────────────────────
  /** Speed mode — auto-approve everything */
  speedMode: boolean;
  /** Whether speed mode risk warning was shown this session */
  speedModeWarningShown: boolean;
  /** Breakpoint round (null = no breakpoint) */
  breakpointRound: number | null;
  /** User instruction to inject into next round */
  pendingInstruction: string | null;

  /** View rendering mode: 'custom' (our overlay) or 'original' (native DOM) */
  viewMode: 'custom' | 'original';

  /** Currently activated skill ID in this loop session */
  activeSkillId: string | null;

  /** Conversation this session belongs to — used to scope the Agent tab */
  sessionConversationId: string | null;

  /** Human-readable label of what this session is doing (skill title or user input) */
  sessionTitle: string | null;

  /** Why the last session ended (null while running) */
  endReason: AgentEndReason | null;

  /**
   * Tool calls already executed in this session, keyed by fingerprint.
   * Display only — the card in the chat uses it to show "ran" / "failed" /
   * "refused". The engine is the only thing that executes.
   */
  executedCalls: Record<string, ExecutedCall>;

  // Actions
  setViewMode: (mode: 'custom' | 'original') => void;
  setActiveSkillId: (id: string | null) => void;
  start: (maxRounds: number, session?: { conversationId?: string | null; title?: string }) => void;
  /** Tool results are in the editor — waiting for the send to go through */
  awaitSend: () => void;
  /** Stop and ask whether to carry on, after running this many steps unattended */
  requestCheckIn: (steps: number) => void;
  /** Bind the running session to a conversation id once the platform assigns one */
  attachSessionConversation: (id: string) => void;
  /** Remember that a tool call ran, keyed by its fingerprint */
  recordExecutedCall: (fingerprint: string, call: ExecutedCall) => void;
  nextRound: () => void;
  setStatus: (status: AgentLoopStatus) => void;
  setCurrentTool: (tool: string | null) => void;
  addResult: (result: ToolCallResult) => void;
  removeLastResult: () => void;
  pause: (reason?: string) => void;
  resume: () => void;
  stop: (endReason?: AgentEndReason) => void;
  reset: () => void;
  setError: (message: string) => void;
  setSnapshotCreated: (created: boolean) => void;
  setPendingApproval: (approval: PendingApproval | null) => void;
  setApproveRestOfRound: (enabled: boolean) => void;
  setSpeedMode: (enabled: boolean) => void;
  setSpeedModeWarningShown: () => void;
  setBreakpointRound: (round: number | null) => void;
  setPendingInstruction: (instruction: string | null) => void;
}

export const useAgentLoopStore = create<AgentLoopStoreState>((set) => ({
  status: 'idle',
  currentRound: 0,
  maxRounds: 20,
  currentTool: null,
  currentResults: [],
  history: [],
  errorMessage: null,
  checkInSteps: null,
  snapshotCreated: false,
  pendingApproval: null,
  approveRestOfRound: false,

  // Control Panel runtime extensions
  speedMode: false,
  speedModeWarningShown: false,
  breakpointRound: null,
  pendingInstruction: null,
  viewMode: 'custom',
  activeSkillId: null,
  sessionConversationId: null,
  sessionTitle: null,
  endReason: null,
  executedCalls: {},

  setViewMode: (mode) => set({ viewMode: mode }),
  setActiveSkillId: (id) => set({ activeSkillId: id }),

  start: (maxRounds, session) => {
    // A stored "show me the native DOM" for this conversation was about reading its
    // history; launching a task supersedes it. Dropped here rather than in the
    // switcher so the decision sits next to the `viewMode` it contradicts — an
    // effect doing it would race the one that applies the override.
    if (session?.conversationId) {
      useAgentViewStore.getState().clearOverride(session.conversationId);
    }

    set({
      status: 'waiting_ai',
      // Starting a session switches the conversation area to the agent view.
      viewMode: 'custom',
      currentRound: 1,
      maxRounds,
      currentTool: null,
      currentResults: [],
      history: [],
      errorMessage: null,
      checkInSteps: null,
      speedMode: false,
      pendingInstruction: null,
      pendingApproval: null,
      approveRestOfRound: false,
      activeSkillId: null,
      sessionConversationId: session?.conversationId ?? null,
      sessionTitle: session?.title ?? null,
      endReason: null,
      executedCalls: {},
    });
  },

  awaitSend: () => set({ status: 'awaiting_send', errorMessage: null }),

  requestCheckIn: (steps) =>
    // No `errorMessage`: the check-in card carries its own copy, and leaving a
    // message here would make the fault notice render alongside it.
    set({ status: 'paused', errorMessage: null, checkInSteps: steps }),

  // A session started in a brand new chat has no conversation id yet; adopt the
  // one the platform assigns after the first message is sent.
  attachSessionConversation: (id) =>
    set((state) => (state.sessionConversationId ? {} : { sessionConversationId: id })),

  recordExecutedCall: (fingerprint, call) =>
    set((state) => ({
      executedCalls: { ...state.executedCalls, [fingerprint]: call },
    })),

  nextRound: () =>
    set((state) => ({
      history: [...state.history, { round: state.currentRound, results: state.currentResults }],
      currentRound: state.currentRound + 1,
      currentResults: [],
      currentTool: null,
      // "Approve the rest" meant the rest of *that* response, not the whole task —
      // that's what the task-scoped switch is for.
      approveRestOfRound: false,
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
      // A real fault supersedes any earlier check-in
      checkInSteps: null,
    }),

  resume: () =>
    set({
      status: 'waiting_ai',
      errorMessage: null,
      checkInSteps: null,
    }),

  stop: (endReason) =>
    set((state) => ({
      status: 'idle',
      currentTool: null,
      speedMode: false,
      activeSkillId: null,
      approveRestOfRound: false,
      checkInSteps: null,
      // A prompt left on screen after the session ends resolves to nothing
      pendingApproval: null,
      endReason: endReason ?? state.endReason ?? 'user_stop',
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
      checkInSteps: null,
      snapshotCreated: false,
      pendingApproval: null,
      approveRestOfRound: false,
      speedMode: false,
      speedModeWarningShown: false,
      breakpointRound: null,
      pendingInstruction: null,
      sessionConversationId: null,
      sessionTitle: null,
      activeSkillId: null,
      endReason: null,
      executedCalls: {},
    }),

  setError: (message) =>
    set({
      status: 'error',
      errorMessage: message,
    }),

  setSnapshotCreated: (created) => set({ snapshotCreated: created }),

  setPendingApproval: (approval) => set({ pendingApproval: approval }),

  setApproveRestOfRound: (enabled) => set({ approveRestOfRound: enabled }),

  // Control Panel actions
  setSpeedMode: (enabled) => set({ speedMode: enabled }),
  setSpeedModeWarningShown: () => set({ speedModeWarningShown: true }),
  setBreakpointRound: (round) => set({ breakpointRound: round }),
  setPendingInstruction: (instruction) => set({ pendingInstruction: instruction }),
}));
