import data from '../../../dummy_data/issues.json';

import { type Issue, isIssueCategory, isIssueStatus } from '@/models/Issue';

it('accepts the category and status of every issue in the dummy data', () => {
  const issues = data.issues as Issue[];

  expect(issues.length).toBeGreaterThan(0);
  for (const issue of issues) {
    expect(isIssueCategory(issue.category)).toBe(true);
    expect(isIssueStatus(issue.status)).toBe(true);
  }
});

it('rejects unknown categories and statuses', () => {
  expect(isIssueCategory('graffiti')).toBe(false);
  expect(isIssueStatus('archived')).toBe(false);
});
