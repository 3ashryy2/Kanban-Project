import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, CanActivateFn, GuardResult, Router, UrlTree, convertToParamMap, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Observable, firstValueFrom, of } from 'rxjs';
import { boardAccessGuard, hasWorkspaceGuard, noWorkspaceGuard, workspaceGuard } from './workspace.guards';
import { AuthStoreService } from '../store/auth-store.service';
import { WorkspaceStoreService } from '../store/workspace-store.service';
import { WorkspaceResponseDto } from '../models/workspace.dto';
import { BoardDetailsDto } from '../models/board.dto';

describe('workspace guards', () => {
  let workspaces: WorkspaceResponseDto[];
  let boards: BoardDetailsDto[];
  let workspaceStore: { ensureWorkspacesLoaded: any; ensureBoardsLoaded: any; getActiveWorkspace: any; setActiveWorkspace: any };
  let messageService: { add: any };

  const alpha: WorkspaceResponseDto = { id: 1, name: 'Alpha', slug: 'alpha', boardCount: 1, memberCount: 2 };
  const roadmap: BoardDetailsDto = { id: 10, workspaceId: 1, title: 'Roadmap', description: '', columns: [] };

  beforeEach(() => {
    workspaces = [];
    boards = [];
    // Each fake reads the variables at call time, so every test can set its own lists
    workspaceStore = {
      ensureWorkspacesLoaded: () => of(workspaces),
      ensureBoardsLoaded: () => of(boards),
      getActiveWorkspace: () => null,
      setActiveWorkspace: vi.fn()
    };
    messageService = { add: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthStoreService, useValue: { isAuthenticated: () => true, ensureFreshSession: () => of(null) } },
        { provide: WorkspaceStoreService, useValue: workspaceStore },
        { provide: MessageService, useValue: messageService }
      ]
    });
  });

  const run = (guard: CanActivateFn, route: Partial<ActivatedRouteSnapshot> = {}): Promise<GuardResult> =>
    firstValueFrom(TestBed.runInInjectionContext(() => guard(route as ActivatedRouteSnapshot, {} as any)) as Observable<GuardResult>);

  const urlOf = (result: GuardResult): string => TestBed.inject(Router).serializeUrl(result as UrlTree);

  // A /w/:workspaceId route, or its boards/:boardId child (whose :workspaceId lives on the parent)
  const workspaceRoute = (workspaceId: number) =>
    ({ paramMap: convertToParamMap({ workspaceId: String(workspaceId) }), parent: null }) as unknown as ActivatedRouteSnapshot;
  const boardRoute = (workspaceId: number, boardId: number) =>
    ({ paramMap: convertToParamMap({ boardId: String(boardId) }), parent: workspaceRoute(workspaceId) }) as unknown as ActivatedRouteSnapshot;

  it('sends a user without workspaces to onboarding', async () => {
    expect(urlOf(await run(hasWorkspaceGuard))).toBe('/onboarding');
  });

  it('lets a workspace member into the app', async () => {
    workspaces = [alpha];
    expect(await run(hasWorkspaceGuard)).toBe(true);
  });

  it('keeps workspace members away from onboarding', async () => {
    workspaces = [alpha];
    expect(urlOf(await run(noWorkspaceGuard))).toBe('/');
  });

  it('lets a user without workspaces see onboarding', async () => {
    expect(await run(noWorkspaceGuard)).toBe(true);
  });

  it('redirects an unknown workspace home and says why', async () => {
    workspaces = [alpha];
    expect(urlOf(await run(workspaceGuard, workspaceRoute(2)))).toBe('/');
    expect(messageService.add).toHaveBeenCalled();
  });

  it('activates a workspace the user belongs to', async () => {
    workspaces = [alpha];
    expect(await run(workspaceGuard, workspaceRoute(1))).toBe(true);
    expect(workspaceStore.setActiveWorkspace).toHaveBeenCalledWith(alpha);
  });

  it('opens a board the user may open', async () => {
    boards = [roadmap];
    expect(await run(boardAccessGuard, boardRoute(1, 10))).toBe(true);
  });

  it('sends a board the user may not open back to its workspace', async () => {
    boards = [roadmap];
    expect(urlOf(await run(boardAccessGuard, boardRoute(1, 99)))).toBe('/w/1');
    expect(messageService.add).toHaveBeenCalled();
  });
});
