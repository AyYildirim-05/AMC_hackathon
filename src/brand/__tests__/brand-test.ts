import { existsSync } from 'node:fs';
import { join } from 'node:path';

import appJson from '../../../app.json';
import appConfig, { loadBrand } from '../../../app.config';
import { brand, BRANDS, DEFAULT_BRAND_ID, resolveBrandId } from '@/brand';
import i18n from '@/i18n';

const ROOT = join(__dirname, '../../..');
const SHADES = ['100', '200', '300', '400', '500', '600', '700', '800', '900'];
const HEX = /^#[0-9a-fA-F]{6}$/;

/** The Expo config app.config.ts produces for a brand (as `APP_BRAND=<id>` would). */
function configFor(id?: string) {
  const previous = process.env.APP_BRAND;
  if (id) process.env.APP_BRAND = id;
  else delete process.env.APP_BRAND;
  try {
    return appConfig({ config: appJson.expo } as never);
  } finally {
    if (previous === undefined) delete process.env.APP_BRAND;
    else process.env.APP_BRAND = previous;
  }
}

describe('white-label brands', () => {
  it.each(Object.entries(BRANDS))('%s has a complete, valid brand file', (id, { config }) => {
    expect(config.id).toBe(id);
    // app.config.ts reads the same file from disk.
    expect(loadBrand(id, ROOT)).toEqual(config);
    for (const path of [config.icon, config.splash.image]) {
      expect(existsSync(join(ROOT, path))).toBe(true);
    }
    for (const mode of ['light', 'dark'] as const) {
      const palette = config.palette[mode];
      expect(Object.keys(palette.neutral)).toEqual(SHADES);
      expect(Object.keys(palette.accent)).toEqual(SHADES);
      const colors = [
        ...Object.values(palette.neutral),
        ...Object.values(palette.accent),
        palette.bg,
        palette.surface,
        palette.ink,
        config.statusColors[mode].success,
        config.statusColors[mode].danger,
      ];
      colors.forEach((color) => expect(color).toMatch(HEX));
    }
  });

  it('gives every brand its own store IDs and link scheme', () => {
    const configs = Object.values(BRANDS).map((entry) => entry.config);
    for (const key of ['ios', 'android', 'scheme'] as const) {
      const values = configs.map((config) =>
        key === 'ios'
          ? config.ios.bundleIdentifier
          : key === 'android'
            ? config.android.package
            : config.scheme,
      );
      expect(new Set(values).size).toBe(values.length);
    }
  });

  it('falls back to MonTone for a build without a known brand', () => {
    expect(resolveBrandId(undefined)).toBe(DEFAULT_BRAND_ID);
    expect(resolveBrandId('nope')).toBe(DEFAULT_BRAND_ID);
    expect(resolveBrandId('citypulse')).toBe('citypulse');
    expect(brand.id).toBe('montone');
  });

  it('puts the brand name into translated text', () => {
    expect(i18n.t('splash.title')).toBe('MonTone');
    expect(i18n.t('home.title', { lng: 'en' })).toBe('Welcome to MonTone');
    expect(i18n.t('home.title', { lng: 'fr' })).toBe('Bienvenue sur MonTone');
  });
});

describe('app.config.ts', () => {
  it('builds MonTone by default', () => {
    const config = configFor();
    expect(config).toMatchObject({
      name: 'MonTone',
      scheme: 'montone',
      ios: { bundleIdentifier: 'com.yildirim.cuneyt.it.Montone' },
      android: { package: 'com.yildirim.cuneyt.it.Montone' },
      extra: { brand: 'montone' },
    });
  });

  it('builds another brand with its own name, IDs, icon, splash and permission texts', () => {
    const config = configFor('citypulse');
    expect(config).toMatchObject({
      name: 'CityPulse',
      slug: 'CityPulse',
      scheme: 'citypulse',
      icon: './brands/citypulse/icon.png',
      ios: { bundleIdentifier: 'com.yildirim.cuneyt.it.CityPulse' },
      android: {
        package: 'com.yildirim.cuneyt.it.CityPulse',
        adaptiveIcon: { foregroundImage: './brands/citypulse/icon.png' },
      },
      extra: { brand: 'citypulse' },
    });
    const plugin = (name: string) =>
      (config.plugins as [string, Record<string, unknown>][]).find(
        (entry) => Array.isArray(entry) && entry[0] === name,
      )?.[1];
    expect(plugin('expo-splash-screen')).toMatchObject({
      backgroundColor: '#F2F4F7',
      image: './brands/citypulse/icon.png',
      dark: { backgroundColor: '#12161C' },
    });
    expect(plugin('expo-location')?.locationWhenInUsePermission).toMatch(/^CityPulse /);
    expect(plugin('expo-image-picker')?.cameraPermission).toMatch(/^CityPulse /);
    // Options the brand doesn't set are kept.
    expect(plugin('expo-image-picker')?.microphonePermission).toBe(false);
  });

  it('refuses an unknown brand instead of silently building MonTone', () => {
    expect(() => configFor('nope')).toThrow(/APP_BRAND "nope"/);
    expect(() => configFor('../secrets')).toThrow(/not a valid brand id/);
  });
});
