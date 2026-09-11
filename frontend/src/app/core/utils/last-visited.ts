// Remembers where the user was, so "/" and "/w/:id" can reopen the last workspace and board.
// localStorage can be unavailable (private mode, blocked storage), so every access is guarded.

const LAST_WORKSPACE_KEY = 'kanban.lastWorkspaceId';
const LAST_BOARD_PREFIX = 'kanban.lastBoardId.';

function read(key: string): number | null {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function write(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Not remembering is harmless
  }
}

export const lastVisited = {
  workspaceId: (): number | null => read(LAST_WORKSPACE_KEY),
  rememberWorkspace: (workspaceId: number): void => write(LAST_WORKSPACE_KEY, workspaceId),
  boardId: (workspaceId: number): number | null => read(LAST_BOARD_PREFIX + workspaceId),
  rememberBoard: (workspaceId: number, boardId: number): void => write(LAST_BOARD_PREFIX + workspaceId, boardId),
  forgetAll: (): void => {
    try {
      Object.keys(localStorage)
        .filter(key => key === LAST_WORKSPACE_KEY || key.startsWith(LAST_BOARD_PREFIX))
        .forEach(key => localStorage.removeItem(key));
    } catch {
      // Nothing to forget
    }
  }
};
