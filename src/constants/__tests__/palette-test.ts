import { Palette, PaletteShades, StatusColors } from '@/constants/palette';
import { Colors } from '@/constants/theme';

it('has neutral and accent scales from 100 to 900 in both modes', () => {
  expect(PaletteShades).toEqual([100, 200, 300, 400, 500, 600, 700, 800, 900]);
  for (const mode of ['light', 'dark'] as const) {
    expect(Object.keys(Palette[mode].neutral).map(Number)).toEqual(PaletteShades);
    expect(Object.keys(Palette[mode].accent).map(Number)).toEqual(PaletteShades);
  }
});

it('defines the same theme tokens for both modes', () => {
  expect(Object.keys(Colors.dark).sort()).toEqual(Object.keys(Colors.light).sort());
});

it('builds every theme token from the palette or the status colors', () => {
  const allowed = new Set<string>();
  for (const mode of ['light', 'dark'] as const) {
    const { neutral, accent, ...base } = Palette[mode];
    [...Object.values(neutral), ...Object.values(accent), ...Object.values(base)].forEach((c) =>
      allowed.add(c),
    );
    Object.values(StatusColors[mode]).forEach((c) => allowed.add(c));
  }
  for (const mode of ['light', 'dark'] as const) {
    for (const [token, color] of Object.entries(Colors[mode])) {
      expect({ token, mode, allowed: allowed.has(color) }).toEqual({ token, mode, allowed: true });
    }
  }
});
