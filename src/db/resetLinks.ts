import db from '.';
import api from '../api';
import { Item } from '../api/models/item';
import { executeQuery } from '../api/utils';
import readline from 'readline';

async function main() {
  await executeQuery('DELETE FROM itemlink');
  const items = await executeQuery(`
    SELECT item.id, item.obj_data, universe.shortname as universe_short
    FROM item
    INNER JOIN universe ON universe.id = item.universe_id
  `) as Item<string>[];
  console.log(`Resetting links for ${items.length} items.`);
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    console.log(`Resetting... (${i}/${items.length})`);
    const objData = JSON.parse(item.obj_data);
    if (objData.body) {
      await api.item.handleLinks(item, objData);
    }
    readline.moveCursor(process.stdout, 0, -1);
  }
  console.log(`Resetting... (${items.length}/${items.length})`);
  db.end();
}

if (require.main === module) {
  main();
}
