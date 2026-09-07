import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'parseDetails',
  standalone: true,
  pure: true
})
export class ParseDetailsPipe implements PipeTransform {
  transform(detailsStr: string | undefined): string {
    if (!detailsStr) return '-';
    try {
      const obj = JSON.parse(detailsStr);
      if (obj.reason) return `Rejection: "${obj.reason}"`;
      if (obj.assignee) return `Assigned: ${obj.assignee}`;
      if (obj.status) return `Status: ${obj.status}`;
      if (obj.title) return `Subject: "${obj.title}"`;
      return JSON.stringify(obj);
    } catch {
      return detailsStr;
    }
  }
}
