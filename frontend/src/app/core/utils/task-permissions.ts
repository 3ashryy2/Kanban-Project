import { TaskDto } from '../models/task.dto';
import { SimpleUserDto } from '../models/user.dto';

// The browser's copy of the server's card rules (TaskSecurityEvaluator). It decides what looks clickable;
// the server still checks every change.

/** Who is looking at the board. */
export interface BoardViewer {
  userId: number | null;
  isAdmin: boolean;
  role: string; // workspace role, e.g. ROLE_DEVELOPER
}

/** Whom the viewer may put on a card, and whether they may clear it. */
export interface AssigneeChoices {
  people: SimpleUserDto[];
  canUnassign: boolean;
}

const isManager = (viewer: BoardViewer): boolean => viewer.isAdmin || viewer.role === 'ROLE_PROJECT_MANAGER';
const isContributor = (viewer: BoardViewer): boolean =>
  viewer.role === 'ROLE_DEVELOPER' || viewer.role === 'ROLE_QA_TESTER';

/** The card's details: title, priority, tags, due date. A locked card is for admins and PMs only. */
export function canEditTask(task: TaskDto, viewer: BoardViewer): boolean {
  if (isManager(viewer)) return true;
  if (task.status === 'PENDING_APPROVAL') return false;
  const involved = task.createdBy?.id === viewer.userId || task.assignee?.id === viewer.userId;
  return involved || isContributor(viewer);
}

/** Whom the viewer may put on a card they're creating: the same people as for taking an unassigned card. */
export function newTaskAssigneeChoices(viewer: BoardViewer, members: SimpleUserDto[]): SimpleUserDto[] {
  if (isManager(viewer)) return members;
  return isContributor(viewer) ? members.filter(m => m.id === viewer.userId) : [];
}

/**
 * The assignee. Admins and PMs choose anyone who can open the board; developers and QA take an
 * unassigned card themselves; only the current assignee hands a card back. As on the server, a card
 * loses its assignee only in the first column. Null: not the viewer's to change.
 */
export function assigneeChoices(
  task: TaskDto,
  viewer: BoardViewer,
  members: SimpleUserDto[],
  inFirstColumn: boolean
): AssigneeChoices | null {
  const canUnassign = !!task.assignee && inFirstColumn;
  if (isManager(viewer)) return { people: members, canUnassign };
  if (task.status === 'PENDING_APPROVAL') return null;

  const me = members.filter(m => m.id === viewer.userId);
  if (!task.assignee) {
    return isContributor(viewer) && me.length > 0 ? { people: me, canUnassign: false } : null;
  }
  // Their own card: handing it back is the only change left, so past the first column there's none
  return task.assignee.id === viewer.userId && canUnassign ? { people: me, canUnassign } : null;
}
