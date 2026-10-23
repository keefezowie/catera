import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import customer from '../apps/customer/app.config';
import dapur from '../apps/caterer/app.config';

/** Spec 3.3: both apps launch on the theme canvas with the phase-f mascot mark and ship the phase-f launcher icons. */
const apps = [
  ['customer', customer, 'apps/customer'],
  ['Catera Dapur', dapur, 'apps/caterer'],
] as const;

type SplashOptions = {
  backgroundColor?: string;
  image?: string;
  imageWidth?: number;
  dark?: { backgroundColor?: string; image?: string };
};

function splash(config: typeof customer): SplashOptions {
  const entry = config.plugins?.find((p) => Array.isArray(p) && p[0] === 'expo-splash-screen');
  if (!Array.isArray(entry)) throw new Error('expo-splash-screen plugin missing');
  return entry[1] as SplashOptions;
}

/** A config path resolves from the app folder; every one named here must exist. */
const exists = (appDir: string, file: string | undefined) => !!file && existsSync(path.join(process.cwd(), appDir, file));
const PHASE_F = '../../packages/brand/assets/phase-f';

describe.each(apps)('%s app config', (_name, config, appDir) => {
  it('both apps use the phase-f splash marks with light and dark backgrounds', () => {
    const s = splash(config);
    expect(s).toMatchObject({
      backgroundColor: '#FFFFFF',
      image: `${PHASE_F}/splash-mark-light.png`,
      imageWidth: 200,
      dark: { backgroundColor: '#151514', image: `${PHASE_F}/splash-mark-dark.png` },
    });
    expect(exists(appDir, s.image)).toBe(true);
    expect(exists(appDir, s.dark?.image)).toBe(true);
  });

  it('both apps set the adaptive foreground, forest background and monochrome icon', () => {
    const icon = config.android?.adaptiveIcon;
    expect(icon).toEqual({
      foregroundImage: `${PHASE_F}/adaptive-foreground.png`,
      backgroundColor: '#163D2E',
      monochromeImage: `${PHASE_F}/icon-monochrome.png`,
    });
    expect(exists(appDir, icon?.foregroundImage)).toBe(true);
    expect(exists(appDir, icon?.monochromeImage)).toBe(true);
  });

  it('iOS keeps the app icon for light and uses the phase-f dark and tinted icons', () => {
    expect(config.icon).toBe('../../packages/brand/assets/app-icon.png');
    expect(config.ios?.icon).toEqual({
      light: '../../packages/brand/assets/app-icon.png',
      dark: `${PHASE_F}/icon-ios-dark.png`,
      tinted: `${PHASE_F}/icon-ios-tinted.png`,
    });
    const ios = config.ios?.icon as { light: string; dark: string; tinted: string };
    for (const file of [ios.light, ios.dark, ios.tinted]) expect(exists(appDir, file)).toBe(true);
  });
});

describe('one EAS project per app', () => {
  const projectId = (config: typeof customer) => (config.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;

  it('each app config declares its own project id and the two differ', () => {
    const [a, b] = [projectId(customer), projectId(dapur)];
    expect(a).toMatch(/^[0-9a-f-]{36}$/);
    expect(b).toMatch(/^[0-9a-f-]{36}$/);
    expect(a).not.toBe(b);
  });

  it('the root app.json carries no project id for either app to fall back to', () => {
    const root = JSON.parse(readFileSync(path.join(process.cwd(), 'app.json'), 'utf8'));
    expect(root.expo?.extra?.eas?.projectId).toBeUndefined();
  });
});
