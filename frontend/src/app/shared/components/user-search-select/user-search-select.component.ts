import { Component, DestroyRef, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, map, switchMap, tap } from 'rxjs';
import { Select } from 'primeng/select';
import { USER_SEARCH_MIN_LENGTH, UserDirectoryStoreService } from '../../../core/store/user-directory-store.service';
import { UserSummaryDto } from '../../../core/models/user.dto';

interface UserOption {
  label: string;
  value: number;
}

const toOption = (u: UserSummaryDto): UserOption => ({
  label: `${u.firstName} ${u.lastName} (${u.email})`,
  value: u.id
});

/** Select backed by the server-side user directory search, for picking a user to add or promote. */
@Component({
  selector: 'app-user-search-select',
  standalone: true,
  imports: [FormsModule, Select],
  template: `
    <p-select
      [id]="inputId"
      [options]="options"
      optionLabel="label"
      optionValue="value"
      [filter]="true"
      filterBy="label"
      filterPlaceholder="Name or email"
      [emptyFilterMessage]="emptyMessage"
      [emptyMessage]="emptyMessage"
      [showClear]="true"
      [placeholder]="placeholder"
      [ngModel]="value"
      (ngModelChange)="onSelect($event)"
      (onFilter)="search$.next($event.filter ?? '')"
      styleClass="w-full"
      appendTo="body"
    ></p-select>
  `
})
export class UserSearchSelectComponent implements OnInit {
  private readonly userDirectory = inject(UserDirectoryStoreService);
  private readonly destroyRef = inject(DestroyRef);

  @Input() inputId = '';
  @Input() placeholder = 'Search by name or email';
  /** When set, users already in this workspace are left out of the results. */
  @Input() excludeWorkspaceId: number | null = null;
  @Input() value: number | null = null;
  @Output() valueChange = new EventEmitter<number | null>();

  readonly search$ = new Subject<string>();
  options: UserOption[] = [];
  emptyMessage = `Type at least ${USER_SEARCH_MIN_LENGTH} characters`;
  private selected: UserOption | null = null;

  ngOnInit(): void {
    this.search$.pipe(
      map(query => query.trim()),
      debounceTime(300),
      distinctUntilChanged(),
      tap(query => this.emptyMessage = query.length < USER_SEARCH_MIN_LENGTH
        ? `Type at least ${USER_SEARCH_MIN_LENGTH} characters`
        : 'No matching users'),
      switchMap(query => this.userDirectory.searchUsers(query, this.excludeWorkspaceId)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(users => {
      const results = users.map(toOption);
      // Keep the current choice in the list so the select can still render its label
      const selected = this.selected;
      this.options = selected && !results.some(o => o.value === selected.value)
        ? [selected, ...results]
        : results;
    });
  }

  onSelect(userId: number | null): void {
    this.selected = this.options.find(o => o.value === userId) ?? null;
    this.value = userId;
    this.valueChange.emit(userId);
  }
}
