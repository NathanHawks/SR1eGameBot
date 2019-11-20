function doNothing (err, res) {} // a callback for function argument defaults
// set true to activate warning messages
var isMaintenanceModeBool = false;
// set status message to send as warning when isMaintenanceModeBool is true
var maintenanceStatusMessage = '\n**Bzzt. Hoi!** '
/*
+ 'We\'re back! Occasional disruptions may occur as I prep for initiative.'

+ 'The bot\'s in maintenance mode.** If it forgets rerolls faster than normal, '
+ 'it means I rebooted the bot.'
*/
+ ' Testing a major upgrade! Please DM me if the bot goes offline!'
+ ' Pzzhht! -<@360086569778020352>';
// conditionally add warning message
function addMaintenanceStatusMessage(output) {
  var r = "";
  if (isMaintenanceModeBool == true) r = output + " " + maintenanceStatusMessage;
  else r = output;
  return r;
}
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
function doNothing() {}
// internal setup
// system folder(s)
global.folderID = {UserData : null};
// a cursor for returning found files per channel
global.lastFoundFileID = { };
// a place to store the (per channel) results of getFileContents
global.lastFileContents = { };
// google drive API lock per channel id, to avoid race conditions
global.lock = { };
// config (debugging flags, etc)
global.config = {
  // debugging options
  skipInitInitiative:                 false,
  deleteUserDataIfFoundOnStartup:     false,
  listAllFilesOnStartup:              true,
  deleteAllFilesOnStartup:            false,
};
// @ =================== CACHE ====================
global.cache = {
  server: [],  // arr of obj: googleID, discordID
  channel: [], // arr of obj: googleID, discordID, parentID,
  userInChannel: [], // arr of obj: googleID, discordID, parentID
  file: [] // arr of obj: googleID, name, parentID, content
};
function _cache_googleIDMatch(obj, file) {
  if (obj.googleID && file.id && obj.googleID == file.id)
    return true;
  else return false;
}
function _cache_nameAndParentMatch(obj, file) {
  if (obj.discordID && file.name && obj.discordID == file.name
    && file.parents && file.parents.length && obj.parentID
    && obj.parentID == file.parents[0])
    return true;
  else return false;
}
function _cache_serverNameMatch(obj, file) {
  if (obj.discordID === file.name) return true; else return false;
}
function cacheHas(file, cacheAs) {
  var found = false;
  global.cache[cacheAs].map((obj) => {
    // valid matches: id match; or parent & discordID (filename) match together
    if (_cache_googleIDMatch(obj, file)) found = true;
    if (_cache_nameAndParentMatch(obj, file)) found = true;
    if (cacheAs === 'server' && _cache_serverNameMatch(obj, file)) found = true;
    if (found) return found;
  });
  return found;
}
function getCacheIndex(file, cacheAs, create=true) {
  var r = -1;
  var i = 0;
  // same as cacheHas
  global.cache[cacheAs].map((obj) => {
    // valid matches: id match; or parent & discordID (filename) match together
    if (_cache_googleIDMatch(obj, file)) r = i;
    if (_cache_nameAndParentMatch(obj, file)) r = i;
      // servers don't need a parent, just the filename
    if (cacheAs === 'server' && _cache_serverNameMatch(obj, file)) r = i;
    if (r) return r;
  });
  if (create === false) return r;
  // if there was no match, reserve an index and return it
  r = global.cache[cacheAs].length;
  global.cache[cacheAs][r] = {};
  return r;
}
function addToCache(file, cacheAs) {
  var ci = getCacheIndex(file, cacheAs);
  switch(cacheAs) {
    case 'server':
      // no parent
      global.cache.server[ci].googleID = file.id;
      global.cache.server[ci].discordID = file.name;
    break;
    case 'channel':
    case 'userInChannel':
      global.cache[cacheAs][ci].googleID = file.id;
      global.cache[cacheAs][ci].discordID = file.name;
      global.cache[cacheAs][ci].parentID = file.parents[0];
    break;
    case 'file':
      global.cache.file[ci].googleID = file.id;
      global.cache.file[ci].discordID = file.name;
      global.cache.file[ci].parentID = file.parents[0];
    break;
  }
}
function getFromCache(file, cacheAs) {
  var ci = getCacheIndex(file, cacheAs, false);
  return global.cache[cacheAs][ci];
}

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
  authorize(JSON.parse(process.env.GOOGLE_CREDENTIALS), initInitiative);
} else {
  fs.readFile('googlecredentials.json', (err, content) => {
    if (err) return console.log('Error loading client secret file:', err);
    // Authorize a client with credentials, then call the Google Drive API.
    authorize(JSON.parse(content), initInitiative);
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
// @ ================== DX FUNCS ================
async function openFile(msg, args) {
  var output = await getFileContents(args[0], 'system');
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  msg.channel.send("```" + output + "```");
}
function listAllFiles(msg) {
  var output = '';
  var finalout = '';
  var auth = global.auth;
  const drive = google.drive({version: 'v3', auth});
  drive.files.list({
    fields: 'nextPageToken, files(id, name, parents)',
  }, (err, res) => {
    if (err) return console.error(err);
    const files = res.data.files;
    if (files.length) {
      output += '--- [filename] ---   ------------ googleID ------------- ------------ parentID -------------\n';
      files.map((file) => {
        output += `${file.name.padEnd(20)} (${file.id}) [${file.parents}]\n`;
      });
    } else {
      output += 'No files found.';
    }
    if (msg !== undefined && output.length < 1994)
      msg.channel.send(`\`\`\`${output}\`\`\``);
    else if (msg !== undefined) {
      var outArr = output.split("\n");
      output = '';
      for (var x = 0; x < outArr.length; x++) {
        output += outArr[x] + "\n";
        if (x%20 === 0) {
          msg.channel.send('```' + output + '```');
          output = '';
        } else if (outArr.length - x < 20) {
          finalout = output;
        }
      }
      if (finalout !== output)
        msg.channel.send('```' + finalout + '```');
    } else console.log(output);
  });
}
function deleteFile(msg, args) {
  if (args && args[0]) {
    deleteFileById(args[0], (err, res) => {
      msg.channel.send("```" + args[0] + ' deleted.```')
    });
  }
}
function showCache(msg) {
  var output = '[CacheID]  - name/discordID - ------------ googleID ----------- ----------- parentID ------------\n';
  var cxArr = ['server', 'channel', 'userInChannel', 'file'];
  cxArr.map((cx) => {
    for (var x = 0; x < global.cache[cx].length; x++) {
      var id = `${cx.substring(0,4)}${x}`;
      id = id.padEnd(10, " ");
      var did = global.cache[cx][x].discordID.padEnd(18, " ");
      var gid = global.cache[cx][x].googleID;
      var par = global.cache[cx][x].parentID;
      output += `${id} ${did} ${gid} ${par}\n`
    }
  });
  msg.channel.send('```' + output + '```');
}
// unlock global.lock for a specific channel
function adminUnlock(msg, args) {
  var channel = -1;
  if (msg && msg.channel && args.length === 0) {
    channel = msg.channel.id
  } else { channel = args[0]; }
  global.lock[channel] = false;
}
function deleteAllFiles() {
  var auth = global.auth;
  const drive = google.drive({version: 'v3', auth});
  drive.files.list({
    fields: 'nextPageToken, files(id, name)',
  }, (err, res) => {
    if (err) return console.error(err);
    const files = res.data.files;
    if (files.length) {
      console.log(`DX: Deleting ${files.length} files...`);
      files.map((file) => {
        deleteFileById(file.id, doNothing);
      });
      console.log("DX: All commands sent.")
    } else {
      console.log('No files found.');
    }
  });
}
//==================================================================
// @ =========== INITIATIVE LIBRARY FUNCS ============
// ensure folder/subfolder chain: (root)/(UserData)/ServerID/ChannelID/UserID
async function ensureFolderTriplet(msg) {
  var serverFolderID = null;
  var channelFolderID = null;
  var userDataFolderID = global.folderID.UserData;
  var serverDiscordID = msg.channel.guild.id;
  // Get the server folder's googleID
  var q = {name: serverDiscordID};
  if (cacheHas(q, 'server')) {
    serverFolderID = getFromCache(q, 'server').googleID;
  } else {
    while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
    await ensureFolderByName(serverDiscordID, userDataFolderID, msg.channel.id);
    serverFolderID = await findFolderByName(serverDiscordID, userDataFolderID,
      (err, res) => {
        if (err) return console.error(err);
        lockDiskForChannel(msg.channel.id);
        if (res.data.files.length === 1) {
          addToCache(res.data.files[0], 'server');
        } else {
          console.error(`> BAD: ${msg.channel.guild.id} in UserData.`);
        }
        unlockDiskForChannel(msg.channel.id);
    }, msg.channel.id);
    while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  }
  // channel folder
  q = {name: msg.channel.id, parents: [serverFolderID]};
  if (cacheHas(q, 'channel')) {
    channelFolderID = getFromCache(q, 'channel').googleID;
  } else {
    await ensureFolderByName(msg.channel.id, serverFolderID, msg.channel.id);
    channelFolderID = await findFolderByName(msg.channel.id, serverFolderID,
      (err, res) => {
        if (err) return console.error(err);
        lockDiskForChannel(msg.channel.id);
        if (res.data.files.length === 1) {
          addToCache(res.data.files[0], 'channel');
        } else {
          console.error(`> BAD: ${msg.channel.id} in ${serverFolderID}.`);
        }
        unlockDiskForChannel(msg.channel.id);
      }, msg.channel.id);
      while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  }
  // user folder
  q = {name: msg.author.id, parents: [channelFolderID]};
  if (cacheHas(q, 'userInChannel')) {
    // we're only here to ensure it exists; it does
  }
  else {
    await ensureFolderByName(msg.author.id, channelFolderID, msg.channel.id);
    await findFolderByName(msg.author.id, channelFolderID, (err, res) => {
      if (err) return console.error(err);
      lockDiskForChannel(msg.channel.id);
      if (res.data.files.length === 1) {
        addToCache(res.data.files[0], 'userInChannel');
      }
      else { console.error(`> BAD: ${msg.author.id} in ${channelFolderID}.`)}
      unlockDiskForChannel(msg.channel.id);
    }, msg.channel.id);
    while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  }
}

async function findUserFolderFromMsg(msg) {
  // a User's folder exists in (root)/UserData/ServerID/ChannelID/UserID
  var r = null; // the userFolderID
  // first try to get it from cache
  var q = {name: msg.channel.guild.id}
  if (cacheHas(q, 'server')) {
    var id = getFromCache(q, 'server').googleID;
    q = {name: msg.channel.id, parents: [o]};
    if (cacheHas(q, 'channel')) {
      var o = getFromCache(q, 'channel').googleID;
      q = {name: msg.author.id, parents: [o]};
      if (cacheHas(q, 'userInChannel')) {
        r = getFromCache(q, 'userInChannel').googleID;
        return r;
      }
    }
  }
  // the cache didn't return -- do it the slow way
  var serverFolderID = await findFolderByName(msg.channel.guild.id,
    global.folderID.UserData, doNothing, msg.channel.id);
  var channelFolderID = await findFolderByName(msg.channel.id,
    serverFolderID, doNothing, msg.channel.id);
  // return the file ID
  r = await findFolderByName(msg.author.id,
    channelFolderID, doNothing, msg.channel.id);
  return r;
}

async function findUserFolderFromUserID(msg, userID) {
  // a User's folder exists in (root)/UserData/ServerID/ChannelID/UserID
  lockDiskForChannel(msg.channel.id);
  var r = null;
  // try to get it from cache first
  var q = {name: msg.channel.guild.id};
  if (cacheHas(q, 'server')) {
    var serverID = getFromCache(q, 'server').googleID;
    q = {name: msg.channel.id, parents: [serverID]};
    if (cacheHas(q, 'channel')) {
      var channelID = getFromCache(q, 'channel').googleID;
      q = {name: userID, parents: [channelID]};
      if (cacheHas(q, 'userInChannel')) {
        r = getFromCache(q, 'userInChannel').googleID;
        unlockDiskForChannel(msg.channel.id);
        return r;
      }
    }
  }
  // cache didn't return -- do it the slow way
  var serverFolderID = await findFolderByName(msg.channel.guild.id,
    global.folderID.UserData, doNothing, msg.channel.id);
  var channelFolderID = await findFolderByName(msg.channel.id, serverFolderID,
    doNothing, msg.channel.id);
  r = await findFolderByName(userID, channelFolderID, doNothing, msg.channel.id);
  // return the file ID
  unlockDiskForChannel(msg.channel.id);
  return r;
}

// @ function ensureFolderByName(name, parentID=null, channelID="system")
function ensureFolderByName(name, parentID=null, channelID="system") {
  findFolderByName(name, parentID, (err, res) => {
    if (err) return console.error(err);
    console.log(`Ensuring folder ${name} exists`);
    const files = res.data.files;
    if (files.length === 0) {
      console.log('It doesn\'t exist; creating it');
      createFolder(name, parentID, (err, file) => {
        if (err) return console.error(err);
      }, channelID);
    }
  }, channelID);
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

// @ function findFolderByName(folderName, parentID=null, callback, channelID="system")
async function findFolderByName(
  folderName,
  parentID=null,
  callback=doNothing,
  channelID="system"
) {
  global.lastFoundFileID[channelID] = -1;
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
  drive.files.list(q, (err, res) => {
    if (err) return console.error(err);
    // optimistically, there will usually be a unique result
    if (res.data.files.length === 1) {
      // prep to return the file id
      res.data.files.map((file)=>{
        global.lastFoundFileID[channelID] = file.id;
      });
    } else { global.lastFoundFileID[channelID] = -1; }
    // hope this either is brief or manages locks well
    unlockDiskForChannel(channelID);
    callback(err, res);
  });
  while (isDiskLockedForChannel(channelID)) { await sleep(15); }
  return global.lastFoundFileID[channelID];
}

// @ function createFolder(folderName, parentID=null, callback, channelID="system")
async function createFolder(
  folderName,
  parentID=null,
  callback=doNothing,
  channelID="system"
) {
  while (isDiskLockedForChannel(channelID)) { await sleep(15); }
  lockDiskForChannel(channelID);
  var auth = global.auth;
  const drive = google.drive({version: 'v3', auth});
  var parents = [];
  if (parentID !== null) {
    parents = [parentID];
  }
  drive.files.create({
    resource: {
      'name': folderName,
      'parents': parents,
      'mimeType': 'application/vnd.google-apps.folder'
    },
    fields: 'id'
  }, (err, file) => {
    unlockDiskForChannel(channelID);
    if (err) return console.error(err);
    callback(err,file);
  });
}

async function findFileByName(filename, parentID, channelID) {
  while (isDiskLockedForChannel(channelID)) { await sleep(15); }
  lockDiskForChannel(channelID);
  global.lastFoundFileID[channelID] = -1;
  var auth = global.auth;
  var drive = google.drive({version: 'v3', auth});
  drive.files.list(
    {q: `"${parentID}" in parents and name="${filename}"`,
    fields: 'nextPageToken, files(id, name, parents)'},
    (err, res) => {
      if (err) console.err(err);
      if (res.data.files.length === 1) {
        res.data.files.map((file) => {
          global.lastFoundFileID[channelID] = file.id;
        });
      }
      else { global.lastFoundFileID[channelID] = -1; }
      unlockDiskForChannel(channelID);
    }
  );
  while (isDiskLockedForChannel(channelID)) { await sleep(15); }
  return global.lastFoundFileID[channelID];
}

async function getFileContents(fileID, channelID) {
  while (isDiskLockedForChannel(channelID)) { await sleep(15); }
  lockDiskForChannel(channelID);
  var auth = global.auth;
  const drive = google.drive({version: 'v3', auth});
  drive.files.get({fileId: fileID, alt: "media"}, (err, res) => {
    if (err) { unlockDiskForChannel(channelID); return console.error(err); }
    // strip padding which was added to bypass a very weird API error
    global.lastFileContents[channelID]=res.data.substring(0,res.data.length-2);
    unlockDiskForChannel(channelID);
  });
  while (isDiskLockedForChannel(channelID)) { await sleep(15); }
  var r = global.lastFileContents[channelID];
  return r;
}

async function setContentsByFilenameAndParent(msg, filename, parentFolderID, contents) {
  // prep for disk ops
  var auth = global.auth;
  const drive = google.drive({version: 'v3', auth});
  var channelID = msg.channel.id;
  while (isDiskLockedForChannel(channelID)) { await sleep(15); }
  lockDiskForChannel(channelID);
  // Create/Update the file; does the file already exist
  drive.files.list({q:`"${parentFolderID}" in parents and name="${filename}"`,
    fields: 'files(id, name, parents)'},
    (err, res) => {
      if (err) return console.error(err);
      // no, the file doesn't exist for this channel/user pairing
      if (res.data.files.length === 0) {
        // create it
        drive.files.create({
          resource: { 'name': filename, 'parents': [parentFolderID] },
          media: { 'mimeType': 'text/plain', 'body': `${contents}/2` },
          fields: 'id'
        }, (err, file) => {
          unlockDiskForChannel(channelID);
          if (err) return console.error(err);
        });
      } else if (res.data.files.length===1) {
        // it already exists, update it
        res.data.files.map((file) => {
            drive.files.update({
              fileId: file.id, media: {body: `${contents}/2`}},
              (err, res) => {
                unlockDiskForChannel(channelID);
                if (err) return console.error(err);
            });
        });
      }
    }
  );
}
async function deleteFileById(fileId, callback=(err,res)=>{}, channelID="system") {
  while (isDiskLockedForChannel(channelID)) { await sleep(15); }
  lockDiskForChannel(channelID);
  var auth = global.auth;
  const drive = google.drive({version: 'v3', auth});
  drive.files.delete({fileId:fileId}, (err, res) => {
    unlockDiskForChannel(channelID);
    callback(err, res);
  });
}
function removeHourglass(msg) {
  msg.reactions.map((reaction) => {
    if (reaction.emoji.name == '⏳') { reaction.remove(); }
  });
}
function modifyNPCInput(args) {
  // allow human-readable format without space
  if (args && args.length && args.length%2 === 0) {
    var gotCha = false; // true if d6+ detected
    var fixArgs = []; // to hold the fixed data format
    var y = 0; // to increment by 3's for the fixed array
    for (var x = 0; x < args.length; x+=2) {
      if (args[x].toLowerCase().indexOf('d6+') !== -1) {
        gotCha = true;
        args[x] = args[x].toLowerCase();
        var tmpArr = args[x].split('d6+');
        tmpArr[2] = args[x+1]
        fixArgs[y] = tmpArr[0];
        fixArgs[y+1] = tmpArr[1];
        fixArgs[y+2] = tmpArr[2];
        y += 3;
      }
    }
    if (gotCha) args = fixArgs;
  }
  // allow human-readable format with space
  for (var x = 0; x < args.length; x+=3) {
    if (args[x] && args[x].length) {
      var suspect = args[x].substring(args[x].length-2, args[x].length).toLowerCase();
      if (suspect == 'd6' || suspect == 'D6') {
        args[x] = args[x].substring(0, args[x].length-2);
      }
    }
    if (args[x+1] && args[x+1].length) {
      var suspect = args[x+1].substring(0, 1);
      if (suspect == '+') {
        args[x+1] = args[x+1].substring(1, args[x+1].length);
      }
    }
  }
  return args;
}
function validateNPCInput(msg, args) {
  // some input validation
  var errOutput = '';
  if (args.length%3 !== 0) {
    errOutput += ':no_entry_sign: Wrong number of options; '
      + 'maybe you put spaces in a label?\n';
  }
  for (var x = 0; x < args.length; x++) {
    if (args[x].indexOf(',') !== -1) {
      errOutput += ':no_entry_sign: No commas allowed anywhere in this command.\n';
    }
  }
  var gotIt_Stop = false;
  for (var x = 0; x < args.length; x+=3) {
    if (gotIt_Stop == false
      && (Number(args[x]) != args[x] || Number(args[x+1]) != args[x+1]))
    {
      errOutput += ':thinking: see ":dragon_face: Adding NPC\'s :dragon_face:" '
        + 'in **!inithelp** for help.\n';
      gotIt_Stop = true;
    }
  }
  // abort if any errors
  if (errOutput !== '') {
    msg.reply(`there was a problem.\n${errOutput}`);
    return false;
  } else return true;
}

// @ ================= INIT INITIATIVE ================
// Init the Initiative system. See also callbackInitInitiative, immediately below
function initInitiative(auth) {
  // frag it
  global.auth = auth;
  // diagnostic / testing junk
  /* if (global.config.deleteAllFilesOnStartup === true)
    { deleteAllFiles(); return; } */
  if (global.config.listAllFilesOnStartup === true) listAllFiles();
  if (global.config.skipInitInitiative === true) return;
  // init disk locking for system
  unlockDiskForChannel("system");
  // initial startup payload depends on whether UserData folder exists
  findFolderByName('UserData', null, (err, res) => {
    callbackInitInitiative(err, res);
  });
}
// Startup payload
async function callbackInitInitiative(err, res) {
  if (err)
    return console.log('Google Drive API returned an error: ' + err);
  // currently global.folderID only holds one element, UserData; I expect others
  // e.g configs, helptexts, etc
  var findAndSetFolderID = function (files, folderName) {
    files.map((file) => {
      if (file.name == folderName) { global.folderID[folderName] = file.id; }
    });
  }
  // INSTALL/SETUP determine if we've already been installed; if not, do install
  const files = res.data.files;
  if (files.length) {
    // SETUP =======================================================
    var folderName = 'UserData';
    findAndSetFolderID(files, folderName);
    if (global.config.deleteUserDataIfFoundOnStartup == true) {
      // testing/debugging: delete UserData folder (to test installer again)
      deleteFileById(global.folderID[folderName],(err,res)=>{if(err)console.error(err);});
    }
  } else {
    // INSTALL =====================================================
    var folderName = 'UserData';
    console.log(`Installing ${folderName} folder.`);
    createFolder(folderName, null, (err, file) => {
        if (err) return console.error(err);
        // fetch ID of new folder
        findFolderByName(folderName, null, (err, res) => {
            lockDiskForChannel("system");
            const files = res.data.files;
            if (files.length) { findAndSetFolderID(files, folderName); }
            unlockDiskForChannel("system");
          }
        );
      }
    );
  }
}
// ====== Original GameBot code ====================================
// @ ============= DICEBOT LIBRARY FUNCS ==============
// @ function d6(explode)
function d6(explode=false) {
    var roll = Math.floor(Math.random() * 6 + 1);
    if (roll == 6 && explode == true) roll += d6(true);
    return roll;
}
function d10() {
  var roll = Math.floor(Math.random() * 10 + 1);
  return roll;
}
function firstTwoLC(ofWhat) {
  var r = ofWhat.substring(0,2);
  r = r.toLowerCase();
  return r;
}
function firstThreeLC(ofWhat) {
  var r = ofWhat.substring(0,3);
  r = r.toLowerCase();
  return r;
}
function lastChar(ofWhat) {
  var r = ofWhat.substring(ofWhat.length-1, ofWhat.length).toLowerCase();
  return r;
}
function getTNFromArgs(args) {
  var tn = -1;
  for (x = 0; x < args.length; x++) {
    var firsttwo = firstTwoLC(args[x]);
    if (firsttwo == 'tn') {
      // peel off the number after "tn"
      tn = args[x].substring(2, args[x].length);
      // if there wasn't a number, look ahead to next arg
      if (isNaN(Number(tn)) || tn < 2) {
        var y = x + 1;
        var tmptn = args[y];
        // if it's a number, use it
        if (!isNaN(Number(tmptn)) && tmptn > 1) tn = tmptn;
        else tn = -1;
       }
    }
  }
  return tn;
}
/* Credit to
  stackoverflow.com/questions/1063007/how-to-sort-an-array-of-integers-correctly
*/
function sortNumberDesc(a, b) { return b - a; }
function sortReaction(a, b) {
  var aArr = a.split("(");
  if (aArr.length > 1) {
    var aReaction = aArr[1].substring(0, aArr[1].length-1);
  } else aReaction = 0;
  var bArr = b.split("(");
  if (bArr.length > 1) {
    var bReaction = bArr[1].substring(0, bArr[1].length-1);
  } else bReaction = 0;
  return bReaction - aReaction;
}
function sortInitPass(a, b) {
  var aArr = a.split("]");
  if (aArr.length > 1) {
    var aReaction = aArr[0].substring(2);
  } else aReaction = 0;
  var bArr = b.split("]");
  if (bArr.length > 1) {
    var bReaction = bArr[0].substring(2);
  } else bReaction = 0;
  return bReaction - aReaction;
}
function getOpposedSetupArr(args) {
  var isOpposedBool = false;
  var opponentDiceInt = -1;
  var opponentTNInt = -1;
  var isOpposedTestBool = false;
  // check every arg for opponent dice & opponent TN
  for (x = 0; x < args.length; x++) {
    var firsttwo = firstTwoLC(args[x]);
    var firstthree = firstThreeLC(args[x]);
    if (firsttwo == 'vs' && args[x].length > 2 && firstthree !== "vs.") {
      isOpposedBool = true;
      var lastchar = lastChar(args[x]);
      if (lastchar == '!') {
        isOpposedTestBool = true;
        opponentDiceInt = args[x].substring(2, args[x].length-1);
      }
      else {
        opponentDiceInt = args[x].substring(2, args[x].length);
      }
    }
    else if (firstthree == 'otn') {
      opponentTNInt = args[x].substring(3, args[x].length);
    }
    // if no TN yet, lookahead
    if (isNaN(Number(opponentTNInt)) || opponentTNInt < 2) {
      var y = x + 1;
      var tmptn = args[y];
      if (!isNaN(Number(tmptn)) && tmptn > 1) opponentTNInt = tmptn;
      else opponentTNInt = -1;
    }
  }
  return [isOpposedBool,opponentDiceInt,opponentTNInt,isOpposedTestBool];
}
function makeOpposedOutput(isOpposedBool, successesInt, opponentSuccessesInt,
  user, rollsIntArr, opponentRollsIntArr, note)
{
  var successesFormattedString = '';
  if (successesInt > opponentSuccessesInt) {
    successesFormattedString = (successesInt-opponentSuccessesInt)
    + ' net successes ';
  }
  else if (successesInt == opponentSuccessesInt) {
    successesFormattedString = '0 net successes';
  }
  else if (opponentSuccessesInt > successesInt) {
    successesFormattedString = (opponentSuccessesInt-successesInt)
    + ' *fewer* successes than the opponent! ';
  }
  var r = user + ' rolled ' + successesFormattedString
  + '('+rollsIntArr+') vs ('+opponentRollsIntArr+') ' + note;
  return r;
}
function prepRollNote(cmd, args, tnInt) {
  var note = cmd;
  var spacer = "";
  for (x = 0; x < args.length; x++) {
    // for this complex command, repeat everything verbatim as a note
    spacer = (note !== "") ? " " : "";
    note += spacer + args[x];
  }
  if (note !== "") note = "(" + note + ")";
  else if (tnInt > 0) note = "(TN" + tnInt + ")";
  return note;
}
function rollDice(numDiceInt, isTestBool, tnInt) {
  var rollsIntArr = [];
  var successesInt = 0;
  for (x = 0; x < numDiceInt; x++) {
    rollsIntArr[x] = d6(isTestBool);
    if (tnInt > -1 && rollsIntArr[x] >= tnInt)
      successesInt++;
  }
  // Convenience, or hiding terrible RNG? you decide! (it's both)
  rollsIntArr.sort(sortNumberDesc);
  return [successesInt,rollsIntArr];
}
function rollD10s(numDiceInt) {
  var rollsIntArr = [];
  for (x = 0; x < numDiceInt; x++) {
    rollsIntArr[x] = d10();
  }
  rollsIntArr.sort(sortNumberDesc);
  return rollsIntArr;
}
// ============= main script =======================================
// @ ============== DISCORD SETUP SCRIPT ==============
// disabled: var Discord = require('discord.io');
const Discord = require('discord.js'); // new hotness
var logger = require('winston'); // why not

// load auth & other tokens (this must be configured in heroku)
var token = null;
if (process.env.hasOwnProperty('TOKEN')) {
  token = process.env.TOKEN;
}
else {
  var auth = require('./discordauth.json');
  token = auth.token;
}

// Configure logger
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console, { colorize: true });
logger.level = 'debug';

// Connect to Discord
var bot = new Discord.Client();
bot.login(token);

bot.on('ready', () => {
    logger.info('Connected; Logged in as: ['+ bot.user.tag + ']');
    bot.user.setPresence({game:{name:'!help for help'}});
});

// Setup reaction handler (when 🎲 UI for triggering re-roll is clicked)
bot.on('messageReactionAdd', (reaction, user) => {
  if ((reaction.emoji == '🎲' || reaction.emoji == 'game_die' ||
        reaction.emoji == ':game_die:') && user.username !== 'GameBot') {
    handleMessage(reaction.message, user);
  }
});

// @ ============== COMMAND HANDLERS ==============
// handle rolls, tests, & opposed tests
function handleRollCommand(msg, cmd, args, user) {

  // SETUP: how many dice, and do we explode?
  var isTestBool = false;
  var isTotalBool = false;
  var numDiceInt = 0;
  var lastchar = lastChar(cmd);
  if (lastchar == '!') {
    isTestBool = true;
    numDiceInt = cmd.substring(0, cmd.length-1);
  } else if (lastchar == 't') {
    isTotalBool = true;
    numDiceInt = cmd.substring(0, cmd.length-1);

    // TODO: look for a modifier


  }
  else {
    numDiceInt = cmd.substring(0, cmd.length);
  }

  // SETUP: was a TN given?
  var tnInt = getTNFromArgs(args);

  // SETUP: is this an opposed roll?
  var retarr = getOpposedSetupArr(args);
  var isOpposedBool = retarr[0];
  var opponentDiceInt = retarr[1];
  var opponentTNInt = retarr[2];
  var isOpposedTestBool = retarr[3];
  if (isOpposedTestBool === true && opponentTNInt === -1) {
    msg.reply(":no_entry_sign: you ordered an opposed test, without specifying an "
    + "opponent TN (the **otn** option).\nExample: **!6! tn4 vs5! otn4**");
    return;
  }

  // SETUP: anything remaining is a note; prepare to pass it thru
  var note = prepRollNote(cmd, args, tnInt);

  // GO: Roll the bones ============================================
  var retarr = rollDice(numDiceInt, isTestBool, tnInt);
  var successesInt = retarr[0];
  var rollsIntArr = retarr[1];
  var output = '';
  // handle total'd roll
  if (isTotalBool) {
    var total = 0;
    rollsIntArr.map((roll)=>{total+=roll;})
    output += `Total: ${total} `;
  }
  // handle opposed roll
  if (isOpposedBool) {
    var retarr = rollDice(opponentDiceInt, isOpposedTestBool, opponentTNInt);
    var opponentSuccessesInt = retarr[0];
    var opponentRollsIntArr = retarr[1];
  }
  // prep output and deliver it ====================================
  if (isOpposedBool) {
    output = makeOpposedOutput(isOpposedBool, successesInt,
      opponentSuccessesInt, user, rollsIntArr, opponentRollsIntArr, note
    );
  }
  else {
    var successesFormattedString = "";
    if (successesInt > 0) {
      successesFormattedString = successesInt + ' successes ';
    }
    output = user + ', you rolled ' + successesFormattedString
    + '(' +rollsIntArr+ ') ' + note;
  }

  // avoid false positives e.g. when chatting about Astral Tabeltop dice formats
  if (numDiceInt > 0) {
    // modify output for maintenance mode status
    output = addMaintenanceStatusMessage(output);
    // post results
    msg.channel.send(output);
    // provide reroll ui (dice reaction)
    console.log('🎲');
    msg.react('🎲');
    // no return
  }
}
function handleHelpCommand(msg, cmd, args, user) {
  var whatToShow = 1;
  if (args.length && args[0] == 2 || cmd === 'inithelp') {
    whatToShow = 2;
  }
  var output = '\n GameBot usage:\n'
    + '!***X***         Roll ***X***d6 *without* exploding 6\'s'
    + '  ***example:*** !5   rolls 5d6 without exploding\n'
    + '!X***!***        Roll ***X***d6 ***with*** exploding 6\'s'
    + '  ***example:*** !5!  rolls 5d6 with exploding\n'
    + '!X ***tnY***     Roll *without* exploding 6\'s against Target Number ***Y***'
    + '  ***example:*** !5 tn4   rolls 5d6 w/o exploding vs TN4\n'
    + '!X***! tnY***     Roll ***with*** exploding 6\'s against Target Number ***Y***'
    + '  ***example:*** !5! tn4   rolls 5d6 w/ exploding vs TN4\n'
    + '\n'
    + '**Opposed Rolls:**\n'
    + '!A! tnB ***vsX!*** ***otnY***\n'
    + '   Roll *A*d6 (exploding) with tn *B*, opposed by *X*d6 (exploding) with opponent\'s TN *Y*\n'
    + '   vs*X* = the number of dice the opponent throws (vs*X*! for exploding dice)\n'
    + '   otn*Y* = the opponent\'s target number\n'
    + '  ***example:*** !5! tn3 vs6! otn4    '
    + 'Roll 5d6 (exploding) with TN 3, against 6d6 (exploding) with TN 4\n'
    + '\n'
    + 'Notes are OK, and your TN can be in the middle of the note\n'
    + 'examples:\n'
    + '  !3! TN4 resist wagemage sorcery      works\n'
    + '  !3! resist wagemage sorcery TN4      works\n'
    + '  !3! resist TN4 wagemage sorcery      works\n'
    + '  resist wagemage sorcery !3! TN4      won\'t work\n'
    + '\n'
    + 'Anyone can click the :game_die: reaction to reroll any *recent* roll.\n'
    + 'Remove and re-add your reaction to keep re-rolling that roll.\n'
    + '\n'
    + ':boom: Oh, and one more thing... try **!inithelp** to learn about the new **initiative features!**';
  var output21 =
      '\n:boom: **EXPERIMENTAL: Initiative System** :boom:\n'
    + '\n'
    + 'Player setup:\n:one: **!setgm @someone**\n:two: **!setinit X Y**\n'
    + 'GM setup:\n:one: **!setgm**\n:two: **!setplayers @player1 @player2 (etc)**'
      + '\n:three: **!setnpcinits *(see below)***\n'
    + '\n'
    + '**!setinit** syntax is **!setinit X Y** where X is the number of dice '
    + 'and Y is the modifier. For example, **!setinit 1 4** sets your initiative '
    + 'formula to 1d6+4.\n'
    + '\n'
    + 'IMPORTANT: Commands won\'t work unless you @people correctly. '
      + 'Use the menu that pops-up while you type, or tab-completion. \n'
      + '**If it\'s blue with an underline, you did it right.**\n'
    + '\n'
    + ':game_die: **Rolling Initiative** :game_die:\n'
      + ':arrow_right: **!init** - Shadowrun 1e initiative\n'
      + ':arrow_right: **!initflip** - Shadowrun 1e initiative, reversed\n'
      + ':arrow_right: **!init2** - Shadowrun 2e initiative\n'
      + ':arrow_right: **!init2flip** - Shadowrun 2e initiative, reversed\n'
      + ':arrow_right: **!init3** - Shadowrun 3e initiative\n'
      + ':arrow_right: **!init3flip** - Shadowrun 3e initiative, reversed\n'
      + '\n'
      + 'The bot remembers stuff; you won\'t need to redo setup, just update whatever '
        + 'changes. **However:**\n'
      + ':arrow_right: Everything is linked to GM **and chat channel**.\n'
      + ':arrow_right: If you move to a different channel, you must re-enter everything.\n'
      + ':arrow_right: Multiple GM\'s can share a channel, but anyone playing in '
      + 'both groups must repeat their set-up steps (starting with !setgm).\n'
      + ':arrow_right: To play in two games *at the same time,* you\'ll need two channels.\n'
      + '\n'
    ;
    var output22 = '\n'
    + '\n'
    + ':nerd: **Other initiative commands** :nerd:\n```'
      + 'Shortcut  Full command    [Required] options\n'
      + '--------------------------------------------\n'
      + '          !setgm          @someone\n'
      + '!si       !setinit        [X Y]\n'
      + '!setp     !setplayers     [@player1 @player2 etc]\n'
      + '!addp     !addplayers     [@player1 @player2 etc]\n'
      + '!lp       !listplayers\n'
      + '!rmp      !removeplayers  [@player1 @player2 etc]\n'
      + '!clrp     !clearplayers\n'
      + '!setn     !setnpcinits    [X1 Y1 label1 X2 Y2 label2 etc]\n'
      + '!addn     !addnpcinits    [X1 Y1 label1 X2 Y2 label2 etc]\n'
      + '!ln       !listnpcinits\n'
      + '!rmn      !removenpcinits [label1 label2 etc]\n'
      + '!clrn     !clearnpcinits\n'
      + '```'
    + '\n'
    + ':dragon_face: **Adding NPC\'s** :dragon_face:\n'
    + '**!setnpcinits** and **!addnpcinits** syntax: !(command) **X Y label**\n -- labels cannot have spaces or commas\n --'
      + ' e.g. **!addnpcinits 1 5 thugs** (means the thugs have 1d6+5 initiative).\n -- Add as many NPCs as you want, separated by spaces.\n'
    + '\n'
    + 'If you have multiple NPC\'s with the same label, !removeNPCInits also accepts '
      + 'the format **!removenpcinits X Y label** which requires a full match. But, '
      + 'having multiple NPC\'s with the same label is confusing anyway, so maybe just don\'t do that.\n'
    + '\n'
    + 'All initiative-related commands are slow. '
      + 'The :hourglass_flowing_sand: reaction means it\'s working on your request.\n'
    + '\n'
    + 'Commands are **not** case-sensitive. Go WiLd WitH tHaT.\n'
    ;
  switch (whatToShow) {
    case 2:
      output22 = addMaintenanceStatusMessage(output22);
      msg.reply(output21);
      msg.reply(output22);
    break;
    case 1:
      output = addMaintenanceStatusMessage(output);
      msg.reply(output);
    break;
  }
}
async function handleInitCommand(msg, cmd, args, user) {
  msg.react('⏳');
  global.lastFoundFileID[msg.channel.id] = null;
  await ensureFolderTriplet(msg);
  var userFolderID = '';
  var gmPlayersFileID = '';
  var gmPlayersString = '';
  var gmPlayersArr = [];
  var gmNPCFileID = '';
  var gmNPCFileContent = '';
  var gmNPCArr = [];
  var playerInitContent = [];
  var gmNPCFileContent = [];
  var someoneIsntReady_GM = false;
  var someoneIsntReady_Init = false;
  var playerFolderIDs = [];
  var playerGMFileID = [];
  var playerInitFileID = [];
  var playersNotSetGM = [];
  var playersNotSetInit = [];
  var skipFileActions = false;
  var initWillFail = false;
  var output = '';
  var filename = '';
  var npcRolls = [];
  var playerRolls = [];
  var npcPhases = [];
  var playerPhases = [];
  var auth = global.auth;
  var drive = google.drive({version: 'v3', auth});
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  // get author's userFolderID for this channel
  userFolderID = await findUserFolderFromMsg(msg);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  // get file ID of gm's (msg.author's) gmPlayers file, if any
  filename = 'gmPlayers';
  gmPlayersFileID = await findFileByName(filename, userFolderID, msg.channel.id);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  // make array of playerIDs from msg.author's gmPlayers file content, if any
  if (gmPlayersFileID !== -1) {
    gmPlayersString = await getFileContents(gmPlayersFileID, msg.channel.id);
    while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
    lockDiskForChannel(msg.channel.id);
    gmPlayersArr = gmPlayersString.split(',');
  }
  // ensure all players have setgm to user, and have setinit
  // prune empty entries from gmPlayersArr
  var tmpArr = [];
  gmPlayersArr.map((p)=>{
    if (p.length && p !== ' ') tmpArr[tmpArr.length] = p;
  });
  gmPlayersArr = tmpArr;
  // loop on gm's (msg.author's) list of players
  for (var x = 0; x < gmPlayersArr.length; x++) {
    filename = 'gmWhoIsGM';
    // create an index of each player's folderID
    unlockDiskForChannel(msg.channel.id);
    playerFolderIDs[x] = await findUserFolderFromUserID(msg, gmPlayersArr[x]);
    while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
    // if the player doesn't have a user folder in this channel, skip other checks
    if (playerFolderIDs[x] == -1) {
      someoneIsntReady_GM = true;
      playersNotSetGM[x] = gmPlayersArr[x];
      playerGMFileID[x] = -1;
      someoneIsntReady_Init = true;
      playersNotSetInit[x] = gmPlayersArr[x];
      playerInitFileID[x] = -1;
    } else {
      unlockDiskForChannel(msg.channel.id);
      // another index for each player's gmWhoIsGM fileID
      playerGMFileID[x] = await findFileByName(filename, playerFolderIDs[x], msg.channel.id);
      while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
      lockDiskForChannel(msg.channel.id);
      if (playerGMFileID[x] == -1) {
        // not ready because they don't have a gmWhoIsGM file at all
        someoneIsntReady_GM = true;
        playersNotSetGM[x] = gmPlayersArr[x];
      }
      else {
        unlockDiskForChannel(msg.channel.id);
        var playerGMContent = await getFileContents(playerGMFileID[x], msg.channel.id);
        while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
        lockDiskForChannel(msg.channel.id);
        if (playerGMContent !== user.id) {
          // not ready because their gmWhoIsGM file indicates another GM
          someoneIsntReady_GM = true;
          playersNotSetGM[x] = gmPlayersArr[x];
        }
      }
      // ensure all players have setinit
      filename = "playerInit";
      // another index for each player's playerInit fileID
      unlockDiskForChannel(msg.channel.id);
      playerInitFileID[x] = await findFileByName(filename, playerFolderIDs[x], msg.channel.id);
      while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
      if (playerInitFileID[x] == -1) {
        // not ready because they don't have a playerInit file at all
        someoneIsntReady_Init = true;
        playersNotSetInit[x] = gmPlayersArr[x];
      }
      else {
        unlockDiskForChannel(msg.channel.id);
        playerInitContent[x] = await getFileContents(playerInitFileID[x], msg.channel.id);
        while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
        lockDiskForChannel(msg.channel.id);
        if (playerInitContent[x].length == 0) {
          // not ready because their playerInit file is empty
          someoneIsntReady_Init = true;
          playersNotSetInit[x] = gmPlayersArr[x];
        }
      }
    }
  }
  if (someoneIsntReady_GM) {
    // someone hasn't !setgm; append output to list them; set flag to fail
    output += ` some players haven't set you as their gm yet:\n`;
    playersNotSetGM.map((p)=>{output+=`:no_entry_sign: <@${p}>\n`});
    initWillFail = true;
  }
  if (someoneIsntReady_Init) {
    // someone hasn't !setinit; append output to list them; set flag to fail
    if (output !== '') output += 'and';
    output += ` some players haven't set their initiative formulas yet:\n`;
    playersNotSetInit.map((p)=>{output+=`:no_entry_sign: <@${p}>\n`});
    initWillFail = true;
  }
  // get NPC's, if any
  filename = 'gmNPCInit';
  unlockDiskForChannel(msg.channel.id);
  gmNPCFileID = await findFileByName(filename, userFolderID, msg.channel.id);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  if (gmNPCFileID == -1) {
  } else {
    gmNPCFileContent[x] = await getFileContents(gmNPCFileID, msg.channel.id);
    while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
    gmNPCArr = gmNPCFileContent[x].split(",");
  }
  // abort if we have no players and no NPC's, or if anyone's init will fail
  if ((gmNPCArr.length == 0 && gmPlayersArr.length == 0) || initWillFail) {
    // init will fail one of two ways; notify
    if (gmPlayersArr.length == 0 && gmPlayersArr.length == 0) {
      initWillFail = true;
      output += " -- can't roll initiative: you have no players or NPC's in this channel.";
    }
    else if (initWillFail) {
      output += " -- can't roll initiative: players aren't ready.\n"
      + ":thinking: :bulb: See **!inithelp** or ask your GM how to get set up!";
    }
  } else {
    output += "\n*[Roll]* Player or NPC (Total Mod)\n===============================\n";
  }
  // if we have a valid setup, roll init
  if (!initWillFail) {
    playerRolls = [];
    // determine which init system we're emulating
    var passTH = [];
    var passSub = [];
    switch (cmd) {
      case 'init':
      case 'initflip':
        passTH = [10, 16, 22, 1000];
        passSub = [7, 14, 21, 0];
      break;
      case 'init2':
      case 'init2flip':
      case 'init3':
      case 'init3flip':
        passTH = [10, 20, 30, 40];
        passSub = [10, 20, 30, 40];
      break;
      case 'initcp':
        passTH = [1000, 2000, 3000, 4000];
        passSub = [0, 0, 0, 0];
      break;
    }
    // roll & calculate for players
    for (var x = 0; x < gmPlayersArr.length; x++) {
      var total = 0;
      var init = playerInitContent[x].split(" ");
      if (cmd !== 'initcp') {
        var [junk,rolls] = rollDice(init[0], false, -1)
      }
      else var rolls = rollD10s(init[0]);
      for (var y = 0; y < rolls.length; y++) {
        rolls[y] = Number(rolls[y]);
        total += rolls[y];
      }
      total += Number(init[1]);
      playerRolls[x] = rolls;
      // store initial initiative passes
      playerPhases[x] = [];
      playerPhases[x][playerPhases[x].length] = total;
      // calculate & store extra initiative passes
      if (total > passTH[0]) {
        playerPhases[x][playerPhases[x].length] = total - passSub[0];
      }
      if (total > passTH[1]) {
        playerPhases[x][playerPhases[x].length] = total - passSub[1];
      }
      if (total > passTH[2]) {
        playerPhases[x][playerPhases[x].length] = total - passSub[2];
      }
      if (total > passTH[3]) {
        playerPhases[x][playerPhases[x].length] = total - passSub[3];
      }
    }
    // roll & calculate for NPCs
    for (var x = 0; x < gmNPCArr.length; x++) {
      if (gmNPCArr[x].length) {
        var total = 0;
        var init = gmNPCArr[x].split(" ");
        if (cmd !== 'initcp') {
          var [junk,rolls] = rollDice(init[0], false, -1)
        }
        else rolls = rollD10s(init[0]);
        for (var y = 0; y < rolls.length; y++) {
          rolls[y] = Number(rolls[y]);
          total += rolls[y];
        }
        total += Number(init[1]);
        npcRolls[x] = rolls;
        // store initial initiative passes
        npcPhases[x] = [];
        npcPhases[x][npcPhases[x].length] = total;
        // calculate & store extra initiative passes
        if (total > passTH[0]) {
          npcPhases[x][npcPhases[x].length] = total - passSub[0];
        }
        if (total > passTH[1]) {
          npcPhases[x][npcPhases[x].length] = total - passSub[1];
        }
        if (total > passTH[2]) {
          npcPhases[x][npcPhases[x].length] = total - passSub[2];
        }
        if (total > passTH[3]) {
          npcPhases[x][npcPhases[x].length] = total - passSub[3];
        }
      }
    }
  }
  // create dummy entries for output array so we can address higher items first
  var ordArr = [];
  // has each player or npc (by array index) gone yet this pass?
  var playerWentArr = [];
  var npcWentArr = [];
  // to bump people to the bottom
  var nextOrdArr = [];
  var nextPlayerWentArr = [];
  var nextNPCWentArr = [];
  var laterOrdArr = [];
  var laterPlayerWentArr = [];
  var laterNPCWentArr = [];
  var furtherOrdArr = [];
  var furtherPlayerWentArr = [];
  var furtherNPCWentArr = [];
  var farOrdArr = [];
  var farPlayerWentArr = [];
  var farNPCWentArr = [];
  for (var x = 0; x <= 40; x++) { ordArr[x] = ''; }
  // sort & format for output
  // create a downward loop for populating ordArr
  for (var x = 40; x > 0; x--) {
    // loop thru players array (containing arrays of their dice-based phases)
    for (var y = 0; y < playerPhases.length; y++) {
      // if the player is supposed to go on this phase (init passes aside)
      if (playerPhases[y].indexOf(x) !== -1) {
        var formattedEntry = `*[${x}]* <@${gmPlayersArr[y]}> (${playerInitContent[y].split(" ")[1]})`;
        if (cmd !== 'init2' && cmd !== 'init2flip' && cmd !== 'initcp') {
          // it's not 2nd edition: enforce the init passes rule
          if (playerWentArr.indexOf(y) === -1) {
            // the player hasn't gone yet this pass
            playerWentArr[playerWentArr.length] = y;
            if (ordArr[x]) { ordArr[x] += ","; }
            ordArr[x] += formattedEntry;
            if (y === 1) {
            }
          } else {
            // the player already went this pass
            if (nextPlayerWentArr.indexOf(y) === -1) {
              nextPlayerWentArr[nextPlayerWentArr.length] = y;
              nextOrdArr[nextOrdArr.length] = formattedEntry;
            } else {
              // the player is also already in the next pass
              if (laterPlayerWentArr.indexOf(y) === -1) {
                laterPlayerWentArr[laterPlayerWentArr.length] = y;
                laterOrdArr[laterOrdArr.length] = formattedEntry;
              } else {
                // i can do this all day (not really)
                if (furtherPlayerWentArr.indexOf(y) === -1) {
                  furtherPlayerWentArr[furtherPlayerWentArr.length] = y;
                  furtherOrdArr[furtherOrdArr.length] = formattedEntry;
                } else {
                  // 5th pass
                  farPlayerWentArr[farPlayerWentArr.length] = y;
                  farOrdArr[farOrdArr.length] = formattedEntry;
                }
              }
            }
          }
        } else {
          // don't enforce init passes for 2nd edition
          if (ordArr[x]) ordArr[x] += "\n";
          ordArr[x] += formattedEntry;
        }
      }
    }
    // loop thru npc array (containing arrays their dice-based phases)
    for (var y = 0; y < npcPhases.length; y++) {
      // if the npc is supposed to go this phase (init passes aside)
      if (npcPhases[y].indexOf(x) !== -1) {
        var formattedEntry = `*[${x}]* ${gmNPCArr[y].split(" ")[2]} (${gmNPCArr[y].split(" ")[1]})`;
        if (cmd !== 'init2' && cmd !== 'init2flip' && cmd !== 'initcp') {
          // enforce the init passes rule
          if (npcWentArr.indexOf(y) === -1) {
            // the npc hasn't gone yet this pass
            npcWentArr[npcWentArr.length] = y;
            if (ordArr[x]) ordArr[x] += ",";
            ordArr[x] += formattedEntry;
          } else {
            // the npc already went this pass
            if (nextNPCWentArr.indexOf(y) === -1) {
              nextNPCWentArr[nextNPCWentArr.length] = y;
              nextOrdArr[nextOrdArr.length] = formattedEntry;
            } else {
              if (laterNPCWentArr.indexOf(y) === -1) {
                // the npc is also already in the next pass
                laterNPCWentArr[laterNPCWentArr.length] = y;
                laterOrdArr[laterOrdArr.length] = formattedEntry;
              } else {
                if (furtherNPCWentArr.indexOf(y) === -1) {
                  // i can do this all day (not really)
                  furtherNPCWentArr[furtherNPCWentArr.length] = y;
                  furtherOrdArr[furtherOrdArr.length] = formattedEntry;
                } else {
                  // 5th pass
                  farNPCWentArr[farNPCWentArr.length] = y;
                  farOrdArr[farOrdArr.length] = formattedEntry;
                }
              }
            }
          }
        } else {
          // don't enforce init passes for 2nd edition
          if (ordArr[x]) ordArr[x] += "\n";
          ordArr[x] += formattedEntry;
        }
      }
    }
    if (cmd !== 'init2' && cmd !== 'init2flip' && cmd !== 'initcp') {
      // has everyone gone yet this pass?
      if (playerWentArr.length == gmPlayersArr.length
        && npcWentArr.length == gmNPCArr.length
        || (x <= 1))
      {
        // sort first pass if it's time to
        if (playerWentArr.length == gmPlayersArr.length
          && npcWentArr.length == gmNPCArr.length)
        {
          //ordArr.sort(sortInitPass); // that made a mess...?
        }
        if (nextOrdArr.length) {
          nextOrdArr.sort(sortInitPass);
          for (var z = 0; z < nextOrdArr.length; z++) {
            ordArr.splice(x, 0, nextOrdArr[z]);
          }
        }
        nextOrdArr = laterOrdArr;
        laterOrdArr = furtherOrdArr
        furtherOrdArr = farOrdArr;
        farOrdArr = [];
        npcWentArr = nextNPCWentArr;
        nextNPCWentArr = laterNPCWentArr;
        laterNPCWentArr = furtherNPCWentArr;
        furtherNPCWentArr = farNPCWentArr;
        farNPCWentArr = [];
        playerWentArr = nextPlayerWentArr;
        nextPlayerWentArr = laterPlayerWentArr;
        laterPlayerWentArr = furtherPlayerWentArr;
        furtherPlayerWentArr = farPlayerWentArr;
        farPlayerWentArr = [];
        if (x <= 1) {
          // second pass
          if (nextOrdArr.length) {
            nextOrdArr.sort(sortInitPass);
            for (var z = 0; z < nextOrdArr.length; z++) {
              ordArr.splice(x, 0, nextOrdArr[z]);
            }
          }
          // third pass
          if (laterOrdArr.length) {
            laterOrdArr.sort(sortInitPass);
            for (var z = 0; z < laterOrdArr.length; z++) {
              ordArr.splice(x, 0, laterOrdArr[z]);
            }
          }
          // fourth pass
          if (furtherOrdArr.length) {
            furtherOrdArr.sort(sortInitPass);
            for (var z = 0; z < furtherOrdArr.length; z++) {
              ordArr.splice(x, 0, furtherOrdArr[z]);
            }
          }
          //. fifth pass
          if (farOrdArr.length) {
            farOrdArr.sort(sortInitPass);
            for (var z = 0; z < farOrdArr.length; z++) {
              ordArr.splice(x, 0, farOrdArr[z]);
            }
          }
        }
      }
    }
  }
  // re-sort each phase for Reaction and split lines
  for (var x = 0; x < ordArr.length; x++) {
    var tmpArr = ordArr[x].split(",");
    if (tmpArr.length > 1) {
      tmpArr = tmpArr.sort(sortReaction);
      ordArr[x] = tmpArr.join("\n")
    }
  }
  switch (cmd) {
    case 'init':
    case 'init2':
    case 'init3':
    case 'initcp':
      // add to output from high to low
      for (var x = ordArr.length-1; x > 0; x--) {
        if (ordArr[x].length) { output += `${ordArr[x]}\n`; }
      }
    break;
    case 'initflip':
    case 'init2flip':
    case 'init3flip':
      // add to output from low to high
      for (var x = 0; x < ordArr.length; x++) { // 40 per pass times 5 passes
        if (ordArr[x].length) { output += `${ordArr[x]}\n`; }
      }
    break;
  }
  if ((gmNPCArr.length > 0 || gmPlayersArr.length > 0) && !initWillFail) {
    output += "===============================\n";
  }
  // report
  msg.reply(output);
  unlockDiskForChannel(msg.channel.id);
  console.log(`🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}/${msg.author.id}`);
  removeHourglass(msg);
}
async function handleSetGMCommand(msg, cmd, args, user) {
  // serverID.channelID.userID.gmWhoIsGM STRING
  // without flag: set self as GM
  msg.react('⏳');
  var targetID = "";
  if (args.length) {
    targetID = args[0].substring(2, args[0].length-1);
    if (targetID.substring(0, 1) == '!')
      targetID = args[0].substring(3, args[0].length-1);
  }
  else targetID = user.id;
  /*
  msg.reply(`User ${user}, ID: ${user.id}\n`
    + `Channel ${msg.channel}, ID: ${msg.channel.id}\n`
    + `Server ${msg.channel.guild}, ID: ${msg.channel.guild.id}\n\n`
    + `<@${user.id}>\n`   + `${args[0]}\n`   + targetID
  );
  */
  // ensure folder/subfolder chain: (root)/(UserData)/ServerID/ChannelID/UserID
  await ensureFolderTriplet(msg);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  // now get the folderID of the user folder in this channel
  var userFolderID = await findUserFolderFromMsg(msg);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  await setContentsByFilenameAndParent(msg, 'gmWhoIsGM', userFolderID, targetID);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  // remove reaction
  removeHourglass(msg);
  if (targetID == msg.author.id) msg.reply(' you are now a GM in this channel.');
  else msg.reply(` your GM is now <@${targetID}> in this channel.`);
  // listAllFiles();
  console.log(`🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}/${msg.author.id}`);
}
async function handleSetPlayersCommand(msg, cmd, args, user) {
  msg.react('⏳');
  await ensureFolderTriplet(msg);
  // fixme: Discord has two formats, <@! vs <@
  for (x=0; x < args.length; x++){
    args[x]=args[x].substring(2,args[x].length-1);
    if (args[x].substring(0, 1) == '!')
      args[x] = args[x].substring(1, args[x].length);
  }
  var content = args.join(",");
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  var userFolderID = await findUserFolderFromMsg(msg);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  await setContentsByFilenameAndParent(msg, 'gmPlayers', userFolderID, content);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  // remove reaction
  removeHourglass(msg);
  msg.reply(` your group in this channel is now ${args.length} players.`);
  // listAllFiles();
  console.log(`🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}/${msg.author.id}`);
}
async function handleAddPlayersCommand(msg, cmd, args, user) {
  msg.react('⏳');
  await ensureFolderTriplet(msg);
  var gmPlayersFileID = null;
  var filename = 'gmPlayers';
  var auth = global.auth;
  var drive = google.drive({version: 'v3', auth});
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  var userFolderID = await findUserFolderFromMsg(msg);
  // see if the gmPlayers file already exists
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  gmPlayersFileID = await findFileByName(filename, userFolderID, msg.channel.id);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  // get and parse the contents of the file
  try {
    if (gmPlayersFileID !== -1) {
      var oldPlayerString = await getFileContents(gmPlayersFileID);
      while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
      var newPlayersArr = [];
      newPlayersArr = oldPlayerString.split(",");
      var tmpArr = [];
      for (var x = 0; x < newPlayersArr.length; x++) {
        if (newPlayersArr[x].length > 0) tmpArr[tmpArr.length] = newPlayersArr[x];
      }
      newPlayersArr = tmpArr;
      // add the new players
      for (x = 0; x < args.length; x++) {
        newPlayersArr[newPlayersArr.length] = args[x].substring(2, args[x].length-1);
        if (newPlayersArr[newPlayersArr.length-1].substring(0,1) == '!') {
          newPlayersArr[newPlayersArr.length-1] = args[x].substring(3, args[x].length-1);
        }
      }
      var newPlayersCount = newPlayersArr.length;
      // format for output/saving
      content = newPlayersArr.join(",");
      // save the new player list
      await setContentsByFilenameAndParent(msg, filename, userFolderID, content);
      while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
      msg.reply(` you added ${args.length} players to your group in this channel;`
      + ` now there are ${newPlayersCount}.`);
      removeHourglass(msg);
    } else {
      // if there is no file we fail forward to the !set version of the command
      return handleSetPlayersCommand(msg, cmd, args, user);
    }
  } catch (e) {
    return console.error(e);
  }
  console.log(`🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}/${msg.author.id}`);
}
async function handleListPlayersCommand(msg, cmd, args, user) {
  msg.react('⏳');
  await ensureFolderTriplet(msg);
  var auth = global.auth;
  var drive = google.drive({version: 'v3', auth});
  var filename = 'gmPlayers';
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  var userFolderID = await findUserFolderFromMsg(msg);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  lockDiskForChannel(msg.channel.id);
  drive.files.list({q:`"${userFolderID}" in parents and name="${filename}"`,
    fields: 'nextPageToken, files(id, name, parents)'},
    (err, res) => {
      global.lastFoundFileID[msg.channel.id] = -1;
      if (err) return console.error(err);
      // the file doesn't exist for this channel/user pairing
      if (res.data.files.length == 0) {
        // no group; report so, and prep to abort
        msg.reply(' you currently have no group in this channel.')
        unlockDiskForChannel(msg.channel.id);
      } else {
        // be sure it's the right file
        res.data.files.map((file) => {
          global.lastFoundFileID[msg.channel.id] = file.id;
          unlockDiskForChannel(msg.channel.id);
        });
      }
    }
  );
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  // abort if no group
  if (global.lastFoundFileID[msg.channel.id] == -1) {
    removeHourglass(msg);
    return;
  }
  // get contents, parse, and count
  var gmPlayersFileID = global.lastFoundFileID[msg.channel.id];
  console.log(`userFolderID ${userFolderID}`);
  console.log('gmPlayersFileID ' + gmPlayersFileID);
  var playersString = await getFileContents(gmPlayersFileID);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  var playersArr = playersString.split(',');
  var tmpArr = [];
  playersArr.map((p) => {
    if (p.length > 0) tmpArr[tmpArr.length] = p;
  });
  playersArr = tmpArr;
  var output = '';
  // format for discord
  playersArr.map((p) => {
    if (p !== '') {
      p = `:arrow_right: <@${p}>`;
      output += `\n${p}`;
    }
  });
  // remove reaction
  removeHourglass(msg);
  if (playersArr.length == 0)
    msg.reply(' you don\'t have a group in this channel yet.');
  else
    msg.reply(` your group for this channel is ${playersArr.length} players `
    + `strong: ${output}`);
  // listAllFiles();
  console.log(`🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}/${msg.author.id}`);
}
async function handleRemovePlayersCommand(msg, cmd, args, user) {
  global.lastFoundFileID[msg.channel.id] = -1;
  msg.react('⏳');
  await ensureFolderTriplet(msg);
  var content = args.join(" ");
  var filename = "gmPlayers"
  var auth = global.auth;
  var drive = google.drive({version: 'v3', auth});
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  var userFolderID = await findUserFolderFromMsg(msg);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  lockDiskForChannel(msg.channel.id);
  // ensure the file
  drive.files.list(
    {q: `"${userFolderID}" in parents and name="${filename}"`,
    fields: 'nextPageToken, files(id, name, parents)'},
    (err, res) => {
      if (err) console.err(err);
      // in the event of no match
      if (res.data.files.length) {
        res.data.files.map((file) => {
          global.lastFoundFileID[msg.channel.id] = file.id;
        });
      } else {
        setContentsByFilenameAndParent(msg, filename, userFolderID, '');
        // now the file surely exists -- redo the find, get the file id
        lockDiskForChannel(msg.channel.id);
        drive.files.list(
          {q: `"${userFolderID}" in parents and name="${filename}"`,
          fields: 'nextPageToken, files(id, name, parents)'},
          (err, res) => {
            if (err) return console.error(err);
            // we must check for filename match
            if (res.data && res.data.files.length) {
              res.data.files.map((file)=>{
                global.lastFoundFileID[msg.channel.id] = file.id;
              });
            }
          }
        );
      }
      unlockDiskForChannel(msg.channel.id);
  });
  // get the file's id
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  gmPlayersFileID = global.lastFoundFileID[msg.channel.id];
  // get and parse the contents
  var oldContentString = await getFileContents(gmPlayersFileID);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  var contentArray = null;
  if (oldContentString == '') contentArray = [];
  else contentArray = oldContentString.split(",");
  var newContentArray = [];
  // parse the args entries and delete the requested entries
  var removedIndex = [];
  for (var y = 0; y < contentArray.length; y++) {
    for (var x = 0; x < args.length; x++) {
      var remove = args[x].substring(2, args[x].length-1); // <@!user_ID>
      if (remove.substring(0,1) == '!') {
        remove = remove.substring(1, remove.length);
      }
      if (contentArray[y] == remove
        || contentArray[y].length == 0
        || contentArray[y] == ' ') {
        // don't keep it
        removedIndex[removedIndex.length] = y;
      }
    }
  }
  // now rebuild it better
  for (var y = 0; y < contentArray.length; y++) {
    if (removedIndex.indexOf(y) == -1)
      newContentArray[newContentArray.length] = contentArray[y];
  }
  // save, notify, remove hourglass
  var newContentString = newContentArray.join(",");
  setContentsByFilenameAndParent(msg, filename, userFolderID, newContentString);
  removeHourglass(msg);
  msg.reply(` you removed ${removedIndex.length} players. `
  + `You now have ${newContentArray.length} players in this channel.`)
  console.log(`🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}/${msg.author.id}`);
}
async function handleClearPlayersCommand(msg, cmd, args, user) {
  msg.react('⏳');
  await ensureFolderTriplet(msg);
  // do prep while waiting for long disk operation
  var auth = global.auth;
  var drive = google.drive({version: 'v3', auth});
  var filename = 'gmPlayers';
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  var parentFolderID = await findUserFolderFromMsg(msg);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  lockDiskForChannel(msg.channel.id);
  drive.files.list({q:`"${parentFolderID}" in parents and name="${filename}"`,
    fields: 'nextPageToken, files(id, name, parents)'},
    (err, res) => {
      if (err) return console.error(err);
      // the file doesn't exist for this channel/user pairing
      if (res.data.files.length == 0) {
        // nothing to delete; we're done here
      } else {
        // be sure it's the right file, then delete it
        res.data.files.map((file) => {
          unlockDiskForChannel(msg.channel.id);
          deleteFileById(file.id, (err,res)=>{}, msg.channel.id);
        });
      }
    }
  );
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  // remove reaction
  removeHourglass(msg);
  msg.reply(' your group for this channel was reset to 0 players.');
  // listAllFiles();
  console.log(`🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}/${msg.author.id}`);
}
async function handleSetInitCommand(msg, cmd, args, user) {
  if (args) {
    // deal with the inevitable player who can't grok pressing a spacebar between fields
    if (args[0] && args.length == 1 && args[0].toLowerCase().indexOf('d6+') !== -1) {
      args[0] = args[0].toLowerCase();
      var tmpArr = args[0].split('d6+');
      args = tmpArr;
    }
    // allow the d6 and the +
    if (args[0] && args[0].length) {
      var suspect = args[0].substring(args[0].length-2, args[0].length).toLowerCase();
      if (suspect == 'd6' || suspect == 'D6') {
        args[0] = args[0].substring(0, args[0].length-2);
      }
    }
    if (args && args[1] && args[1].length) {
      var suspect = args[1].substring(0, 1);
      if (suspect == '+') {
        args[1] = args[1].substring(1, args[1].length);
      }
    }
    var errOutput = '';
    if (args.length !== 2) {
      errOutput += ':no_entry_sign: Wrong number of options; \n'
        + 'it\'s two numbers separated by a space.\n'
        + 'For example: **!setinit 1 5** for **1**d6 +**5**';
    }
    if (Number(args[0]) != args[0] || (args[1] && Number(args[1]) != args[1])) {
      errOutput += ':no_entry_sign: Wrong type of options; '
        + 'it should be two numbers separated by a space.\n'
        + 'For example: **!setinit 1 5** for **1**d6 +**5**';
    }
  } else {
    errOutput += ':no_entry_sign: Options required; \n'
      + 'two numbers separated by a space.\n'
      + 'For example: **!setinit 1 5** for **1**d6 +**5**'
    }

  // abort if any errors
  if (errOutput !== '') {
    msg.reply(`There was a problem.\n${errOutput}`);
    return;
  }
  // and on to the show
  msg.react('⏳');
  // serverID.channelID.userID.playerInit STRING
  var content = args.join(" ");
  await ensureFolderTriplet(msg);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  // now get the folderID of the user folder in this channel
  var userFolderID = await findUserFolderFromMsg(msg);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  await setContentsByFilenameAndParent(msg, 'playerInit', userFolderID, content);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  // reformat for output (better user feedback)
  tmpArr = content.split(" ");
  var output = `${tmpArr[0]}d6 +${tmpArr[1]}`;
  // remove reaction
  removeHourglass(msg);
  msg.reply(` your initiative formula (in this channel) is now ${output}.`);
  // listAllFiles();
  console.log(`🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}/${msg.author.id}`);
}
async function handleSetNPCInitCommand(msg, cmd, args, user) {
  args = modifyNPCInput(args);
  if (!validateNPCInput(msg, args)) {
    return;
  }
  // and on to the show
  msg.react('⏳');
  await ensureFolderTriplet(msg);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  var userFolderID = await findUserFolderFromMsg(msg);
  var contentArray = [];
  for (var x = 0; x < args.length; x++) {
    contentArray[contentArray.length] = `${args[x]} ${args[x+1]} ${args[x+2]}`;
    x = x + 2;
  }
  var content = contentArray.join(",");
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  await setContentsByFilenameAndParent(msg, 'gmNPCInit', userFolderID, content);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  // remove reaction
  removeHourglass(msg);
  msg.reply(` your NPC's for this channel were reset, `
  + `and you added ${contentArray.length} NPC's.`);
  // listAllFiles();
  console.log(`🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}/${msg.author.id}`);
}
async function handleAddNPCInitCommand(msg, cmd, args, user) {
  args = modifyNPCInput(args);
  if (!validateNPCInput(msg, args)) {
    return;
  }
  msg.react('⏳');
  await ensureFolderTriplet(msg);
  var content = args.join(" ");
  var filename = "gmNPCInit"
  var auth = global.auth;
  var drive = google.drive({version: 'v3', auth});
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  var userFolderID = await findUserFolderFromMsg(msg);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  // find the file
  var gmNPCFileID = await findFileByName(filename, userFolderID, msg.channel.id);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  // don't get attached to the id just yet
  if (gmNPCFileID === -1) {
    // create if nonexistent
    await setContentsByFilenameAndParent(msg, filename, userFolderID, '');
    while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  }
  // if it didn't exist the first time, repeat the find
  if (gmNPCFileID === -1)
    gmNPCFileID = await findFileByName(filename, userFolderID, msg.channel.id);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  // now we can have the id
  // get and parse the contents
  var oldContentString = await getFileContents(gmNPCFileID);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  var contentArray = null;
  if (oldContentString == '') contentArray = [];
  else contentArray = oldContentString.split(",");
  // add the new entries
  for (var x = 0; x < args.length; x++) {
    var newNPC = `${args[x]} ${args[x+1]} ${args[x+2]}`;
    contentArray[contentArray.length] = newNPC;
    x = x + 2;
  }
  // save, notify, remove hourglass
  var newContentString = contentArray.join(",");
  setContentsByFilenameAndParent(msg, filename, userFolderID, newContentString);
  removeHourglass(msg);
  msg.reply(` you now have ${contentArray.length} NPC's in this channel.`)
  console.log(`🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}/${msg.author.id}`);
}
async function handleRemoveNPCInitCommand(msg, cmd, args, user) {
  global.lastFoundFileID[msg.channel.id] = -1;
  msg.react('⏳');
  await ensureFolderTriplet(msg);
  var content = args.join(" ");
  var filename = "gmNPCInit"
  var auth = global.auth;
  var drive = google.drive({version: 'v3', auth});
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  var userFolderID = await findUserFolderFromMsg(msg);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  lockDiskForChannel(msg.channel.id);
  // ensure the file
  drive.files.list(
    {q: `"${userFolderID}" in parents and name="${filename}"`,
    fields: 'nextPageToken, files(id, name, parents)'},
    (err, res) => {
      if (err) console.err(err);
      // in the event of no match
      if (res.data.files.length) {
        res.data.files.map((file) => {
          global.lastFoundFileID[msg.channel.id] = file.id;
        });
      } else {
        // it didn't exist; make an empty file
        unlockDiskForChannel(msg.channel.id);
        setContentsByFilenameAndParent(msg, filename, userFolderID, '');
        lockDiskForChannel(msg.channel.id);
        // now the file surely exists -- redo the find, get the file id
        drive.files.list(
          {q: `"${userFolderID}" in parents and name="${filename}"`,
          fields: 'nextPageToken, files(id, name, parents)'},
          (err, res) => {
            if (err) return console.error(err);
            // we must check for filename match
            if (res.data && res.data.files.length) {
              res.data.files.map((file)=>{
                global.lastFoundFileID[msg.channel.id] = file.id;
              });
            }
          }
        );
      }
      unlockDiskForChannel(msg.channel.id);
  });
  // get the file's id
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  var gmNPCFileID = global.lastFoundFileID[msg.channel.id];
  // get and parse the contents
  var oldContentString = await getFileContents(gmNPCFileID);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  var contentArray = null;
  if (oldContentString == '') contentArray = [];
  else contentArray = oldContentString.split(",");
  var newContentArray = [];
  // parse the args entries and delete the requested entries
  var removedIndex = [];
  for (var y = 0; y < contentArray.length; y++) {
    for (var x = 0; x < args.length; x++) {
      var remove = `${args[x]} ${args[x+1]} ${args[x+2]}`;
      if (contentArray[y] == remove) {
        // don't keep it
        removedIndex[removedIndex.length] = y;
        x = x + 2; // the top of the for() loop does x++; we skip to next trio
      } else {
        // try matching just the label
        caySplitArray = contentArray[y].split(" ");
        if (args[x] !== null && caySplitArray[2] == args[x]) {
          removedIndex[removedIndex.length] = y;
        }
      }
    }
  }
  // now rebuild it better
  for (var y = 0; y < contentArray.length; y++) {
    if (removedIndex.indexOf(y) == -1)
      newContentArray[newContentArray.length] = contentArray[y];
  }
  // save, notify, remove hourglass
  var newContentString = newContentArray.join(",");
  setContentsByFilenameAndParent(msg, filename, userFolderID, newContentString);
  removeHourglass(msg);
  msg.reply(` you removed ${removedIndex.length} NPC's. `
  + `You now have ${newContentArray.length} NPC's in this channel.`)
  console.log(`🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}/${msg.author.id}`);
}
async function handleListNPCInitCommand(msg, cmd, args, user) {
  msg.react('⏳');
  await ensureFolderTriplet(msg);
  var auth = global.auth;
  var drive = google.drive({version: 'v3', auth});
  var filename = 'gmNPCInit';
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  var parentFolderID = await findUserFolderFromMsg(msg);
  var gmNPCFileID = await findFileByName(filename, parentFolderID, msg.channel.id);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  if (gmNPCFileID == -1) {
    // file doesn't exist
    var output = " you have no NPC's configured in this channel yet.";
  } else {
    // file exists
    while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
    var contentString = await getFileContents(gmNPCFileID);
    while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }

    var contentArray = contentString.split(",");
    // clean any blank entries
    var tmpArr = [];
    contentArray.map((content)=> {
      if (content.length > 0) tmpArr[tmpArr.length] = content;
    });
    contentArray = tmpArr;
    // determine/build output
    if (contentArray.length > 0) {
      // file exists and has NPC's in it
      var output = " your NPC's inits in this channel are:";
      for (var x = 0; x < contentArray.length; x++) {
        var [dice,mod,label] = contentArray[x].split(" ");
        output += `\n:arrow_right: ${dice}d6 +${mod} :label: ${label}`
      }
    } else {
      // file exists but was blank
      var output = " you have no NPC's in this channel yet.";
    }
  }
  removeHourglass(msg);
  msg.reply(output);
  // listAllFiles();
  console.log(`🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}/${msg.author.id}`);
}
async function handleClearNPCInitCommand(msg, cmd, args, user) {
  msg.react('⏳');
  await ensureFolderTriplet(msg);
  var auth = global.auth;
  var drive = google.drive({version: 'v3', auth});
  var filename = 'gmNPCInit';
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  var parentFolderID = await findUserFolderFromMsg(msg);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  lockDiskForChannel(msg.channel.id);
  drive.files.list(
    {q:`"${parentFolderID}" in parents and name="${filename}"`,
    fields: 'nextPageToken, files(id, name, parents)'},
    (err, res) => {
      unlockDiskForChannel(msg.channel.id);
      if (err) return console.error(err);
      if (res.data.files.length == 0) { } else {
        // delete it
        res.data.files.map((file) => {
          deleteFileById(file.id, (err,res)=>{}, msg.channel.id);
        });
      }
    }
  );
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  // remove reaction
  removeHourglass(msg);
  msg.reply(' you cleared your NPC initiative formulas for this channel.');
  // listAllFiles();
  console.log(`🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}/${msg.author.id}`);
}
// @ =========== HANDLEMESSAGE FUNCTION ============
function handleMessage(msg, user=msg.author) {
  // stop confusing people during development!!
  // if (user.id !== '360086569778020352') return;
  // check if message starts with `!`
  var message = msg.content;
  if (message.substring(0, 1) == '!') {
      var args = message.substring(1).split(' ');
      var cmd = args[0];
      args = args.splice(1);
      cmd = cmd.toLowerCase();
      switch(cmd) {
          case 'help':
          case 'inithelp':
            handleHelpCommand(msg, cmd, args, user);
          break;
          case 'list':
            if (user.id == '360086569778020352') listAllFiles(msg);
          break;
           case 'delall':
            if (user.id == '360086569778020352') deleteAllFiles();
          break;
          case 'del':
            if (user.id == '360086569778020352') deleteFile(msg, args);
          break;
          case 'open':
            if (user.id == '360086569778020352') openFile(msg, args);
          break;
          case 'showcache':
            if (user.id == '360086569778020352') showCache(msg);
          break;
          case 'unlock':
            if (user.id == '360086569778020352') adminUnlock(msg, args);
          break;
          case 'init':
          case 'init2':
          case 'init3':
          case 'initflip':
          case 'init2flip':
          case 'init3flip':
          case 'initcp':
            handleInitCommand(msg, cmd, args, user);
          break;
          case 'setgm':
            handleSetGMCommand(msg, cmd, args, user);
          break;
          case 'setp':
          case 'setplayers':
          case 'setplayer':
            handleSetPlayersCommand(msg, cmd, args, user);
          break;
          case 'addp':
          case 'addplayers':
          case 'addplayer':
            handleAddPlayersCommand(msg, cmd, args, user);
          break;
          case 'lp':
          case 'listplayers':
            handleListPlayersCommand(msg, cmd, args, user);
          break;
          case 'rmp':
          case 'removeplayer':
          case 'removeplayers':
            handleRemovePlayersCommand(msg, cmd, args, user);
          break;
          case 'clrp':
          case 'clearplayers':
            handleClearPlayersCommand(msg, cmd, args, user);
          break;
          case 'si':
          case 'seti':
          case 'setinit':
            handleSetInitCommand(msg, cmd, args, user);
          break;
          case 'setn':
          case 'setnpc':
          case 'setnpcs':
          case 'setnpcinits':
          case 'setnpcinit':
            handleSetNPCInitCommand(msg, cmd, args, user);
          break;
          case 'addn':
          case 'addnpc':
          case 'addnpcs':
          case 'addnpcinits':
          case 'addnpcinit':
            handleAddNPCInitCommand(msg, cmd, args, user);
          break;
          case 'ln':
          case 'listnpcs':
          case 'listnpcinits':
          case 'listnpcinit':
            handleListNPCInitCommand(msg, cmd, args, user);
          break;
          case 'rmn':
          case 'rmnpc':
          case 'rmnpcs':
          case 'removenpc':
          case 'removenpcs':
          case 'removenpcinit':
          case 'removenpcinits':
            handleRemoveNPCInitCommand(msg, cmd, args, user);
          break;
          case 'clrn':
          case 'clearnpcinits':
          case 'clearnpcinit':
            handleClearNPCInitCommand(msg, cmd, args, user);
          break;
          default:
            handleRollCommand(msg, cmd, args, user);
          break;
       }
   }
   // no return
}

// Hook the handler
bot.on('message', (msg) => {    handleMessage(msg);   });
