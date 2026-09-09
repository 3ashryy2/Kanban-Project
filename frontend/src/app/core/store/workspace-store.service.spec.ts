import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { WorkspaceStoreService } from './workspace-store.service';
import { MessageService } from 'primeng/api';
import { WorkspaceResponseDto } from '../models/workspace.dto';

describe('WorkspaceStoreService', () => {
  let service: WorkspaceStoreService;
  let httpMock: HttpTestingController;
  let messageServiceMock: any;

  beforeEach(() => {
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

    // Expect an API request for the members of the newly selected active workspace (id 1)
    const memberReq = httpMock.expectOne('/api/workspaces/1/members');
    memberReq.flush([]);

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

    // Expect an API request for the members of the old workspace upon setActiveWorkspace
    const memberReq = httpMock.expectOne('/api/workspaces/1/members');
    memberReq.flush([]);

    service.loadWorkspaces();

    const req = httpMock.expectOne('/api/users/me/workspaces');
    req.flush(mockWorkspaces);

    // Expect an API request for the members of the newly selected active workspace (id 2)
    const newMemberReq = httpMock.expectOne('/api/workspaces/2/members');
    newMemberReq.flush([]);

    // Should auto-select first workspace (id 2) since id 1 is not in the list
    expect(service.getActiveWorkspace()).toEqual(mockWorkspaces[0]);
  });

  it('should clear workspace state on clear()', () => {
    const activeWorkspace: WorkspaceResponseDto = { id: 1, name: 'Workspace 1', slug: 'ws-1', description: 'Desc 1', boardCount: 0, memberCount: 1 };
    service.setActiveWorkspace(activeWorkspace);

    // Flush member req
    const memberReq = httpMock.expectOne('/api/workspaces/1/members');
    memberReq.flush([]);

    service.clear();

    expect(service.getActiveWorkspace()).toBeNull();
    let workspaces: any[] = [];
    service.workspaces$.subscribe(ws => workspaces = ws);
    expect(workspaces).toEqual([]);
  });
});
