const {Database} = require('./db');
const {logWrite, logError} = require('./log');
const {getParentFolder, sleep, decrypt} = require('./api');
const {ObjectId} = require('mongodb');
const sysFolders = ['UserData','reminders','options'];

function isSysFolder(r) {
  if (sysFolders.indexOf(r.name) > -1) return true;
  else return false;
}
async function getDecryptedFullPath(r) {
  let fullpath = (isSysFolder(r)) ? r.name : decrypt(r.name);
  const p = await getParentFolder(r._id.toString());
  if (p) {
    fullpath = (isSysFolder(p)) ? `${p.name}/${fullpath}` : `${decrypt(p.name)}/${fullpath}`;
    const gp = await getParentFolder(p._id.toString());
    if (gp) {
      fullpath = (isSysFolder(gp)) ? `${gp.name}/${fullpath}` : `${decrypt(gp.name)}/${fullpath}`;
      const ggp = await getParentFolder(gp._id.toString());
      if (ggp) {
        fullpath = (isSysFolder(ggp)) ? `${ggp.name}/${fullpath}` : `${decrypt(ggp.name)}/${fullpath}`;
      }
    }
  }
  return fullpath;
}
async function fixDuplicates() {
  const userDataFolder = await Database.getTable("folders").findOne(
    {name: 'UserData'}
  );
  const dupeNames = Database.getTable("folders").aggregate([
    {"$group" : { "_id": "$name", "count": { "$sum": 1 } } },
    {"$match": {"_id" :{ "$ne" : null } , "count" : {"$gt": 1} } },
    {"$project": {"name" : "$_id", "_id" : 0} }
  ]);
  let expectedCount = 0;
  let dupeCount = 0;
  let dupeDeleted = 0;
  let stringsMoved = 0;
  let foldersMoved = 0;
  let checkingSubfolders = true;
  let checkingStrings = true;
  let checkingSubfolderStrings = true;
  let awaitStringQuery = true;
  let awaitSubfolderQuery = true;
  let awaitSubfolderStringQuery = true;
  let intentionallyKept = 0;
  let userFolders = 0;
  let stringNameConflicts = 0;
  let subfolderConflicts = 0;
  let dupeStringsDeleted = 0;
  let nullStringsDeleted = 0;
  let first = {};
  // count total duplicates (not counting 1 of each name)
  dupeNames.forEach(async (dupeName) => {
    const rowCount = await Database.getTable("folders").countDocuments(
      {name: dupeName.name}
    );
    expectedCount += rowCount-1;
  });
  dupeNames.forEach(async (dupeName) => {
    checkingSubfolders = true;
    checkingStrings = true;
    checkingSubfolderStrings = true;
    awaitStringQuery = true;
    awaitSubfolderQuery = true;
    awaitSubfolderStringQuery = true;
    const name = dupeName.name;
    const rows = Database.getTable("folders").find({name: name});
    rows.forEach(async (r) => {
      const fullpath = await getDecryptedFullPath(r);
      logWrite(`Checking for duplicates of ${fullpath}`);
      if (first[fullpath] === undefined) {
        first[fullpath] = r;
        return;
      }
      // if keepFolder is true we won't delete the entry
      let keepFolder = false;
      // get strings in duplicate folder
      const stringsCount = await Database.getTable("strings").countDocuments({
        parent: ObjectId(r._id.toString())
      });
      const strings = Database.getTable("strings").find({
        parent: ObjectId(r._id.toString())
      });
      if (stringsCount === 0) checkingStrings = false;
      else checkingStrings = true;
      awaitStringQuery = false;
      // loop strings
      strings.forEach(async (s) => {
        const dupeStrCt = await Database.getTable("strings").countDocuments(
          {$and: [{name: s.name}, {parent: ObjectId(first[fullpath]._id.toString())}]}
        );
        // if same string exists in first folder
        if (dupeStrCt > 0) {
          // try to resolve the conflict
          const firstString = await Database.getTable("strings").findOne(
            {$and: [{name: s.name}, {parent: ObjectId(first[fullpath]._id.toString())}]}
          );
          if (firstString.content === s.content) {
            logError(`Strings are identical: ${s.name}. Deleting duplicate`);
            Database.getTable("strings").deleteOne({_id: ObjectId(s._id.toString())});
            dupeStringsDeleted++;
          }
          else if (decrypt(s.content) === '') {
            logWrite('Empty duplicate string found; keeping the other one');
            Database.getTable("strings").deleteOne({_id: ObjectId(s._id.toString())});
            nullStringsDeleted++;
          }
          else if (decrypt(firstString.content) === '') {
            logWrite('Empty duplicate string found; keeping the other one');
            Database.getTable("strings").deleteOne({_id: ObjectId(firstString._id.toString())});
            nullStringsDeleted++;
          }
          else if (decrypt(r.name) === '360086569778020352') {
            // 360086569778020352 is me, and I don't care if I lose data
            Database.getTable("strings").deleteOne({_id: ObjectId(s._id.toString())});
            dupeStringsDeleted++;
          }
          else {
            // can't resolve the conflict
            let folderLabel = (r.label) ? `${decrypt(r.label)} (${decrypt(r.name)})` : decrypt(r.name);
            console.log(`======================================================`);
            logWrite(`Keeping duplicate folder ${folderLabel} (_id ${r._id}) because of string name conflict ${s.name} (_id ${s._id})`);
            logWrite(`Content of _id ${firstString._id}:`);
            console.log(decrypt(firstString.content));
            logWrite(`Content of _id ${s._id}:`);
            console.log(decrypt(s.content));
            console.log(`======================================================`);
            keepFolder = true;
            stringNameConflicts++;
          }
        }
        else {
          // else move string to first folder
          Database.getTable("strings").updateOne(
            {_id: ObjectId(s._id.toString())},
            {$set: {parent: ObjectId(first[fullpath]._id.toString())}}
          );
          stringsMoved++;
        }
        checkingStrings = false;
      });
      while (checkingStrings || awaitStringQuery) { await sleep(15); }
      // get subfolders in duplicate folder
      const sfCount = await Database.getTable("folders").countDocuments({
        parent: ObjectId(r._id.toString())
      });
      const subfolders = Database.getTable("folders").find({
        parent: ObjectId(r._id.toString())
      });
      if (sfCount === 0) checkingSubfolders = false;
      else checkingSubfolders = true;
      awaitSubfolderQuery = false;
      // fast track deletion if no strings or subfolders
      if (stringsCount === 0 && sfCount === 0) {
        dupeDeleted++;
        dupeCount++;
        Database.getTable("folders").deleteOne({_id: ObjectId(r._id.toString())});
        return;
      }
      // loop subfolders
      let sfProcessed = 0;
      subfolders.forEach(async (sf) => {
        const dupeSfCt = await Database.getTable("folders").countDocuments(
          {$and: [{name: sf.name}, {parent: ObjectId(first[fullpath]._id.toString())}]}
        );
        // if same subfolder exists in first folder
        if (dupeSfCt > 0) {
          keepFolder = true;
          subfolderConflicts++;
          // get subfolder in first folder
          const keeperSf = await Database.getTable("folders").findOne(
            {$and: [{name: sf.name}, {parent: ObjectId(first[fullpath]._id.toString())}]}
          );
          // get strings in subfolder
          const sfStringsCount = await Database.getTable("strings").countDocuments({
            parent: ObjectId(sf._id.toString())
          });
          const sfStrings = Database.getTable("strings").find({
            parent: ObjectId(sf._id.toString())
          });
          if (sfStringsCount === 0) checkingSubfolderStrings = false;
          else checkingSubfolderStrings = true;
          awaitSubfolderStringQuery = false;
          // loop strings
          let sfStringsProcessed = 0;
          sfStrings.forEach(async (s) => {
            const dupeSfStrCt = await Database.getTable("strings").countDocuments(
              {$and: [{name: s.name}, {parent: ObjectId(keeperSf._id.toString())}]}
            );
            // if same string exists in first subfolder
            if (dupeSfStrCt > 0) {
              // ???
              keepFolder = true;
            }
            else {
              // else move string to first subfolder
              if (s.name === 'gmReminders') {
                const gp1 = await getParentFolder(r._id.toString());
                const gp2 = await getParentFolder(first[fullpath]._id.toString());
                logError(`Moving gmReminders from ${decrypt(gp1.name)}/${decrypt(r.name)}/${decrypt(sf.name)} to ${decrypt(gp2.name)}/${decrypt(first[fullpath].name)}/${decrypt(keeperSf.name)}`);
                if (sf._id.toString() !== keeperSf._id.toString()) {
                  logError(`_id's don't match: this is a good thing`);
                }
                else {
                  logError(`_id's match: this is a bad thing`);
                }
              }
              Database.getTable("strings").updateOne(
                {_id: ObjectId(s._id.toString())},
                {$set: {parent: ObjectId(keeperSf._id.toString())}}
              );
              stringsMoved++;
            }
            sfStringsProcessed++;
            if (sfStringsCount === sfStringsProcessed) checkingSubfolderStrings = false;
          });
          while (awaitSubfolderStringQuery || checkingSubfolderStrings) {
            await sleep(150);
          }
        }
        else {
          // else move subfolder to first folder,
          // after ensuring it's not a server folder
          let moveFolder = true;
          const pFolder = await getParentFolder(sf._id.toString());
          if (pFolder && pFolder._id.toString() === userDataFolder._id.toString()) {
            moveFolder = false;
          }
          else if (pFolder) {
            const gpFolder = await getParentFolder(pFolder._id.toString());
            if (gpFolder && gpFolder._id.toString() !== userDataFolder._id.toString()) {
              userFolders++;
            }
          }
          if (moveFolder) {
            Database.getTable("folders").updateOne(
              {_id: ObjectId(sf._id.toString())},
              {$set: {parent: ObjectId(first[fullpath]._id.toString())}}
            );
            foldersMoved++;
            keepFolder = true;
          }
        }
        if (!keepFolder) {
          Database.getTable("folders").deleteOne({_id: ObjectId(r._id.toString())});
          dupeDeleted++;
        }
        else {
          logWrite(`Keeping folder`);
          intentionallyKept++;
        }
        sfProcessed++;
        if (sfProcessed === sfCount) checkingSubfolders = false;
        else logWrite(`${sfProcessed}/${sfCount}`);
      });
      while (awaitSubfolderQuery || checkingSubfolders) { await sleep(150); }
      dupeCount++;
    });
  });
  let waited = 0;
  while (
    waited < 5000 &&
    (checkingSubfolders || checkingStrings || checkingSubfolderStrings
    || awaitStringQuery || awaitSubfolderQuery || awaitSubfolderStringQuery)
  ) {
    let msg = 'Waiting for ';
    msg += (checkingSubfolders) ? 'subfolders'
      : (checkingStrings) ? 'strings' : (checkingSubfolderStrings)
      ? 'subfolder strings' : (awaitStringQuery) ? 'string query'
      : (awaitSubfolderQuery) ? 'subfolder query' : (awaitSubfolderStringQuery)
      ? 'subfolder strings' : 'nothing';
    logWrite(msg);
    await sleep(1000);
    waited += 1000;
  }
  waited = 0;
  while (dupeCount === 0 || expectedCount === 0 || (dupeCount < expectedCount && waited < 5000)) {
    await sleep(150);
    waited += 150
  }
  logWrite(`====================================================================`);
  logWrite(`${dupeCount} duplicate folders found, ${dupeDeleted} deleted`);
  logWrite(`${userFolders} user folders`);
  logWrite(`${dupeStringsDeleted} identical strings deleted from duplicate folders`);
  logWrite(`${nullStringsDeleted} string conflicts resolved because a string was empty`);
  logError(`${stringNameConflicts} string name conflicts could not be resolved`);
  logWrite(`${subfolderConflicts} subfolder conflicts`);
  logWrite(`${intentionallyKept} intentionally kept`);
  logWrite(`${stringsMoved} strings moved, ${foldersMoved} folders moved`);
  if (dupeCount > dupeDeleted) logError(`You may need to run this script again.`);
  logError(`You should restart the bot now or at least issue the !clearcache command.`);
  process.exit();
}

fixDuplicates();
