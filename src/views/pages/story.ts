import { renderToHTMLString } from '@tiptap/static-renderer/pm/html-string';
import sanitizeHtml from 'sanitize-html';
import { RouteHandler } from '..';
import api from '../../api';
import { Comment } from '../../api/models/discussion';
import { User } from '../../api/models/user';
import { getPfpUrl, perms } from '../../api/utils';
import { ADDR_PREFIX } from '../../config';
import { NotFoundError } from '../../errors';
import { editorExtensions, extractLinkData, LinkData, TiptapContext } from '../../lib/editor';
import { IndexedDocument, indexedToJson } from '../../lib/tiptapHelpers';
import { T } from '../../locale';
import logger from '../../logger';
import { universeLink } from '../../templates';

export default {
  async list(req, res) {
    const search = req.getQueryParam('search');
    const stories = await api.story.getMany(
      req.session.user,
      null,
      perms.READ,
      {
        sort: req.getQueryParam('sort'),
        sortDesc: req.getQueryParam('sort_order') === 'desc',
        search,
      },
    );
    res.prepareRender('storyList', { stories, search });
  },

  async create(req, res) {
    const universes = await api.universe.getMany(req.session.user, null, perms.WRITE);
    res.prepareRender('createStory', { universes });
  },
  
  async view(req, res) {
    const story = await api.story.getOne(req.session.user, { 'story.shortname': req.params.shortname });
    res.prepareRender('story', { story });
  },

  async delete(req, res) {
    try {
      const story = await api.story.getOne(req.session.user, { 'story.shortname': req.params.shortname }, perms.OWNER);
      res.prepareRender('deleteStory', { story });
    } catch (err) {
      if (err instanceof NotFoundError) {
        return res.redirect(`${ADDR_PREFIX}/stories`);
      }
      throw err;
    }
  },

  async edit(req, res) {
    const fetchedStory = await api.story.getOne(req.session.user, { 'story.shortname': req.params.shortname }, perms.WRITE);
    const story = {...fetchedStory, ...(req.body ?? {}), shortname: fetchedStory.shortname, newShort: req.body?.shortname ?? fetchedStory.shortname};
    res.prepareRender('editStory', { story, error: res.error });
  },

  async createChapter(req, res) {
    const story = await api.story.getOne(req.session.user, { 'story.shortname': req.params.shortname });

    const title = `${T('Untitled Chapter')} ${story.chapter_count + 1}`;
    const [, index] = await api.story.postChapter(req.session.user, story.shortname, { title });
    return res.redirect(`${ADDR_PREFIX}/editor/stories/${story.shortname}/${index}`);
  },
  
  async viewChapter(req, res) {
    const story = await api.story.getOne(req.session.user, { 'story.shortname': req.params.shortname });
    const chapter = await api.story.getChapter(req.session.user, story.shortname, Number(req.params.index));
    const [comments, commentUsers] = await api.discussion.getCommentsByChapter(chapter.id, true) as [Comment[], User[]];
    const commenters = {};
    for (const user of commentUsers) {
      user.pfpUrl = getPfpUrl(user);
      delete user.email;
      commenters[user.id] = user;
    }

    let renderedBody: { type: string, content: any };
    try {
      const links: LinkData[] = [];
      const headings: { title: string, level: number }[] = [];
      const jsonBody = indexedToJson(
        chapter.body as IndexedDocument,
        (href) => links.push(extractLinkData(href)),
        (title, level) => headings.push({ title, level }),
      );
      const itemsPerUniverse = {};
      /* Because Tiptap rendering cannot be async, we extract the links we'll need to check ahead of time. */
      await Promise.all(links.map(async (link) => {
        if (link.item) {
          const universeShort = link.universe ?? story.universe_short;
          if (!(universeShort in itemsPerUniverse)) {
            itemsPerUniverse[universeShort] = {};
          }
          if (!(link.item in itemsPerUniverse[universeShort])) {
            itemsPerUniverse[universeShort][link.item] = await api.item.exists(req.session.user, universeShort, link.item);
          }
        }
      }));
      const renderContext: TiptapContext = {
        currentUniverse: story.universe_short,
        universeLink: (universeShort) => universeLink(req, universeShort),
        itemExists: (universe, item) => (universe in itemsPerUniverse) && itemsPerUniverse[universe][item],
        headings,
      };
      const htmlBody = renderToHTMLString({ extensions: editorExtensions(false, renderContext), content: jsonBody });
      const sanitizedHtml = sanitizeHtml(htmlBody, {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
        allowedAttributes: {
          ...sanitizeHtml.defaults.allowedAttributes,
          img: ['src', 'alt', 'title', 'width', 'height'],
          h1: ['id'], h2: ['id'], h3: ['id'], h4: ['id'], h5: ['id'], h6: ['id'],
        },
        disallowedTagsMode: 'escape',
        allowedClasses: {
          '*': false,
        },
      });
      renderedBody = {
        type: 'html',
        content: sanitizedHtml,
      };
    } catch (err) {
      logger.error('Failed to parse chapter body:');
      logger.error(err);
      renderedBody = { type: 'text', content: chapter.body };
    }

    res.prepareRender('chapter', {
      story, chapter, comments, commenters, renderedBody,
      commentAction: `${ADDR_PREFIX}/stories/${story.shortname}/${chapter.chapter_number}/comment`,
    });
  },

  async deleteChapter(req, res) {
    try {
      const chapter = await api.story.getChapter(req.session.user, req.params.shortname, Number(req.params.index), perms.OWNER);
      res.prepareRender('deleteChapter', { chapter, storyShort: req.params.shortname });
    } catch (err) {
      if (err instanceof NotFoundError) {
        return res.redirect(`${ADDR_PREFIX}/stories/${req.params.shortname}`);
      }
      throw err;
    }
  },
} satisfies Record<string, RouteHandler>;
