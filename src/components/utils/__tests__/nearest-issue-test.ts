import { distanceMeters, nearestIssueWithin } from '@/components/utils/map-utils';
import type { Issue } from '@/models/Issue';

import { TEST_ISSUES } from '../../../../test/fixtures';

const at = (id: string, latitude: number, longitude: number): Issue => ({
  ...TEST_ISSUES[0],
  id,
  latitude,
  longitude,
});

describe('distanceMeters', () => {
  it('measures 0.001° of latitude as about 111 m', () => {
    const meters = distanceMeters(
      { latitude: 45.5, longitude: -73.6 },
      { latitude: 45.501, longitude: -73.6 },
    );
    expect(meters).toBeCloseTo(111.19, 1);
  });

  it('shrinks longitude with latitude (cos 45.5° ≈ 0.70)', () => {
    const meters = distanceMeters(
      { latitude: 45.5, longitude: -73.6 },
      { latitude: 45.5, longitude: -73.599 },
    );
    expect(meters).toBeCloseTo(77.95, 1);
  });
});

describe('nearestIssueWithin', () => {
  const point = { latitude: 45.5, longitude: -73.6 };

  it('returns the closest issue inside the radius, with its distance', () => {
    const far = at('far', 45.5004, -73.6); // ~44 m
    const near = at('near', 45.5002, -73.6); // ~22 m
    const result = nearestIssueWithin([far, near], point, 50);
    expect(result?.issue.id).toBe('near');
    expect(result?.meters).toBeCloseTo(22.24, 1);
  });

  it('returns null when every issue is beyond the radius', () => {
    expect(nearestIssueWithin([at('out', 45.5005, -73.6)], point, 50)).toBeNull(); // ~56 m
  });
});
