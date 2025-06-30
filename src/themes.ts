export type Theme = {
  glass: boolean,
  background?: string,
  backgroundImage?: string,
};

const themes = {
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
} satisfies Record<string, Theme>;

export default themes;
