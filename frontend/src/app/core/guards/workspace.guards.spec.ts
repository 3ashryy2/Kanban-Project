import { TestBed } from '@angular/core/testing';
import { CanActivateFn, GuardResult, Router, UrlTree, provideRouter } from '@angular/router';
import { Observable, firstValueFrom, of } from 'rxjs';
import { hasWorkspaceGuard, noWorkspaceGuard } from './workspace.guards';
import { AuthStoreService } from '../store/auth-store.service';
import { WorkspaceStoreService } from '../store/workspace-store.service';
import { WorkspaceResponseDto } from '../models/workspace.dto';

describe('workspace guards', () => {
  let workspaces: WorkspaceResponseDto[];
  const alpha: WorkspaceResponseDto = { id: 1, name: 'Alpha', slug: 'alpha', boardCount: 1, memberCount: 2 };

  beforeEach(() => {
    workspaces = [];
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthStoreService, useValue: { isAuthenticated: () => true, ensureFreshSession: () => of(null) } },
        // Reads the variable at call time, so each test can set its own list
        { provide: WorkspaceStoreService, useValue: { ensureWorkspacesLoaded: () => of(workspaces) } }
      ]
    });
  });

  const run = (guard: CanActivateFn): Promise<GuardResult> =>
    firstValueFrom(TestBed.runInInjectionContext(() => guard({} as any, {} as any)) as Observable<GuardResult>);

  const urlOf = (result: GuardResult): string => TestBed.inject(Router).serializeUrl(result as UrlTree);

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
});
