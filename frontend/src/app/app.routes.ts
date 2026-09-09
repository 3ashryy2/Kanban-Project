import { Routes } from '@angular/router';
import { Component } from '@angular/core';
import { authGuard } from './core/guards/auth.guard';

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
    path: '',
    loadComponent: () => import('./features/layout/main-layout/main-layout.component').then(m => m.MainLayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/boards/board-container/board-container.component').then(m => m.BoardContainerComponent)
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/workspaces/workspace-settings/workspace-settings.component').then(m => m.WorkspaceSettingsComponent)
      },
      {
        path: 'admin/audit-logs',
        loadComponent: () => import('./features/admin/audit-log-dashboard/audit-log-dashboard.component').then(m => m.AuditLogDashboardComponent)
      },
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard'
      }
    ]
  },
  {
    path: '**',
    redirectTo: ''
  }
];
