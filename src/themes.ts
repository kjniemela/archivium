import { tiers } from './lib/tiers';
import type { Tier } from './lib/tiers';

export type Palette = {
  page: string,
  sheet: string,
  text: string,
  link: string,
  accent?: string,
};

export type Theme = {
  /** Minimum tier needed to use this theme (defaults to free). */
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

const themes: Record<string, Theme> = {
  default: {
    tier: tiers.FREE,
    glass: false,
  },
  glass: {
    tier: tiers.FREE,
    glass: true,
    background: 'radial-gradient(ellipse at 30% 0%, light-dark(#e6eef6, #3b4b5d) 0%, light-dark(#93abc3, #1f3347) 55%, light-dark(#7d97b2, #121d2a) 100%)',
    palette: {
      light: { page: '#d9e3ee', sheet: '#f4f8fc', text: '#13202c', link: '#154a7d' },
      dark: { page: '#2a3949', sheet: '#1d2935', text: '#e6edf4', link: '#7db6ee' },
    },
  },
  sepia: {
    tier: tiers.FREE,
    glass: false,
    palette: {
      light: { page: '#e4d6bd', sheet: '#f5eddd', text: '#43341f', link: '#7a4a1e' },
      dark: { page: '#2e261c', sheet: '#241d15', text: '#dccdb0', link: '#d6a574' },
    },
  },
  mono: {
    tier: tiers.FREE,
    glass: false,
    palette: {
      light: { page: '#e4e4e4', sheet: '#ffffff', text: '#111111', link: '#111111', accent: '#555555' },
      dark: { page: '#111111', sheet: '#1a1a1a', text: '#eeeeee', link: '#ffffff', accent: '#bbbbbb' },
    },
  },
  highcontrast: {
    tier: tiers.FREE,
    glass: false,
    palette: {
      light: { page: '#ffffff', sheet: '#ffffff', text: '#000000', link: '#0000cc', accent: '#b00020' },
      dark: { page: '#000000', sheet: '#000000', text: '#ffffff', link: '#ffff00', accent: '#00ffff' },
    },
  },

  // Palette themes
  // parchment: {
  //   tier: tiers.PREMIUM,
  //   glass: false,
  //   palette: {
  //     light: { page: '#e8dcc0', sheet: '#f6edd6', text: '#3b2f1e', link: '#8a3b12', accent: '#2a6f6b' },
  //     dark: { page: '#2b2316', sheet: '#211a10', text: '#eadcb9', link: '#e0a060', accent: '#7fb7a4' },
  //   },
  // },
  forest: {
    tier: tiers.PREMIUM,
    glass: false,
    palette: {
      light: { page: '#dce8d5', sheet: '#f3f8ef', text: '#1f3321', link: '#2b7034', accent: '#946016' },
      dark: { page: '#1b2a1e', sheet: '#142018', text: '#dcebd9', link: '#7fd38a', accent: '#e6b450' },
    },
  },
  // ocean: {
  //   tier: tiers.PREMIUM,
  //   glass: false,
  //   palette: {
  //     light: { page: '#d3e8f0', sheet: '#f2fafd', text: '#0b2e3f', link: '#096b8a', accent: '#b4452e' },
  //     dark: { page: '#0c2a3a', sheet: '#08202d', text: '#d6eef7', link: '#4fc3e8', accent: '#ff8a70' },
  //   },
  // },
  lavender: {
    tier: tiers.PREMIUM,
    glass: false,
    palette: {
      light: { page: '#e6e0f5', sheet: '#f7f4ff', text: '#2d2547', link: '#6d4bc4', accent: '#c22a5f' },
      dark: { page: '#261f3d', sheet: '#1c162e', text: '#ece6ff', link: '#b79bff', accent: '#ff7eb6' },
    },
  },
  // coffee: {
  //   tier: tiers.PREMIUM,
  //   glass: false,
  //   palette: {
  //     light: { page: '#d9c7b5', sheet: '#efe3d6', text: '#3a2619', link: '#7f441b', accent: '#25695d' },
  //     dark: { page: '#2a1d15', sheet: '#20150f', text: '#eadbc9', link: '#e0a370', accent: '#6fcfb8' },
  //   },
  // },
  // solarized: {
  //   tier: tiers.PREMIUM,
  //   glass: false,
  //   palette: {
  //     light: { page: '#eee8d5', sheet: '#fdf6e3', text: '#586e75', link: '#268bd2', accent: '#b7410e' },
  //     dark: { page: '#073642', sheet: '#002b36', text: '#93a1a1', link: '#2aa198', accent: '#e8743b' },
  //   },
  // },
  // nord: {
  //   tier: tiers.PREMIUM,
  //   glass: false,
  //   palette: {
  //     light: { page: '#e5e9f0', sheet: '#eceff4', text: '#2e3440', link: '#46688f', accent: '#a34a33' },
  //     dark: { page: '#3b4252', sheet: '#2e3440', text: '#eceff4', link: '#88c0d0', accent: '#ebcb8b' },
  //   },
  // },
  // sakura: {
  //   tier: tiers.PREMIUM,
  //   glass: false,
  //   palette: {
  //     light: { page: '#fbe3ea', sheet: '#fff6f8', text: '#4a2330', link: '#c2185b', accent: '#3f7536' },
  //     dark: { page: '#3a1f29', sheet: '#2b151d', text: '#ffe3ec', link: '#ff8fb5', accent: '#8fd48a' },
  //   },
  // },

  // midnight: {
  //   tier: tiers.PREMIUM,
  //   glass: false,
  //   palette: {
  //     light: { page: '#dfe3f5', sheet: '#f3f5fd', text: '#151a33', link: '#2f55c4', accent: '#8a5a00' },
  //     dark: { page: '#0f1220', sheet: '#171b2e', text: '#e6e8f5', link: '#8ab4ff', accent: '#f5c26b' },
  //   },
  // },
  // dracula: {
  //   tier: tiers.PREMIUM,
  //   glass: false,
  //   palette: {
  //     light: { page: '#ece8d6', sheet: '#fffbeb', text: '#1f1f1f', link: '#644ac9', accent: '#a3144d' },
  //     dark: { page: '#282a36', sheet: '#21222c', text: '#f8f8f2', link: '#bd93f9', accent: '#ff79c6' },
  //   },
  // },
  // ember: {
  //   tier: tiers.PREMIUM,
  //   glass: false,
  //   palette: {
  //     light: { page: '#f3dccd', sheet: '#fff4ec', text: '#3a1c12', link: '#aa3809', accent: '#0f766e' },
  //     dark: { page: '#1c1210', sheet: '#261715', text: '#ffe9dc', link: '#ff7a3d', accent: '#4fd1c5' },
  //   },
  // },
  // terminal: {
  //   tier: tiers.PREMIUM,
  //   glass: false,
  //   palette: {
  //     light: { page: '#dfe8d8', sheet: '#f4faef', text: '#0a3d14', link: '#0b6b25', accent: '#8a5a00' },
  //     dark: { page: '#000000', sheet: '#031a07', text: '#3cff6b', link: '#9dffb5', accent: '#ffb000' },
  //   },
  // },

  // Gradient themes
  // sunset: {
  //   tier: tiers.PREMIUM,
  //   glass: true,
  //   background: 'linear-gradient(160deg, light-dark(#ffd2a8, #4a1d3a) 0%, light-dark(#f58fa8, #1d1b3f) 100%)',
  //   palette: {
  //     light: { page: '#f6d9c8', sheet: '#fff4ec', text: '#3a1f1a', link: '#aa3809', accent: '#8e3b8f' },
  //     dark: { page: '#3b1d2b', sheet: '#2b1420', text: '#ffe6d9', link: '#ff9a62', accent: '#c58bff' },
  //   },
  // },
  aurora: {
    tier: tiers.PREMIUM,
    glass: true,
    background: 'linear-gradient(135deg, light-dark(#b9e6dc, #0b1d2e) 0%, light-dark(#8fd3c0, #0f4c4a) 45%, light-dark(#c9b8f0, #3b2a6e) 100%)',
    palette: {
      light: { page: '#d6ece6', sheet: '#f0faf7', text: '#0d2b33', link: '#09705b', accent: '#6b46c1' },
      dark: { page: '#12222e', sheet: '#0d1822', text: '#e3f6f1', link: '#6ee7c8', accent: '#b794f6' },
    },
  },
  // synthwave: {
  //   tier: tiers.PREMIUM,
  //   glass: true,
  //   background: 'linear-gradient(180deg, light-dark(#f7d6f0, #1a0b2e) 0%, light-dark(#e3a8e0, #3b0f5c) 60%, light-dark(#ff9ad8, #b3207f) 130%)',
  //   palette: {
  //     light: { page: '#f3d9f0', sheet: '#fff0fc', text: '#2e0f45', link: '#b0148f', accent: '#0e7490' },
  //     dark: { page: '#241240', sheet: '#1a0b2e', text: '#ffe6ff', link: '#ff4fd8', accent: '#22e8ff' },
  //   },
  // },
  lagoon: {
    tier: tiers.PREMIUM,
    glass: true,
    background: 'linear-gradient(150deg, light-dark(#c8f0f0, #062a35) 0%, light-dark(#8fd0e8, #0b4a63) 55%, light-dark(#a8b8f0, #1d2f6b) 100%)',
    palette: {
      light: { page: '#cfeef0', sheet: '#f1fbfc', text: '#0a2e38', link: '#0a6e8a', accent: '#b4472f' },
      dark: { page: '#0b3442', sheet: '#072430', text: '#dff4f7', link: '#5fd3e6', accent: '#ff9a7a' },
    },
  },
  meadow: {
    tier: tiers.PREMIUM,
    glass: true,
    background: 'linear-gradient(160deg, light-dark(#e6f4c8, #10261a) 0%, light-dark(#bfe3a0, #1b4d2e) 60%, light-dark(#f4e3a1, #4a4a1a) 100%)',
    palette: {
      light: { page: '#e4f0c8', sheet: '#f8fbec', text: '#22300f', link: '#3a6f1a', accent: '#a35a00' },
      dark: { page: '#1a3322', sheet: '#11261a', text: '#e4f2da', link: '#9be37a', accent: '#f2c14e' },
    },
  },
  // twilight: {
  //   tier: tiers.PREMIUM,
  //   glass: true,
  //   background: 'linear-gradient(180deg, light-dark(#ffd9c0, #1b1442) 0%, light-dark(#e9a8c8, #4b2a7a) 55%, light-dark(#a8a0e8, #c2548f) 130%)',
  //   palette: {
  //     light: { page: '#f4d3dc', sheet: '#fff3f6', text: '#35183a', link: '#7a3fb8', accent: '#a8321f' },
  //     dark: { page: '#2a1d55', sheet: '#1b1342', text: '#f2e8ff', link: '#c3a2ff', accent: '#ffb36b' },
  //   },
  // },
  // cottoncandy: {
  //   tier: tiers.PREMIUM,
  //   glass: true,
  //   background: 'linear-gradient(135deg, light-dark(#ffd1e8, #2a1636) 0%, light-dark(#d4c5ff, #1f2a5c) 50%, light-dark(#bfe6ff, #14475c) 100%)',
  //   palette: {
  //     light: { page: '#f6d6ee', sheet: '#fff4fb', text: '#3a1d3f', link: '#a01f7a', accent: '#0f6e8f' },
  //     dark: { page: '#2b1b45', sheet: '#1d1230', text: '#ffe9f7', link: '#ff8fd0', accent: '#7fdcff' },
  //   },
  // },
  // citrus: {
  //   tier: tiers.PREMIUM,
  //   glass: true,
  //   background: 'linear-gradient(145deg, light-dark(#fff2b0, #2a2208) 0%, light-dark(#ffd08a, #4d3208) 55%, light-dark(#ffb08a, #5a2210) 100%)',
  //   palette: {
  //     light: { page: '#fbe6a8', sheet: '#fffaea', text: '#3a2a05', link: '#a14a00', accent: '#2b6a1f' },
  //     dark: { page: '#3a2d0c', sheet: '#272006', text: '#fff0c8', link: '#ffb347', accent: '#8fe36a' },
  //   },
  // },
  // nebula: {
  //   tier: tiers.PREMIUM,
  //   glass: true,
  //   background: 'radial-gradient(ellipse at 20% 10%, light-dark(#e8d0ff, #4b2394) 0%, light-dark(#b8c8ff, #1c2160) 50%, light-dark(#ffc8e8, #0b0d2e) 100%)',
  //   palette: {
  //     light: { page: '#dccdf6', sheet: '#f6f1ff', text: '#231a47', link: '#5a35c7', accent: '#b0246a' },
  //     dark: { page: '#1b1a4a', sheet: '#11112f', text: '#e8e6ff', link: '#a9a2ff', accent: '#ff7ac0' },
  //   },
  // },

  // Image themes
  space: {
    tier: tiers.PREMIUM,
    glass: true,
    backgroundImage: '/static/assets/themes/space.jpg',
    credit: { text: 'Vecteezy', url: 'https://www.vecteezy.com/free-photos/earth' },
  },
  city: {
    tier: tiers.PREMIUM,
    glass: true,
    backgroundImage: '/static/assets/themes/chicago.jpg',
    credit: { text: 'Stephan Cassara', url: 'https://unsplash.com/@smsee?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText' },
    palette: {
      light: { page: '#d4dbec', sheet: '#f2f5fb', text: '#16203a', link: '#2d58b8', accent: '#a85d00' },
      dark: { page: '#1d2540', sheet: '#141a30', text: '#eaeefa', link: '#8fb4ff', accent: '#ffb347' },
    },
  },
  italy: {
    tier: tiers.PREMIUM,
    glass: true,
    backgroundImage: '/static/assets/themes/italy.jpg',
    credit: { text: 'Jonatan', url: 'https://archivium.net/users/jonatan' },
    palette: {
      light: { page: '#dfe5d0', sheet: '#f5f8ee', text: '#232c1b', link: '#3e6b2a', accent: '#9a4f22' },
      dark: { page: '#26301f', sheet: '#1a2116', text: '#e8eddc', link: '#a8d08a', accent: '#d9a066' },
    },
  },
  // aqua: {
  //   tier: tiers.PREMIUM,
  //   glass: true,
  //   backgroundImage: '/static/assets/themes/aqua.jpg',
  //   credit: { text: 'David Clode', url: 'https://unsplash.com/@davidclode?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText' },
  //   palette: {
  //     light: { page: '#acb7e3', sheet: '#e6ffe3', text: '#021d70', link: '#b3390b', accent: '#8f106a' },
  //     dark: { page: '#848f93', sheet: '#1b2038', text: '#e7f5ff', link: '#ceb032', accent: '#ff3ac7' },
  //   },
  // },
  fall: {
    tier: tiers.PREMIUM,
    glass: true,
    backgroundImage: '/static/assets/themes/fall.jpg',
    credit: { text: 'Lyndon Li', url: 'https://unsplash.com/@dynastywind?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText' },
    palette: {
      light: { page: '#f2d9c4', sheet: '#fff4ea', text: '#3b1a0c', link: '#a23608', accent: '#1d7a78' },
      dark: { page: '#3a1e12', sheet: '#2a140b', text: '#fbe9dc', link: '#ffa766', accent: '#6fc9c0' },
    },
  },
  pink: {
    tier: tiers.PREMIUM,
    glass: true,
    backgroundImage: '/static/assets/themes/pink.jpg',
    credit: { text: 'simon', url: 'https://unsplash.com/@simon_berger?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText' },
    palette: {
      light: { page: '#f6dbd6', sheet: '#fff5f2', text: '#3c1f33', link: '#b3265f', accent: '#0e6e8c' },
      dark: { page: '#3a2340', sheet: '#281830', text: '#fff0ea', link: '#ffa98a', accent: '#7fd0e8' },
    },
  },
  rain: {
    tier: tiers.PREMIUM,
    glass: true,
    backgroundImage: '/static/assets/themes/rain.jpg',
    credit: { text: 'Sreenivas', url: 'https://unsplash.com/@sree97?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText' },
    palette: {
      light: { page: '#d3e6d5', sheet: '#f2faf3', text: '#0e2415', link: '#1f6b32', accent: '#684420' },
      dark: { page: '#0f2417', sheet: '#08150e', text: '#e3f3e5', link: '#7fe08f', accent: '#f0b27a' },
    },
  },
  yellow: {
    tier: tiers.PREMIUM,
    glass: true,
    backgroundImage: '/static/assets/themes/yellow.jpg',
    credit: { text: 'Sergey Shmidt', url: 'https://unsplash.com/@monstercritic?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText' },
    palette: {
      light: { page: '#cfeaf0', sheet: '#f0fafc', text: '#0b2f3b', link: '#8c4600', accent: '#087a96' },
      dark: { page: '#0e3a4a', sheet: '#082a36', text: '#e8f6fa', link: '#ffc43d', accent: '#5fd3e6' },
    },
  },
  polaris: {
    tier: tiers.PREMIUM,
    glass: true,
    backgroundImage: '/static/assets/themes/polaris.jpg',
    credit: { text: 'Benjamin Voros', url: 'https://unsplash.com/@vorosbenisop?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText' },
    palette: {
      light: { page: '#b6c3c7', sheet: '#d3e0f4', text: '#1c3b45', link: '#7c068c', /*accent: '#1b608f'*/ },
      dark: { page: '#172c34', sheet: '#47595f', text: '#f2f9fd', link: '#df92c8', /*accent: '#5fb0ee'*/ },
    },
  },

  custom: {
    tier: tiers.PREMIUM,
    glass: false,
  },
};

/** Whether a user or universe at `tier` may use the built-in theme `name`. */
export function themeAvailable(name: string | null | undefined, tier: Tier): boolean {
  if (!name || !Object.prototype.hasOwnProperty.call(themes, name)) return false;
  return (themes[name].tier ?? tiers.FREE) <= tier;
}

export default themes;
