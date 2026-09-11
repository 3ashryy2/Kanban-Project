import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

import { HeaderComponent } from '../../../shared/components/header/header.component';
import { SidebarComponent } from '../../../shared/components/sidebar/sidebar.component';

/**
 * The app shell: header, sidebar and the routed page. It holds no state of its own:
 * the URL (/w/:workspaceId/…) and its guards decide which workspace and board are open.
 */
@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    RouterModule,
    HeaderComponent,
    SidebarComponent
  ],
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.scss']
})
export class MainLayoutComponent {}
