export type Palette = {
  page: string,
  sheet: string,
  text: string,
  link: string,
  accent?: string,
};

export type Theme = {
  glass: boolean,
  background?: string,
  backgroundImage?: string,
  palette?: { light?: Palette, dark?: Palette },
};

export type ThemeName = keyof typeof themes;

const HEX_COLOR = /^#[0-9a-f]{3,8}$/i;

const PALETTE_KEYS: [Exclude<keyof Palette, 'accent'>, string][] = [
  ['page', '--page-color'],
  ['sheet', '--sheet-color'],
  ['text', '--text-color'],
  ['link', '--link-color'],
];

function accentOf(light?: Palette, dark?: Palette): string | null {
  if (!light?.accent && !dark?.accent) return null;
  const l = light && (light.accent ?? light.link);
  const d = dark && (dark.accent ?? dark.link);
  return l && d ? `light-dark(${l}, ${d})` : (l ?? d)!;
}

export type ThemeAttrs = { classes: string[], vars: Record<string, string> };

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
  const classes: string[] = [];
  const vars: Record<string, string> = {};
  if (theme.glass) classes.push('theme-glass');
  if (typeof theme.background === 'string' && SAFE_BACKGROUND.test(theme.background)) {
    classes.push('theme-bg');
    vars['--theme-background'] = theme.background;
  }
  if (typeof theme.backgroundImage === 'string' && theme.backgroundImage) {
    classes.push('theme-bg-image');
    vars['--theme-background-image'] = cssUrl(theme.backgroundImage);
  }

  const { light, dark } = theme.palette ?? {};
  const valid = (p?: Palette) => !!p
    && PALETTE_KEYS.every(([key]) => typeof p[key] === 'string' && HEX_COLOR.test(p[key]))
    && (p.accent === undefined || (typeof p.accent === 'string' && HEX_COLOR.test(p.accent)));
  if ((light || dark) && !(light && !valid(light)) && !(dark && !valid(dark))) {
    for (const [key, cssVar] of PALETTE_KEYS) {
      vars[cssVar] = light && dark ? `light-dark(${light[key]}, ${dark[key]})` : (light ?? dark)![key];
    }
    const accent = accentOf(light, dark);
    if (accent) vars['--accent-color'] = accent;
    vars['color-scheme'] = light && dark ? 'light dark' : light ? 'light' : 'dark';
    classes.push('palette');
    if (accent) classes.push('palette-accent');
  }
  return { classes, vars };
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
  const { light, dark } = theme.palette ?? {};
  const preview = { ...DEFAULT_PREVIEW };
  if (light || dark) {
    for (const [key] of PALETTE_KEYS) {
      preview[key] = light && dark ? `light-dark(${light[key]}, ${dark[key]})` : (light ?? dark)![key];
    }
  }
  const accent = accentOf(light, dark);
  if (accent) preview.accent = accent;
  if (theme.background) preview.background = theme.background;
  else if (theme.backgroundImage) preview.background = `url('${theme.backgroundImage}') center / cover`;
  return preview;
}

const themes: Record<string, Theme> = {
  default: {
    glass: false,
  },
  glass: {
    glass: true,
    background: 'radial-gradient(circle, light-dark(#d2dbe5, #484f57) 0%, light-dark(#718ea7, #23384b) 100%) 0 0',
  },
  space: {
    glass: true,
    backgroundImage: '/static/assets/themes/space.jpg',
  },
  custom: {
    glass: false,
  },
};

export default themes;
