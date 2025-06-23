const mysql = require('mysql2/promise');
const { DB_CONFIG } = require('../../config');
const { loadSchema, askQuestion } = require('../import');
const api = require('../../api');
const { perms } = require('../../api/utils');
const db = require('..');
const { defaultUniverseData, defaultItemData } = require('./defaults');

async function createUser(username, email, password) {
  if (!email) email = `${username}@archivium.net`;
  if (!password) password = username;
  const data = await api.user.post({ username, email, password });
  const [_, user] = await api.user.getOne({ 'user.id': data.insertId });
  return user;
}

async function createContact(requester, target, accept=true) {
  await api.contact.post(requester, target.username);
  if (accept) {
    await api.contact.put(requester, target.username, true);
  }
}

async function createUniverse(owner, title, shortname, public=true, discussion_enabled=false, discussion_open=false) {
  const [, data] = await api.universe.post(owner, { title, shortname, public, discussion_enabled, discussion_open, obj_data: defaultUniverseData });
  const [, universe] = await api.universe.getOne(owner, { 'universe.id': data[0].insertId });
  return universe;
}

async function createStory(owner, title, shortname, summary, public, universe) {
  const [, data] = await api.story.post(owner, { title, shortname, summary, public, universe: universe.shortname });
  const [, story] = await api.story.getOne(owner, { 'story.id': data.insertId });
  return story;
}

async function createChapter(owner, story, title, summary, body='', isPublished=false) {
  const [,, index] = await api.story.postChapter(owner, story.shortname, { title, summary });
  const [, chapter] = await api.story.getChapter(owner, story.shortname, index);
  await api.story.putChapter(owner, story.shortname, chapter.chapter_number, { is_published: isPublished, body });
  return chapter;
}

async function setUniversePerms(owner, universe, user, permsLvl) {
  await api.universe.putPermissions(owner, universe.shortname, user, permsLvl);
}

async function createItem(owner, universe, title, shortname, item_type, obj_data, tags=['testing'], parent_id=null) {
  const [, data] = await api.item.post(owner, { title, shortname, item_type, parent_id, obj_data: {} }, universe.shortname);
  await api.item.save(owner, universe.shortname, shortname, { title, tags, obj_data }, true);
  const [, item] = await api.item.getOne(owner, { 'item.id' : data.insertId });
  return item;
}

async function setFollowingUniverse(follower, universe, isFollowing=true) {
  await api.universe.putUserFollowing(follower, universe.shortname, isFollowing);
}

async function createDiscussionThread(poster, universe, title) {
  const [, data] = await api.discussion.postUniverseThread(poster, universe.shortname, { title });
  const [, threads] = await api.discussion.getThreads(poster, { 'discussion.id': data.insertId });
  return threads[0];
}

async function postComment(poster, thread, comment) {
  await api.discussion.postCommentToThread(poster, thread.id, { body: comment });
}

async function createNote(owner, title, body, public, tags, items=[], boards=[]) {
  const [,, uuid] = await api.note.post(owner, { title, body, public, tags });
  const [, note] = await api.note.getOne(owner, uuid);
  for (const item of items) {
    await api.note.linkToItem(owner, item.universe_short, item.shortname, uuid);
  }
  return note;
}

