import { ActivatedRouteSnapshot } from '@angular/router';

/** Reads a route parameter from the route or any ancestor, e.g. :workspaceId from inside boards/:boardId. */
export function findRouteParam(route: ActivatedRouteSnapshot, name: string): string | null {
  for (let current: ActivatedRouteSnapshot | null = route; current; current = current.parent) {
    const value = current.paramMap.get(name);
    if (value !== null) {
      return value;
    }
  }
  return null;
}
