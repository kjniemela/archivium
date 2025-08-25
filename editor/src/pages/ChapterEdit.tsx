import { useEditor } from '@tiptap/react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import type { Chapter, Story } from '../../../src/api/models/story';
import { editorExtensions, extractLinkData, type LinkData, type TiptapContext } from '../../../src/lib/editor';
import { indexedToJson, jsonToIndexed } from '../../../src/lib/tiptapHelpers';
import EditorFrame from '../components/EditorFrame';
import SaveBtn from '../components/SaveBtn';
import { BulkExistsFetcher, fetchAsync, fetchData, T } from '../helpers';

export type ItemEditProps = {
  universeLink: (universe: string) => string,
};

const itemExistsCache: { [universe: string]: { [item: string]: boolean } } = {};

export default function ChapterEdit({ universeLink }: ItemEditProps) {
  const { storyShort, chapterIndex } = useParams();

  if (!storyShort || !chapterIndex) return;

  const [initContent, setInitContent] = useState<any | null>(null);
  const [story, setStory] = useState<Story | null>(null);
  const [chapter, setChapter] = useState<Chapter | null>(null);

  const context: TiptapContext = {
    currentUniverse: story?.universe_short ?? '',
    universeLink,
    itemExists(universe, item): boolean {
      return (itemExistsCache[universe] ?? {})[item] ?? false;
    },
    headings: [],
  };
  
  const editor = useEditor({
    extensions: editorExtensions(true, context),
    onUpdate: ({ editor }) => {
      if (!chapter) return;
      const json = editor.getJSON();
      const indexed = jsonToIndexed(json);
      setChapter({ ...chapter, body: indexed });
    },
  });

  useEffect(() => {
    fetchData(`/api/stories/${storyShort}/${chapterIndex}`, async (chapterData: Chapter) => {
      const storyData = await fetchAsync(`/api/stories/${storyShort}`) as Story;
      if (chapterData.body) {
        const links: LinkData[] = [];
        const json = indexedToJson(chapterData.body, (href) => links.push(extractLinkData(href)));
        const bulkFetcher = new BulkExistsFetcher();
        const fetchPromises = links.map(async (link) => {
          if (link.item) {
            const universe = link.universe ?? storyData.universe_short;
            if (!(universe in itemExistsCache)) {
              itemExistsCache[universe] = {};
            }
            if (!(link.item in itemExistsCache[universe])) {
              itemExistsCache[universe][link.item] = await bulkFetcher.exists(universe, link.item);
            }
          }
        });
        bulkFetcher.fetchAll();
        await Promise.all(fetchPromises);
        setInitContent(json);
      }
      setStory(storyData);
      setChapter(chapterData);
    });
  }, [storyShort, chapterIndex]);

  useEffect(() => {
    if (editor && initContent) {
      editor.commands.setContent(initContent);
    }
  }, [editor, initContent]);

  /* Loading Screen */
  if (!story || !chapter) {
    return <div className='d-flex justify-center align-center'>
      <div className='loader' style={{ marginTop: 'max(0px, calc(50vh - 50px - var(--page-margin-top)))' }}></div>
    </div>;
  }

  return (
    <>
      {/* Editor Page */}
      <div className='d-flex justify-between align-baseline'>
        <h2>{T('Edit %s', chapter.title)}</h2>
        <a className='link link-animated color-error' href={`/stories/${story.shortname}/${chapter.chapter_number}`}>{T('Discard Changes')}</a>
      </div>
      <div id='edit' className='form-row-group'>
        <div className='inputGroup'>
          <label htmlFor='title'>{T('Title')}</label>
          <input id='title' type='text' name='title' value={chapter.title} onChange={({ target }) =>
            setChapter({ ...chapter, title: target.value })
          } />
        </div>

        <div className='inputGroup'>
          <label htmlFor='comments'>{T('Published')}:</label>
          <label className='switch'>
            <input id='comments' name='comments' type='checkbox' checked={chapter.is_published} onChange={({ target }) =>
              setChapter({ ...chapter, is_published: target.checked })
            } />
            <span className='slider'></span>
          </label>
        </div>

        <div className='inputGroup'>
          <small style={{ gridColumn: '2 / 4' }}>
            <i>{T('NOTE: other users currently editing this item will be unable to save their work. Change with caution.')}</i>
          </small>
        </div>

        <div className='mt-2'>
          <SaveBtn<Chapter>
            data={chapter}
            saveUrl={`/api/stories/${story.shortname}/${chapter.chapter_number}`}
          />
        </div>

        <hr className='w-100 mb-0' />
        
        <EditorFrame editor={editor} getLink={async (previousUrl, type) => {
          const url = window.prompt('URL', previousUrl);
          if (url?.startsWith('@')) {
            if (type === 'link') {
              const link = extractLinkData(url);
              if (link.item) {
                const universe = link.universe ?? story.universe_short;
                if (!(universe in itemExistsCache)) {
                  itemExistsCache[universe] = {};
                }
                if (!(link.item in itemExistsCache[universe])) {
                  const existsFetcher = new BulkExistsFetcher();
                  const fetchPromise = existsFetcher.exists(universe, link.item);
                  existsFetcher.fetchAll();
                  itemExistsCache[universe][link.item] = await fetchPromise;
                }
              }
            }
          }
          return [url];
        }} />
      </div>
    </>
  );
}