async function main() {
  const schemaConn = await mysql.createConnection({ ...DB_CONFIG, multipleStatements: true });
  await loadSchema(schemaConn, false);

  console.log('Generating testing database...');

  const loremIpsum = `
    Lorem ipsum odor amet, consectetuer adipiscing elit. Eleifend pellentesque eu; ipsum hendrerit facilisis luctus mauris netus.
    Varius curabitur amet vel donec sed nullam. Vestibulum eget facilisi conubia montes scelerisque curae augue odio.
    Facilisi elit velit erat nunc sem eu finibus finibus. Rutrum nec aliquet est montes laoreet fusce egestas.
    Habitasse velit nec aenean aliquam mi dictum. Donec faucibus aliquam duis viverra amet lacus sit penatibus.
  `.split('\n').map(line => line.trim()).join(' ').trim();

  const loremIpsumLong = `
    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Curabitur facilisis neque risus, eget interdum diam sagittis et. Etiam a gravida ex. Phasellus mattis metus quis augue feugiat iaculis. Nullam interdum laoreet odio, vel tempus neque. Praesent quis semper sapien, et eleifend odio. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas metus ex, iaculis at congue ut, placerat sed sem. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Donec euismod laoreet est in aliquet. Phasellus sit amet nulla nisi. Maecenas in venenatis elit. Sed sed feugiat risus.

    Quisque lacus orci, gravida volutpat libero semper, elementum placerat dui. Ut tempus felis ac ante faucibus, a volutpat massa elementum. Quisque sagittis massa at eros malesuada interdum. Nulla viverra urna nec vehicula interdum. Cras malesuada ornare ligula, a commodo odio finibus eu. Cras malesuada, ligula nec venenatis convallis, est augue maximus justo, tincidunt auctor orci justo nec ante. Cras eu semper lorem, vitae fringilla felis. Donec placerat volutpat egestas. Nullam egestas dictum risus aliquet aliquet. Morbi eu nibh quis dolor posuere tincidunt accumsan in diam. Nam eleifend leo nec consectetur rutrum. Nullam at feugiat justo. Sed et ipsum ex. Donec nulla enim, suscipit non blandit non, porttitor ut orci. Sed gravida felis in porttitor faucibus. Nullam ultrices purus tincidunt, ullamcorper tellus eu, dapibus tortor.

    Mauris ut mi neque. Duis felis turpis, malesuada at tempus et, interdum nec orci. Nullam dolor sapien, finibus eu sem non, semper aliquam neque. Nullam quis mauris sed massa tincidunt iaculis. Suspendisse lacus nulla, vulputate a gravida vel, tempus quis dolor. Cras a metus vel neque bibendum consectetur sit amet pretium justo. Aenean ac lobortis quam. Sed tempor consectetur mi id ultricies. Sed et commodo risus. Nam lobortis vulputate lectus ut elementum. Phasellus diam arcu, efficitur vitae urna ac, semper bibendum sapien. Etiam condimentum finibus lectus ac tristique. In at sem laoreet, ullamcorper enim id, porttitor enim.

    Morbi ultricies rutrum facilisis. Duis et lacinia est. Phasellus ultricies eros ut nulla aliquet, scelerisque laoreet magna condimentum. Pellentesque ornare augue a ultricies cursus. Pellentesque fringilla, tortor eget mattis posuere, metus eros iaculis ligula, eu malesuada erat lectus id turpis. Integer volutpat maximus ornare. Nullam at mauris arcu. Nulla consequat magna accumsan nibh convallis porta. Cras vel neque eu nisi congue rutrum nec ac turpis. Quisque in nulla vehicula, efficitur dolor congue, fringilla diam. Vivamus magna libero, molestie ac feugiat eu, mattis vel dui. Praesent fermentum massa eget suscipit rutrum. Proin purus dui, mattis sed libero at, ornare faucibus magna. Pellentesque magna eros, facilisis eget nisl varius, feugiat auctor libero. Proin vitae cursus metus.

    Nam tortor dui, pretium et metus eget, posuere ornare erat. Curabitur convallis nisl consectetur, viverra massa sit amet, pellentesque urna. Morbi quis consectetur massa. Pellentesque nec efficitur sem. Morbi vel porttitor massa. Vivamus efficitur eros ligula, sit amet faucibus risus posuere vel. Phasellus diam justo, maximus quis varius in, consequat sed tellus. Curabitur et viverra magna, ac tempor dui. Donec a lacinia lacus, sed blandit eros.
  `.split('\n').map(line => line.trim()).join('\n').trim();

  console.log('Creating users...');
  const users = {};
  for (const user of ['user', 'owner', 'admin', 'writer', 'commenter', 'reader']) {
    const username = `test${user}`;
    users[username] = await createUser(username);
  }
  
  console.log('Creating contacts...');
  await createContact(users.testadmin, users.testuser, false);
  await createContact(users.testadmin, users.testwriter);
  await createContact(users.testadmin, users.testcommenter);
  await createContact(users.testadmin, users.testreader);
  
  console.log('Creating universes...');
  const publicUniverse = await createUniverse(users.testowner, 'Public Test Universe', 'public-test-universe', true);
  const privateUniverse = await createUniverse(users.testowner, 'Private Test Universe', 'private-test-universe', false, true);
  const chatroomUniverse = await createUniverse(users.testowner, 'Chatroom', 'chatroom', true, true, true);

  console.log('Setting permissions...');
  await setUniversePerms(users.testowner, publicUniverse, users.testadmin, perms.ADMIN);
  await setUniversePerms(users.testowner, privateUniverse, users.testadmin, perms.ADMIN);
  await setUniversePerms(users.testowner, chatroomUniverse, users.testadmin, perms.ADMIN);
  await setUniversePerms(users.testadmin, publicUniverse, users.testwriter, perms.WRITE);
  await setUniversePerms(users.testadmin, privateUniverse, users.testwriter, perms.WRITE);
  await setUniversePerms(users.testadmin, privateUniverse, users.testcommenter, perms.COMMENT);
  await setUniversePerms(users.testadmin, privateUniverse, users.testreader, perms.READ);
  await setUniversePerms(users.testowner, chatroomUniverse, users.testuser, perms.ADMIN);

  console.log('Creating items...');
  const testArticle = await createItem(users.testwriter, publicUniverse, 'Test Article', 'test-article', 'article', defaultItemData.article);
  const testParent = await createItem(users.testwriter, publicUniverse, 'Test Parent', 'test-parent', 'character', defaultItemData.character(1));
  const testChild = await createItem(users.testwriter, publicUniverse, 'Test Child', 'test-child', 'character', defaultItemData.character(47));
  const testCharacter = await createItem(
    users.testwriter,
    publicUniverse,
    'Test Character',
    'test-character',
    'character',
    defaultItemData.character(25, testParent, testChild),
  );
  const testEvent = await createItem(users.testwriter, publicUniverse, 'Test Event', 'test-event', 'event', defaultItemData.event);
  const testTimeline = await createItem(users.testwriter, publicUniverse, 'Test Timeline', 'test-timeline', 'timeline', defaultItemData.timeline([
    testEvent, testCharacter, testParent, testChild,
  ]));

  console.log('Following universes...');
  await setFollowingUniverse(users.testadmin, publicUniverse);
  await setFollowingUniverse(users.testadmin, privateUniverse);
  await setFollowingUniverse(users.testadmin, chatroomUniverse);

  console.log('Writing stories...');
  const publicStory1 = await createStory(users.testwriter, 'Public Story', 'public-story-1', loremIpsum, true, publicUniverse);
  const privateStory1 = await createStory(users.testwriter, 'Private Story', 'private-story-1', loremIpsum, true, privateUniverse);
  const publicStory2 = await createStory(users.testwriter, 'Public Story Hidden', 'public-story-2', loremIpsum, false, publicUniverse);
  const privateStory2 = await createStory(users.testwriter, 'Private Story Hidden', 'private-story-2', loremIpsum, false, privateUniverse);
  const publicDraftStory1 = await createStory(users.testwriter, 'Public Draft Story', 'public-draft-story-1', loremIpsum, true, publicUniverse);
  const privateDraftStory1 = await createStory(users.testwriter, 'Private Draft Story', 'private-draft-story-1', loremIpsum, true, privateUniverse);
  const publicDraftStory2 = await createStory(users.testwriter, 'Public Draft Story Hidden', 'public-draft-story-2', loremIpsum, false, publicUniverse);
  const privateDraftStory2 = await createStory(users.testwriter, 'Private Draft Story Hidden', 'private-draft-story-2', loremIpsum, false, privateUniverse);
  for (const story of [publicStory1, privateStory1, publicStory2, privateStory2]) {
    for (let i = 0; i < 30; i++) {
      await createChapter(users.testwriter, story, `Chapter ${i+1}`, `This is a summary of chapter ${i+1} of ${story.title}`, loremIpsumLong, i < 13);
    }
  }
  for (const story of [publicDraftStory1, privateDraftStory1, publicDraftStory2, privateDraftStory2]) {
    for (let i = 0; i < 7; i++) {
      await createChapter(users.testwriter, story, `Chapter ${i+1}`, `This is a summary of chapter ${i+1} of ${story.title}`, loremIpsumLong, false);
    }
  }

  console.log('Creating threads...');
  const privateThread = await createDiscussionThread(users.testcommenter, privateUniverse, 'Private Test Thread');
  const chatroomThread = await createDiscussionThread(users.testcommenter, chatroomUniverse, 'Chatroom Thread');

  console.log('Posting comments...');
  await postComment(users.testcommenter, privateThread, 'Test question?');
  await postComment(users.testadmin, privateThread, 'Test answer.');
  await postComment(users.testuser, chatroomThread, 'Hello world!');
  await postComment(users.testreader, chatroomThread, loremIpsum);
  await postComment(users.testcommenter, chatroomThread, 'Test comment.');
  await postComment(users.testwriter, chatroomThread, '# Markdown test\n- **bold**\n- *italics*\n- etc.');

  console.log('Creating notes...');
  await createNote(users.testwriter, 'Public Test Note', loremIpsum, true, ['test', 'public']);
  await createNote(users.testwriter, 'Public Article Note', loremIpsum, true, ['article', 'public'], [testArticle]);
  await createNote(users.testwriter, 'Private Test Note', loremIpsum, false, ['test', 'private']);
  await createNote(users.testwriter, 'Private Article Note', loremIpsum, false, ['article', 'private'], [testArticle]);

  schemaConn.end();
  db.end();
}
if (require.main === module) {
  main();
}
