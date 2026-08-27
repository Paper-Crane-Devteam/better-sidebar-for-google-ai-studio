/**
 * AgentTab — the Agent sidebar tab. Two views, one at a time.
 *
 * It used to swap between a launcher and a live status panel, which put every
 * decision the loop needed behind "sidebar open" *and* "Agent tab selected". Those
 * now live in `agent-dock`, docked to the chat composer where the answer gets typed
 * and where they're reachable even with the sidebar shut.
 *
 * What remains is the launcher — a stable answer to "what is this thing and how do I
 * use it" — plus the workspace file browser, which replaces it outright rather than
 * squeezing in beside it. The sidebar is too narrow for both, and the two belong to
 * different moments: you choose a workspace before starting, and look through its files
 * afterwards. The one concession to a running session is on the launcher itself:
 * starting a second task would silently replace the first, so it goes inert while one
 * is live.
 *
 * The view is not persisted, deliberately. Nothing about a file listing is worth
 * restoring, and the launcher is what the next task starts from.
 */

import React, { useState } from 'react';
import { AgentLauncher } from './components/AgentLauncher';
import { WorkspaceView } from './workspace/WorkspaceView';

type View = 'launcher' | 'workspace';

export const AgentTab: React.FC = () => {
  const [view, setView] = useState<View>('launcher');

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-gradient-to-b from-transparent to-primary/[0.02]">
      {view === 'workspace' ? (
        <WorkspaceView onBack={() => setView('launcher')} />
      ) : (
        <AgentLauncher onOpenWorkspace={() => setView('workspace')} />
      )}
    </div>
  );
};
