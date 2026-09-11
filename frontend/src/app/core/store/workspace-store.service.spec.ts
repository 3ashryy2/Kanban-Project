import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { WorkspaceStoreService } from './workspace-store.service';
import { MessageService } from 'primeng/api';
import { WorkspaceResponseDto } from '../models/workspace.dto';
import { BoardDetailsDto } from '../models/board.dto';

describe('WorkspaceStoreService', () => {
  let service: WorkspaceStoreService;
  let httpMock: HttpTestingController;
  let messageServiceMock: any;

  // Making a workspace active loads its members and its boards
  const flushActivation = (workspaceId: number, boards: BoardDetailsDto[] = []) => {
    httpMock.expectOne(`/api/workspaces/${workspaceId}/members`).flush([]);
    httpMock.expectOne(`/api/workspaces/${workspaceId}/boards`).flush(boards);
  };

  beforeEach(() => {
    // The store remembers the last workspace in localStorage; start every test clean
    localStorage.clear();
    messageServiceMock = {
      add: vi.fn()
    };

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        WorkspaceStoreService,
        { provide: MessageService, useValue: messageServiceMock }
      ]
    });

    service = TestBed.inject(WorkspaceStoreService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should auto-select first workspace on load if none active', () => {
    const mockWorkspaces: WorkspaceResponseDto[] = [
      { id: 1, name: 'Workspace 1', slug: 'ws-1', description: 'Desc 1', boardCount: 0, memberCount: 1 },
      { id: 2, name: 'Workspace 2', slug: 'ws-2', description: 'Desc 2', boardCount: 0, memberCount: 1 }
    ];

    service.loadWorkspaces();

    const req = httpMock.expectOne('/api/users/me/workspaces');
    expect(req.request.method).toBe('GET');
    req.flush(mockWorkspaces);

    // The newly selected active workspace (id 1) loads its members and boards
    flushActivation(1);

    // Should auto-select first workspace (id 1)
    expect(service.getActiveWorkspace()).toEqual(mockWorkspaces[0]);
  });

  it('should auto-select first workspace if active workspace is not in the loaded list', () => {
    const mockWorkspaces: WorkspaceResponseDto[] = [
      { id: 2, name: 'Workspace 2', slug: 'ws-2', description: 'Desc 2', boardCount: 0, memberCount: 1 }
    ];

    // Set an active workspace with id 1 (which won't be in the loaded list)
    const oldWorkspace: WorkspaceResponseDto = { id: 1, name: 'Workspace 1', slug: 'ws-1', description: 'Desc 1', boardCount: 0, memberCount: 1 };
    service.setActiveWorkspace(oldWorkspace);
    flushActivation(1);

    service.loadWorkspaces();

    const req = httpMock.expectOne('/api/users/me/workspaces');
    req.flush(mockWorkspaces);

    // The newly selected active workspace (id 2) loads its members and boards
    flushActivation(2);

    // Should auto-select first workspace (id 2) since id 1 is not in the list
    expect(service.getActiveWorkspace()).toEqual(mockWorkspaces[0]);
  });

  it('should share one workspaces request between callers and reflect later additions', () => {
    let firstResult: WorkspaceResponseDto[] | null = null;
    let secondResult: WorkspaceResponseDto[] | null = null;

    service.ensureWorkspacesLoaded().subscribe(list => firstResult = list);
    service.ensureWorkspacesLoaded().subscribe(list => secondResult = list);

    // Two callers (e.g. a guard and the layout), one HTTP call
    httpMock.expectOne('/api/users/me/workspaces').flush([]);
    expect(firstResult).toEqual([]);
    expect(secondResult).toEqual([]);

    // A workspace created afterwards is visible to later callers without refetching
    const created: WorkspaceResponseDto = { id: 3, name: 'New', slug: 'new', boardCount: 0, memberCount: 0 };
    service.createWorkspace({ name: 'New', slug: 'new' }).subscribe();
    httpMock.expectOne('/api/workspaces').flush(created);
    flushActivation(3);

    let afterCreate: WorkspaceResponseDto[] | null = null;
    service.ensureWorkspacesLoaded().subscribe(list => afterCreate = list);
    expect(afterCreate).toEqual([created]);
  });

  it('should share the boards request and ignore a late answer for a workspace already left', () => {
    const boardA: BoardDetailsDto = { id: 10, workspaceId: 1, title: 'A', description: '', columns: [] };
    const boardB: BoardDetailsDto = { id: 20, workspaceId: 2, title: 'B', description: '', columns: [] };

    let fromGuard: BoardDetailsDto[] | null = null;
    service.ensureBoardsLoaded(1).subscribe(list => fromGuard = list);
    service.ensureBoardsLoaded(1).subscribe();   // a second caller reuses the same request
    const slowRequest = httpMock.expectOne('/api/workspaces/1/boards');

    // The user switches to workspace 2 before workspace 1's boards arrive
    service.ensureBoardsLoaded(2).subscribe();
    httpMock.expectOne('/api/workspaces/2/boards').flush([boardB]);
    slowRequest.flush([boardA]);

    let current: BoardDetailsDto[] = [];
    service.boards$.subscribe(list => current = list);
    expect(current).toEqual([boardB]);
    expect(fromGuard).toEqual([]);   // never answered with another workspace's boards
  });

  it('should clear workspace state on clear()', () => {
    const activeWorkspace: WorkspaceResponseDto = { id: 1, name: 'Workspace 1', slug: 'ws-1', description: 'Desc 1', boardCount: 0, memberCount: 1 };
    service.setActiveWorkspace(activeWorkspace);
    flushActivation(1);

    service.clear();

    expect(service.getActiveWorkspace()).toBeNull();
    let workspaces: any[] = [];
    service.workspaces$.subscribe(ws => workspaces = ws);
    expect(workspaces).toEqual([]);
    expect(localStorage.getItem('kanban.lastWorkspaceId')).toBeNull();
  });
});
