import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';

export interface ErrorPageData {
  status: 403 | 404;
  title: string;
  message: string;
}

/** One page for "you may not" (403) and "nothing here" (404); each route supplies its wording as route data. */
@Component({
  selector: 'app-error-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './error-page.component.html',
  styleUrls: ['./error-page.component.scss']
})
export class ErrorPageComponent {
  private readonly route = inject(ActivatedRoute);

  readonly page = this.route.snapshot.data as ErrorPageData;

  // For the wildcard route, the unmatched segments are the address the user asked for
  readonly requestedPath = '/' + this.route.snapshot.url.map(segment => segment.path).join('/');
}
