/**
 * Snippet Drag Event Bus.
 *
 * Lightweight typed pub/sub for communication between
 * SaveSnippetFeature (injector) and SnippetsTab (sidebar).
 *
 * Replaces window-level global variables with a clean event-driven approach.
 */

export interface SnippetDragEventMap {
  /** Drag started — sidebar should switch to folder-only view */
  'drag:start': undefined;
  /** Drag ended — sidebar should restore normal view */
  'drag:end': undefined;
  /** Pointer entered a folder drop target */
  'drop-target:enter': { folderId: string | null };
  /** Pointer left the drop target area entirely */
  'drop-target:leave': undefined;
}

type EventName = keyof SnippetDragEventMap;
type EventData<E extends EventName> = SnippetDragEventMap[E];
type Listener<E extends EventName> = (data: EventData<E>) => void;

class SnippetDragBus {
  private listeners = new Map<string, Function[]>();
  private _currentDropTarget: string | null | undefined = undefined;
  private _isDragging = false;

  on<E extends EventName>(event: E, listener: Listener<E>): () => void {
    const list = this.listeners.get(event) || [];
    list.push(listener);
    this.listeners.set(event, list);
    return () => this.off(event, listener);
  }

  off<E extends EventName>(event: E, listener: Listener<E>): void {
    const list = this.listeners.get(event);
    if (!list) return;
    const idx = list.indexOf(listener);
    if (idx >= 0) list.splice(idx, 1);
  }

  emit<E extends EventName>(event: E, data: EventData<E>): void {
    if (event === 'drag:start') this._isDragging = true;
    if (event === 'drag:end') this._isDragging = false;

    const list = this.listeners.get(event);
    if (!list) return;
    for (const fn of [...list]) {
      try {
        (fn as Listener<E>)(data);
      } catch (e) {
        console.error('[SnippetDragBus]', e);
      }
    }
  }

  /** Whether a snippet drag is currently active */
  get isDragging() {
    return this._isDragging;
  }

  /** The currently hovered folder ID (string = folder, null = inbox, undefined = nothing) */
  get currentDropTarget() {
    return this._currentDropTarget;
  }

  setDropTarget(folderId: string | null) {
    this._currentDropTarget = folderId;
    this.emit('drop-target:enter', { folderId });
  }

  clearDropTarget() {
    this._currentDropTarget = undefined;
    this.emit('drop-target:leave', undefined);
  }
}

export const snippetDragBus = new SnippetDragBus();
