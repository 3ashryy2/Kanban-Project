import { TaskDto } from '../models/task.dto';
import { SimpleUserDto } from '../models/user.dto';
import { BoardViewer, assigneeChoices, canEditTask, newTaskAssigneeChoices } from './task-permissions';

const pm: SimpleUserDto = { id: 2, email: 'pm@valeo.com', firstName: 'Project', lastName: 'Manager' };
const dev: SimpleUserDto = { id: 3, email: 'dev@valeo.com', firstName: 'Mohanad', lastName: 'Emad' };
const qa: SimpleUserDto = { id: 4, email: 'qa@valeo.com', firstName: 'Sarah', lastName: 'Tester' };
const members = [pm, dev, qa];

const viewerFor = (user: SimpleUserDto | null, role: string, isAdmin = false): BoardViewer =>
  ({ userId: user?.id ?? 1, isAdmin, role });

const task = (overrides: Partial<TaskDto> = {}): TaskDto => ({
  id: 7, boardId: 1, columnId: 2, title: 'Calibrate radar', description: '', priority: 'MEDIUM',
  status: 'ACTIVE', position: 1000, createdBy: pm, tags: [], version: 0, createdAt: '', updatedAt: '',
  ...overrides
});

// Where the card sits: only in the first column can it lose its assignee
const firstColumn = true;
const laterColumn = false;

describe('task permissions', () => {
  it('lets PMs and admins choose anyone, and clear an assigned card', () => {
    expect(assigneeChoices(task({ assignee: qa }), viewerFor(pm, 'ROLE_PROJECT_MANAGER'), members, firstColumn))
      .toEqual({ people: members, canUnassign: true });
    expect(assigneeChoices(task(), viewerFor(null, 'ROLE_VIEWER', true), members, firstColumn))
      .toEqual({ people: members, canUnassign: false });
  });

  it('lets developers and QA take an unassigned card, but only themselves', () => {
    expect(assigneeChoices(task(), viewerFor(dev, 'ROLE_DEVELOPER'), members, firstColumn))
      .toEqual({ people: [dev], canUnassign: false });
  });

  it("lets only the current assignee hand a card back, and leaves others' cards alone", () => {
    expect(assigneeChoices(task({ assignee: dev }), viewerFor(dev, 'ROLE_DEVELOPER'), members, firstColumn))
      .toEqual({ people: [dev], canUnassign: true });
    expect(assigneeChoices(task({ assignee: qa }), viewerFor(dev, 'ROLE_DEVELOPER'), members, firstColumn)).toBeNull();
  });

  it('offers Unassign only in the first column, where the server allows it', () => {
    expect(assigneeChoices(task({ assignee: qa }), viewerFor(pm, 'ROLE_PROJECT_MANAGER'), members, laterColumn))
      .toEqual({ people: members, canUnassign: false });
    // A developer's own card past the first column has nothing left for them to change
    expect(assigneeChoices(task({ assignee: dev }), viewerFor(dev, 'ROLE_DEVELOPER'), members, laterColumn)).toBeNull();
    // An unassigned card there ("Needs assignee") can still be taken
    expect(assigneeChoices(task(), viewerFor(dev, 'ROLE_DEVELOPER'), members, laterColumn))
      .toEqual({ people: [dev], canUnassign: false });
  });

  it('keeps viewers and locked cards read-only for everyone but PMs and admins', () => {
    expect(canEditTask(task(), viewerFor({ ...dev, id: 5 }, 'ROLE_VIEWER'))).toBe(false);
    expect(assigneeChoices(task(), viewerFor({ ...dev, id: 5 }, 'ROLE_VIEWER'), members, firstColumn)).toBeNull();

    const locked = task({ status: 'PENDING_APPROVAL', assignee: dev });
    expect(canEditTask(locked, viewerFor(dev, 'ROLE_DEVELOPER'))).toBe(false);
    expect(assigneeChoices(locked, viewerFor(dev, 'ROLE_DEVELOPER'), members, laterColumn)).toBeNull();
    expect(canEditTask(locked, viewerFor(pm, 'ROLE_PROJECT_MANAGER'))).toBe(true);
  });

  it('offers the same people when creating a card as when taking an unassigned one', () => {
    expect(newTaskAssigneeChoices(viewerFor(pm, 'ROLE_PROJECT_MANAGER'), members)).toEqual(members);
    expect(newTaskAssigneeChoices(viewerFor(dev, 'ROLE_DEVELOPER'), members)).toEqual([dev]);
    expect(newTaskAssigneeChoices(viewerFor({ ...dev, id: 5 }, 'ROLE_VIEWER'), members)).toEqual([]);
  });

  it('lets developers and QA edit the details of an active card', () => {
    expect(canEditTask(task(), viewerFor(dev, 'ROLE_DEVELOPER'))).toBe(true);
    expect(canEditTask(task(), viewerFor(qa, 'ROLE_QA_TESTER'))).toBe(true);
  });
});
