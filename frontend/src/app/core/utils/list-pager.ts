/**
 * Paging for a list that's already fully loaded: each page is a slice of it.
 * One instance per list. Its first and rows feed a p-paginator and the template's slice pipe.
 */
export class ListPager {
  /** Rows per page on offer; the first is the default. */
  readonly pageSizes = [10, 25, 50];

  /** Index of the first row on the current page. */
  first = 0;
  rows = this.pageSizes[0];

  /** A list that fits on one page at the smallest size needs no paginator. */
  isNeeded(total: number): boolean {
    return total > this.pageSizes[0];
  }

  /** From the paginator's onPageChange: a new page, or a new page size. */
  change(event: { first?: number; rows?: number }): void {
    this.first = event.first ?? 0;
    this.rows = event.rows ?? this.rows;
  }

  /** After the list shrinks (someone removed, granted access, or filtered out), stay on a page that still has rows. */
  fit(total: number): void {
    if (this.first >= total) {
      this.first = total === 0 ? 0 : Math.floor((total - 1) / this.rows) * this.rows;
    }
  }

  reset(): void {
    this.first = 0;
  }
}
