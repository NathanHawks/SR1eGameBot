const {Database} = require('./db');
const {ObjectId} = require('mongodb');
const StreamZip = require('node-stream-zip');
const {logWrite, logError} = require('./log');
const zip = new StreamZip({file: './UserData.zip'});
/* =================================================== LEGACY CODE ========== */
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
global.folderID = {UserData: null}
/* ================================================== MICGRATION CODE ======= */
async function _subObjects(a, i=0, fullPath=null, isFile=false) {
  const r = {};
  r.name = a[i];
  if (a.length > i+1 && a[i+1] !== '') r.sub = await _subObjects(a, i+1, fullPath, isFile);
  else if (isFile === true && fullPath !== null) {
    r.name = r.name.replace('.txt', '');
    r.content = zip.entryDataSync(fullPath).toString();
    r.content = r.content.substr(0, r.content.length-2);
  }
  return r;
}
async function parseZipData() {
  const entries = zip.entries();
  const folders = {}, files = {};
  for (const e of Object.values(entries)) {
    const a = e.name.split('/');
    if (e.isDirectory) {
      // all paths begin with UserData
      const root = a.shift();
      if (!folders[root]) folders[root] = [];
      folders[root].push( await _subObjects(a) );
    }
    else {
      // it's a file
      const root = a.shift();
      if (!files[root]) files[root] = [];
      files[root].push( await _subObjects(a, 0, e.name, true) );
    }
  }
  zip.close();
  return {folders, files};
}
async function makePath(e, p) {
  if (!e.hasOwnProperty('content')) {
    const c = await findFolderByName(e.name, p);
    if (!c) await createFolder(e.name, p);
  }
  if (e.sub) {
    const f = await findFolderByName(e.name, p);
    const newP = f._id.toString();
    const newE = e.sub;
    await makePath(newE, newP);
  }
  if (e.hasOwnProperty('content')) {
    const text = e.content;
    await setStringByNameAndParent(e.name, p, text);
  }
}
/* ===================================================== v0.3 CODE ========== */
async function createFolder(
  folderName,
  parentID=null,
) {
  try {
    const doc = { name: folderName };
    if (parentID !== null) doc.parent = ObjectId(parentID);
    await Database.getTable("folders").insertOne(doc);
  }
  catch (e) { logError(e); }
}
async function setStringByNameAndParent(filename, parentFolderID, contents) {
  try {
    await Database.getTable("strings").updateOne(
      {$and: [ {name: filename}, {parent: ObjectId(parentFolderID)} ]},
      {$set: { content: contents, name: filename, parent: ObjectId(parentFolderID) }},
      {upsert: true}
    );
  }
  catch (e) { logError(e); }
}
async function findFolderByName(
  folderName,
  parentID=null,
  callback=(c) => { c; },
) {
  if (parentID === -1) {
    logWrite(`findFolderByName: parentID was -1, `
      + `folderName was ${folderName}, channel was ${channelID}`);
    return -1;
  }
  const query = { $and: [{name: folderName}] };
  if (parentID !== null) query.$and.push({parent: ObjectId(parentID)});
  try {
    const c = await Database.getTable("folders").findOne(query);
    callback(c);
    return c;
  }
  catch (e) { logError(e); }
}
async function migrate() {
  logWrite(``);
  logWrite(`|||||||||||||||||||| IMPORTANT!!!!!!!!!!!! ||||||||||||||||||||`);
  logWrite(`MIGRATING DATA FROM GOOGLE DRIVE DOWNLOADED ZIP FILE!`);
  logWrite(`DOING THIS MULTIPLE TIMES WILL RESULT IN DUPLICATE/BROKEN DATA!`);
  logWrite(`Press Ctrl-C NOW to cancel`);
  logWrite(`|||||||||||||||||||| IMPORTANT!!!!!!!!!!!! ||||||||||||||||||||`);
  logWrite(``);
  logWrite(`10 seconds until migragion begins.`);
  await sleep(10000);
  logWrite(`Proceeding with data migration...`);
  const {folders, files} = await parseZipData();
  // Ensure UserData folder
  let userDataFolder = await findFolderByName('UserData');
  if (!userDataFolder) {
    await createFolder('UserData');
    userDataFolder = await findFolderByName('UserData');
  }
  global.folderID.UserData = userDataFolder._id.toString();
  // Import folders first
  let u = folders.UserData;
  logWrite(`Folder count: ${u.length}`);
  for (let i = 0; i < u.length; i++) {
    const e = u[i];
    const p = userDataFolder._id.toString();
    await makePath(e, p);
  }
  // Import files
  u = files.UserData;
  logWrite(`Files count: ${u.length}`);
  for (let i = 0; i < u.length; i++) {
    const e = u[i];
    const p = userDataFolder._id.toString();
    await makePath(e, p);
  }
}
zip.on('ready', async () => {
  await migrate();
  process.exit();
});
