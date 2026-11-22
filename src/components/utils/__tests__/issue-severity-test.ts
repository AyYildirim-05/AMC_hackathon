import { compareIssuesBySeverityDesc, getIssueUrgency } from '@/components/utils/issue-severity';
import { normalizeIssue } from '@/components/utils/map-utils';
import { severityScoreToUrgency, type Issue } from '@/models/Issue';

const makeIssue = (overrides: Partial<Issue>): Issue => ({
  id: 'issue-1',
  title: 'Sample issue',
  description: 'Sample description',
  category: 'roads_potholes',
  status: 'not_started',
  images: [],
  address: '100 Rue Rachel Est',
  latitude: 45.52,
  longitude: -73.57,
  district_id: 'district-1',
  created_by_id: 'user-1',
  updated_by_id: null,
  upvote_count: 0,
  resolution_confirmations: 0,
  external_311_ref: null,
  created_at: '2026-11-20T10:00:00.000Z',
  updated_at: '2026-11-20T10:00:00.000Z',
  ...overrides,
});

describe('issue severity helpers', () => {
  it('maps severity scores to urgency levels and normalizes API payloads', () => {
    expect(severityScoreToUrgency(10)).toBe('high');
    expect(severityScoreToUrgency(8)).toBe('high');
    expect(severityScoreToUrgency(5)).toBe('medium');
    expect(severityScoreToUrgency(2)).toBe('low');

    const normalized = normalizeIssue({
      id: 'abc',
      title: 'Downed wire',
      description: 'Live wire on sidewalk',
      category: 'streetlights_utilities',
      status: 'not_started',
      address: '10 Rue Saint-Denis',
      latitude: 45.52,
      longitude: -73.57,
      districtId: 'd1',
      createdById: 'u1',
      severityScore: 9,
      createdAt: '2026-11-22T01:00:00.000Z',
      updatedAt: '2026-11-22T01:00:00.000Z',
    });

    expect(normalized.severity_score).toBe(9);
    expect(normalized.urgency).toBe('high');
    expect(getIssueUrgency(normalized)).toBe('high');
  });

  it('sorts highest-severity urgent issues at the top, breaking ties by newest first', () => {
    const low = makeIssue({
      id: 'low',
      severity_score: 2,
      urgency: 'low',
      created_at: '2026-11-22T02:00:00.000Z',
    });
    const highOlder = makeIssue({
      id: 'high-older',
      severity_score: 9,
      urgency: 'high',
      created_at: '2026-11-21T08:00:00.000Z',
    });
    const highNewer = makeIssue({
      id: 'high-newer',
      severity_score: 9,
      urgency: 'high',
      created_at: '2026-11-22T01:00:00.000Z',
    });
    const medium = makeIssue({
      id: 'medium',
      severity_score: 6,
      urgency: 'medium',
      created_at: '2026-11-22T03:00:00.000Z',
    });
    const unrated = makeIssue({
      id: 'unrated',
      severity_score: null,
      urgency: null,
      created_at: '2026-11-22T04:00:00.000Z',
    });

    const sorted = [unrated, low, medium, highOlder, highNewer].sort(compareIssuesBySeverityDesc);
    expect(sorted.map((i) => i.id)).toEqual([
      'high-newer',
      'high-older',
      'medium',
      'low',
      'unrated',
    ]);
  });
});
