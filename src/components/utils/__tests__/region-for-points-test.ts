import { MONTREAL_DEFAULT_REGION, regionForPoints } from '@/components/utils/map-utils';

describe('regionForPoints', () => {
  it('centres on the points and pads the span by 40% so markers clear the edges', () => {
    const region = regionForPoints([
      { latitude: 45.5, longitude: -73.6 },
      { latitude: 45.54, longitude: -73.56 },
    ]);
    expect(region.latitude).toBeCloseTo(45.52, 6);
    expect(region.longitude).toBeCloseTo(-73.58, 6);
    expect(region.latitudeDelta).toBeCloseTo(0.056, 6);
    expect(region.longitudeDelta).toBeCloseTo(0.056, 6);
  });

  it('never zooms in past the minimum span (a single point)', () => {
    expect(regionForPoints([{ latitude: 45.5, longitude: -73.6 }])).toEqual({
      latitude: 45.5,
      longitude: -73.6,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
  });

  it('falls back to Montreal when there is nothing to show', () => {
    expect(regionForPoints([])).toBe(MONTREAL_DEFAULT_REGION);
  });
});
