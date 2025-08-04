import { RouteHandler } from '..';

import misc from './misc';
import user from './user';
import item from './item';
import story from './story';
import universe from './universe';

type PageCategory = 'misc' | 'user' | 'item' | 'story' | 'universe';

const pages = {
  misc,
  user,
  item,
  story,
  universe,
} satisfies Record<PageCategory, Record<string, RouteHandler>>;

export default pages;
