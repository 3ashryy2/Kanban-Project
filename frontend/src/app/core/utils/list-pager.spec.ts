import { ListPager } from './list-pager';

describe('ListPager', () => {
  it('starts on the first page, ten rows at a time', () => {
    const pager = new ListPager();
    expect(pager.first).toBe(0);
    expect(pager.rows).toBe(10);
  });

  it('shows the paginator only when the list is longer than the smallest page', () => {
    const pager = new ListPager();
    expect(pager.isNeeded(10)).toBe(false);
    expect(pager.isNeeded(11)).toBe(true);
    // Still shown at 25 per page for 12 rows, so the viewer can go back to 10
    pager.change({ first: 0, rows: 25 });
    expect(pager.isNeeded(12)).toBe(true);
  });

  it('moves back to the last page that still has rows when the list shrinks', () => {
    const pager = new ListPager();
    pager.change({ first: 20, rows: 10 }); // third page of 21..30
    pager.fit(21);
    expect(pager.first).toBe(20);          // row 21 is still there
    pager.fit(20);
    expect(pager.first).toBe(10);          // the third page emptied: back to the second
    pager.fit(3);
    expect(pager.first).toBe(0);
    pager.fit(0);
    expect(pager.first).toBe(0);
  });

  it('goes back to the first page on reset, keeping the page size', () => {
    const pager = new ListPager();
    pager.change({ first: 50, rows: 25 });
    pager.reset();
    expect(pager.first).toBe(0);
    expect(pager.rows).toBe(25);
  });
});
