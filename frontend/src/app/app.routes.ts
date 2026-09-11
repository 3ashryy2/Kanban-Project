import { Routes } from '@angular/router';
import { Component } from '@angular/core';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import {
  boardAccessGuard,
  hasWorkspaceGuard,
  homeRedirectGuard,
  noWorkspaceGuard,
  workspaceGuard
} from './core/guards/workspace.guards';

@Component({
  template: '',
  standalone: true
})
export class EmptyComponent {}

export const routes: Routes = [
  {
    path: 'auth/login',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent)
  },
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
    path: '**',
    redirectTo: ''
  }
];
