import { PageHandler } from '..';
import api from '../../api';
import { perms, Cond } from '../../api/utils';

import misc from './misc';
import user from './user';
import item from './item';
import story from './story';
import universe from './universe';

type PageCategory = 'misc' | 'user' | 'item' | 'story' | 'universe';

const pages: Record<PageCategory, Record<string, PageHandler>> = {
  misc,
  user,
  item,
  story,
  universe,
};

export default pages;
