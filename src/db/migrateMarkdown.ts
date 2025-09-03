import { generateJSON } from '@tiptap/html/server';
import readline from 'readline';
import db from '.';
import { GalleryImage } from '../api/models/item';
import { executeQuery } from '../api/utils';
import { editorExtensions } from '../lib/editor';
import { renderMarkdown } from '../lib/markdownRender';
import { jsonToIndexed } from '../lib/tiptapHelpers';

async function main() {
  const items = await executeQuery(`
    SELECT item.id, item.shortname, item.obj_data, universe.shortname as universe_short
    FROM item
    INNER JOIN universe ON universe.id = item.universe_id
  `);
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const objData = JSON.parse(item.obj_data);
    if (typeof objData.body !== 'string') continue;
    console.log(`Migrating... (${i}/${items.length})`);

    const gallery = await executeQuery(`
      SELECT
        image.id, image.name, itemimage.label
      FROM itemimage
      INNER JOIN image ON image.id = itemimage.image_id
      WHERE itemimage.item_id = ?
    `, [item.id]) as GalleryImage[];

    const html = await renderMarkdown(item.universe_short, objData.body, { item: { ...item, obj_data: objData, gallery } });
    const json = generateJSON(html, editorExtensions(false));
    const indexed = jsonToIndexed(json);
    objData.body = indexed;
    await executeQuery('UPDATE item SET obj_data = ? WHERE id = ?', [JSON.stringify(objData), item.id]);
    readline.moveCursor(process.stdout, 0, -1);
  }
  console.log(`Migrated ${items.length} items to JSON.`);

  const chapters = await executeQuery(`
    SELECT sc.id, sc.chapter_number, sc.body, universe.shortname as universe_short
    FROM storychapter AS sc
    INNER JOIN story ON story.id = sc.story_id
    INNER JOIN universe ON universe.id = story.universe_id
  `);
  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];
    if (typeof chapter.body !== 'string') continue;
    console.log(`Migrating... (${i}/${items.length})`);

    const html = await renderMarkdown(chapter.universe_short, chapter.body, {});
    const json = generateJSON(html, editorExtensions(false));
    const indexed = jsonToIndexed(json);
    await executeQuery('UPDATE storychapter SET body = ? WHERE id = ?', [JSON.stringify(indexed), chapter.id]);
    readline.moveCursor(process.stdout, 0, -1);
  }
  console.log(`Migrated ${chapters.length} chapters to JSON.`);

  db.end();
}

if (require.main === module) {
  main();
}
