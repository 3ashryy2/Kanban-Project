import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WorkflowStoreService } from '../../../core/store/workflow-store.service';
import { BoardStoreService } from '../../../core/store/board-store.service';
import { ColumnDto } from '../../../core/models/column.dto';
import { WorkflowTransitionUpdateRequest } from '../../../core/models/workflow.dto';

import { Button } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { Dialog } from 'primeng/dialog';
import { Select } from 'primeng/select';
import { Tooltip } from 'primeng/tooltip';

/** One listed rule while the dialog is open. */
interface RuleRow {
  fromColumnId: number;
  toColumnId: number;
  permitted: boolean;          // an unticked rule stays listed until saved, so it can be ticked again
  requiresApproval: boolean;
  fallbackColumnId?: number;
  isNew: boolean;              // added in this dialog and not saved yet
}

/**
 * Configure Workflow: the board's active rules, plus a way to add the moves that aren't rules yet.
 * Opening it reads the rules fresh from the server; nothing changes until Save.
 */
@Component({
  selector: 'app-workflow-rules-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, Button, Checkbox, Dialog, Select, Tooltip],
  templateUrl: './workflow-rules-dialog.component.html',
  styleUrls: ['./workflow-rules-dialog.component.scss']
})
export class WorkflowRulesDialogComponent implements OnChanges {
  private readonly workflowStore = inject(WorkflowStoreService);
  private readonly boardStore = inject(BoardStoreService);

  @Input({ required: true }) boardId!: number;
  /** The board's columns, left to right. */
  @Input({ required: true }) columns: ColumnDto[] = [];
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();

  rows: RuleRow[] = [];
  loading = false;
  saving = false;

  // The "Add transition" pickers
  adding = false;
  newFromId: number | null = null;
  newToId: number | null = null;
  fromOptions: ColumnDto[] = [];
  toOptions: ColumnDto[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && this.visible) {
      this.load();
    }
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.visibleChange.emit(visible);
  }

  nameOf(columnId: number): string {
    return this.columns.find(c => c.id === columnId)?.name ?? '?';
  }

  // --- Adding a rule ---

  /** At least one move between two different columns isn't listed yet. */
  get canAddRule(): boolean {
    return this.columns.some(c => this.targetsFor(c.id).length > 0);
  }

  startAdding(): void {
    this.adding = true;
    this.newFromId = null;
    this.newToId = null;
    this.fromOptions = this.columns.filter(c => this.targetsFor(c.id).length > 0);
    this.toOptions = [];
  }

  onFromChosen(): void {
    this.newToId = null;
    this.toOptions = this.newFromId === null ? [] : this.targetsFor(this.newFromId);
  }

  /** Picking the target adds the rule, permitted and ungated; the row's own controls do the rest. */
  onToChosen(): void {
    if (this.newFromId === null || this.newToId === null) return;
    this.rows = this.sorted([...this.rows, {
      fromColumnId: this.newFromId,
      toColumnId: this.newToId,
      permitted: true,
      requiresApproval: false,
      isNew: true
    }]);
    this.adding = false;
  }

  // Columns a card could still be allowed to move to from this one: not itself, not already listed
  private targetsFor(fromColumnId: number): ColumnDto[] {
    return this.columns.filter(c =>
      c.id !== fromColumnId && !this.rows.some(r => r.fromColumnId === fromColumnId && r.toColumnId === c.id));
  }

  // --- The three controls on each row ---

  onApprovalToggled(rule: RuleRow): void {
    // A gate needs somewhere to send rejected cards: start with the column the card came from
    rule.fallbackColumnId = rule.requiresApproval ? (rule.fallbackColumnId ?? rule.fromColumnId) : undefined;
  }

  setFallback(rule: RuleRow, columnId: number | null): void {
    rule.fallbackColumnId = columnId ?? undefined;
  }

  /** A permitted rule that requires approval but has no fallback column; the server refuses to save one. */
  needsFallback(rule: RuleRow): boolean {
    return rule.permitted && rule.requiresApproval && !rule.fallbackColumnId;
  }

  get hasRuleMissingFallback(): boolean {
    return this.rows.some(rule => this.needsFallback(rule));
  }

  // --- Loading and saving ---

  save(): void {
    if (this.hasRuleMissingFallback || this.saving) return;
    const rules: WorkflowTransitionUpdateRequest[] = this.rows
      .filter(rule => rule.permitted)
      .map(rule => ({
        fromColumnId: rule.fromColumnId,
        toColumnId: rule.toColumnId,
        requiresApproval: rule.requiresApproval,
        fallbackColumnId: rule.requiresApproval ? rule.fallbackColumnId : undefined
      }));

    this.saving = true;
    // On failure the store shows the reason and completes without a value, so the dialog stays open
    this.workflowStore.updateTransitions(this.boardId, rules).subscribe({
      next: () => {
        this.setVisible(false);
        // Column lock icons follow the rules, so fetch the board again for the recomputed flags
        this.boardStore.loadBoard(this.boardId);
      },
      complete: () => this.saving = false
    });
  }

  private load(): void {
    this.loading = true;
    this.adding = false;
    this.rows = [];
    this.workflowStore.fetchTransitions(this.boardId).subscribe({
      next: rules => {
        this.rows = this.sorted(rules.map(rule => ({
          ...rule,
          permitted: true,
          isNew: false
        })));
        this.loading = false;
      },
      error: () => this.loading = false // the store already shows the reason
    });
  }

  // Rules in the order a card travels: by source column, then by target column
  private sorted(rows: RuleRow[]): RuleRow[] {
    const position = new Map(this.columns.map((column, index) => [column.id, index]));
    return [...rows].sort((a, b) =>
      (position.get(a.fromColumnId)! - position.get(b.fromColumnId)!)
      || (position.get(a.toColumnId)! - position.get(b.toColumnId)!));
  }

  trackByRule(index: number, rule: RuleRow): string {
    return `${rule.fromColumnId}-${rule.toColumnId}`;
  }
}
