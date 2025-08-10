export type Theme = {
  glass: boolean,
  background?: string,
  backgroundImage?: string,
};

export type ThemeName = keyof typeof themes;

const themes: Record<string, Theme> = {
  default: {
    glass: false,
  },
  glass: {
    glass: true,
    background: 'radial-gradient(circle, #d2dbe5 0%, #718ea7 100%) 0 0',
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
