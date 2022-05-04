/*
 * Shadowrun 1e GameBot by Discord user AstroMacGuffin#1486 (Nathan Hawks)
 * Yes I do regret baking 1e into the name
 * version 0.13, yeah that sounds good
 * Released under the terms of the UnLicense. This work is in the public domain.
 * Released as-is with no warranty or claim of usability for any purpose.
 * The file cache doesn't work, don't enable it.
 */
// require express for log date/time
var express = require('express');
// require crypto for reminders (random strings)
var crypto = require('crypto');
// for defaulting if's & callbacks
function doNothing (err=null, res=null) {}
// set true to activate warning messages
var isMaintenanceModeBool = true;
// set status message to send as warning when isMaintenanceModeBool is true
var maintenanceStatusMessage = '\n**Bzzt. Hoi!** '
/*
+ 'The bot\'s in maintenance mode.** If it forgets rerolls faster than normal, '
+ 'it means I rebooted the bot.'
*/
/*
+ ' Testing a major upgrade! Please DM me if the bot goes offline!'
+ ' Pzzhht! -<@360086569778020352>'
*/
/*
+ 'Chasing bugs in the initiative and macro systems. Normal rolls should be fine.'
*/
+ ' Working on new features! I hope none of your dice rolls are dropped during restarts!'
+ ' Please notify me of any suspected bugs ASAP with a screenshot and timezone: <@360086569778020352>'
//+ ' If initiative bugs out, just type the command again and it will probably work on the 2nd try.'
;
// conditionally add warning message
function addMaintenanceStatusMessage(output) {
  var r = "";
  if (isMaintenanceModeBool == true) r = output + " " + maintenanceStatusMessage;
  else r = output;
  return r;
}
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
// internal setup
// for reminders
global.reminders = [];
global.lastRemindersTime = '';
// for listAllFiles
global.filesFound = [];
// system folder(s)
global.folderID = {UserData: null, reminders: null};
// google drive API lock per channel id, to avoid race conditions
global.lock = { };
// config (debugging flags, etc)
global.config = {
  // debugging options
  logspam:                            true,
  // disables initial google drive setup
  skipInitInitiative:                 false,
  // this gets spammy and you can !list in chat now
  listAllFilesOnStartup:              false,
};
// @ =================== CACHE ====================
function resetCache() {
  global.cache = {
    server: [],  // arr of obj: googleID, discordID
    channel: [], // arr of obj: googleID, discordID, parentID,
    userInChannel: [], // arr of obj: googleID, discordID, parentID
    file: [], // arr of obj: googleID, name, parentID
    fileContent: [], // arr of obj: googleID, content
    playChannel: [], // arr of obj: server, channel, user, playChannel
    folderTriplet: [] // arr of obj: server, channel, user, googleID
  };
}
resetCache();
// function _cache_googleIDMatch(obj, file) {
//   if (obj.googleID && file.id && obj.googleID === file.id)
//     return true;
//   else return false;
// }
function _cache_nameAndParentMatch(obj, file) {
  if (obj.discordID && file.name && obj.discordID === file.name
    && file.parents && file.parents.length && obj.parentID
    && obj.parentID === file.parents[0])
    return true;
  else return false;
}
function _cache_serverNameMatch(obj, file) {
  var i = 0;
  var r = -1;
  if (file.name) {
    if (file.name === obj.discordID) return true;
  }
  if (r > -1) return true;
  else return false;
}
function cacheHas(file, cacheAs) {
  var i = getCacheIndex(file, cacheAs, false);
  if (i > -1) return true;
  else return false;

}
function getCacheIndex(file, cacheAs, create=true) {
  var r = -1;
  var i = 0;
  var id = file.id;
  if (cacheAs === 'playChannel' || cacheAs === 'folderTriplet') {
    // fast-track playChannel seek
    for (i = 0; i < global.cache[cacheAs].length; i++) {
      var obj = global.cache[cacheAs][i];
      if (obj.server === file.server
        && obj.channel === file.channel
        && obj.user === file.user)
      {
        return i;
      }
    }
  }
  if (id) {
    // fast track id => index seeking
    var idIndex = [];
    global.cache[cacheAs].map((c) => {
      idIndex[i] = c.googleID;
      i++;
    });
    r = idIndex.indexOf(id);
    if (r > -1) {
      logSpam('Found cache index ' + cacheAs + r);
      return r;
    }
  }
  r = -1;
  i = 0;
  for (i = 0; i < global.cache[cacheAs].length; i++) {
    // valid matches: id match; or parent & discordID (filename) match together
    // if (_cache_googleIDMatch(obj, file)) r = i;
    // servers don't need a parent, just the filename
    var obj = global.cache[cacheAs][i];
    if (cacheAs === 'server' && _cache_serverNameMatch(obj, file)) return i;
    if (cacheAs != 'playChannel' && cacheAs != 'server'
    && _cache_nameAndParentMatch(obj, file))
      return i;
    if (cacheAs === 'file') {
      if (file.parents && file.parents.length
      && obj.discordID === file.name && obj.parentID === file.parents[0])
        return i;
    }
  }
  if (create === false) return r;
  // if there was no match, reserve an index and return it
  r = global.cache[cacheAs].length;
  global.cache[cacheAs][r] = {};
  return r;
}
function addToCache(file, cacheAs) {
  var ci = getCacheIndex(file, cacheAs);
  switch(cacheAs) {
    case 'folderTriplet':
      global.cache.folderTriplet[ci] = {
        server: file.server, channel: file.channel, user: file.user,
        googleID: file.id
      };
    break;
    case 'playChannel':
      // no parent; special cache
      global.cache.playChannel[ci] = {
        server: file.server, channel: file.channel, user: file.user,
        playChannel: file.playChannel
      };
    break;
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
      if (file.id)      global.cache.file[ci].googleID = file.id;
      if (file.name)    global.cache.file[ci].discordID = file.name;
      if (file.parents) global.cache.file[ci].parentID = file.parents[0];
    break;
    case 'fileContent':
      if (file.content) {
        if (file.id)      global.cache.fileContent[ci].googleID = file.id;
        if (file.content) global.cache.fileContent[ci].content = file.content;
      }
      else {
        // no content; remove the element from the cache
        global.cache.fileContent.splice(ci, 1);
      }
    break;
  }
}
function delFromCache(gID, cacheAs) {
  var ci = getCacheIndex({id: gID}, cacheAs, false);
  if (ci != -1) {
    global.cache[cacheAs].splice(ci, 1);
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
// @ ================== DX FUNCS ================
function getDate() {
  var d = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
  return d;
}
function getColorDate() {
  var d = getDate();
  return `\x1b[36m${d}\x1b[0m`;
}
async function logSpam(msg) {
  var d = getColorDate();
  if (global.config.logspam) console.log(`${d} ${msg}`);
}
async function openFile(msg, args) {
  var output = await getFileContents(args[0], 'system');
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  msg.channel.send("```\n" + output + "```").catch((e) => {console.log(e);});
}
function listAllFiles(msg) {
  var nextPageToken = undefined;
  var output = '--- [filename] ---------   ------------ googleID ------------- ------------ parentID -------------\n';
  var finalout = '';
  var iteratePage = function (nextPageToken, level=0) {
    var q = { fields: 'nextPageToken, files(id, name, parents)' };
    var filesFound = [];
    q.pageToken = nextPageToken;
    logSpam('Querying GDrive for a list');
    lockDiskForChannel('system');
    drive.files.list(q, (err, res) => {
      lockDiskForChannel('system');
      if (res.data.files) {
        logSpam(`res.data.files got ${res.data.files.length}`);
      }
      else {
        logSpam('res.data.files got nothing');
      }
      if (err) return console.error(err);
      logSpam('No error returned');
      var files = res.data.files;
      if (files.length) {
        logSpam(res.data.nextPageToken);
        var x = 0;
        for (x = 0; x < files.length; x++) {
          global.filesFound[global.filesFound.length] = files[x];
        }
        nextPageToken = res.data.nextPageToken;
        logSpam('nextPageToken = ' + nextPageToken);
      } else if (res.data.nextPageToken === 'undefined' || res.data.nextPageToken === undefined) {
        nextPageToken = undefined;
      } else {
        nextPageToken = undefined;
        output += 'No files found.';
      }
      logSpam(`Finishing callback with ${global.filesFound.length} files found on level ${level}`);
      if (nextPageToken !== undefined) {
        iteratePage(nextPageToken, level+1);
      }
      else {
        var x;
        for (x = 0; x < global.filesFound.length; x++) {
          // temporary / fallback (old version)
          var file = global.filesFound[x];
          output += `${file.name.padEnd(26)} (${file.id}) [${file.parents}]\n`;
        }
        if (msg !== undefined && output.length < 1994)
          msg.channel.send(`\`\`\`${output}\`\`\``)
          .catch((e) => {console.log(e);});
        else if (msg !== undefined) {
          var outArr = output.split("\n");
          output = '';
          for (var x = 0; x < outArr.length; x++) {
            output += outArr[x] + "\n";
            if (output !== '\n') {
              if (x%20 === 0) {
                msg.channel.send('```\n' + output + '```')
                .catch((e) => {console.log(e);});
                output = '';
              } else if (outArr.length - x < 20) {
                finalout = output;
              }
            }
          }
          if (finalout !== '\n') {
            msg.channel.send('```\n' + finalout + '```')
            .catch((e) => {console.log(e);});
          }
        }
        else console.log(output);
        global.filesFound = [];
      }
    });
  }
  var auth = global.auth;
  const drive = google.drive({version: 'v3', auth});
  var q = {};
  q = { fields: 'nextPageToken, files(id, name, parents)' };
  if (nextPageToken !== undefined) q.pageToken = nextPageToken;
  logSpam('Querying GDrive for a list');
  lockDiskForChannel('system');
  drive.files.list(q, (err, res) => {
    lockDiskForChannel('system');
    if (res.data.files) {
      logSpam(`res.data.files got ${res.data.files.length}`);
    }
    else {
      logSpam('res.data.files got nothing');
    }
    if (err) return console.error(err);
    logSpam('No error returned');
    var files = res.data.files;
    if (files.length) {
      logSpam(res.data.nextPageToken);
      var x = 0;
      for (x = 0; x < files.length; x++) {
        global.filesFound[filesFound.length] = files[x];
      }
      nextPageToken = res.data.nextPageToken;
      logSpam('nextPageToken = ' + nextPageToken);
    } else if (res.data.nextPageToken === 'undefined' || res.data.nextPageToken === undefined) {
      nextPageToken = undefined;
    } else {
      nextPageToken = undefined;
      output += 'No files found.';
    }
    if (nextPageToken) iteratePage(nextPageToken);
    logSpam('Finishing callback');
  });
  unlockDiskForChannel('system');
  while(isDiskLockedForChannel('system')) { sleep(15); }
  logSpam('Disk unlocked');
}
function deleteFile(msg, args) {
  if (args && args[0]) {
    deleteFileById(args[0], (err, res) => {
      msg.channel.send("```" + args[0] + ' deleted.```')
      .catch((e) => {console.log(e);});
    });
  }
}
function showCache(msg) {
  var output = '\nGeneral\n[CacheID]  - name/discordID - ------------ googleID ----------- ----------- parentID ------------\n';
  var finalout = '';
  var cxArr = ['server', 'channel', 'userInChannel', 'file'];
  var foundCache = false;
  cxArr.map((cx) => {
    for (var x = 0; x < global.cache[cx].length; x++) {
      if (!global.cache[cx][x]) continue;
      foundCache = true;
      var id = `${cx.substring(0,4)}${x}`;
      id = id.padEnd(10, " ");
      var did = (global.cache[cx][x].hasOwnProperty('discordID'))
        ? global.cache[cx][x].discordID.padEnd(18, " ")
        : " ".padEnd(18, " ");
      var gid = global.cache[cx][x].googleID;
      var par = global.cache[cx][x].parentID;
      if (par === undefined) par = "[UserData]".padStart(11, " ");
      output += `${id} ${did} ${gid} ${par}\n`
    }
  });
  if (foundCache === false) output += " Cache empty\n";
  var x = 0;
  output += '\nFile Contents\n[CacheID] ------------------- ------------ googleID ----------- ------------ content ------------\n';
  global.cache.fileContent.map((c) => {
    var id = `fcon${x}`.padEnd(10, " ");
    var spa = " ".padEnd(18, " ");
    var gid = c.googleID;
    if (c.content === undefined) c.content = "";
    var con = c.content.substring(0, 33);
    con = con.replace(/\n/g, " ");
    output += `${id} ${spa} ${gid} ${con}\n`;
    x++;
  });
  if (x === 0) output += " Cache empty\n";
  var pcx = 0;
  output += '\nPlay Channels\n[CacheID]  ----- server ----- ----- channel ---- ------ user ------ ----- playChannel -----\n';
  global.cache.playChannel.map((pc) => {
    var id = `play${pcx}`.padEnd(10, " ");
    var s = pc.server;
    var c = pc.channel;
    var u = pc.user;
    var p = pc.playChannel;
    output += `${id} ${s} ${c} ${u} ${p}\n`;
    pcx++;
  });
  if (pcx === 0) output += " Cache empty\n";
  var ftx = 0;
  output += '\nFolder Triplets\n[CacheID]  ----- server ----- ----- channel ---- ------ user ------ ----- googleID -----\n';
  global.cache.folderTriplet.map((ft) => {
    var id = `trip${ftx}`.padEnd(10, " ");
    var s = ft.server;
    var c = ft.channel;
    var u = ft.user;
    var t = ft.googleID;
    output += `${id} ${s} ${c} ${u} ${t}\n`;
    ftx++;
  });
  if (ftx === 0) output += " Cache empty\n";
  // 2000 or fewer characters please
  var outArr = output.split("\n");
  output = '';
  for (var i = 0; i < outArr.length; i++) {
    output += outArr[i] + "\n";
    if (i%15===0 && i != 0) {
      msg.channel.send('```' + output + '```')
      .catch((e) => {console.log(e);});
      output = '';
    } else if (outArr.length - i < 15) {
      finalout = output;
    }
  }
  if (finalout) msg.channel.send('```' + finalout + '```')
  .catch((e) => {console.log(e);});
}
function clearCache(msg) {
  resetCache();
  showCache(msg);
}
// unlock global.lock for a specific channel
function adminUnlock(msg, args) {
  var channel = -1;
  if (msg && msg.channel && args.length === 0) {
    channel = msg.channel.id
  } else { channel = args[0]; }
  global.lock[channel] = false;
}
function adminUnlockAll(msg) {
  var i;
  for (i = 0; i < global.lock.length; i++) {
    global.lock[i] = false;
  };
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
  var gmPlayChannelID = await getPlayChannel(msg);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  // Try asking the cache for the whole triplet endpoint
  var q = {server: msg.channel.guild.id, channel: gmPlayChannelID, user: msg.author.id};
  if (cacheHas(q, 'folderTriplet')) {
    logSpam('ensureFolderTriplet found triplet in cache');
    logSpam(' [ ==================== exiting ensureFolderTriplet ============ ]');
    return;
  }
  // Get the server folder's googleID
  var q = {name: serverDiscordID};
  if (cacheHas(q, 'server')) {
    serverFolderID = getFromCache(q, 'server').googleID;
    logSpam('Found server folder in cache');
  } else {
    while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
    try {
      logSpam('ensureFolderTriplet entering ensureFolderByName (server folder)');
      await ensureFolderByName(serverDiscordID, userDataFolderID, msg.channel.id);
      while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
    } catch (e) { console.log(e); }
    try {
      logSpam('ensureFolderTriplet entering findFolderByName (server folder)');
      serverFolderID = await findFolderByName(serverDiscordID, userDataFolderID,
        (err, res) => {
          logSpam('ensureFolderTriplet in callback for findFolderByName (server folder)');
          while (isDiskLockedForChannel(msg.channel.id)) { sleep(15); }
          if (err) return console.error(err);
          lockDiskForChannel(msg.channel.id);
          if (res.data.files.length === 1) {
            addToCache(res.data.files[0], 'server');
          } else {
            console.error(`> BAD: server ${msg.channel.guild.id} is in UserData `
              + `(${res.data.files.length}) times.`);
          }
          unlockDiskForChannel(msg.channel.id);
      }, msg.channel.id);
    } catch (e) { console.log(e); }
    logSpam('ensureFolderTriplet exited callback for findFolderByName (server folder)');
    while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
    logSpam('ensureFolderTriplet clear of callback for findFolderByName (server folder)');
  }
  // channel folder
  q = {name: gmPlayChannelID, parents: [serverFolderID]};
  if (cacheHas(q, 'channel')) {
    channelFolderID = getFromCache(q, 'channel').googleID;
    logSpam('Found channel folder in cache');
  } else {
    try {
      logSpam('ensureFolderTriplet entering ensureFolderByName (channel folder)');
      await ensureFolderByName(gmPlayChannelID, serverFolderID, gmPlayChannelID);
      while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
    } catch (e) { console.log(e); }
    try {
      logSpam('ensureFolderTriplet entering findFolderByName (channel folder)');
      channelFolderID = await findFolderByName(gmPlayChannelID, serverFolderID,
        (err, res) => {
          logSpam('ensureFolderTriplet in callback for findFolderByName (channel folder)');
          while (isDiskLockedForChannel(msg.channel.id)) { sleep(15); }
          if (err) return console.error(err);
          lockDiskForChannel(gmPlayChannelID);
          if (res.data.files.length === 1) {
            addToCache(res.data.files[0], 'channel');
          } else {
            console.error(`> BAD: channel ${gmPlayChannelID} is in `
              + `${serverFolderID} (${res.data.files.length}) times.`);
          }
          unlockDiskForChannel(gmPlayChannelID);
        }, msg.channel.id);
    } catch (e) { console.log(e); }
    logSpam('ensureFolderTriplet exited callback for findFolderByName (channel folder)');
    while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
    logSpam('ensureFolderTriplet clear of callback for findFolderByName (channel folder)');
  }
  // user folder
  q = {name: msg.author.id, parents: [channelFolderID]};
  if (cacheHas(q, 'userInChannel')) {
    logSpam('Found user folder in cache');
    // we're only here to ensure it exists; it does so we're done
  }
  else {
    try {
      logSpam('ensureFolderTriplet entering ensureFolderByName (user folder)');
      await ensureFolderByName(msg.author.id, channelFolderID, gmPlayChannelID);
      while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
    } catch (e) { console.log(e); }
    try {
      logSpam('ensureFolderTriplet entering findFolderByName (user folder)');
      await findFolderByName(msg.author.id, channelFolderID, (err, res) => {
        logSpam('ensureFolderTriplet in callback for findFolderByName (user folder)');
        while (isDiskLockedForChannel(gmPlayChannelID)) { sleep(15); }
        if (err) return console.error(err);
        lockDiskForChannel(gmPlayChannelID);
        if (res.data.files.length === 1) {
          addToCache(res.data.files[0], 'userInChannel');
          // we have the whole triplet now; cache it as such
          addToCache({
            server: msg.channel.guild.id,
            channel: gmPlayChannelID,
            user: msg.author.id,
            id: res.data.files[0].id
          }, 'folderTriplet');
        }
        else { console.error(`> BAD: author ${msg.author.id} is in `
          + `${channelFolderID} (${res.data.files.length}) times.`)}
        unlockDiskForChannel(gmPlayChannelID);
      }, gmPlayChannelID);
    } catch (e) { console.log(e); }
    logSpam('ensureFolderTriplet exited callback for findFolderByName (user folder)');
    while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
    logSpam('ensureFolderTriplet clear of callback for findFolderByName (user folder)');
  }
  logSpam(' [ ==================== exiting ensureFolderTriplet ============ ]')
}

async function findUserFolderFromMsg(msg, usePlayChannel=false) {
  // a User's folder exists in (root)/UserData/ServerID/ChannelID/UserID
  var r = null; // the userFolderID
  var s = null; // the server googleID
  var discordChannelID = -1;
  if (usePlayChannel) {
    discordChannelID = await getPlayChannel(msg);
    while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  }
  else discordChannelID = msg.channel.id;
  // first try to get it from cache
  var q = {name: msg.channel.guild.id}
  if (cacheHas(q, 'server')) {
    s = getFromCache(q, 'server').googleID;
    logSpam(`findUserFolderFromMsg found server in cache: ${s}`);
    q = {name: discordChannelID, parents: [s]};
    if (cacheHas(q, 'channel')) {
      var c = getFromCache(q, 'channel').googleID;
      logSpam(`findUserFolderFromMsg found channel in cache: ${c}`);
      q = {name: msg.author.id, parents: [c]};
      if (cacheHas(q, 'userInChannel')) {
        r = getFromCache(q, 'userInChannel').googleID;
        logSpam("Found user folder at " + s + "/" + c + "/" + r);
        return r;
      }
    }
  }
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  // the cache didn't return -- do it the slow way
  var serverFolderID;
  serverFolderID = await findFolderByName(msg.channel.guild.id,
    global.folderID.UserData, doNothing, discordChannelID);
  while (isDiskLockedForChannel(discordChannelID)) { await sleep(15); }
  logSpam ("GDrive seek sID: " + serverFolderID);
  if (serverFolderID === -1) {
    msg.reply(' :man_facepalming: something went wrong. Please try your command again. :man_facepalming:')
    .catch((e) => {console.log(e);});
  }
  var channelFolderID = await findFolderByName(discordChannelID,
    serverFolderID, doNothing, discordChannelID);
  while (isDiskLockedForChannel(discordChannelID)) { await sleep(15); }
  logSpam ("GDrive seek cID: " + channelFolderID);
  // return the file ID
  r = await findFolderByName(msg.author.id,
    channelFolderID, doNothing, discordChannelID);
  while (isDiskLockedForChannel(discordChannelID)) { await sleep(15); }
  logSpam ("Gdrive seek uID: " + r);
  return r;
}

async function findUserFolderFromUserID(msg, userID, usePlayChannel=false) {
  // a User's folder exists in (root)/UserData/ServerID/ChannelID/UserID
  var gmPlayChannelID = -1;
  if (usePlayChannel) gmPlayChannelID = await getPlayChannel(msg);
  else gmPlayChannelID = msg.channel.id;
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  var r = null;
  // try to get it from cache first
  var q = {name: msg.channel.guild.id};
  if (cacheHas(q, 'server')) {
    var serverID = getFromCache(q, 'server').googleID;
    q = {name: gmPlayChannelID, parents: [serverID]};
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
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  if (serverFolderID !== -1) {
    addToCache({
      name:msg.channel.guild.id, id:serverFolderID
    }, 'server');
    var channelFolderID = await findFolderByName(gmPlayChannelID, serverFolderID,
      doNothing, gmPlayChannelID);
    while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
    if (channelFolderID !== -1) {
      addToCache({
        name:gmPlayChannelID, parents:[msg.channel.guild.id], id:channelFolderID
      }, 'channel');
      r = await findFolderByName(userID, channelFolderID, doNothing, gmPlayChannelID);
      while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
      if (r !== -1) {
        addToCache({
          name:userID, parents:[channelFolderID], id:r
        }, 'userInChannel');
        addToCache({
          server:msg.channel.guild.id, channel:gmPlayChannelID, user:userID, id:r
        }, 'folderTriplet');
      }
      // return the file ID
      unlockDiskForChannel(gmPlayChannelID);
      return r;
    }
  }
  unlockDiskForChannel(gmPlayChannelID);
  return -1;
}

// @ function ensureFolderByName(name, parentID=null, channelID="system")
function ensureFolderByName(name, parentID=null, channelID="system") {
  findFolderByName(name, parentID, (err, res) => {
    if (err) return console.error(err);
    logSpam(`Ensuring folder ${name} exists`);
    const files = res.data.files;
    if (files.length === 0) {
      logSpam('It doesn\'t exist; creating it');
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
  if (parentID === -1) {
    console.log(`findFolderByName: parentID was -1, `
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
  drive.files.list(q, (err, res) => {
    if (err) return console.error(err);
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
    (err, res) => {
      if (err) {
        lastFoundFileID = -1;
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
      fileContent = c.content;
      unlockDiskForChannel(channelID);
      return c.content;
    }
  }
  logSpam('Seeking file in GDrive');
  var auth = global.auth;
  const drive = google.drive({version: 'v3', auth});
  drive.files.get({fileId: fileID, alt: "media"}, (err, res) => {
    if (err) { unlockDiskForChannel(channelID); return console.error(err); }
    // strip padding which was added to bypass a very weird API error
    fileContent=res.data.substring(0,res.data.length-2);
    addToCache({id: fileID, content: fileContent}, 'fileContent');
    unlockDiskForChannel(channelID);
  });
  while (isDiskLockedForChannel(channelID)) { await sleep(15); }
  return fileContent;
}

async function setContentsByFilenameAndParent(msg, filename, parentFolderID, contents) {
  // prep for disk ops
  var channelID = msg.channel.id;
  while (isDiskLockedForChannel(channelID)) { await sleep(15); }
  lockDiskForChannel(channelID);
  var auth = global.auth;
  const drive = google.drive({version: 'v3', auth});
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
          logSpam(`Creating file ${filename}`);
          unlockDiskForChannel(channelID);
          if (err) return console.error(err);
          // don't add to cache -- let it happen on next load
          return;
        });
      } else if (res.data.files.length===1) {
        // it already exists, update it
        res.data.files.map((file) => {
            drive.files.update({
              fileId: file.id, media: {body: `${contents}/2`}},
              (err, res) => {
                logSpam(`Updating file ${filename}`);
                unlockDiskForChannel(channelID);
                if (err) return console.error(err);
                else return;
            });
            // update cache
            var q = {id: file.id, content: contents};
            addToCache(q, 'fileContent');
        });
      }
    }
  );
  while (isDiskLockedForChannel(channelID)) { await sleep(15); }
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
    if (reaction.emoji.name == '⏳') {
      reaction.remove().catch((e) => {
        console.log(e);
        logSpam('Seems I don\'t have permission to do reactions in this channel.');
        msg.channel.send('Seems I don\'t have permission to do reactions in this channel.');
      });
    }
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
    // filter non-numeric inputs for 1st & 2nd args (& display error only once)
    if (gotIt_Stop === false
      // loose comparison below is intentional DO NOT FIX
      && (Number(args[x]) != args[x] || Number(args[x+1]) != args[x+1]))
    {
      errOutput += ':thinking: see ":dragon_face: Adding NPC\'s :dragon_face:" '
        + 'in **!inithelp** for help.\n';
      gotIt_Stop = true;
    }
  }
  // abort if any errors
  if (errOutput !== '') {
    msg.reply(addMaintenanceStatusMessage(`there was a problem.\n${errOutput}`))
    .catch((e) => {console.log(e);});
    return false;
  } else return true;
}

// @ ================= INIT INITIATIVE ETC ================
async function initAll(auth) {
  global.auth = auth;
  // diagnostic / testing junk
  if (global.config.listAllFilesOnStartup === true) listAllFiles();
  if (global.config.skipInitInitiative === true) return;
  // init disk locking for system
  unlockDiskForChannel("system");
  initInitiative(auth);
  await initReminders();
}
// Init the Initiative system. See also callbackInitInitiative, immediately below
function initInitiative(auth) {
  // initial startup payload depends on whether UserData folder exists
  findFolderByName('UserData', 'root', (err, res) => {
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
// Init reminders
async function initReminders() {
  var userDataFolderID = await findFolderByName('UserData', 'root');
  while (isDiskLockedForChannel('system')) { await sleep(15); }
  await ensureFolderByName('reminders', userDataFolderID);
  while (isDiskLockedForChannel('system')) { await sleep(15); }
  var reminderFolderID = await findFolderByName('reminders', userDataFolderID);
  while (isDiskLockedForChannel('system')) { await sleep(15); }
  global.folderID.reminders = reminderFolderID;
  global.reminders = await getActiveReminders();
  if (global.reminders.length > 0) {
    for (var x = 0; x < global.reminders.length; x++) {
      global.reminders[x].MilliSecondsFromNow =
        new Date(global.reminders[x].dateTime).valueOf() - Date.now();
      var reminder = global.reminders[x];
      if (reminder.playersString !== undefined) {
        logSpam(`Players String: ${reminder.playersString}`);
        global.reminders[x].timeoutID = setTimeout(
          async (reminder
        ) => {
          logSpam(`Reminder ID: ${reminder.id}`);
          var d = new Date(reminder.sessionTimeDateF);
          var players = reminder.playersString.split(',');
          for (var y = 0; y < players.length; y++) {
            logSpam(`Attempting reminder to ${players[y]}`);
            var user = await bot.fetchUser(players[y]);
            user.send(`This is a reminder of your upcoming game`
              + ` at ${d} with GM <@${reminder.gmID}>.`)
              .catch((err) => { console.error(err); });
          }
          // upkeep system
          global.lastRemindersTime = Date.now();
          await _deleteReminder(reminder.id, reminder.userFolderID);
          logSpam(`System reminders var has ${global.reminders.length} entries`);
        }, global.reminders[x].MilliSecondsFromNow, global.reminders[x]);
      }
    }
  }
}
// =============== SCENE LIBRARY FUNCS ================
async function getSceneList(msg) {
  var gmPlayChannelID = await getPlayChannel(msg);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  var filename = 'gmSceneList';
  var userFolderID = await findUserFolderFromMsg(msg, true);
  while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
  var fileID = await findFileByName(filename, userFolderID, gmPlayChannelID);
  while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
  if (fileID !== -1) {
    var content = await getFileContents(fileID, gmPlayChannelID);
    while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
    if (content && content.length && content.length > 0) {
      var contentArr = content.split("\n|||||\n");
      var i = 0;
      var sceneList = [];
      contentArr.map((scene) => {
        if (scene.length > 0) {
          var sceneArr = scene.split("\n|||\n");
          sceneList[i] = {};
          sceneList[i].name = sceneArr[0];
          sceneList[i].googleID = sceneArr[1];
          i++;
        }
      });
      return sceneList;
    }
    else {
      return [];
    }
  }
  else {
    return [];
  }
}
async function updateSceneList(msg, newScene) {
  var gmPlayChannelID = await getPlayChannel(msg);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  var sceneList = await getSceneList(msg);
  while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
  var i = sceneList.length;
  var makeNewEntry = true;
  if (i === 0) sceneList = [];
  else {
    // don't add the same scene name twice
    sceneList.map((scene) => {
      if (scene.name === newScene.name) makeNewEntry = false;
    });
  }
  if (makeNewEntry) {
    sceneList[i] = {};
    sceneList[i].googleID = newScene.googleID;
    sceneList[i].name = newScene.name;
    await saveSceneList(msg, sceneList);
    while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
  }
  if (makeNewEntry) i++;
  return i;
}
async function deleteSceneFromList(msg, sceneName) {
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  logSpam(`Starting deleteSceneFromList for scene ${sceneName}`);
  var gmPlayChannelID = await getPlayChannel(msg);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  logSpam(`got gmPlayChannelID ${gmPlayChannelID}`)
  var sceneList = await getSceneList(msg);
  while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
  logSpam(`got sceneList: ${sceneList}`);
  var i = 0;
  if (sceneList.length === 0) {
    logSpam('sceneList length is 0');
    return -1;
  }
  else {
    for (i = 0; i < sceneList.length; i++) {
      logSpam('Seeking match');
      if (sceneList[i].name === sceneName) {
        sceneList.splice(i, 1);
        logSpam('Spliced');
      }
    }
    logSpam('Saving sceneList as: \n' + sceneList);
    await saveSceneList(msg, sceneList);
    while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
    logSpam('deleteSceneFromList returning');
    return sceneList.length;
  }
}
async function saveSceneList(msg, sceneList) {
  var gmPlayChannelID = await getPlayChannel(msg);
  var filename = 'gmSceneList';
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  var userFolderID = await findUserFolderFromMsg(msg, true);
  while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
  var content = '';
  sceneList.map((scene) => {
    if (scene.googleID && scene.name) {
      content += `${scene.name}\n|||\n${scene.googleID}\n|||||\n`;
    }
  });
  await setContentsByFilenameAndParent(msg, filename, userFolderID, content);
  while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
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
function getModifierFromArgs(args) {
  for (x = 0; x < args.length; x++) {
    var firstchar = args[x].substring(0, 1);
    if (firstchar === '+' || firstchar === '-') {
      // make sure the rest of the arg is a number
      var subj = args[x].substring(1, args[x].length);
      if (subj == Number(subj)) {
        // return the version with the +/- sign as a Number()
        return Number(args[x]);
      }
    }
  }
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
function sort1ETiebreaker(tmpArr, tbArr) {
  let didSort = false;
  if (tmpArr.length === 1) return [tmpArr, tbArr];
  logSpam('checking sort of ' + tmpArr.length);
  for (let y = 0; y < tmpArr.length; y++) {
    let thisCharacter = tmpArr[y].split(" ")[1];
    let nextCharacter = null;
    if (tmpArr.length >= y+2) nextCharacter = tmpArr[y+1].split(" ")[1];
    let thisIndex = -1;
    let nextIndex = -1;
    for (let z = 0; z < tbArr.length; z++) {
      if (tbArr[z].name === thisCharacter) { thisIndex = z; }
      if (nextCharacter && tbArr[z].name === nextCharacter) { nextIndex = z; }
    }
    if (nextIndex > -1) {
      logSpam(`${thisCharacter}: ${tbArr[thisIndex].phases}`);
      logSpam(`${nextCharacter}: ${tbArr[nextIndex].phases}`);
    }
    if (nextIndex > -1
      && tbArr[thisIndex].phases > tbArr[nextIndex].phases
    ) {
      // swap the array elements
      let tmp = tmpArr[y];
      tmpArr[y] = tmpArr[y+1];
      tmpArr[y+1] = tmp;
      didSort = true;
      logSpam('>>>>>>>>>>>>>>>>>>>>>> did sort');
    }
  }
  if (didSort) logSpam(tmpArr);
  if (didSort) [tmpArr,tbArr] = sort1ETiebreaker(tmpArr, tbArr);
  return [tmpArr,tbArr];
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
try {
  bot.login(token);
}
catch (e) {
  console.error(e);
  console.log('Trying to connect again in 15 seconds...');
  sleep(15000);
  try {
    bot.login(token);
  }
  catch (e) {
    console.log('Couldn\'t connect.');
  }
}

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
function handleRollCommand(msg, cmd, args, user, override=null) {
  // allow multiple roll commands separated by semicolon
  var cmdArr = null;
  if (override !== null) cmdArr = override.split(";");
  else cmdArr = msg.content.split(";");
  var output = '';
  for (var x = 0; x < cmdArr.length; x++) {
    if (output !== '') output += `\nRoll #${x+1}: `;
    // kill preceding or trailing space before it kills my parsing
    cmdArr[x] = cmdArr[x].trim();
    args = cmdArr[x].split(' ');
    cmd = args[0];
    args = args.splice(1);
    cmd = cmd.toLowerCase();
    if (cmd.substring(0, 1) === '!') cmd = cmd.substring(1);
    // SETUP: how many dice, and do we explode?
    var isTestBool = false;
    var isTotalBool = false;
    var numDiceInt = 0;
    var lastchar = lastChar(cmd);
    var modifier = 0;
    if (lastchar == '!') {
      isTestBool = true;
      numDiceInt = cmd.substring(0, cmd.length-1);
    } else if (lastchar == 't') {
      isTotalBool = true;
      numDiceInt = cmd.substring(0, cmd.length-1);
      // look for a modifier
      modifier = getModifierFromArgs(args);
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
      msg.reply(addMaintenanceStatusMessage(":no_entry_sign: you ordered an opposed test without an "
      + "opponent TN (the **otn** option).\nExample: **!6! tn4 vs5! *otn4***"))
      .catch((e) => {console.log(e);});
      return;
    }

    // SETUP: anything remaining is a note; prepare to pass it thru
    var note = prepRollNote(cmd, args, tnInt);

    // GO: Roll the bones ============================================
    var retarr = rollDice(numDiceInt, isTestBool, tnInt);
    var successesInt = retarr[0];
    var rollsIntArr = retarr[1];
    // handle opposed roll
    if (isOpposedBool) {
      var retarr = rollDice(opponentDiceInt, isOpposedTestBool, opponentTNInt);
      var opponentSuccessesInt = retarr[0];
      var opponentRollsIntArr = retarr[1];
    }
    // prep output and deliver it ====================================
    // handle total'd roll
    if (isTotalBool) {
      var total = 0;
      rollsIntArr.map((roll)=>{total+=roll;})
      if (modifier) total += modifier;
      output += `[Total: ${total}] | `;
    }
    if (isOpposedBool) {
      output += makeOpposedOutput(isOpposedBool, successesInt,
        opponentSuccessesInt, user, rollsIntArr, opponentRollsIntArr, note
      );
    }
    else {
      var successesFormattedString = "";
      if (successesInt > 0) {
        successesFormattedString = successesInt + ' successes ';
      }
      output += user + ', you rolled ' + successesFormattedString
      + '(' +rollsIntArr+ ') ' + note;
    }
    // end of for cmdArr loop
  }
  // avoid false positives e.g. when chatting about Astral Tabeltop dice formats
  if (numDiceInt > 0) {
    // modify output for maintenance mode status
    output = addMaintenanceStatusMessage(output);
    // post results
    msg.channel.send(output).catch((e) => {console.log(e);});
    // log activity
    console.log(getColorDate() + ' 🎲');
    // provide reroll ui (dice reaction)
    msg.react('🎲').catch((e) => {console.log(e);});
    // no return
  }

}
function handleHelpCommand(msg, cmd, args, user) {
  var whatToShow = 'main';
  // legacy help commands
  if (args.length && args[0] == 2 || cmd === 'inithelp') {
    whatToShow = 'init';
  }
  // new help commands
  else if (args.length) {
    switch (args[0]) {
      case 'main':
      case 'init':
      case 'scene':
      case 'macros':
      case 'gmscreen':
        whatToShow = args[0];
      break;
      default:
        whatToShow = 'index';
      break;
    }
  }
  else {
    whatToShow = 'index';
  }
  var index1 = '\nHelp Topics:\n'
    + '`main    ` - Dice rolls, Rule of 6, Target Numbers, Opposed Tests\n'
    + '`init    ` - Initiative for Shadowrun 1e-3e\n'
    + '`scene   ` - Prepare text and music for deploying later\n'
    + '`macros  ` - Saving and re-using named dice rolls\n'
    + '`gmscreen` - Doing initiative and/or scene prep in a hidden channel\n'
    + '\n'
    + 'Example: type **!help main** for the main help.\n'
  ;
  var main1 = '\nMain Help:\n'
    + '**====== Plain Old d6\'s ======**\n'
    + '!***X***         Roll ***X***d6 *without* Rule of 6'
    + '  ***example:*** !5        rolls 5d6 *without* Rule of 6\n'
    + '!X***t***        Roll Xd6 *and total them*.'
    + '  ***example:*** !6t       rolls 6d6 and *adds them up*.\n'
    + '!Xt ***+Z***     Roll Xd6, total them, and *add or subtract a modifier*.'
    + '  ***example:*** !6t -5    rolls 6d6, totals them, and *subtracts 5 from the total*.\n'
    + '\n'
    + '**====== Rule of 6 & Target Numbers ======**\n'
    + '!X***!***        Roll ***X***d6 ***with*** Rule of 6'
    + '  ***example:*** !5!       rolls 5d6 *with Rule of 6*\n'
    + '!X ***tnY***     Roll *without* Rule of 6 against Target Number ***Y***'
    + '  ***example:*** !5 tn4    rolls 5d6 w/o Rule of 6 vs TN4\n'
    + '!X***! tnY***    Roll ***with*** Rule of 6 against Target Number ***Y***'
    + '  ***example:*** !5! tn4   rolls 5d6 w/ Rule of 6 vs TN4\n'
    + '\n'
    + '**====== Opposed Rolls ======**\n'
    + '!A! tnB ***vsX!*** ***otnY***\n'
    + '   Roll *A*d6 (with Rule of 6) with tn *B*, opposed by *X*d6 (with Rule of 6) with opponent\'s TN *Y*\n'
    + '   vs*X* = the number of dice the opponent throws (vs*X*! for Rule of 6)\n'
    + '   otn*Y* = the opponent\'s target number\n'
    + '  ***example:*** !5! tn3 vs6! otn4    '
    + 'Roll 5d6 (Rule of 6) with TN 3, against 6d6 (Rule of 6) with TN 4\n'
    + '\n'
    + '**===== Multiple Rolls per Message =====**\n'
    + 'You can order GameBot to do more than one roll without sending multiple'
    + ' messages. Just separate the commands with semicolons.\n'
    + '***example:*** !1 (grenade scatter direction);'
    + ' 2t (max non-aero grenade scatter distance)\n';
    var main2 =
    '\n**====== Notes ======**\n'
    + 'Notes are OK, and your options can be in the middle of the note.\n'
    + 'examples:\n'
    + '  !3! TN4 resist wagemage sorcery      works\n'
    + '  !3! resist wagemage sorcery TN4      works\n'
    + '  !3! resist TN4 wagemage sorcery      works\n'
    + '  resist wagemage sorcery !3! TN4      won\'t work\n'
    + '\n'
    + '**===== Reroll =====**\n'
    + 'Anyone can click the :game_die: reaction to reroll any *recent* roll.\n'
    + 'Remove and re-add your reaction to keep re-rolling that roll.\n'
    + '\n'
    + ':boom: Oh, and one more thing... try **!inithelp** to learn about the new **initiative features!**\n'
    + '\n'
    + 'Patreon: <https://patreon.com/nathanhawks> | <@360086569778020352>'
  ;
  var init1 =
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
      + '**If it\'s highlighted blue, you did it right.**\n'
    + '\n'
    + ':game_die: **Rolling Initiative** :game_die:\n'
      + ':arrow_right: **!init** - Shadowrun 1e initiative\n'
      + ':arrow_right: **!initflip** - Shadowrun 1e initiative, reversed\n'
      + ':arrow_right: **!init2** - Shadowrun 2e initiative\n'
      + ':arrow_right: **!init2flip** - Shadowrun 2e initiative, reversed\n'
      + ':arrow_right: **!init3** - Shadowrun 3e initiative\n'
      + ':arrow_right: **!init3flip** - Shadowrun 3e initiative, reversed\n'
      + ':arrow_right: **!initcp** - Cyberpunk 2020 initiative\n'
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
    var init2 = '\n'
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
    + 'All initiative-related commands are slow (until the cache gets loaded with your data). '
      + 'The :hourglass_flowing_sand: reaction means it\'s working on your request.\n'
    + '\n'
    + 'Commands are **not** case-sensitive. Go WiLd WitH tHaT.\n'
    + '\n'
    + '**See also:** !help gmscreen\n'
    + '\n'
    + 'Patreon: <https://patreon.com/nathanhawks> | <@360086569778020352>'
  ;
  var scene1 = '\n:blue_book: **Prepared Scenes with (or without) Music** :blue_book:\n'
    + '\n'
    + '**It is strongly recommended** that you also read **!help gmscreen** so you can do your prep in secret!\n'
    + '\n'
    + 'Every adventure has passages of text that must be given to the players at each new scene. '
    + 'You no longer need to type these out in real time! Now you can prepare the texts in advance via the bot, and deploy them easily later.\n'
    + '\n'
    + '!**setscene** *name* *music_link* *scene_text*\n'
    + 'Creates or updates a named scene. The music link is optional. Scene text can have line breaks and formatting, and is only limited by Discord message length limits.\n'
    + '**Example 1:** !setscene example1 <https://www.youtube.com/watch?v=zsq-tAz54Pg> The orks burst through the door carrying uzis and a grudge.\n'
    + '**Example 2:** !setscene example2 Suddenly the band stops playing as everyone stares at you in horror.\n'
    + '\n'
    + '!**getscene** *name*\n'
    + 'Deploys the named scene. The name of the scene is **not** displayed in the output. Music (if any) is shown as a link, with Discord\'s embedded player below that.\n'
    + '\n'
    + '!**listscenes**\n'
    + 'Shows a list of scene names that you\'ve saved to the current channel (or play channel, if you\'re using the virtual GM Screen feature).\n'
    + '\n'
    + '!**delscene** *name*\n'
    + 'Deletes one or more scenes identified by name(s). To delete multiple scenes, simply put spaces between the names. **Deleted scenes cannot be recovered!**\n'
    + '\n'
    + '**See also:** !help gmscreen\n'
    + '\n'
    + 'Patreon: <https://patreon.com/nathanhawks> | <@360086569778020352>';
  ;
  var macros1 = '\n:scroll: **Macros (Saved Rolls)** :scroll:\n'
    + '\n'
    + 'These commands allow you to manage named dice rolls and use them any time just by typing a quick command.\n'
    + '\n'
    + '!***save*** *name* *dice_command_without_preceding_bang*\n'
    + 'Creates or updates a named "dice command". *(See **!help main** for valid "dice commands".)*\n'
    + '\n'
    + '!***roll*** *name*\n'
    + 'Rolls the saved "dice command" with the given name.\n'
    + '\n'
    + '!***lm***\n'
    + 'Lists your saved dice command macros for that channel.\n'
    + '\n'
    + '!***removemacro*** *name* or !***rmm*** *name*\n'
    + 'Removes one of your saved macros in that channel.\n'
    + '\n'
    + '**Pro tip:** Don\'t forget you can have multiple dice rolls in a single command by separating the rolls with semicolons (;)\n'
    + '\n'
    + 'Patreon: <https://patreon.com/nathanhawks> | <@360086569778020352>'
  ;
  var gmscreen1 = '\n:ninja: **Virtual GM Screen** :ninja:\n\n'
    + 'Using this feature, **initiative** and **scene** commands can be done in a hidden channel.\n'
    + '\n'
    + 'Players still need to **!setgm** and **!setinit** in the play channel.\n'
    + '\n'
    + '**It\'s simple!**\n'
    + '\n'
    + 'Step :one:: Go to your hidden channel\n'
    + 'This will be the channel where you do all your prep from now on.\n'
    + '\n'
    + 'Step :two:: **!setchannel** *link_to_play_channel*\n'
    + 'Your "play channel" is the channel players have access to; your main channel for the game. '
    + 'You make a channel link by typing the # sign and typing the channel name or choosing it from the pop-up menu. '
    + '**If the channel name is highlighted blue, you did it right.**\n'
    + '\n'
    + 'Step :three:: Do your prep!\n'
    + '\n'
    + '**Notes about running various commands behind the GM screen:**\n'
    + ':arrow_forward: !getscene will output to the play channel so you don\'t need to reveal your scene titles.\n'
    + ':arrow_forward: You can now run !init in secret, or you can prep your NPC\'s in the secret channel and then do the !init command in the play channel.\n'
    + '\n'
    + 'Patreon: <https://patreon.com/nathanhawks> | <@360086569778020352>'
  ;
  switch (whatToShow) {
    case 'index':
      index1 = addMaintenanceStatusMessage(index1);
      msg.reply(index1).catch((e) => {console.log(e);});
    break;
    case 'main':
      main2 = addMaintenanceStatusMessage(main2);
      msg.reply(main1).catch((e) => {console.log(e);});
      msg.reply(main2, {embed: null}).catch((e) => {console.log(e);});
    break;
    case 'init':
      init2 = addMaintenanceStatusMessage(init2);
      msg.reply(init1).catch((e) => {console.log(e);});
      msg.reply(init2, {embed: null}).catch((e) => {console.log(e);});
    break;
    case 'scene':
      scene1 = addMaintenanceStatusMessage(scene1);
      msg.reply(scene1, {embed: null}).catch((e) => {console.log(e);});
    break;
    case 'macros':
      macros1 = addMaintenanceStatusMessage(macros1);
      msg.reply(macros1, {embed: null}).catch((e) => {console.log(e);});
    break;
    case 'gmscreen':
      gmscreen1 = addMaintenanceStatusMessage(gmscreen1);
      msg.reply(gmscreen1, {embed: null}).catch((e) => {console.log(e);});
    break;
  }
}
async function handleInitCommand(msg, cmd, args, user) {
  await msg.react('⏳').catch((e) => {console.log(e);});
  console.log('\x1b[32m%s\x1b[0m', ' [ ==================== handleInitCommand ======================= ]');
  var gmPlayChannelID = await getPlayChannel(msg);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  var lastFoundFileID = null;
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
  while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
  // get author's userFolderID for play channel
  userFolderID = await findUserFolderFromMsg(msg, true);
  while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
  // get file ID of gm's (msg.author's) gmPlayers file, if any
  filename = 'gmPlayers';
  gmPlayersFileID = await findFileByName(filename, userFolderID, gmPlayChannelID);
  while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
  // make array of playerIDs from msg.author's gmPlayers file content, if any
  if (gmPlayersFileID !== -1) {
    gmPlayersString = await getFileContents(gmPlayersFileID, gmPlayChannelID);
    while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
    lockDiskForChannel(gmPlayChannelID);
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
    unlockDiskForChannel(gmPlayChannelID);
    playerFolderIDs[x] = await findUserFolderFromUserID(msg, gmPlayersArr[x], true);
    while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
    // if the player doesn't have a user folder in this channel, skip other checks
    if (playerFolderIDs[x] == -1) {
      someoneIsntReady_GM = true;
      playersNotSetGM[x] = gmPlayersArr[x];
      playerGMFileID[x] = -1;
      someoneIsntReady_Init = true;
      playersNotSetInit[x] = gmPlayersArr[x];
      playerInitFileID[x] = -1;
    } else {
      unlockDiskForChannel(gmPlayChannelID);
      // another index for each player's gmWhoIsGM fileID
      playerGMFileID[x] = await findFileByName(filename, playerFolderIDs[x], gmPlayChannelID);
      while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
      lockDiskForChannel(gmPlayChannelID);
      if (playerGMFileID[x] == -1) {
        // not ready because they don't have a gmWhoIsGM file at all
        someoneIsntReady_GM = true;
        playersNotSetGM[x] = gmPlayersArr[x];
      }
      else {
        unlockDiskForChannel(gmPlayChannelID);
        var playerGMContent = await getFileContents(playerGMFileID[x], gmPlayChannelID);
        while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
        lockDiskForChannel(gmPlayChannelID);
        if (playerGMContent !== user.id) {
          // not ready because their gmWhoIsGM file indicates another GM
          someoneIsntReady_GM = true;
          playersNotSetGM[x] = gmPlayersArr[x];
        }
      }
      // ensure all players have setinit
      filename = "playerInit";
      // another index for each player's playerInit fileID
      unlockDiskForChannel(gmPlayChannelID);
      playerInitFileID[x] = await findFileByName(filename, playerFolderIDs[x], gmPlayChannelID);
      while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
      if (playerInitFileID[x] == -1) {
        // not ready because they don't have a playerInit file at all
        someoneIsntReady_Init = true;
        playersNotSetInit[x] = gmPlayersArr[x];
      }
      else {
        unlockDiskForChannel(gmPlayChannelID);
        playerInitContent[x] = await getFileContents(playerInitFileID[x], gmPlayChannelID);
        while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
        lockDiskForChannel(gmPlayChannelID);
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
  unlockDiskForChannel(gmPlayChannelID);
  gmNPCFileID = await findFileByName(filename, userFolderID, gmPlayChannelID);
  while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
  if (gmNPCFileID == -1) {
    doNothing();
  }
  else {
    gmNPCFileContent = await getFileContents(gmNPCFileID, gmPlayChannelID);
    while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
    gmNPCArr = gmNPCFileContent.split(",");
  }
  // abort if we have no players and no NPC's, or if anyone's init will fail
  if ((gmNPCArr.length == 0 && gmPlayersArr.length == 0) || initWillFail) {
    // init will fail one of two ways; notify
    if (gmPlayersArr.length == 0 && gmNPCArr.length == 0) {
      initWillFail = true;
      output += ` -- can't roll initiative: you have no players or NPC's in channel <#${gmPlayChannelID}>.`;
    }
    else if (initWillFail) {
      output += " -- can't roll initiative: players aren't ready.\n"
      + ":thinking: :bulb: See **!inithelp** or ask your GM how to get set up!";
    }
  } else {
    output += "\n*[Roll]* Player or NPC (Mod)\n========================\n";
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
        if (cmd !== 'init' && cmd !== 'initflip' && cmd !== 'init2' && cmd !== 'init2flip' && cmd !== 'initcp') {
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
          if (ordArr[x]) ordArr[x] += ",";
          ordArr[x] += formattedEntry;
        }
      }
    }
    // loop thru npc array (containing arrays their dice-based phases)
    for (var y = 0; y < npcPhases.length; y++) {
      // if the npc is supposed to go this phase (init passes aside)
      if (npcPhases[y].indexOf(x) !== -1) {
        var formattedEntry = `*[${x}]* ${gmNPCArr[y].split(" ")[2]} (${gmNPCArr[y].split(" ")[1]})`;
        if (cmd !== 'init' && cmd !== 'initflip' && cmd !== 'init2' && cmd !== 'init2flip' && cmd !== 'initcp') {
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
          if (ordArr[x]) ordArr[x] += ",";
          ordArr[x] += formattedEntry;
        }
      }
    }
    if (cmd !== 'init' && cmd !== 'initflip' && cmd !== 'init2' && cmd !== 'init2flip' && cmd !== 'initcp') {
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
  // prep for possible 1e tiebreaker rule
  var tbArr = [{name: '', phases: 0}];
  // prep for sorting
  var tmpArr = [];
  // re-sort each phase for Reaction and 1e tiebreaker rule, and then split lines
  // backwards loop of element-per-phase array
  for (var x = ordArr.length - 1; x > -1 ; x--) {
    // at this point each phase is a comma-separated list of formattedEntry's
    tmpArr = ordArr[x].split(",");
    // sortReaction is a nice tidy affair
    tmpArr = tmpArr.sort(sortReaction);
    // 1e tiebreaker rule: a player on 2nd phase comes after a player on 1st phase, etc
    if (cmd === 'init' || cmd === 'initflip') {
      // loop of characters acting this phase
      for (let y = 0; y < tmpArr.length; y++) {
        // build an array (tbArr) noting how many phases each character has had so far including this one
        try {
          // get the character name (or discord id, mention-formatted)
          let character = tmpArr[y].split(" ")[1];
          // abundance of caution
          if (character !== undefined) {
            let index = -1;
            // get the index of that character in the tbArr (tiebreaker array)
            for (let z = 0; z < tbArr.length; z++) {
              if (tbArr[z].name === character) { index = z; }
            }
            // if the character isn't in the tbArr yet, put them there
            if (index === -1) {
              index = tbArr.length;
              tbArr[index] = {name: character, phases: 0};
            }
            // increment how many phases this character has had so far
            if (index > -1) {
              tbArr[index].phases++;
              logSpam('incrementing ' + character);
            }
          }
        } catch (e) { console.log(e); }
      }
      // recursively loop, bumping array elements down if they've acted more times than the next one
      try { [tmpArr,tbArr] = sort1ETiebreaker(tmpArr, tbArr); }
      catch (e) { console.log(e); }
      if (tmpArr[0] !== '') logSpam('__________________next_________\n');
    }

    ordArr[x] = tmpArr.join("\n")
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
    output += "========================\n";
  }
  // report
  msg.reply(addMaintenanceStatusMessage(output)).catch((e) => {console.log(e);});
  unlockDiskForChannel(gmPlayChannelID);
  console.log(getColorDate() + ` 🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${gmPlayChannelID})/${msg.author.id}`);
  removeHourglass(msg);
}
async function handleSetGMCommand(msg, cmd, args, user) {
  // serverID.channelID.userID.gmWhoIsGM STRING
  // without flag: set self as GM
  console.log('\x1b[32m%s\x1b[0m', ' [ ==================== handleSetGMCommand ====================== ]');
  var gmPlayChannelID = await getPlayChannel(msg);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  var targetID = "";
  if (args.length) {
    if (args[0].substring(0,2) !== '<@') {
      msg.reply(addMaintenanceStatusMessage('this command requires you to "@" people correctly.'))
      .catch((e) => {console.log(e);});
      return;
    }
    targetID = args[0].substring(2, args[0].length-1);
    if (targetID.substring(0, 1) == '!')
      targetID = args[0].substring(3, args[0].length-1);
  }
  else targetID = user.id;
  await msg.react('⏳').catch((e) => {console.log(e);});
  // ensure folder/subfolder chain: (root)/(UserData)/ServerID/ChannelID/UserID
    logSpam('handleSetGMCommand entering ensureFolderTriplet');
  await ensureFolderTriplet(msg);
    logSpam('handleSetGMCommand finished ensureFolderTriplet');
    while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
  // now get the folderID of the user folder in this channel
    logSpam('handleSetGMCommand entering findUserFolderFromMsg');
  var userFolderID = await findUserFolderFromMsg(msg, true);
    logSpam('handleSetGMCommand finished findUserFolderFromMsg');
    while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
    logSpam('handleSetGMCommand entering setContentsByFilenameAndParent');
  await setContentsByFilenameAndParent(msg, 'gmWhoIsGM', userFolderID, targetID);
    logSpam('handleSetGMCommand finished setContentsByFilenameAndParent');
    while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
    logSpam('handleSetGMCommand moving along');
  // remove reaction
  removeHourglass(msg);
  if (targetID == msg.author.id) msg.reply(addMaintenanceStatusMessage(` you are now a GM in channel <#${gmPlayChannelID}>.`)).catch((e) => {console.log(e);});
  else msg.reply(addMaintenanceStatusMessage(` your GM is now <@${targetID}> in this channel.`)).catch((e) => {console.log(e);});
  // listAllFiles();
  console.log(getColorDate() + ` 🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${gmPlayChannelID})/${msg.author.id}`);
}
async function handleSetPlayersCommand(msg, cmd, args, user) {
  console.log('\x1b[32m%s\x1b[0m', ' [ ==================== handleSetPlayersCommand ================= ]');
  await msg.react('⏳').catch((e) => {console.log(e);});
  var gmPlayChannelID = await getPlayChannel(msg);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  await ensureFolderTriplet(msg);
  // fixme: Discord has two formats, <@! vs <@
  for (x=0; x < args.length; x++){
    args[x]=args[x].substring(2,args[x].length-1);
    if (args[x].substring(0, 1) == '!')
      args[x] = args[x].substring(1, args[x].length);
  }
  var content = args.join(",");
  while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
  var userFolderID = await findUserFolderFromMsg(msg, true);
  while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
  await setContentsByFilenameAndParent(msg, 'gmPlayers', userFolderID, content);
  while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
  // remove reaction
  removeHourglass(msg);
  msg.reply(addMaintenanceStatusMessage(` your group in channel <#${gmPlayChannelID}> is now ${args.length} players.`)).catch((e) => {console.log(e);});
  // listAllFiles();
  console.log(getColorDate() + ` 🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${gmPlayChannelID})/${msg.author.id}`);
}
async function handleAddPlayersCommand(msg, cmd, args, user) {
  if (args.length) {
    if (args[0].substring(0,2) !== '<@') {
      msg.reply(addMaintenanceStatusMessage('this command requires you to "@" people correctly.')).catch((e) => {console.log(e);});
      return;
    }
  }
  console.log('\x1b[32m%s\x1b[0m', ' [ ==================== handleAddPlayersCommand ================= ]');
  await msg.react('⏳').catch((e) => {console.log(e);});
  var gmPlayChannelID = await getPlayChannel(msg);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  await ensureFolderTriplet(msg);
  var gmPlayersFileID = null;
  var filename = 'gmPlayers';
  var auth = global.auth;
  var drive = google.drive({version: 'v3', auth});
  while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
  var userFolderID = await findUserFolderFromMsg(msg, true);
  // see if the gmPlayers file already exists
  while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
  gmPlayersFileID = await findFileByName(filename, userFolderID, gmPlayChannelID);
  while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
  // get and parse the contents of the file
  try {
    if (gmPlayersFileID !== -1) {
      var oldPlayerString = await getFileContents(gmPlayersFileID);
      while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
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
      while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
      msg.reply(addMaintenanceStatusMessage(` you added ${args.length} players `
      + ` to your group in channel <#${gmPlayChannelID}>;`
      + ` now there are ${newPlayersCount}.`)).catch((e) => {console.log(e);});
      removeHourglass(msg);
    } else {
      // if there is no file we fail forward to the !set version of the command
      return handleSetPlayersCommand(msg, cmd, args, user);
    }
  } catch (e) {
    return console.error(e);
  }
  console.log(getColorDate() + ` 🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${gmPlayChannelID})/${msg.author.id}`);
}
async function handleListPlayersCommand(msg, cmd, args, user) {
  console.log('\x1b[32m%s\x1b[0m', ' [ ==================== handleListPlayersCommand ================ ]');
  await msg.react('⏳').catch((e) => {console.log(e);});
  var gmPlayChannelID = await getPlayChannel(msg);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  await ensureFolderTriplet(msg);
  var auth = global.auth;
  var drive = google.drive({version: 'v3', auth});
  var filename = 'gmPlayers';
  while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
  var userFolderID = await findUserFolderFromMsg(msg, true);
  while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
  lockDiskForChannel(gmPlayChannelID);
  drive.files.list({q:`"${userFolderID}" in parents and name="${filename}"`,
    fields: 'nextPageToken, files(id, name, parents)'},
    (err, res) => {
      lastFoundFileID = -1;
      if (err) return console.error(err);
      // the file doesn't exist for this channel/user pairing
      if (res.data.files.length == 0) {
        // no group; report so, and prep to abort
        msg.reply(addMaintenanceStatusMessage(` you currently have no group in channel <#${gmPlayChannelID}>.`)).catch((e) => {console.log(e);});
        unlockDiskForChannel(gmPlayChannelID);
      } else {
        // be sure it's the right file
        res.data.files.map((file) => {
          lastFoundFileID = file.id;
          unlockDiskForChannel(gmPlayChannelID);
        });
      }
    }
  );
  while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
  // abort if no group
  if (lastFoundFileID == -1) {
    removeHourglass(msg);
    return;
  }
  // get contents, parse, and count
  var gmPlayersFileID = lastFoundFileID;
  console.log(`userFolderID ${userFolderID}`);
  console.log('gmPlayersFileID ' + gmPlayersFileID);
  var playersString = await getFileContents(gmPlayersFileID);
  while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
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
  if (playersArr.length == 0)
    msg.reply(addMaintenanceStatusMessage(` you don\'t have a group in channel <#${gmPlayChannelID}> yet.`)).catch((e) => {console.log(e);});
  else
    msg.reply(addMaintenanceStatusMessage(` your group for this channel is ${playersArr.length} players `
    + `strong: ${output}`)).catch((e) => {console.log(e);});
  // listAllFiles();
  console.log(getColorDate() + ` 🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${gmPlayChannelID})/${msg.author.id}`);
  // remove reaction
  removeHourglass(msg);
}
async function handleRemovePlayersCommand(msg, cmd, args, user) {
  console.log('\x1b[32m%s\x1b[0m', ' [ ==================== handleRemovePlayersCommand ============== ]');
  await msg.react('⏳').catch((e) => {console.log(e);});
  var gmPlayChannelID = await getPlayChannel(msg);
  while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
  var lastFoundFileID = -1;
  await ensureFolderTriplet(msg);
  var content = args.join(" ");
  var filename = "gmPlayers"
  var auth = global.auth;
  var drive = google.drive({version: 'v3', auth});
  while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
  var userFolderID = await findUserFolderFromMsg(msg, true);
  while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
  lockDiskForChannel(gmPlayChannelID);
  // ensure the file
  drive.files.list(
    {q: `"${userFolderID}" in parents and name="${filename}"`,
    fields: 'nextPageToken, files(id, name, parents)'},
    (err, res) => {
      if (err) console.error(err);
      // in the event of no match
      if (res.data.files.length) {
        res.data.files.map((file) => {
          lastFoundFileID = file.id;
        });
      } else {
        setContentsByFilenameAndParent(msg, filename, userFolderID, '');
        // now the file surely exists -- redo the find, get the file id
        lockDiskForChannel(gmPlayChannelID);
        drive.files.list(
          {q: `"${userFolderID}" in parents and name="${filename}"`,
          fields: 'nextPageToken, files(id, name, parents)'},
          (err, res) => {
            if (err) return console.error(err);
            // we must check for filename match
            if (res.data && res.data.files.length) {
              res.data.files.map((file)=>{
                lastFoundFileID = file.id;
              });
            }
          }
        );
      }
      unlockDiskForChannel(gmPlayChannelID);
  });
  // get the file's id
  while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
  gmPlayersFileID = lastFoundFileID;
  // get and parse the contents
  var oldContentString = await getFileContents(gmPlayersFileID);
  while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
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
  msg.reply(addMaintenanceStatusMessage(` you removed ${removedIndex.length} players. `
  + `You now have ${newContentArray.length} players in channel <#${gmPlayChannelID}>.`))
  .catch((e) => {console.log(e);});
  console.log(getColorDate() + ` 🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${gmPlayChannelID})/${msg.author.id}`);
}
async function handleClearPlayersCommand(msg, cmd, args, user) {
  console.log('\x1b[32m%s\x1b[0m', ' [ ==================== handleClearPlayersCommand =============== ]');
  await msg.react('⏳').catch((e) => {console.log(e);});
  var gmPlayChannelID = await getPlayChannel(msg);
  while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
  await ensureFolderTriplet(msg);
  // do prep while waiting for long disk operation
  var auth = global.auth;
  var drive = google.drive({version: 'v3', auth});
  var filename = 'gmPlayers';
  while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
  var parentFolderID = await findUserFolderFromMsg(msg, true);
  while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
  lockDiskForChannel(gmPlayChannelID);
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
          unlockDiskForChannel(gmPlayChannelID);
          deleteFileById(file.id, (err,res)=>{}, gmPlayChannelID);
          file.content = '';
          addToCache(file, 'fileContent');
        });
      }
    }
  );
  while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
  // remove reaction
  removeHourglass(msg);
  msg.reply(addMaintenanceStatusMessage(` your group for channel <#${gmPlayChannelID}> was reset to 0 players.`))
  .catch((e) => {console.log(e);});
  console.log(getColorDate() + ` 🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${gmPlayChannelID})/${msg.author.id}`);
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
    msg.reply(addMaintenanceStatusMessage(`There was a problem.\n${errOutput}`))
    .catch((e) => {console.log(e);});
    return;
  }
  // and on to the show
  console.log('\x1b[32m%s\x1b[0m', ' [ ==================== handleSetInitCommand ==================== ]');
  await msg.react('⏳').catch((e) => {console.log(e);});
  // serverID.channelID.userID.playerInit STRING
  var content = args.join(" ");
    logSpam('handleSetInitCommand entering ensureFolderTriplet');
  await ensureFolderTriplet(msg);
    logSpam('handleSetInitCommand finished ensureFolderTriplet');
    while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  // now get the folderID of the user folder in this channel
    logSpam('handleSetInitCommand entering findUserFolderFromMsg');
  var userFolderID = await findUserFolderFromMsg(msg);
    logSpam('handleSetInitCommand finished findUserFolderFromMsg');
    while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
    logSpam('handleSetInitCommand entering setContentsByFilenameAndParent');
  await setContentsByFilenameAndParent(msg, 'playerInit', userFolderID, content);
    logSpam('handleSetInitCommand finished setContentsByFilenameAndParent');
    while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
    logSpam('handleSetInitCommand moving along home');
  // reformat for output (better user feedback)
  tmpArr = content.split(" ");
  var output = `${tmpArr[0]}d6 +${tmpArr[1]}`;
  // remove reaction
  removeHourglass(msg);
  msg.reply(addMaintenanceStatusMessage(` your initiative formula (in this channel) is now ${output}.`));
  console.log(getColorDate() + ` 🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}/${msg.author.id}`);
}
async function handleSetNPCInitCommand(msg, cmd, args, user) {
  args = modifyNPCInput(args);
  if (!validateNPCInput(msg, args)) {
    return;
  }
  // and on to the show
  console.log('\x1b[32m%s\x1b[0m', ' [ ==================== handleSetNPCInitCommand ================= ]');
  await msg.react('⏳').catch((e) => {console.log(e);});
  var gmPlayChannelID = await getPlayChannel(msg);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  await ensureFolderTriplet(msg);
  while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
  var userFolderID = await findUserFolderFromMsg(msg, true);
  var contentArray = [];
  for (var x = 0; x < args.length; x++) {
    contentArray[contentArray.length] = `${args[x]} ${args[x+1]} ${args[x+2]}`;
    x = x + 2;
  }
  var content = contentArray.join(",");
  while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
  await setContentsByFilenameAndParent(msg, 'gmNPCInit', userFolderID, content);
  while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
  // remove reaction
  removeHourglass(msg);
  msg.reply(addMaintenanceStatusMessage(` your NPC's for this channel were reset, `
  + `and you added ${contentArray.length} NPC's.`)).catch((e) => {console.log(e);});
  console.log(getColorDate() + ` 🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}/${msg.author.id}`);
}
async function handleAddNPCInitCommand(msg, cmd, args, user) {
  args = modifyNPCInput(args);
  if (!validateNPCInput(msg, args)) {
    return;
  }
  await msg.react('⏳').catch((e) => {console.log(e);});
  console.log('\x1b[32m%s\x1b[0m', ' [ ==================== handleAddNPCInitCommand ================= ]');
  var gmPlayChannelID = await getPlayChannel(msg);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  await ensureFolderTriplet(msg);
  var content = args.join(" ");
  var filename = "gmNPCInit"
  var auth = global.auth;
  var drive = google.drive({version: 'v3', auth});
  while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
  var userFolderID = await findUserFolderFromMsg(msg, true);
  while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
  // find the file
  var gmNPCFileID = await findFileByName(filename, userFolderID, gmPlayChannelID);
  while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
  // don't get attached to the id just yet
  if (gmNPCFileID === -1) {
    // create if nonexistent
    await setContentsByFilenameAndParent(msg, filename, userFolderID, '');
    while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
  }
  // if it didn't exist the first time, repeat the find
  if (gmNPCFileID === -1)
    gmNPCFileID = await findFileByName(filename, userFolderID, gmPlayChannelID);
  while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
  // now we can have the id
  // get and parse the contents
  var oldContentString = await getFileContents(gmNPCFileID);
  while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
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
  msg.reply(addMaintenanceStatusMessage(` you now have ${contentArray.length} NPC's in channel <#${gmPlayChannelID}>.`))
  .catch((e) => {console.log(e);});
  console.log(getColorDate() + ` 🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${gmPlayChannelID})/${msg.author.id}`);
}
async function handleRemoveNPCInitCommand(msg, cmd, args, user) {
  console.log('\x1b[32m%s\x1b[0m', ' [ ==================== handleRemoveNPCInitCommand ============== ]');
  var lastFoundFileID = -1;
  await msg.react('⏳').catch((e) => {console.log(e);});
  var gmPlayChannelID = await getPlayChannel(msg);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  await ensureFolderTriplet(msg);
  var content = args.join(" ");
  var filename = "gmNPCInit"
  var auth = global.auth;
  var drive = google.drive({version: 'v3', auth});
  while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
  var userFolderID = await findUserFolderFromMsg(msg, true);
  while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
  lockDiskForChannel(gmPlayChannelID);
  // ensure the file
  drive.files.list(
    {q: `"${userFolderID}" in parents and name="${filename}"`,
    fields: 'nextPageToken, files(id, name, parents)'},
    (err, res) => {
      if (err) console.error(err);
      // in the event of no match
      if (res.data.files.length) {
        res.data.files.map((file) => {
          lastFoundFileID = file.id;
        });
      } else {
        // it didn't exist; make an empty file
        unlockDiskForChannel(gmPlayChannelID);
        setContentsByFilenameAndParent(msg, filename, userFolderID, '');
        lockDiskForChannel(gmPlayChannelID);
        // now the file surely exists -- redo the find, get the file id
        drive.files.list(
          {q: `"${userFolderID}" in parents and name="${filename}"`,
          fields: 'nextPageToken, files(id, name, parents)'},
          (err, res) => {
            if (err) return console.error(err);
            // we must check for filename match
            if (res.data && res.data.files.length) {
              res.data.files.map((file)=>{
                lastFoundFileID = file.id;
              });
            }
          }
        );
      }
      unlockDiskForChannel(gmPlayChannelID);
  });
  // get the file's id
  while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
  var gmNPCFileID = lastFoundFileID;
  // get and parse the contents
  var oldContentString = await getFileContents(gmNPCFileID);
  while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
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
  msg.reply(addMaintenanceStatusMessage(` you removed ${removedIndex.length} NPC's. `
  + `You now have ${newContentArray.length} NPC's in channel <#${gmPlayChannelID}>.`))
  .catch((e) => {console.log(e);});
  console.log(getColorDate() + ` 🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${gmPlayChannelID})/${msg.author.id}`);
}
async function handleListNPCInitCommand(msg, cmd, args, user) {
  console.log('\x1b[32m%s\x1b[0m', ' [ ==================== handleListNPCInitCommand ================ ]');
  await msg.react('⏳').catch((e) => {console.log(e);});
  var gmPlayChannel = await getPlayChannel(msg);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  await ensureFolderTriplet(msg);
  var filename = 'gmNPCInit';
  while (isDiskLockedForChannel(gmPlayChannel)) { await sleep(15); }
  var parentFolderID = await findUserFolderFromMsg(msg, true);
  var gmNPCFileID = await findFileByName(filename, parentFolderID, msg.channel.id);
  while (isDiskLockedForChannel(gmPlayChannel)) { await sleep(15); }
  if (gmNPCFileID == -1) {
    // file doesn't exist
    var output = " you have no NPC's configured in this channel yet.";
  } else {
    // file exists
    while (isDiskLockedForChannel(gmPlayChannel)) { await sleep(15); }
    var contentString = await getFileContents(gmNPCFileID);
    while (isDiskLockedForChannel(gmPlayChannel)) { await sleep(15); }

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
  msg.reply(addMaintenanceStatusMessage(output)).catch((e) => {console.log(e);});
  console.log(getColorDate() + ` 🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${gmPlayChannel})/${msg.author.id}`);
  removeHourglass(msg);
}
async function handleClearNPCInitCommand(msg, cmd, args, user) {
  console.log('\x1b[32m%s\x1b[0m', ' [ ==================== handleClearNPCInitCommand =============== ]');
  await msg.react('⏳').catch((e) => {console.log(e);});
  var gmPlayChannelID = await getPlayChannel(msg);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  await ensureFolderTriplet(msg);
  var auth = global.auth;
  var drive = google.drive({version: 'v3', auth});
  var filename = 'gmNPCInit';
  while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
  var parentFolderID = await findUserFolderFromMsg(msg, true);
  while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
  lockDiskForChannel(gmPlayChannelID);
  drive.files.list(
    {q:`"${parentFolderID}" in parents and name="${filename}"`,
    fields: 'nextPageToken, files(id, name, parents)'},
    (err, res) => {
      unlockDiskForChannel(gmPlayChannelID);
      if (err) return console.error(err);
      if (res.data.files.length == 0) { } else {
        // delete it
        res.data.files.map((file) => {
          deleteFileById(file.id, (err,res)=>{}, gmPlayChannelID);
          file.content = '';
          addToCache(file, 'fileContent');
        });
      }
    }
  );
  while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
  // remove reaction
  removeHourglass(msg);
  msg.reply(addMaintenanceStatusMessage(' you cleared your NPC initiative formulas for this channel.'))
  .catch((e) => {console.log(e);});
  console.log(getColorDate() + ` 🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${gmPlayChannelID})/${msg.author.id}`);
}
async function handleSaveMacroCommand(msg, cmd, args, user) {
  if (args.length < 2)
    return msg.reply(addMaintenanceStatusMessage(':no_entry_sign: Not enough options. Needs a name followed by any valid dice roll command.'))
    .catch((e) => {console.log(e);});
  console.log('\x1b[32m%s\x1b[0m', ' [ ==================== handleSaveMacroCommand ================== ]');
  await msg.react('⏳').catch((e) => {console.log(e);});
  await ensureFolderTriplet(msg);
  var auth = global.auth;
  var drive = google.drive({version: 'v3', auth});
  var filename = 'savedRolls';
  var parentFolderID = -1;
  var savedRollsFileID = -1;
  var savedRollsStr = '';
  var savedRollsArr = [];
  var savedRollsNames = [];
  var inputName = args[0];
  var inputRoll = args;
  inputRoll.splice(0, 1);
  inputRoll = inputRoll.join(" ");
  var formattedEntry = `${inputName} ${inputRoll}`;
  // console.log(`inputName=${inputName} & inputRoll=${inputRoll}`);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  parentFolderID = await findUserFolderFromMsg(msg);
  savedRollsFileID = await findFileByName(filename, parentFolderID, msg.channel.id);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  if (savedRollsFileID !== -1) {
    // get existing file content
    savedRollsStr = await getFileContents(savedRollsFileID, msg.channel.id);
    while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
    if (savedRollsStr) {
      savedRollsArr = savedRollsStr.split("\n");
      // get an index of name per line
      savedRollsArr.map((macro)=>{
        var tmpArr = macro.split(" ");
        savedRollsNames[savedRollsNames.length] = tmpArr[0];
      });
      var found = false;
      var i = savedRollsNames.indexOf(inputName);
      if (i !== -1) {
        // if name already exists, update that entry
        savedRollsArr[i] = formattedEntry;
      } else {
        // if name is new, append to existing rolls
        savedRollsArr[savedRollsArr.length] = formattedEntry;
      }
    } else {
      // if empty file, put entry
      savedRollsArr = [formattedEntry];
    }
    savedRollsStr = savedRollsArr.join("\n");
    await setContentsByFilenameAndParent(msg, filename, parentFolderID, savedRollsStr);
    while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  }
  else {
    // savedRolls file didn't exist; initialize it with this roll macro
    savedRollsArr = [formattedEntry];
    savedRollsStr = savedRollsArr.join("\n");
    await setContentsByFilenameAndParent(msg, filename, parentFolderID, savedRollsStr);
    while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  }
  msg.reply(addMaintenanceStatusMessage(` you now have ${savedRollsArr.length} roll macros saved.`))
  .catch((e) => {console.log(e);});
  console.log(getColorDate() + ` 🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}/${msg.author.id}`);
  removeHourglass(msg);
}
async function handleRollMacroCommand(msg, cmd, args, user) {
  if (args.length < 1)
    return msg.reply(addMaintenanceStatusMessage(':no_entry_sign: You didn\'t specify which macro I should roll.'))
    .catch((e) => {console.log(e);});
  console.log('\x1b[32m%s\x1b[0m', ' [ ==================== handleRollMacroCommand ================== ]');
  await msg.react('⏳').catch((e) => {console.log(e);});
  await ensureFolderTriplet(msg);
  var auth = global.auth;
  var drive = google.drive({version: 'v3', auth});
  var filename = 'savedRolls';
  var parentFolderID = -1;
  var savedRollsFileID = -1;
  var savedRollsStr = '';
  var savedRollsArr = [];
  var savedRollsNames = [];
  var inputName = args[0];
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  parentFolderID = await findUserFolderFromMsg(msg);
  savedRollsFileID = await findFileByName(filename, parentFolderID, msg.channel.id);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  if (savedRollsFileID !== -1) {
    // get existing file content
    savedRollsStr = await getFileContents(savedRollsFileID, msg.channel.id);
    while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
    if (savedRollsStr) {
      savedRollsArr = savedRollsStr.split("\n");
      // get an index of name per line
      savedRollsArr.map((macro)=>{
        var tmpArr = macro.split(" ");
        savedRollsNames[savedRollsNames.length] = tmpArr[0];
      });
      var i = savedRollsNames.indexOf(inputName);
      if (i !== -1) {
        // found it; roll it
        var roll = savedRollsArr[i];
        roll = roll.split(" ");
        cmd = roll[1];
        // be nice if they add the preceding bang, i do it constantly
        if (cmd.substring(0,1) !== '!') cmd = `!${cmd}`;
        roll.splice(0, 2);
        args = roll;
        //console.log(`cmd: ${cmd} & args: ${args}`);
        var newContent = `${cmd} ${args.join(" ")}`;
        logSpam(newContent);
        handleRollCommand(msg, cmd, args, user, newContent);
        removeHourglass(msg);
      }
    }
  }
  else {
    // savedRolls file didn't exist
    msg.reply(addMaintenanceStatusMessage(" you don't have any saved macros in this channel yet."))
    .catch((e) => {console.log(e);});
  }
  console.log(getColorDate() + ` 🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}/${msg.author.id}`);
  removeHourglass(msg);
}
async function handleRemoveMacroCommand(msg, cmd, args, user) {
  if (args.length < 1)
    return msg.reply(addMaintenanceStatusMessage(':no_entry_sign: You didn\'t specify which macro I should remove.'))
    .catch((e) => {console.log(e);});
  console.log('\x1b[32m%s\x1b[0m', ' [ ==================== handleRemoveMacroCommand ================ ]');
  await msg.react('⏳').catch((e) => {console.log(e);});
  await ensureFolderTriplet(msg);
  var auth = global.auth;
  var drive = google.drive({version: 'v3', auth});
  var filename = 'savedRolls';
  var parentFolderID = -1;
  var savedRollsFileID = -1;
  var savedRollsStr = '';
  var savedRollsArr = [];
  var savedRollsNames = [];
  var inputName = args[0];
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  parentFolderID = await findUserFolderFromMsg(msg);
  savedRollsFileID = await findFileByName(filename, parentFolderID, msg.channel.id);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  if (savedRollsFileID !== -1) {
    // get existing file content
    savedRollsStr = await getFileContents(savedRollsFileID, msg.channel.id);
    while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
    if (savedRollsStr) {
      savedRollsArr = savedRollsStr.split("\n");
      // get an index of name per line
      savedRollsArr.map((macro)=>{
        var tmpArr = macro.split(" ");
        savedRollsNames[savedRollsNames.length] = tmpArr[0];
      });
      var i = savedRollsNames.indexOf(inputName);
      if (i !== -1) {
        // found it; remove it
        savedRollsArr.splice(i, 1);
        savedRollsStr = savedRollsArr.join("\n");
        await setContentsByFilenameAndParent(msg, filename, parentFolderID, savedRollsStr);
        while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
        msg.reply(addMaintenanceStatusMessage(`Removed the macro; `
          + `you now have ${savedRollsArr.length} macros saved in this channel.`))
          .catch((e) => {console.log(e);});
        removeHourglass(msg);
      } else
        msg.reply(addMaintenanceStatusMessage('That name didn\'t match any of your saved macros in this channel.'))
        .catch((e) => {console.log(e);});
    }
    else {
      // file exists but is empty
      msg.reply(addMaintenanceStatusMessage(" you don't have any saved macros in this channel yet."))
      .catch((e) => {console.log(e);});
    }
  }
  else {
    // savedRolls file didn't exist
    msg.reply(addMaintenanceStatusMessage(" you don't have any saved macros in this channel yet."))
    .catch((e) => {console.log(e);});
  }
  console.log(getColorDate() + ` 🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}/${msg.author.id}`);
  removeHourglass(msg);
}
async function handleListMacrosCommand(msg, cmd, args, user) {
  console.log('\x1b[32m%s\x1b[0m', ' [ ==================== handleListMacrosCommand ================= ]');
  await msg.react('⏳').catch((e) => {console.log(e);});
  await ensureFolderTriplet(msg);
  var auth = global.auth;
  var drive = google.drive({version: 'v3', auth});
  var filename = 'savedRolls';
  var parentFolderID = -1;
  var savedRollsFileID = -1;
  var savedRollsStr = '';
  var savedRollsArr = [];
  var savedRollsNames = [];
  var output = '';
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  parentFolderID = await findUserFolderFromMsg(msg);
  savedRollsFileID = await findFileByName(filename, parentFolderID, msg.channel.id);
  logSpam('Found file ID: ' + savedRollsFileID);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  if (savedRollsFileID !== -1) {
    // get existing file content
    savedRollsStr = await getFileContents(savedRollsFileID, msg.channel.id);
    while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
    if (savedRollsStr) {
      savedRollsArr = savedRollsStr.split("\n");
      // get an index of name per line
      savedRollsArr.map((macro)=>{
        var tmpArr = macro.split(" ");
        var name = tmpArr[0];
        tmpArr.splice(0, 1);
        var tmpStr = tmpArr.join(" ");
        var macro = tmpStr;
        output += `***${name}*** :arrow_right: ${macro}\n`;
      });
      msg.reply(addMaintenanceStatusMessage(` you have the following macros in this channel:\n${output}`))
      .catch((e) => {console.log(e);});
    }
    else {
      // file exists but is empty
      msg.reply(addMaintenanceStatusMessage(" you don't have any saved macros in this channel yet."))
      .catch((e) => {console.log(e);});
    }
  }
  else {
    // savedRolls file didn't exist
    msg.reply(addMaintenanceStatusMessage(" you don't have any saved macros in this channel yet."))
    .catch((e) => {console.log(e);});
  }
  console.log(getColorDate() + ` 🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}/${msg.author.id}`);
  removeHourglass(msg);
}
// returns a discord channel ID
// if the curent folder has a file named gmPlayChannel it returns the content of that file
// returns the current discord channel ID otherwise
async function getPlayChannel(msg) {
  // check cache first
  var file = {
    server: msg.channel.guild.id, channel: msg.channel.id, user: msg.author.id
  };
  if (cacheHas(file, 'playChannel')) {
    var r = getFromCache(file, 'playChannel');
    logSpam('Returning play channel from cache');
    return r.playChannel;
  }
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  logSpam(`getPlayChannel begins: Determining user folder of CURRENT channel`);
  var userFolderID = await findUserFolderFromMsg(msg);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  var filename = 'gmPlayChannel';
  logSpam(`Checking CURRENT channel for gmPlayChannel file`);
  var gmPlayChannelGoogleID = await findFileByName(filename, userFolderID, msg.channel.id);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  try {
    if (gmPlayChannelGoogleID !== -1) {
      logSpam(`Getting content of found gmPlayChannel file`);
      var gmPlayChannelID = await getFileContents(gmPlayChannelGoogleID);
      while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
      logSpam(`getPlayChannel returning ${gmPlayChannelID}`);
      addToCache({
        server: msg.channel.guild.id,
        channel: msg.channel.id,
        user: msg.author.id,
        playChannel: gmPlayChannelID
      }, 'playChannel');
      return gmPlayChannelID;
    }
    else {
      logSpam('getPlayChannel returning CURRENT channel');
      addToCache({
        server: msg.channel.guild.id,
        channel: msg.channel.id,
        user: msg.author.id,
        playChannel: msg.channel.id
      }, 'playChannel');
      return msg.channel.id;
    }
  }
  catch (e) {
    return console.error(e);
  }
}
// checks the current play channel and replies with a channel link
async function handleCheckChannelCommand(msg, cmd, args, user) {
  console.log('\x1b[32m%s\x1b[0m', ' [ ==================== handleCheckChannelCommand =============== ]');
  await msg.react('⏳').catch((e) => {console.log(e);});
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  await ensureFolderTriplet(msg);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  var gmPlayChannelID = await getPlayChannel(msg);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  msg.reply(addMaintenanceStatusMessage(` your current play channel is set to <#${gmPlayChannelID}>.`))
  .catch((e) => {console.log(e);});
  console.log(getColorDate() + ` 🎲🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${gmPlayChannelID})/${msg.author.id}`);
  removeHourglass(msg);
}
// set the play channel so that commands can be entered in a secret channel
// useful for NPC inits and scene content
async function handleSetChannelCommand(msg, cmd, args, user) {
  console.log('\x1b[32m%s\x1b[0m', ' [ ==================== handleSetChannelCommand ================= ]');
  await msg.react('⏳').catch((e) => {console.log(e);});
  if (args.length === 1) {
    if (args[0].substring(0,2) === '<#') {
      var gmPlayChannelID = args[0].substring(2, args[0].length-1);
      await ensureFolderTriplet(msg);
      var filename = 'gmPlayChannel';
      while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
      var gmSecretFolderID = await findUserFolderFromMsg(msg);
      while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
      await setContentsByFilenameAndParent(msg, filename, gmSecretFolderID, gmPlayChannelID);
      while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
      addToCache({
        server: msg.channel.guild.id,
        channel: msg.channel.id,
        user: msg.author.id,
        playChannel: gmPlayChannelID
      }, 'playChannel');
      msg.reply(addMaintenanceStatusMessage(` play channel is now set to `
        + `<#${gmPlayChannelID}>. You can now issue commands for initiative and `
        + `scenes in this channel, and they will be saved to <#${gmPlayChannelID}>.`))
        .catch((e) => {console.log(e);});
    }
    else {
      msg.reply(addMaintenanceStatusMessage(' error: make sure this command is followed only by a link to a channel.'))
      .catch((e) => {console.log(e);});
    }
  }
  else {
    msg.reply(addMaintenanceStatusMessage(' this command requires one (and only one) argument, a channel link.'))
    .catch((e) => {console.log(e);});
  }
  console.log(getColorDate() + ` 🎲🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${gmPlayChannelID})/${msg.author.id}`);
  removeHourglass(msg);
}
async function handleSetSceneCommand(msg, cmd, args, user) {
  console.log('\x1b[32m%s\x1b[0m', ' [ ==================== handleSetSceneCommand =================== ]');
  await msg.react('⏳').catch((e) => {console.log(e);});
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  await ensureFolderTriplet(msg);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  var gmPlayChannelID = await getPlayChannel(msg);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  var sceneList = await getSceneList(msg);
  while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
  var userFolderID = await findUserFolderFromMsg(msg, true);
  while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
  var newScene = {};
  newScene.name = args[0];
  if (args[1].substring(0,4).toLowerCase() === 'http') {
    newScene.music = args[1];
    args.splice(0, 2);
    newScene.text = args.join(' ');
  }
  else {
    newScene.music = '';
    args.splice(0, 1);
    newScene.text = args.join(' ');
  }
  var filename = `gmScene_${newScene.name}`;
  var content = `${newScene.name}\n|||\n${newScene.music}\n|||\n${newScene.text}`;
  await setContentsByFilenameAndParent(msg, filename, userFolderID, content);
  while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
  newScene.googleID = await findFileByName(filename, userFolderID, gmPlayChannelID);
  while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
  var countOfScenes = await updateSceneList(msg, newScene);
  msg.reply(addMaintenanceStatusMessage(` you now have ${countOfScenes} scenes in channel <#${gmPlayChannelID}>.`))
  .catch((e) => {console.log(e);});
  console.log(getColorDate() + ` 🎲🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${gmPlayChannelID})/${msg.author.id}`);
  removeHourglass(msg);
}
async function handleDelSceneCommand(msg, cmd, args, user) {
  console.log('\x1b[32m%s\x1b[0m', ' [ ==================== handleDelSceneCommand =================== ]');
  await msg.react('⏳').catch((e) => {console.log(e);});
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  await ensureFolderTriplet(msg);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  var gmPlayChannelID = await getPlayChannel(msg);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  var userFolderID = await findUserFolderFromMsg(msg, true);
  while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
  if (args.length > 0) {
    var waitForAsync = true;
    args.map(async (arg) => {
      var filename = `gmScene_${arg}`;
      var gID = await findFileByName(filename, userFolderID, gmPlayChannelID);
      while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
      if (gID != -1) {
        await deleteFileById(gID, (err, res) => {}, gmPlayChannelID);
        while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
        delFromCache(gID, 'file');
        await deleteSceneFromList(msg, arg);
        while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
        var file = {content: '', id: gID};
        addToCache(file, 'fileContent');
      }
      else {
        msg.reply(addMaintenanceStatusMessage(`The scene named ${arg} wasn't found.`)).catch((e) => {console.log(e);});
      }
      waitForAsync = false;
    });
    while (waitForAsync) { await sleep(15); }
    var sceneList = await getSceneList(msg);
    while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
    logSpam(`handleDelSceneCommand got sceneList ${sceneList}`);
    var count = sceneList.length;
    msg.reply(addMaintenanceStatusMessage(` you now have ${count} scenes in channel <#${gmPlayChannelID}>.`))
    .catch((e) => {console.log(e);});
  }
  else {
    msg.reply(addMaintenanceStatusMessage(' this command requires one or more names of scenes.'))
    .catch((e) => {console.log(e);});
  }
  console.log(getColorDate() + ` 🎲🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${gmPlayChannelID})/${msg.author.id}`);
  removeHourglass(msg);
}
async function handleGetSceneCommand(msg, cmd, args, user) {
  console.log('\x1b[32m%s\x1b[0m', ' [ ==================== handleGetSceneCommand =================== ]');
  await msg.react('⏳').catch((e) => {console.log(e);});
  var gmPlayChannelID = await getPlayChannel(msg);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  if (args.length === 1) {
    var userFolderID = await findUserFolderFromMsg(msg, true);
    while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
    var filename = `gmScene_${args[0]}`;
    var gID = await findFileByName(filename, userFolderID, gmPlayChannelID);
    while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
    var content = await getFileContents(gID);
    while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
    var contentArray = content.split("\n|||\n");
    var scene = {};
    scene.name = contentArray[0];
    scene.music = contentArray[1];
    scene.text = contentArray[2];
    var playChannel = await bot.channels.get(gmPlayChannelID);
    var musicText = '';
    if (scene.music && scene.music.length > 0) {
      musicText = `\n\nSoundtrack:\n${scene.music}`;
    }
    playChannel.send(`${scene.text}${musicText}`);
    msg.reply(addMaintenanceStatusMessage(` scene "${scene.name}" was just deployed in channel <#${gmPlayChannelID}>.`))
    .catch((e) => {console.log(e);});
  }
  else {
    msg.reply(addMaintenanceStatusMessage(' error: this command requires a single argument, '
      + 'the name of the scene. Try !listscenes for a list of your scenes in ')
      + `channel ${gmPlayChannelID}.`).catch((e) => {console.log(e);});
  }
  console.log(getColorDate() + ` 🎲🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${gmPlayChannelID})/${msg.author.id}`);
  removeHourglass(msg);
}
async function handleListScenesCommand(msg, cmd, args, user) {
  console.log('\x1b[32m%s\x1b[0m', ' [ ==================== handleListScenesCommand ================= ]');
  await msg.react('⏳').catch((e) => {console.log(e);});
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  await ensureFolderTriplet(msg);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  var gmPlayChannelID = await getPlayChannel(msg);
  logSpam(`Parent folder: ${gmPlayChannelID}`);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  var sceneList = await getSceneList(msg);
  while (isDiskLockedForChannel(gmPlayChannelID)) { await sleep(15); }
  var output = '';
  if (sceneList.length > 0) {
    sceneList.map((scene) => {
      output += `${scene.name}\n`;
    });
    msg.reply(addMaintenanceStatusMessage(" your scene names in channel <#" + gmPlayChannelID +
      "> are: ```\n" + output + "\n```")).catch((e) => {console.log(e);});
  }
  else {
    msg.reply(addMaintenanceStatusMessage(` you have no scenes yet in channel <#${gmPlayChannelID}>.`))
    .catch((e) => {console.log(e);});
  }
  console.log(getColorDate() + ` 🎲🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${gmPlayChannelID})/${msg.author.id}`);
  removeHourglass(msg);
}
async function getUserReminders(userFolderID, playChannelID) {
  var filename = 'gmReminders';
  var gmRemindersID = await findFileByName(filename, userFolderID, playChannelID);
  while (isDiskLockedForChannel(playChannelID)) { await sleep(15); }
  var gmContent = '';
  var reminders = [];
  if (gmRemindersID !== -1) {
    gmContent = await getFileContents(gmRemindersID, playChannelID);
    while (isDiskLockedForChannel(playChannelID)) { await sleep(15); }
    if (gmContent !== '') {
      var gmFileArr = gmContent.split('\n');
      for (var x = 0; x < gmFileArr.length; x++) {
        var r = gmFileArr[x].split(',');
        reminders[reminders.length] = {
          smallID: r[0], id: r[1], sessionTimeDateF: r[2], dateTime: r[3], timeStamp: r[4],
          gmID: r[5], userFolderID: r[6], playChannelID: r[7], playersString: r[8]
        };
      }
    }
    return reminders;
  }
  else {
    return reminders; // empty array
  }
}
async function getActiveReminders() {
  var filename = 'activeReminders';
  var sysRemindersID = await findFileByName(filename, global.folderID.reminders, 'system');
  while(isDiskLockedForChannel('system')) { await sleep(15); }
  var sysContent = '';
  var reminders = [];
  if (sysRemindersID !== -1) {
    sysContent = await getFileContents(sysRemindersID, 'system');
    while (isDiskLockedForChannel('system')) { await sleep(15); }
    var sysFileArr = sysContent.split('\n');
    for (var x = 0; x < sysFileArr.length; x++) {
      var r = sysFileArr[x].split(',');
      reminders[reminders.length] = {
        shortID: r[0], id: r[1], sessionTimeDateF: r[2], dateTime: r[3], timeStamp: r[4],
        gmID: r[5], userFolderID: r[6], playChannelID: r[7], playersString: r[8]
      };
    }
    return reminders;
  }
  else {
    return reminders; // empty array
  }
}
async function _deleteReminder(reminderID, userFolderID) {
  for (var y = 0; y < global.reminders.length; y++) {
    if (global.reminders[y].id === reminderID) {
      while(isDiskLockedForChannel('system')) { await sleep(15); }
      // delete the element from gm's userfolder which was passed as an arg
      var gmFileID = await findFileByName('gmReminders', userFolderID, 'system');
      while(isDiskLockedForChannel('system')) { await sleep(15); }
      var gmFileContent = await getFileContents(gmFileID, 'system');
      while(isDiskLockedForChannel('system')) { await sleep(15); }
      var gmFileArr = gmFileContent.split('\n');
      for (var z = 0; z < gmFileArr.length; z++) {
        gmEntryArr = gmFileArr[z].split(',');
        if (gmEntryArr[1] === reminderID) {
          gmFileArr.splice(z, 1);
          z--;
        }
      }
      // write after the loop
      await setContentsByFilenameAndParent(
        {channel: { id: 'system'}}, // fake msg object
        'gmReminders',
        userFolderID,
        gmFileArr.join('\n')
      );
      while(isDiskLockedForChannel('system')) { await sleep(15); }
      // delete the element from the activeReminders file
      var sysFileID = await findFileByName('activeReminders',
        global.folderID.reminders, 'system');
      while(isDiskLockedForChannel('system')) { await sleep(15); }
      var sysFileContent = await getFileContents(sysFileID, 'system');
      while(isDiskLockedForChannel('system')) { await sleep(15); }
      var sysFileArr = sysFileContent.split('\n');
      for (var z = 0; z < sysFileArr.length; z++) {
        sysEntryArr = sysFileArr[z].split(',');
        if (sysEntryArr[1] === reminderID) {
          sysFileArr.splice(z, 1);
          z--;
        }
      }
      // write after the loop
      await setContentsByFilenameAndParent(
        {channel: { id: 'system'}}, // fake msg object
        'activeReminders',
        global.folderID.reminders,
        sysFileArr.join('\n')
      );
      while(isDiskLockedForChannel('system')) { await sleep(15); }
      // remove the element from global.reminders
      global.reminders.splice(y, 1);
      y--; // must inspect the new current element
    }
  }
}
function _makeSaveString(reminder) {
  return `${reminder.shortID},${reminder.id},${reminder.sessionTimeDateF},${reminder.dateTime},`
    + `${reminder.timeStamp},${reminder.gmID},${reminder.userFolderID},`
    + `${reminder.playChannelID},${reminder.playersString}`;
}
async function _saveGMReminder(userFolderID, playChannelID, reminder) {
  var saveString = _makeSaveString(reminder);
  var filename = 'gmReminders';
  var gmRemindersID = await findFileByName(filename, userFolderID, playChannelID);
  while (isDiskLockedForChannel(playChannelID)) { await sleep(15); }
  var gmContent = '';
  if (gmRemindersID !== -1) {
    gmContent = await getFileContents(gmRemindersID, playChannelID);
    while (isDiskLockedForChannel(playChannelID)) { await sleep(15); }
    gmContent = (gmContent !== '')
      ? `${gmContent}\n${saveString}`
      : `${saveString}`;
  }
  else {
    gmContent = `${saveString}`;
  }
  await setContentsByFilenameAndParent({channel: {id: playChannelID}}, filename, userFolderID, gmContent);
  while (isDiskLockedForChannel(playChannelID)) { await sleep(15); }
}
async function _saveSystemReminder(reminder) {
  var saveString = _makeSaveString(reminder);
  var reminderFolderID = global.folderID.reminders;
  filename = 'activeReminders';
  var sysFileID = await findFileByName(filename, reminderFolderID, 'system');
  while (isDiskLockedForChannel('system')) { await sleep(15); }
  var sysContent = '';
  if (sysFileID !== -1) {
      sysContent = await getFileContents(sysFileID, 'system');
      while (isDiskLockedForChannel('system')) { await sleep(15); }
      sysContent = (sysContent !== '') ? `${sysContent}\n${saveString}` : saveString;
  }
  else {
    sysContent = saveString;
  }
  await setContentsByFilenameAndParent({channel: {id: 'system'}}, filename, reminderFolderID, sysContent);
  while (isDiskLockedForChannel('system')) { await sleep(15); }
}
async function addReminder(msg, reminder) {
  reminder.id = crypto.randomBytes(32).toString('hex');
  reminder.shortID = crypto.randomBytes(3).toString('hex');
  // save to GM's play folder
  // get play folder
  var playChannelID = await getPlayChannel(msg);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  // user folder
  var userFolderID = await findUserFolderFromMsg(msg, true);
  while (isDiskLockedForChannel(playChannelID)) { await sleep(15); }
  await _saveGMReminder(userFolderID, playChannelID, reminder);
  while (isDiskLockedForChannel(playChannelID)) { await sleep(15); }
  // save to /(root)/UserData/reminders/activeReminders
  await _saveSystemReminder(reminder);
  while (isDiskLockedForChannel('system')) { await sleep(15); }
  // activate reminders
  var users = reminder.playersString.split(',');
  var x = 0;
  for (x = 0; x < users.length; x++) {
    var userID = users[x];
    var timeoutID = setTimeout(async (reminderID, userFolderID) => {
      logSpam(`Reminder ID: ${reminderID}`);
      var d = new Date(reminder.sessionTimeDateF);
      bot.users.get(userID).send(`This is a reminder of your upcoming game`
        + ` at ${d} with GM <@${reminder.gmID}>.`)
      .catch((err) => { console.error(err); });
      // upkeep system
      global.lastRemindersTime = Date.now();
      await _deleteReminder(reminderID, userFolderID);
      logSpam(`System reminders var has ${global.reminders.length} entries`);
    }, reminder.MilliSecondsFromNow, reminder.id, userFolderID);
    reminder.timeoutID = timeoutID;
    global.reminders[global.reminders.length] = reminder;
  }
  logSpam(`reminder = {shortID: ${reminder.shortID}, id: ${reminder.id},`
    + ` dateTime: ${reminder.dateTime}, sessionTimeDateF: ${reminder.sessionTimeDateF},`
    + ` timeStamp: ${reminder.timeStamp}, playersString: ${reminder.playersString}},`
    + ` MilliSecondsFromNow: ${reminder.MilliSecondsFromNow}, gmID: ${reminder.gmID}`);
}
async function handleListRemindersCommand(msg, cmd, args, user) {
  var playChannelID = await getPlayChannel(msg);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  var userFolderID = await findUserFolderFromMsg(msg, true);
  while (isDiskLockedForChannel(playChannelID)) { await sleep(15); }
  var reminders = await getUserReminders(userFolderID, playChannelID);
  while (isDiskLockedForChannel(playChannelID)) { await sleep(15); }
  if (reminders.length > 0) {
    var output = '\n';
    for (var x = 0; x < reminders.length; x++) {
      if (reminders[x].playersString !== undefined) {
        if (x > 0) output += '\n\n';
        output += `**ID:** ${reminders[x].smallID}\n`
        + `**Reminder Time/Date:** ${reminders[x].dateTime}\n`
        + `**Session Time/Date:** ${new Date(reminders[x].sessionTimeDateF)}\n`
        + `**Players to Remind:** `;
        var players = reminders[x].playersString.split(',');
        for (var y = 0; y < players.length; y++) {
          if (y > 0) output += ', '
          output += `<@${players[y]}>`;
        }
      }
    }
    if (output === '\n') output = ` you have no reminders set in channel <#${playChannelID}>.`;
    else {
      if (output.length < 1900) msg.reply(output).catch((err)=>{console.error(err);});
      else {
        var items = output.split('\n\n');
        for (var x = 0; x < items.length; x++) {
          msg.reply(`\n${items[x]}\n\n`).catch((err)=>{console.error(err);});
        }
      }
    }
  }
  else {
    msg.reply(` you have no reminders set in channel <#${playChannelID}>.`)
    .catch((err)=>{console.error(err);});
  }
}
async function handleAddReminderCommand(msg, cmd, args, user) {
  var sessionTimeDateF = args[0];
  var sessionTimestamp = undefined;
  args.splice(0, 1);
  var reminders = []; // list of reminder objects (below)
  var reminder = {}; // .sessionTimeDateF, .dateTime, .timeStamp, .playersString, .MilliSecondsFromNow, gmID, userFolderID, playChannelID
  var timings = [...args]; // post-splice contains only list of timing strings
  var timing = ''; // a time string e.g. 15m, 1d, etc
  // parse sessionTimeDateF string
  sessionTimestamp = new Date(sessionTimeDateF);
  logSpam(`Timestamp compare: ${Date.now()} is now, ${sessionTimestamp.valueOf()} is target`);
  logSpam(`sessionTimestamp ${sessionTimestamp}`);
  if (isNaN(Date.parse(sessionTimestamp))) {
    msg.reply(` the session date & time you entered was invalid. Check it carefully and try again.`)
    .catch((err)=>{console.error(err);});
    return;
  }
  // get play folder
  var playChannelID = await getPlayChannel(msg);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  // get player list
  var userFolderID = await findUserFolderFromMsg(msg, true);
  while (isDiskLockedForChannel(playChannelID)) { await sleep(15); }
  var filename = 'gmPlayers';
  playersFileID = await findFileByName(filename, userFolderID, playChannelID);
  while (isDiskLockedForChannel(playChannelID)) { await sleep(15); }
  var playersString = await getFileContents(playersFileID, playChannelID);
  while (isDiskLockedForChannel(playChannelID)) { await sleep(15); }
  if (playersString.length === 0) {
    await msg.reply(` you have no players in channel <#${playChannelID}> yet to send reminders to.`)
    .catch((err) => {console.error(err)});
    return;
  }
  // parse list of timings
  var x;
  for (x = 0; x < timings.length; x++) {
    timing = timings[x];
    var timingUnit = timing.substring(timing.length-1);
    var timingNumber = timing.substring(0, timing.length-1);
    var asSeconds = timingNumber*1000;
    logSpam(`unit ${timingUnit}, number ${timingNumber}`);
    var timestampMinus = 0;
    switch (timingUnit.toLowerCase()) {
      case "d":
        logSpam(`${timingNumber} days reminder`);
        var asMinutes = asSeconds*60;
        var asHours = asMinutes*60;
        var asDays = asHours*24;
        timestampMinus = asDays;
      break;
      case "h":
        logSpam(`${timingNumber} hours reminder`);
        var asMinutes = asSeconds*60;
        var asHours = asMinutes*60;
        timestampMinus = asHours;
      break;
      case "m":
        logSpam(`${timingNumber} minutes reminder`);
        var asMinutes = asSeconds*60;
        timestampMinus = asMinutes;
      break;
      default:
        logSpam('Timing not parsed');
      break;
    }
    logSpam(`timestampMinus ${timestampMinus}`);
    var targetTimestamp = sessionTimestamp.valueOf() - timestampMinus;
    // start reminder object
    reminder = {
      dateTime: new Date(targetTimestamp),
      sessionTimeDateF: sessionTimeDateF,
      timeStamp: targetTimestamp,
      playersString: playersString,
      MilliSecondsFromNow: targetTimestamp - Date.now(),
      gmID: msg.author.id,
      userFolderID: userFolderID,
      playChannelID: playChannelID
    };
    await addReminder(msg, reminder);
  }
  msg.reply(` ${x} reminders added.`)
  .catch((err)=>{console.error(err);});
}
async function handleCancelReminderCommand(msg, cmd, args, user) {
  // parse args
  var shortIDs = [...args];
  logSpam(shortIDs);
  if (shortIDs.length === 0) {
    msg.reply(` this command needs one or more ID's. You'll find the ID's by using \`!listreminders\`.`)
    .catch((err)=>{console.error(err);});
    return;
  }
  // loop thru shortIDs
  for (var x = 0; x < shortIDs.length; x++) {
    // find reminder in global.reminders
    for (var y = 0; y < global.reminders.length; y++) {
      if (global.reminders[y].shortID === shortIDs[x]) {
        // clearTimeout
        clearTimeout(global.reminders[y].timeoutID);
        // splice the element from global.reminders
        global.reminders.splice(y, 1);
        // decrement because next item just became current item
        y--;
      }
    }
  }
  // update files from what's left of global.reminders
  // system folder first
  var saveString = '';
  for (var x = 0; x < global.reminders.length; x++) {
    if (saveString !== '') saveString += '\n';
    saveString += _makeSaveString(global.reminders[x]);
  }
  var filename = 'activeReminders';
  await setContentsByFilenameAndParent({channel: {id: 'system'}}, filename, global.folderID.reminders, saveString);
  while (isDiskLockedForChannel('system')) { await sleep(15); }
  // user folder last
  saveString = '';
  var playChannelID = await getPlayChannel(msg);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  for (var x = 0; x < global.reminders.length; x++) {
    if (saveString !== '') saveString += '\n';
    if (global.reminders[x].gmID === msg.author.id
      && global.reminders[x].playChannelID == playChannelID)
    {
      saveString += `${_makeSaveString(global.reminders[x])}`;
    }
  }
  filename = 'gmReminders';
  var userFolderID = await findUserFolderFromMsg(msg, true);
  while (isDiskLockedForChannel(playChannelID)) { await sleep(15); }
  await setContentsByFilenameAndParent({channel: {id: playChannelID}}, filename, userFolderID, saveString);
  while (isDiskLockedForChannel(playChannelID)) { await sleep(15); }
  // user feedback
  msg.reply(`${shortIDs.length} reminder cancellations were requested.`)
  .catch((err) => {console.error(err);});
}
// @ =========== HANDLEMESSAGE FUNCTION ============
function handleMessage(msg, user=msg.author) {
  // stop confusing people during development!!
  // if (user.id !== '360086569778020352') return;
  // check if message starts with `!`
  var message = msg.content;
  if (message.substring(0, 1) === '!') {
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
          case 'clearcache':
            if (user.id == '360086569778020352') clearCache(msg);
          break;
          case 'unlock':
            adminUnlock(msg, args);
          break;
          case 'unlockall':
            if (user.id == '360086569778020352') adminUnlockAll(msg);
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
          case 'save':
            handleSaveMacroCommand(msg, cmd, args, user);
          break;
          case 'roll':
            handleRollMacroCommand(msg, cmd, args, user);
          break;
          case 'removemacro':
          case 'rmm':
            handleRemoveMacroCommand(msg, cmd, args, user);
          break;
          case 'lm':
          case 'listmacros':
            handleListMacrosCommand(msg, cmd, args, user);
          break;
          case 'checkchannel':
            handleCheckChannelCommand(msg, cmd, args, user);
          break;
          case 'setchannel':
            handleSetChannelCommand(msg, cmd, args, user);
          break;
          case 'setscene':
            handleSetSceneCommand(msg, cmd, args, user);
          break;
          case 'delscene':
            handleDelSceneCommand(msg, cmd, args, user);
          break;
          case 'getscene':
            handleGetSceneCommand(msg, cmd, args, user);
          break;
          case 'listscenes':
            handleListScenesCommand(msg, cmd, args, user);
          break;
          case 'listreminders':
            handleListRemindersCommand(msg, cmd, args, user);
          break;
          case 'addreminder':
            handleAddReminderCommand(msg, cmd, args, user);
          break;
          case 'cancelreminder':
            handleCancelReminderCommand(msg, cmd, args, user);
          break;
          default:
            handleRollCommand(msg, cmd, args, user);
          break;
       }
   }
   // no return
}

// Hook the handler
try {
  bot.on('message', (msg) => {    handleMessage(msg);   });
}
catch (e) {
  console.error(e);

}
