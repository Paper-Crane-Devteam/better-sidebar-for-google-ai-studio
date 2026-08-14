/**
 * AgentTab — the Agent sidebar tab. One thing only: how to start a task.
 *
 * It used to swap between a launcher and a live status panel, which put every
 * decision the loop needed behind "sidebar open" *and* "Agent tab selected". Those
 * now live in `agent-dock`, docked to the chat composer where the answer gets typed
 * and where they're reachable even with the sidebar shut.
 *
 * So this tab looks the same at all times, which also makes it a stable answer to
 * "what is this thing and how do I use it" for someone opening it the first time.
 * The one concession to a running session is on the launcher itself: starting a
 * second task would silently replace the first, so it goes inert while one is live.
 */

import React from 'react';
import { AgentLauncher } from './components/AgentLauncher';

export const AgentTab: React.FC = () => (
  <div className="relative flex h-full flex-col overflow-hidden bg-gradient-to-b from-transparent to-primary/[0.02]">
    <AgentLauncher />
  </div>
);
