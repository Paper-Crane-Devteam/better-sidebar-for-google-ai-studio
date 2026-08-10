/**
 * Agent Loop runtime state store (Zustand).
 * Manages execution state, round tracking, tool results, and confirmation flow.
 * Not persisted — resets on page reload.
 */

import { create } from 'zustand';
import type {
  AgentLoopStatus,
  AgentEndReason,
  ToolCallResult,
  PendingApproval,
  PendingQuestion,
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

  /**
   * Question the AI put to the user (UI renders the prompt when non-null).
   * Separate from `pendingConfirmation`: this is about what to do, not about
   * whether one specific operation may run.
   */
  pendingQuestion: PendingQuestion | null;

  /** Questions asked so far — bounded, since asking costs no round budget */
  askUserCount: number;

  /**
   * Rounds granted on top of `maxRounds`.
   *
   * A round spent waiting on the user is supervised by definition, so it can't run
   * away and shouldn't eat the budget meant for autonomous work. Without this an
   * AI that asks a couple of questions exhausts the session before doing the job.
   */
  bonusRounds: number;

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

  /** View rendering mode: 'custom' (our overlay) or 'original' (native DOM) */
  viewMode: 'custom' | 'original';

  /** Currently activated skill ID in this loop session */
  activeSkillId: string | null;

  /** Conversation this session belongs to — used to scope the Agent tab */
  sessionConversationId: string | null;

  /** Human-readable label of what this session is doing (skill title or user input) */
  sessionTitle: string | null;

  /** Timestamp when the session started (for elapsed time display) */
  sessionStartedAt: number | null;

  /** Why the last session ended (null while running) */
  endReason: AgentEndReason | null;

  /**
   * Tool calls already executed in this session, keyed by fingerprint.
   * Lets the conversation's manual "Run" button know what the engine has
   * already done, so a write can't be fired twice.
   */
  executedCalls: Record<string, ExecutedCall>;

  // Actions
  setViewMode: (mode: 'custom' | 'original') => void;
  setActiveSkillId: (id: string | null) => void;
  start: (maxRounds: number, session?: { conversationId?: string | null; title?: string }) => void;
  /** Tool results are in the editor — waiting for the user (or auto-continue) to send */
  awaitSend: () => void;
  /** Parked on a question from the AI — a checkpoint, not a fault */
  awaitUser: () => void;
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
  setPendingQuestion: (question: PendingQuestion | null) => void;
  /** Count a question against the session's asking budget */
  noteAskUser: () => void;
  /** Extend the round budget by one, for a round the user was in charge of */
  grantBonusRound: () => void;
  setSpeedMode: (enabled: boolean) => void;
  setSpeedModeWarningShown: () => void;
  setBreakpointRound: (round: number | null) => void;
  addTokens: (count: number) => void;
  resetTokens: () => void;
  setPendingInstruction: (instruction: string | null) => void;
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
  pendingApproval: null,
  approveRestOfRound: false,
  pendingQuestion: null,
  askUserCount: 0,
  bonusRounds: 0,

  // Control Panel runtime extensions
  speedMode: false,
  speedModeWarningShown: false,
  breakpointRound: null,
  tokenEstimation: 0,
  pendingInstruction: null,
  viewMode: 'custom',
  activeSkillId: null,
  sessionConversationId: null,
  sessionTitle: null,
  sessionStartedAt: null,
  endReason: null,
  executedCalls: {},

  setViewMode: (mode) => set({ viewMode: mode }),
  setActiveSkillId: (id) => set({ activeSkillId: id }),

  start: (maxRounds, session) =>
    set({
      status: 'waiting_ai',
      // Starting a session switches the conversation area to the agent view.
      // Without this the switcher's idle-reset leaves it on 'original' forever.
      viewMode: 'custom',
      currentRound: 1,
      maxRounds,
      currentTool: null,
      currentResults: [],
      history: [],
      errorMessage: null,
      tokenEstimation: 0,
      speedMode: false,
      pendingInstruction: null,
      pendingApproval: null,
      approveRestOfRound: false,
      pendingQuestion: null,
      askUserCount: 0,
      bonusRounds: 0,
      activeSkillId: null,
      sessionConversationId: session?.conversationId ?? null,
      sessionTitle: session?.title ?? null,
      sessionStartedAt: Date.now(),
      endReason: null,
      executedCalls: {},
    }),

  awaitSend: () => set({ status: 'awaiting_send', errorMessage: null }),

  awaitUser: () => set({ status: 'awaiting_user', errorMessage: null, currentTool: null }),

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
    }),

  resume: () =>
    set({
      status: 'waiting_ai',
      errorMessage: null,
    }),

  stop: (endReason) =>
    set((state) => ({
      status: 'idle',
      currentTool: null,
      speedMode: false,
      activeSkillId: null,
      approveRestOfRound: false,
      // A prompt left on screen after the session ends resolves to nothing
      pendingQuestion: null,
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
      snapshotCreated: false,
      pendingApproval: null,
      approveRestOfRound: false,
      pendingQuestion: null,
      askUserCount: 0,
      bonusRounds: 0,
      speedMode: false,
      speedModeWarningShown: false,
      breakpointRound: null,
      tokenEstimation: 0,
      pendingInstruction: null,
      sessionConversationId: null,
      sessionTitle: null,
      sessionStartedAt: null,
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

  setPendingQuestion: (question) => set({ pendingQuestion: question }),

  noteAskUser: () => set((state) => ({ askUserCount: state.askUserCount + 1 })),

  grantBonusRound: () => set((state) => ({ bonusRounds: state.bonusRounds + 1 })),

  // Control Panel actions
  setSpeedMode: (enabled) => set({ speedMode: enabled }),
  setSpeedModeWarningShown: () => set({ speedModeWarningShown: true }),
  setBreakpointRound: (round) => set({ breakpointRound: round }),
  addTokens: (count) => set((state) => ({ tokenEstimation: state.tokenEstimation + count })),
  resetTokens: () => set({ tokenEstimation: 0 }),
  setPendingInstruction: (instruction) => set({ pendingInstruction: instruction }),
}));
