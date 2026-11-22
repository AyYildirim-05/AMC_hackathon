import { TEST_ISSUES } from '../../../test/fixtures';

import { isIssueCategory, isIssueStatus } from '@/models/Issue';

it('accepts the category and status of every issue fixture', () => {
  expect(TEST_ISSUES.length).toBeGreaterThan(0);
  for (const issue of TEST_ISSUES) {
    expect(isIssueCategory(issue.category)).toBe(true);
    expect(isIssueStatus(issue.status)).toBe(true);
  }
});

it('rejects unknown categories and statuses', () => {
  expect(isIssueCategory('graffiti')).toBe(false);
  expect(isIssueStatus('archived')).toBe(false);
});
