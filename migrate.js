const {Database} = require('./db');
const {ObjectId} = require('mongodb');
const {logWrite, logSpam, logError} = require('./log');
/* =================================================== LEGACY CODE ========== */
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
global.gfolderID = {UserData: null};
global.mfolderID = {UserData: null}
// google drive API lock per channel id, to avoid race conditions
global.lock = { };
// config (debugging flags, etc)
global.config = {
  // debugging options
  logspam:                            true,
};
// @ ============ GOOGLE * google * Google ===========
const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');

// If modifying these scopes, delete googletoken.json.
const G_SCOPES = ['https://www.googleapis.com/auth/drive.appdata',
                'https://www.googleapis.com/auth/drive.file'];
// The file googletoken.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const G_TOKEN_PATH = 'googletoken.json';

// Load client secrets from env or local file.
if (process.env.hasOwnProperty('GOOGLE_CREDENTIALS')) {
  authorize(JSON.parse(process.env.GOOGLE_CREDENTIALS), initAll);
} else {
  fs.readFile('googlecredentials.json', (err, content) => {
    if (err) return console.log('Error loading client secret file:', err);
    // Authorize a client with credentials, then call the Google Drive API.
    authorize(JSON.parse(content), initAll);
  });
}

// @ =========== google's library functions =============
/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  if (process.env.hasOwnProperty('GOOGLE_TOKEN')) {
    oAuth2Client.setCredentials(JSON.parse(process.env.GOOGLE_TOKEN));
    callback(oAuth2Client);
  } else {
    fs.readFile(G_TOKEN_PATH, (err, token) => {
      if (err) return getAccessToken(oAuth2Client, callback);
      oAuth2Client.setCredentials(JSON.parse(token));
      callback(oAuth2Client);
    });
  }
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getAccessToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: G_SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(G_TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', G_TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}
//==================================================================
async function initAll(auth) {
  global.auth = auth;
  // diagnostic / testing junk
  if (global.config.listAllFilesOnStartup === true) listAllFiles();
  if (global.config.skipInitInitiative === true) return;
  // init disk locking for system
  unlockDiskForChannel("system");
  initInitiative();
}
// Init the Initiative system. See also callbackInitInitiative, immediately below
function initInitiative() {
  // initial startup payload depends on whether UserData folder exists
  findFolderByName('UserData', 'root', (err, res) => {
    callbackInitInitiative(err, res);
  });
}
// Startup payload
async function callbackInitInitiative(err, res) {
  if (err) {
    logError('Google Drive API error: ' + err);
    process.exit();
  }
  // currently global.gfolderID only holds one element, UserData; I expect others
  // e.g configs, helptexts, etc
  var findAndSetGFolderID = function (files, folderName) {
    files.forEach((file) => {
      if (file.name == folderName) { global.gfolderID[folderName] = file.id; }
    });
  }
  var findAndSetMFolderID = async function (c, folderName) {
    if (c && c.name && c.name === folderName) { global.mfolderID[folderName] = c._id.toString(); }
    else {
      await createFolder(folderName);
      const x = await findMFolderByName(folderName);
      await findAndSetMFolderID(x, folderName);
    }
  };
  // INSTALL/SETUP determine if we've already been installed; if not, do install
  const files = res.data.files;
  if (files.length) {
    // SETUP =======================================================
    var folderName = 'UserData';
    findAndSetGFolderID(files, folderName);
    const c = await findMFolderByName(folderName);
    await findAndSetMFolderID(c, folderName);
    console.log(global.mfolderID);
    console.log(global.gfolderID);
  } else {
    logError(`There doesn't appear to be a GameBot installation on your Google `
      + `Drive account.`);
    process.exit();
  }
}
//  function isDiskLockedForChannel(channelID)
// folder paradigm w/ disk locking per channel to prevent race conditions
function isDiskLockedForChannel(channelID) {
  return global.lock[channelID];
}
// @ function lockDiskForChannel(channelID, unlock=false)
// optional 2nd arg allows inverting the function
function lockDiskForChannel(channelID, unlock=false) {
  if (unlock==true) return unlockDiskForChannel(channelID);
  global.lock[channelID] = true;
}

// @ function unlockDiskForChannel(channelID, lock=false)
function unlockDiskForChannel(channelID, lock=false) {
  if (lock==true) return lockDiskForChannel(channelID);
  global.lock[channelID] = false;
}
async function getFileContents(fileID, channelID) {
  var fileContents = '';
  while (isDiskLockedForChannel(channelID)) { await sleep(15); }
  lockDiskForChannel(channelID);
  logSpam("File ID: " + fileID);
  var q = {id: fileID};
  if (cacheHas(q, 'fileContent')) {
    var c = getFromCache(q, 'fileContent');
    if (c.hasOwnProperty('content')) {
      logSpam("Found in cache: " + c.content);
      fileContents = c.content;
      unlockDiskForChannel(channelID);
      return c.content;
    }
  }
  logSpam('Seeking file in GDrive');
  var auth = global.auth;
  const drive = google.drive({version: 'v3', auth});
  drive.files.get({fileId: fileID, alt: "media"}, async (err, res) => {
    if (err) {
      unlockDiskForChannel(channelID);
      if (err.hasOwnProperty('code') && err.code === 500) {
        console.error(err);
        logWrite('getFileContents trying again in 2 seconds...');
        await sleep(2000);
        return await getFileContents(fileID, channelID);
      }
      else if (err.hasOwnProperty('code') && err.code === 404) {
        logWrite(`getFileContents got 404 for ${fileID}`);
        return '';
      }
      else {
        return console.error(err);
      }
    }
    // strip padding which was added to bypass a very weird API error
    fileContents=res.data.substring(0,res.data.length-2);
    addToCache({id: fileID, content: fileContents}, 'fileContent');
    unlockDiskForChannel(channelID);
  });
  while (isDiskLockedForChannel(channelID)) { await sleep(15); }
  return fileContents;
}
async function findFolderByName(
  folderName,
  parentID=null,
  callback=(err, res) => { err; res; },
  channelID="system"
) {
  if (parentID === -1) {
    logWrite(`findFolderByName: parentID was -1, `
      + `folderName was ${folderName}, channel was ${channelID}`);
    return -1;
  }
  var lastFoundFileID = -1;
  while (isDiskLockedForChannel(channelID)) { await sleep(15); }
  lockDiskForChannel(channelID);
  var auth = global.auth;
  const drive = google.drive({version: 'v3', auth});
  // since parents field is optional
  var mainq = `name="${folderName}"`;
  mainq = (parentID == null) ? mainq : `${mainq} and "${parentID}" in parents`
  var q = {
    q: mainq,
    mimeType: 'application/vnd.google-apps.folder',
    fields: 'files(id, name, parents)',
  };
  drive.files.list(q, async (err, res) => {
    if (err && err.hasOwnProperty('code') && err.code === 500) {
      console.error(err);
      logWrite('findFolderByName trying again in 2 seconds...');
      await sleep(2000);
      return await findFileByName(folderName, parentID, callback, channelID);
    }
    else if (err) {
      console.error(err);
      logWrite('findFolderByName returning -1...');
      return -1;
    }
    // optimistically, there will usually be a unique result
    if (res.data.files.length === 1) {
      // prep to return the file id
      lastFoundFileID = res.data.files[0].id;
    }
    else {
      lastFoundFileID = -1;
      logSpam(`findFolderByName got ${res.data.files.length} results from GDrive for ${folderName} in ${parentID}`);
    }
    unlockDiskForChannel(channelID);
    callback(err, res);
  });
  while (isDiskLockedForChannel(channelID)) { await sleep(15); }
  return lastFoundFileID;
}
async function findFileByName(filename, parentID, channelID) {
  var lastFoundFileID = -1;
  while (isDiskLockedForChannel(channelID)) { await sleep(15); }

  var q = {name: filename, parents: [parentID]};
  if (cacheHas(q, 'file')) {
    lockDiskForChannel(channelID);
    var c = getFromCache(q, 'file');
    lastFoundFileID = c.googleID;
    unlockDiskForChannel(channelID);
    return lastFoundFileID;
  }

  while (isDiskLockedForChannel(channelID)) { await sleep(15); }
  lockDiskForChannel(channelID);
  var auth = global.auth;
  var drive = google.drive({version: 'v3', auth});
  drive.files.list(
    {q: `"${parentID}" in parents and name="${filename}"`,
    fields: 'nextPageToken, files(id, name, parents)'},
    async (err, res) => {
      if (err) {
        if (err.hasOwnProperty('code') && err.code === 500) {
          logWrite(err);
          logWrite('findFileByName trying again in 2 seconds...');
          await sleep(2000);
          return await findFileByName(filename, parentID, channelID);
        }
        else {
          lastFoundFileID = -1;
          if (err.hasOwnProperty('code') && err.code === 404) {
            logWrite(`findFileByName: got 404 for file ${filename}...`);
          }
        }
        // console.error(err);
      }
      else if (res && res.data.files.length === 1) {
        res.data.files.map((file) => {
          lastFoundFileID = file.id;
          addToCache(file, 'file');
        });
      }
      unlockDiskForChannel(channelID);
    }
  );
  while (isDiskLockedForChannel(channelID)) { await sleep(15); }
  return lastFoundFileID;
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
      {$and: [ {name: filename, parent: ObjectId(parentFolderID)} ]},
      {$set: [ {content: contents}, {name: filename}, {parent: ObjectId(parentFolderID)} ]},
      {upsert: true}
    );
  }
  catch (e) { logError(e); }
}
async function findMFolderByName(
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
  logWrite(`MIGRATING DATA FROM GOOGLE DRIVE: THIS WILL TAKE A LONG TIME!`);
  logWrite(`DOING THIS MULTIPLE TIMES MAY RESULT IN DUPLICATE/BROKEN DATA!!`);
  logWrite(`Press Ctrl-C NOW to cancel`);
  logWrite(`|||||||||||||||||||| IMPORTANT!!!!!!!!!!!! ||||||||||||||||||||`);
  logWrite(``);
  logWrite(`10 seconds until migragion begins.`);
  await sleep(1000);
  logWrite(`Proceeding with data migration...`);
  // get all googleID's & names of folders in UserData folder
  var expectedFolders = 0;
  var expectedFiles = 0;
  var loadedFolders = 0;
  var loadedFiles = 0;
  var auth = global.auth;
  const drive = google.drive({version: 'v3', auth});
  let handleFolderResults = async (
    gParent=global.gfolderID.UserData,
    mParent=global.mfolderID.UserData,
    folderPageToken=undefined,
    folderLevel=0
  ) => {
    let q = {
      q: `"${gParent}" in parents`,
      mimeType: `application/vnd.google-apps.folder`,
      fields: `nextPageToken, files(id, name)`,
    };
    if (folderPageToken !== undefined) q.nextPageToken = folderPageToken;
    try {
      lockDiskForChannel('system');
      drive.files.list(q, async (folderErr, folderRes) => {
        if (folderErr) {
          logWrite(`Google Drive error: ${folderErr}`);
          logWrite(`Aborting...`);
          process.exit();
        }
        if (folderRes.data.files.length === 0) {
          logWrite(`There were no UserData files to restore. Aborting...`);
          process.exit();
        }
        expectedFolders += folderRes.data.files.length;
        // loop folders
        for (let f = 0; f < folderRes.data.files.length; f++) {
          let folderName = folderRes.data.files[f].name;
          let folderID = folderRes.data.files[f].id;
          // create local data/(folderName) if not exists
          try {



            await createFolder(folderName, mParent);
            setTimeout( async () => {
              await handleFolderResults(gParent);
            }, 100*expectedFolders)



            // get all googleID's & names of GDrive files in (folderName)
            let handleFileResults =
              async (fileParent=folderID, nextPageToken=undefined, level=0) =>
            {
              let q = {
                q: `"${fileParent}" in parents`,
                fields: `nextPageToken, files(id, name)`,
              };
              if (nextPageToken !== undefined) q.pageToken = nextPageToken;
              drive.files.list(q, async (fileErr, fileRes) => {
                if (fileErr) {
                  logWrite(`Google Drive error: ${fileErr}`);
                  logWrite(`Aborting...`);
                  process.exit();
                }
                expectedFiles += fileRes.data.files.length;
                if (fileRes.data.files.length > 0) {
                  logWrite(
                    `Got ${fileRes.data.files.length} files on page ${level}`
                  );
                }
                // loop files
                for (let x = 0; x < fileRes.data.files.length; x++) {
                  // get content of GDrive file
                  let filename = fileRes.data.files[x].name;
                  let fileID = fileRes.data.files[x].id;
                  unlockDiskForChannel('system');
                  // many tries per file are required to guarantee content
                  var content = await getFileContents(fileID);
                  while (isDiskLockedForChannel('system')) { await sleep(15); }
                  var retries = 0;
                  while (content === '' && retries < 20) {
                    logSpam(`Got no content: retry #${retries}`);
                    content = await getFileContents(fileID);
                    while (isDiskLockedForChannel('system')) { await sleep(15); }
                    retries++;
                  }
                  // (destructively) write local data/(filename)
                  try {



                    await setStringByNameAndParent(filename, mParent, content);
                    loadedFiles++;
                    logSpam(`File status ${loadedFiles}/${expectedFiles}`);


                  } // end of try
                  catch (e) {
                    logError(
                      `Couldn't write data/${folderName}/${filename}`
                    );
                    logWrite(`Aborting...`);
                    process.exit();
                  } // end of catch
                } // end of for loop (res.data.files.length)
                let filePageToken = fileRes.data.nextPageToken;
                if (filePageToken !== undefined && filePageToken !== 'undefined') {



                  setTimeout( async () => {
                    logWrite(`Querying files p${level+1}...`);
                    await handleFileResults(folderID, filePageToken, level+1);
                  }, expectedFiles*100);



                }
              }); // end of drive.files.list callback
            }; // end of handleFileResults
            logSpam(`Doing page 1 of handleFileResults`);
            await handleFileResults();




          } // end of try mkdir
          catch (e) {
            logError(`Can't write to local disk: ${e}`);
            logError(`Aborting...`);
            process.exit();
          } // end of catch
          loadedFolders++;
          logSpam(`Folder status ${loadedFolders}/${expectedFolders}`);
        } // end of for loop res.data.files for parent folders
        folderPageToken = folderRes.data.nextPageToken;
        if (folderPageToken !== undefined && folderPageToken !== 'undefined') {
          logWrite(`Querying folders p${folderLevel}...`);
          await handleFolderResults(gParent, folderPageToken, folderLevel);
          logSpam(`Waiting for disk lock`);
          while (isDiskLockedForChannel('system')) { await sleep(15); }
        }
      }); // end of drive.files.list for parent folders
    } // end of try drive.files.list for parent folders
    catch (e) {
      logError(`An error occurred: ${e}`);
      logError(`Aborting...`);
      process.exit();
    }
    unlockDiskForChannel('system');
  } // end of handleFolderResults
  await handleFolderResults();
  logSpam(`Waiting for disk lock`);
  while (isDiskLockedForChannel('system')) { await sleep(15); }
  while (
    (loadedFiles !== expectedFiles || expectedFiles === 0)
    || (loadedFolders !== expectedFolders || expectedFolders === 0)
  ) { await sleep(5000); }

  logWrite(``);
  logWrite(`Restoration complete.`);
  process.exit();
}
migrate();
