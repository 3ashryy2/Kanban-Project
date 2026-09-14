import { Component, EventEmitter, Input, OnChanges, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { Popover } from 'primeng/popover';
import { BoardStoreService } from '../../../core/store/board-store.service';
import { WorkflowStoreService } from '../../../core/store/workflow-store.service';
import { TaskDto } from '../../../core/models/task.dto';
import { SimpleUserDto } from '../../../core/models/user.dto';
import { AssigneeChoices, BoardViewer, assigneeChoices, canEditTask } from '../../../core/utils/task-permissions';

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

// Past this many people the assignee list gets a search box
const SEARCH_THRESHOLD = 6;

/**
 * One card on the board. The assignee and priority change in place, from small panels anchored to them;
 * a click anywhere else on the card still opens the Task Inspector (the board handles that click).
 */
@Component({
  selector: 'app-task-card',
  standalone: true,
  imports: [CommonModule, FormsModule, Popover],
  templateUrl: './task-card.component.html',
  styleUrls: ['./task-card.component.scss']
})
export class TaskCardComponent implements OnChanges {
  private readonly boardStore = inject(BoardStoreService);
  private readonly workflowStore = inject(WorkflowStoreService);

  @Input({ required: true }) task!: TaskDto;
  @Input({ required: true }) viewer!: BoardViewer;
  /** Everyone who can open this board, so could be assigned. */
  @Input() members: SimpleUserDto[] = [];
  /** Unassigned cards past the first column show "Needs assignee". */
  @Input() inFirstColumn = false;
  /** True while one of the card's panels is open, so the board can stop it being dragged meanwhile. */
  @Output() editingChange = new EventEmitter<boolean>();

  readonly priorities = PRIORITIES;
  editable = false;
  choices: AssigneeChoices | null = null;
  search = '';
  private saving = false;
  private openedFrom: HTMLElement | null = null;

  ngOnChanges(): void {
    this.editable = canEditTask(this.task, this.viewer);
    this.choices = assigneeChoices(this.task, this.viewer, this.members, this.inFirstColumn);
  }

  get columnName(): string {
    const col = this.boardStore.currentColumns.find(c => c.id === this.task.columnId);
    return col ? col.name : 'Unknown Status';
  }

  get columnsList(): any[] {
    return this.boardStore.currentColumns;
  }

  moveTaskToColumn(targetColumnId: number, panel: Popover): void {
    panel.hide();
    if (targetColumnId === this.task.columnId) return;

    const sourceColumnId = this.task.columnId;
    const rule = this.workflowStore.transitionsList
      .find(t => t.fromColumnId === sourceColumnId && t.toColumnId === targetColumnId);

    const isManager = this.viewer.isAdmin || this.viewer.role === 'ROLE_PROJECT_MANAGER';
    const awaitsApproval = sourceColumnId !== targetColumnId && !!rule?.requiresApproval && !isManager;

    const targetColumn = this.boardStore.currentColumns.find(c => c.id === targetColumnId);
    const targetIndex = targetColumn ? targetColumn.tasks.length : 0;

    this.boardStore.moveTaskOptimistically(
      this.task.id,
      sourceColumnId,
      targetColumnId,
      targetIndex,
      this.task.version,
      awaitsApproval
    );
  }

  get showSearch(): boolean {
    return (this.choices?.people.length ?? 0) > SEARCH_THRESHOLD;
  }

  /** The person whose option takes focus when the panel opens: the current assignee, else the first one listed. */
  get focusedPersonId(): number | null {
    const people = this.visiblePeople;
    return (people.find(p => p.id === this.task.assignee?.id) ?? people[0])?.id ?? null;
  }

  get visiblePeople(): SimpleUserDto[] {
    const people = this.choices?.people ?? [];
    const query = this.search.trim().toLowerCase();
    if (!query) return people;
    return people.filter(p => `${p.firstName} ${p.lastName} ${p.email}`.toLowerCase().includes(query));
  }

  get assigneeHeading(): string {
    if (this.viewer.isAdmin || this.viewer.role === 'ROLE_PROJECT_MANAGER') return 'Assign to';
    return this.task.assignee ? 'Your card' : 'Take this card';
  }

  get assigneeLabel(): string {
    const a = this.task.assignee;
    return a ? `Assignee: ${a.firstName} ${a.lastName}. Change the assignee` : 'No assignee. Choose one';
  }

  openPanel(event: MouseEvent, panel: Popover): void {
    // A click on an editable part must not also open the Task Inspector
    event.stopPropagation();
    if (this.saving) return;
    this.openedFrom = event.currentTarget as HTMLElement;
    this.search = '';
    panel.toggle(event);
  }

  onPanelShown(): void {
    this.editingChange.emit(true);
  }

  onPanelHidden(): void {
    this.editingChange.emit(false);
    // Hand focus back to what opened the panel, unless the user has already moved on. The panel is
    // still on the page when this runs, so focus may be on one of its options.
    const active = document.activeElement;
    const movedOn = !!active && active !== document.body && !active.closest('.p-popover');
    if (this.openedFrom && !movedOn) {
      this.openedFrom.focus();
    }
  }

  assign(person: SimpleUserDto | null, panel: Popover): void {
    panel.hide();
    if ((person?.id ?? null) === (this.task.assignee?.id ?? null)) return; // same person: nothing to save
    this.save(this.boardStore.assignTaskInPlace(this.task, person));
  }

  setPriority(priority: string, panel: Popover): void {
    panel.hide();
    if (priority === this.task.priority) return;
    this.save(this.boardStore.updateTaskInPlace(this.task, { priority }));
  }

  /** Arrow keys move between a panel's options. */
  moveFocus(event: KeyboardEvent): void {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const options = Array.from((event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('.popover-option'));
    if (options.length === 0) return;
    event.preventDefault();
    const index = options.indexOf(document.activeElement as HTMLElement);
    const next = event.key === 'ArrowDown'
      ? (index + 1) % options.length
      : (index <= 0 ? options.length : index) - 1;
    options[next].focus();
  }

  // One save at a time per card: each save needs the version the previous one returned
  private save(request$: Observable<TaskDto>): void {
    this.saving = true;
    request$.subscribe({ complete: () => this.saving = false });
  }
}
