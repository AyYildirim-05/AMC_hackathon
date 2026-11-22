import {
  MONTREAL_DEFAULT_REGION,
  regionForPoints,
  reserveBottom,
} from '@/components/utils/map-utils';

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

describe('reserveBottom', () => {
  const region = { latitude: 45.5, longitude: -73.6, latitudeDelta: 0.065, longitudeDelta: 0.03 };
  const top = (r: typeof region) => r.latitude + r.latitudeDelta / 2;
  const bottom = (r: typeof region) => r.latitude - r.latitudeDelta / 2;

  it('keeps the top edge and extends the bottom so the region fills the top 65%', () => {
    const reserved = reserveBottom(region, 0.35);
    expect(top(reserved)).toBeCloseTo(top(region), 9);
    expect(reserved.latitudeDelta).toBeCloseTo(0.1, 9);
    // The original bottom edge now sits 65% of the way down the map.
    expect((top(reserved) - bottom(region)) / reserved.latitudeDelta).toBeCloseTo(0.65, 9);
    expect(reserved.longitude).toBe(region.longitude);
    expect(reserved.longitudeDelta).toBe(region.longitudeDelta);
  });

  it('changes nothing when nothing is covered', () => {
    expect(reserveBottom(region, 0)).toEqual(region);
  });
});
