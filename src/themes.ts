import { tiers } from './lib/tiers';
import type { Tier } from './lib/tiers';
import themesJson from './themes.json';

export type Palette = {
  page: string,
  sheet: string,
  text: string,
  link: string,
  accent?: string,
};

export type Theme = {
  tier?: Tier,
  glass: boolean,
  background?: string,
  backgroundImage?: string,
  credit?: { text: string, url: string },
  palette?: { light: Palette, dark: Palette },
};

export type ThemeName = keyof typeof themes;

const HEX_COLOR = /^#[0-9a-f]{3,8}$/i;

const PALETTE_KEYS: [Exclude<keyof Palette, 'accent'>, string][] = [
  ['page', '--page-color'],
  ['sheet', '--sheet-color'],
  ['text', '--text-color'],
  ['link', '--link-color'],
];

function accentOf(light: Palette, dark: Palette): string | null {
  if (!light.accent && !dark.accent) return null;
  return `light-dark(${light.accent ?? light.link}, ${dark.accent ?? dark.link})`;
}

export type ThemeAttrs = { classes: string[], vars: Record<string, string>, credit: { text: string, url: string } | null };

export const THEME_VAR_NAMES = [
  ...PALETTE_KEYS.map(([, cssVar]) => cssVar),
  '--accent-color',
  'color-scheme',
  '--theme-background',
  '--theme-background-image',
];

const SAFE_BACKGROUND = /^[a-z-]+\([#a-z0-9%.,\s()-]*\)( 0 0)?$/i;

function cssUrl(url: string): string {
  return `url('${encodeURI(url).replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29')}')`;
}

export function themeAttrs(theme: Theme): ThemeAttrs {
  const credit = theme.credit
    && typeof theme.credit.text === 'string' && theme.credit.text
    && typeof theme.credit.url === 'string' && /^https:\/\//.test(theme.credit.url)
    ? { text: theme.credit.text.slice(0, 100), url: theme.credit.url }
    : null;
  const classes: string[] = [];
  const vars: Record<string, string> = {};
  if (theme.glass) classes.push('theme-glass');
  if (typeof theme.background === 'string' && SAFE_BACKGROUND.test(theme.background)) {
    classes.push('theme-bg');
    // Older saved themes may carry a trailing `0 0` position, which isn't valid in background-image.
    vars['--theme-background'] = theme.background.replace(/ 0 0$/, '');
  }
  if (typeof theme.backgroundImage === 'string' && theme.backgroundImage) {
    classes.push('theme-bg-image');
    vars['--theme-background-image'] = cssUrl(theme.backgroundImage);
  }

  const { light, dark }: Partial<NonNullable<Theme['palette']>> = theme.palette ?? {};
  const valid = (p?: Palette): p is Palette => !!p
    && PALETTE_KEYS.every(([key]) => typeof p[key] === 'string' && HEX_COLOR.test(p[key]))
    && (p.accent === undefined || (typeof p.accent === 'string' && HEX_COLOR.test(p.accent)));
  if (valid(light) && valid(dark)) {
    for (const [key, cssVar] of PALETTE_KEYS) {
      vars[cssVar] = `light-dark(${light[key]}, ${dark[key]})`;
    }
    const accent = accentOf(light, dark);
    if (accent) vars['--accent-color'] = accent;
    vars['color-scheme'] = 'light dark';
    classes.push('palette');
    if (accent) classes.push('palette-accent');
  }
  return { classes, vars, credit };
}

export function themeHtmlAttrs(theme: Theme): { class?: string, style?: string } {
  const { classes, vars } = themeAttrs(theme);
  return {
    class: classes.join(' ') || undefined,
    style: Object.entries(vars).map(([k, v]) => `${k}: ${v}`).join('; ') || undefined,
  };
}

export type ThemePreview = { page: string, sheet: string, text: string, link: string, accent?: string, background?: string };

// TODO find a way to dedup these?
const DEFAULT_PREVIEW: ThemePreview = {
  page: 'light-dark(#e9e9e9, #444)',
  sheet: 'light-dark(#fefefe, #333)',
  text: 'light-dark(black, whitesmoke)',
  link: 'light-dark(#069, #46b9f2)',
};

export function themePreview(theme: Theme): ThemePreview {
  const preview = { ...DEFAULT_PREVIEW };
  if (theme.palette) {
    const { light, dark } = theme.palette;
    for (const [key] of PALETTE_KEYS) {
      preview[key] = `light-dark(${light[key]}, ${dark[key]})`;
    }
    const accent = accentOf(light, dark);
    if (accent) preview.accent = accent;
  }
  if (theme.background) preview.background = theme.background;
  else if (theme.backgroundImage) preview.background = `url('${theme.backgroundImage}') center / cover`;
  return preview;
}

type RawTheme = Omit<Theme, 'tier'> & { tier?: keyof typeof tiers };

function loadThemes(raw: Record<string, RawTheme>): Record<string, Theme> {
  const result: Record<string, Theme> = {};
  for (const [name, { tier, ...rest }] of Object.entries(raw)) {
    if (tier !== undefined && !Object.hasOwn(tiers, tier)) throw new Error(`themes.json: theme "${name}" has unknown tier "${tier}"`);
    const theme: Theme = { ...rest, tier: tier === undefined ? undefined : tiers[tier] };
    const { light, dark } = theme.palette ?? {};
    if (theme.palette) {
      for (const p of [light, dark]) {
        for (const [key, value] of Object.entries(p ?? {})) {
          if (!HEX_COLOR.test(value)) throw new Error(`themes.json: theme "${name}" has invalid colour ${key}: "${value}"`);
        }
      }
    }
    if (theme.credit && !/^https:\/\//.test(theme.credit.url)) throw new Error(`themes.json: theme "${name}" credit url must be https`);
    if (theme.background && !SAFE_BACKGROUND.test(theme.background)) throw new Error(`themes.json: theme "${name}" has an unsafe background`);
    result[name] = theme;
  }
  if (!result.default) throw new Error('themes.json: missing "default" theme');
  return result;
}

const themes = loadThemes(themesJson as Record<string, RawTheme>);

export function themeAvailable(name: string | null | undefined, tier: Tier): boolean {
  if (!name || !Object.prototype.hasOwnProperty.call(themes, name)) return false;
  return (themes[name].tier ?? tiers.FREE) <= tier;
}

export default themes;
