import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import {
  boardAccessGuard,
  hasWorkspaceGuard,
  homeRedirectGuard,
  noWorkspaceGuard,
  workspaceGuard
} from './core/guards/workspace.guards';
// Type-only import: erased at compile time, so the error page stays in its own lazy chunk
import type { ErrorPageData } from './features/errors/error-page.component';

const loadAuthPage = () => import('./features/auth/login/login.component').then(m => m.LoginComponent);
const loadErrorPage = () => import('./features/errors/error-page.component').then(m => m.ErrorPageComponent);

export const routes: Routes = [
  // Sign-in and registration share one component; signed-in users are sent into the app
  { path: 'auth/login', canActivate: [guestGuard], loadComponent: loadAuthPage },
  { path: 'auth/register', canActivate: [guestGuard], loadComponent: loadAuthPage, data: { mode: 'register' } },
  {
    // Signed-in users who belong to no workspace yet wait here (outside the main shell)
    path: 'onboarding',
    canActivate: [authGuard, noWorkspaceGuard],
    loadComponent: () => import('./features/onboarding/onboarding.component').then(m => m.OnboardingComponent)
  },
  {
    path: '',
    loadComponent: () => import('./features/layout/main-layout/main-layout.component').then(m => m.MainLayoutComponent),
    canActivate: [authGuard, hasWorkspaceGuard],
    children: [
      {
        // "/" only redirects: to the last-used workspace, or onboarding
        path: '',
        pathMatch: 'full',
        canActivate: [homeRedirectGuard],
        children: []
      },
      {
        // The URL carries the workspace and board, so refresh and shared links keep their place
        path: 'w/:workspaceId',
        canActivate: [workspaceGuard],
        children: [
          {
            path: '',
            pathMatch: 'full',
            loadComponent: () => import('./features/workspaces/workspace-home/workspace-home.component').then(m => m.WorkspaceHomeComponent)
          },
          {
            path: 'boards/:boardId',
            canActivate: [boardAccessGuard],
            loadComponent: () => import('./features/boards/board-container/board-container.component').then(m => m.BoardContainerComponent)
          },
          {
            path: 'members',
            loadComponent: () => import('./features/workspaces/workspace-settings/workspace-settings.component').then(m => m.WorkspaceSettingsComponent)
          }
        ]
      },
      {
        path: 'profile',
        loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent)
      },
      {
        path: 'admin/users',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/admin/admin-users/admin-users.component').then(m => m.AdminUsersComponent)
      },
      {
        path: 'admin/audit-logs',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/admin/audit-log-dashboard/audit-log-dashboard.component').then(m => m.AuditLogDashboardComponent)
      },
      // Addresses from before workspace URLs existed
      { path: 'dashboard', redirectTo: '/' },
      { path: 'settings', redirectTo: '/' }
    ]
  },
  {
    path: 'forbidden',
    loadComponent: loadErrorPage,
    data: {
      status: 403,
      title: "You don't have access to this page",
      message: 'This page is only available to administrators. If you need it, ask an administrator.'
    } satisfies ErrorPageData
  },
  {
    // Anything unmatched gets a real "not found" page instead of a silent redirect
    path: '**',
    loadComponent: loadErrorPage,
    data: {
      status: 404,
      title: 'Page not found',
      message: "There's nothing at this address. The link may be wrong, or the page may have moved."
    } satisfies ErrorPageData
  }
];
