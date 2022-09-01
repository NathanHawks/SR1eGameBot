/*
 * Shadowrun 1e GameBot by Discord user AstroMacGuffin#1486 (Nathan Hawks)
 * https://github.com/NathanHawks/SR1eGameBot
 * Yes I do regret baking 1e into the name
 * version 0.3, yeah that sounds good
 * Released under the terms of the UnLicense. This work is in the public domain.
 * Released as-is with no warranty or claim of usability for any purpose.
 */
// require crypto for reminders (random strings)
var crypto = require('crypto');

// for defaulting if's & callbacks
function doNothing (err=null, res=null) {}
// @ =================== CACHE ====================
function resetCache() {
  global.cache = {
    server: [],  // arr of obj: googleID, discordID
    channel: [], // arr of obj: googleID, discordID, parentID,
    userInChannel: [], // arr of obj: googleID, discordID, parentID
    file: [], // arr of obj: googleID, name, parentID
    fileContent: [], // arr of obj: googleID, content
    playChannel: [], // arr of obj: server, channel, user, playChannel
    triplet: [] // arr of obj: server, channel, user, googleID
  };
}
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
  var id = file.id;
  if (cacheAs === 'playChannel' || cacheAs === 'triplet') {
    // fast-track playChannel seek
    for (let i = 0; i < global.cache[cacheAs].length; i++) {
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
    // id => index seeking
    var idIndex = [];
    for (let i = 0; i < global.cache[cacheAs].length; i++) {
      idIndex[i] = global.cache[cacheAs][i].googleID;
    }
    r = idIndex.indexOf(id);
    if (r > -1) {
      // logSpam('Found cache index ' + cacheAs + r);
      return r;
    }
  }
  r = -1;
  for (let i = 0; i < global.cache[cacheAs].length; i++) {
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
    case 'triplet':
      global.cache.triplet[ci] = {
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

async function ensureTriplet(msg) {
  var serverFolderID = null;
  var channelFolderID = null;
  var userDataFolderID = global.folderID.UserData;
  var serverDiscordID = msg.channel.guild.id;
  var gmPlayChannelID = await getPlayChannel(msg);

  // Try asking the cache for the whole triplet endpoint
  var q = {
    server: msg.channel.guild.id, channel: gmPlayChannelID, user: msg.author.id
  };
  if (cacheHas(q, 'triplet')) {
    logSpam('ensureTriplet found triplet in cache');
    logSpam(' [ ==================== exiting ensureTriplet ============ ]');
    return;
  }
  // Get the server folder's googleID
  var q = {name: serverDiscordID};
  if (cacheHas(q, 'server')) {
    serverFolderID = getFromCache(q, 'server').googleID;
    logSpam('Found server folder in cache');
  } else {

    try {
      logSpam('ensureTriplet entering ensureFolderByName (server folder)');
      await ensureFolderByName(serverDiscordID, userDataFolderID, msg.channel.id);

    } catch (e) { console.log(e); }
    try {
      logSpam('ensureTriplet entering findFolderByName (server folder)');
      serverFolderID = await findFolderByName(serverDiscordID, userDataFolderID,
        (err, res) => {
          logSpam('ensureTriplet in callback for findFolderByName (server folder)');
          while (isDiskLockedForChannel(msg.channel.id)) { sleep(15); }
          if (err) return console.error(err);

          if (res.data.files.length === 1) {
            addToCache(res.data.files[0], 'server');
          } else {
            console.error(`> BAD: server ${msg.channel.guild.id} is in UserData `
              + `(${res.data.files.length}) times.`);
          }

      }, msg.channel.id);
    } catch (e) { console.log(e); }
    logSpam('ensureTriplet exited callback for findFolderByName (server folder)');

    logSpam('ensureTriplet clear of callback for findFolderByName (server folder)');
  }
  // channel folder
  q = {name: gmPlayChannelID, parents: [serverFolderID]};
  if (cacheHas(q, 'channel')) {
    channelFolderID = getFromCache(q, 'channel').googleID;
    logSpam('Found channel folder in cache');
  } else {
    try {
      logSpam('ensureTriplet entering ensureFolderByName (channel folder)');
      await ensureFolderByName(gmPlayChannelID, serverFolderID, gmPlayChannelID);

    } catch (e) { console.log(e); }
    try {
      logSpam('ensureTriplet entering findFolderByName (channel folder)');
      channelFolderID = await findFolderByName(gmPlayChannelID, serverFolderID,
        (err, res) => {
          logSpam('ensureTriplet in callback for findFolderByName (channel folder)');
          while (isDiskLockedForChannel(msg.channel.id)) { sleep(15); }
          if (err) return console.error(err);

          if (res.data.files.length === 1) {
            addToCache(res.data.files[0], 'channel');
          } else {
            console.error(`> BAD: channel ${gmPlayChannelID} is in `
              + `${serverFolderID} (${res.data.files.length}) times.`);
          }

        }, msg.channel.id);
    } catch (e) { console.log(e); }
    logSpam('ensureTriplet exited callback for findFolderByName (channel folder)');

    logSpam('ensureTriplet clear of callback for findFolderByName (channel folder)');
  }
  // user folder
  q = {name: msg.author.id, parents: [channelFolderID]};
  if (cacheHas(q, 'userInChannel')) {
    logSpam('Found user folder in cache');
    // we're only here to ensure it exists; it does so we're done
  }
  else {
    try {
      logSpam('ensureTriplet entering ensureFolderByName (user folder)');
      await ensureFolderByName(msg.author.id, channelFolderID, gmPlayChannelID);

    } catch (e) { console.log(e); }
    try {
      logSpam('ensureTriplet entering findFolderByName (user folder)');
      await findFolderByName(msg.author.id, channelFolderID, (err, res) => {
        logSpam('ensureTriplet in callback for findFolderByName (user folder)');
        while (isDiskLockedForChannel(gmPlayChannelID)) { sleep(15); }
        if (err) return console.error(err);

        if (res.data.files.length === 1) {
          addToCache(res.data.files[0], 'userInChannel');
          // we have the whole triplet now; cache it as such
          addToCache({
            server: msg.channel.guild.id,
            channel: gmPlayChannelID,
            user: msg.author.id,
            id: res.data.files[0].id
          }, 'triplet');
        }
        else { console.error(`> BAD: author ${msg.author.id} is in `
          + `${channelFolderID} (${res.data.files.length}) times.`)}

      }, gmPlayChannelID);
    } catch (e) { console.log(e); }
    logSpam('ensureTriplet exited callback for findFolderByName (user folder)');

    logSpam('ensureTriplet clear of callback for findFolderByName (user folder)');
  }
  logSpam(' [ ==================== exiting ensureTriplet ============ ]')
}

async function findUserDBIDFromMsg(msg, usePlayChannel=false) {
  // a User's folder exists in (root)/UserData/ServerID/ChannelID/UserID
  var r = null; // the userFolderID
  var s = null; // the server googleID
  var discordChannelID = -1;
  if (usePlayChannel) {
    discordChannelID = await getPlayChannel(msg);

  }
  else discordChannelID = msg.channel.id;
  // first try to get it from cache
  var q = {name: msg.channel.guild.id}
  if (cacheHas(q, 'server')) {
    s = getFromCache(q, 'server').googleID;
    logSpam(`findUserDBIDFromMsg found server in cache: ${s}`);
    q = {name: discordChannelID, parents: [s]};
    if (cacheHas(q, 'channel')) {
      var c = getFromCache(q, 'channel').googleID;
      logSpam(`findUserDBIDFromMsg found channel in cache: ${c}`);
      q = {name: msg.author.id, parents: [c]};
      if (cacheHas(q, 'userInChannel')) {
        r = getFromCache(q, 'userInChannel').googleID;
        logSpam("Found user folder at " + s + "/" + c + "/" + r);
        return r;
      }
    }
  }

  // the cache didn't return -- do it the slow way
  var serverFolderID;
  serverFolderID = await findFolderByName(msg.channel.guild.id,
    global.folderID.UserData, doNothing, discordChannelID);

  logSpam ("GDrive seek sID: " + serverFolderID);
  if (serverFolderID === -1) {
    msg.reply(' :man_facepalming: something went wrong. Please try your command '
      + 'again and **ignore the following error message**. :man_facepalming:')
    .catch((e) => {console.log(e);});
  }
  var channelFolderID = await findFolderByName(discordChannelID,
    serverFolderID, doNothing, discordChannelID);

  logSpam ("GDrive seek cID: " + channelFolderID);
  // return the file ID
  r = await findFolderByName(msg.author.id,
    channelFolderID, doNothing, discordChannelID);

  logSpam ("Gdrive seek uID: " + r);
  return r;
}

async function findUserDBIDFromDiscordID(msg, userID, usePlayChannel=false) {
  // a User's folder exists in (root)/UserData/ServerID/ChannelID/UserID
  var gmPlayChannelID = -1;
  if (usePlayChannel) gmPlayChannelID = await getPlayChannel(msg);
  else gmPlayChannelID = msg.channel.id;

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

        return r;
      }
    }
  }
  // cache didn't return -- do it the slow way
  var serverFolderID = await findFolderByName(msg.channel.guild.id,
    global.folderID.UserData, doNothing, msg.channel.id);

  if (serverFolderID !== -1) {
    addToCache({
      name:msg.channel.guild.id, id:serverFolderID
    }, 'server');
    var channelFolderID = await findFolderByName(gmPlayChannelID, serverFolderID,
      doNothing, gmPlayChannelID);

    if (channelFolderID !== -1) {
      addToCache({
        name:gmPlayChannelID, parents:[msg.channel.guild.id], id:channelFolderID
      }, 'channel');
      r = await findFolderByName(userID, channelFolderID, doNothing, gmPlayChannelID);

      if (r !== -1) {
        addToCache({
          name:userID, parents:[channelFolderID], id:r
        }, 'userInChannel');
        addToCache({
          server:msg.channel.guild.id, channel:gmPlayChannelID, user:userID, id:r
        }, 'triplet');
      }
      // return the file ID

      return r;
    }
  }

  return -1;
}

// @ function ensureFolderByName(name, parentID=null, channelID="system")
function ensureFolderByName(name, parentID=null, channelID="system") {
  findFolderByName(name, parentID, (err, res) => {
    if (err) return console.error(err);
    logSpam(`Ensuring folder "${name}" exists`);
    const files = res.data.files;
    if (files.length === 0) {
      logSpam('It doesn\'t exist; creating it');
      createFolder(name, parentID, (err, file) => {
        if (err) return console.error(err);
      }, channelID);
    }
  }, channelID);
}

async function findFolderByName(
  folderName,
  parentID=null,
  callback=doNothing,
  channelID="system"
) {
  if (parentID === -1) {
    logWrite(`findFolderByName: parentID was -1, `
      + `folderName was ${folderName}, channel was ${channelID}`);
    return -1;
  }
  var lastFoundFileID = -1;


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
      return await findStringIDByName(folderName, parentID, callback, channelID);
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

    callback(err, res);
  });

  return lastFoundFileID;
}

// @ function createFolder(folderName, parentID=null, callback, channelID="system")
async function createFolder(
  folderName,
  parentID=null,
  callback=doNothing,
  channelID="system"
) {


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
  }, async (err, file) => {

    if (err && err.hasOwnProperty('code') && err.code === 500) {
      console.error(err);
      logWrite('createFolder trying again in 2 seconds...');
      await sleep(2000);
      return await createFolder(folderName, parentID, callback, channelID);
    }
    else if (err) return console.error(err);
    callback(err,file);
  });
}

async function findStringIDByName(filename, parentID, channelID) {
  var lastFoundFileID = -1;


  var q = {name: filename, parents: [parentID]};
  if (cacheHas(q, 'file')) {

    var c = getFromCache(q, 'file');
    lastFoundFileID = c.googleID;

    return lastFoundFileID;
  }



  var auth = global.auth;
  var drive = google.drive({version: 'v3', auth});
  drive.files.list(
    {q: `"${parentID}" in parents and name="${filename}"`,
    fields: 'nextPageToken, files(id, name, parents)'},
    async (err, res) => {
      if (err) {
        if (err.hasOwnProperty('code') && err.code === 500) {
          logWrite(err);
          logWrite('findStringIDByName trying again in 2 seconds...');
          await sleep(2000);
          return await findStringIDByName(filename, parentID, channelID);
        }
        else {
          lastFoundFileID = -1;
          if (err.hasOwnProperty('code') && err.code === 404) {
            logWrite(`findStringIDByName: got 404 for file ${filename}...`);
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

    }
  );

  return lastFoundFileID;
}

async function getStringContents(fileID, channelID) {
  var fileContents = '';


  logSpam("File ID: " + fileID);
  var q = {id: fileID};
  if (cacheHas(q, 'fileContent')) {
    var c = getFromCache(q, 'fileContent');
    if (c.hasOwnProperty('content')) {
      logSpam("Found in cache: " + c.content);
      fileContent = c.content;

      return c.content;
    }
  }
  logSpam('Seeking file in GDrive');
  var auth = global.auth;
  const drive = google.drive({version: 'v3', auth});
  drive.files.get({fileId: fileID, alt: "media"}, async (err, res) => {
    if (err) {

      if (err.hasOwnProperty('code') && err.code === 500) {
        console.error(err);
        logWrite('getStringContents trying again in 2 seconds...');
        await sleep(2000);
        return await getStringContents(fileID, channelID);
      }
      else if (err.hasOwnProperty('code') && err.code === 404) {
        logWrite(`getStringContents got 404 for ${fileID}`);
        return '';
      }
      else {
        return console.error(err);
      }
    }
    // strip padding which was added to bypass a very weird API error
    fileContent=res.data.substring(0,res.data.length-2);
    addToCache({id: fileID, content: fileContent}, 'fileContent');

  });

  return fileContent;
}

async function setStringByNameAndParent(msg, filename, parentFolderID, contents) {
  // prep for disk ops
  var channelID = msg.channel.id;


  var auth = global.auth;
  const drive = google.drive({version: 'v3', auth});
  // Create/Update the file; does the file already exist
  drive.files.list({q:`"${parentFolderID}" in parents and name="${filename}"`,
    fields: 'files(id, name, parents)'},
    async (err, res) => {

      if (err && err.hasOwnProperty('code') && err.code === 500) {
        console.error(err);
        logWrite('setStringByNameAndParent trying again in 2 seconds...');
        await sleep(2000);
        return await setStringByNameAndParent(msg, filename, parentFolderID, contents);
      }
      else if (err) return console.error(err);
      // no, the file doesn't exist for this channel/user pairing

      if (res.data.files.length === 0) {
        // create it
        drive.files.create({
          resource: { 'name': filename, 'parents': [parentFolderID] },
          media: { 'mimeType': 'text/plain', 'body': `${contents}/2` },
          fields: 'id'
        }, async (err, file) => {
          logSpam(`Creating file ${filename}`);

          if (err && err.hasOwnProperty('code') && err.code === 500) {
            console.error(err);
            logWrite('setStringByNameAndParent trying again in 2 seconds...');
            await sleep(2000);
            return await setStringByNameAndParent(msg, filename, parentFolderID, contents);
          }
          else if (err) return console.error(err);
          // don't add to cache -- let it happen on next load
          return;
        });
      } else if (res.data.files.length===1) {
        // it already exists, update it
        res.data.files.map((file) => {
            drive.files.update({
              fileId: file.id, media: {body: `${contents}/2`}},
              async (err, res) => {
                logSpam(`Updating file ${filename}`);

                if (err) {
                  console.error(err);
                  logWrite('setStringByNameAndParent trying again in 2 seconds...');
                  await sleep(2000);
                  return await setStringByNameAndParent(msg, filename, parentFolderID, contents);
                }
                else if (err) return console.error(err);
                else return;
            });
            // update cache
            var q = {id: file.id, content: contents};
            addToCache(q, 'fileContent');
        });
      }
    }
  );

}
async function deleteStringByID(fileId, callback=(err,res)=>{}, channelID="system") {


  var auth = global.auth;
  const drive = google.drive({version: 'v3', auth});
  drive.files.delete({fileId:fileId}, async (err, res) => {
    if (err && err.hasOwnProperty('code') && err.code === 500) {
      console.error(err);
      logWrite('deleteStringByID trying again in 2 seconds');
      await sleep(2000);
      return await deleteStringByID(fileId, callbaack, channellID);
    }
    else if (err) {
      return console.error(err);
    }

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
function sortCPRTiebreaker(a, b) {
  var aReroll = 0;
  var bReroll = 0;
  while (aReroll === bReroll) {
    aReroll = d10();
    bReroll = d10();
  }
  return bReroll - aReroll;
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

  logSpam(`getPlayChannel begins: Determining user folder of CURRENT channel`);
  var userFolderID = await findUserDBIDFromMsg(msg);

  var filename = 'gmPlayChannel';
  logSpam(`Checking CURRENT channel for gmPlayChannel file`);
  var gmPlayChannelGoogleID = await findStringIDByName(filename, userFolderID, msg.channel.id);

  try {
    if (gmPlayChannelGoogleID !== -1) {
      logSpam(`Getting content of found gmPlayChannel file`);
      var gmPlayChannelID = await getStringContents(gmPlayChannelGoogleID);

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
async function getUserReminders(userFolderID, playChannelID) {
  var filename = 'gmReminders';
  var gmRemindersID = await findStringIDByName(filename, userFolderID, playChannelID);

  var gmContent = '';
  var reminders = [];
  if (gmRemindersID !== -1) {
    gmContent = await getStringContents(gmRemindersID, playChannelID);

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
  var sysRemindersID = await findStringIDByName(filename, global.folderID.reminders, 'system');

  var sysContent = '';
  var reminders = [];
  if (sysRemindersID !== -1) {
    sysContent = await getStringContents(sysRemindersID, 'system');

    if (sysContent !== '') {
      var sysFileArr = sysContent.split('\n');
      for (var x = 0; x < sysFileArr.length; x++) {
        var r = sysFileArr[x].split(',');
        reminders[reminders.length] = {
          shortID: r[0], id: r[1], sessionTimeDateF: r[2], dateTime: r[3], timeStamp: r[4],
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
async function _deleteReminder(reminderID, userFolderID) {
  for (var y = 0; y < global.reminders.length; y++) {
    if (global.reminders[y].id === reminderID) {

      // delete the element from gm's userfolder which was passed as an arg
      var gmFileID = await findStringIDByName('gmReminders', userFolderID, 'system');

      var gmFileContent = await getStringContents(gmFileID, 'system');

      var gmFileArr = gmFileContent.split('\n');
      for (var z = 0; z < gmFileArr.length; z++) {
        gmEntryArr = gmFileArr[z].split(',');
        if (gmEntryArr[1] === reminderID) {
          gmFileArr.splice(z, 1);
          z--;
        }
      }
      // write after the loop
      await setStringByNameAndParent(
        {channel: { id: 'system'}}, // fake msg object
        'gmReminders',
        userFolderID,
        gmFileArr.join('\n')
      );

      // delete the element from the activeReminders file
      var sysFileID = await findStringIDByName('activeReminders',
        global.folderID.reminders, 'system');

      var sysFileContent = await getStringContents(sysFileID, 'system');

      var sysFileArr = sysFileContent.split('\n');
      for (var z = 0; z < sysFileArr.length; z++) {
        sysEntryArr = sysFileArr[z].split(',');
        if (sysEntryArr[1] === reminderID) {
          sysFileArr.splice(z, 1);
          z--;
        }
      }
      // write after the loop
      await setStringByNameAndParent(
        {channel: { id: 'system'}}, // fake msg object
        'activeReminders',
        global.folderID.reminders,
        sysFileArr.join('\n')
      );

      // remove the element from global.reminders
      global.reminders.splice(y, 1);
      y--; // must inspect the new current element
    }
  }
}
function _makeReminderSaveString(reminder) {
  return `${reminder.shortID},${reminder.id},${reminder.sessionTimeDateF},${reminder.dateTime},`
    + `${reminder.timeStamp},${reminder.gmID},${reminder.userFolderID},`
    + `${reminder.playChannelID},${reminder.playersString}`;
}
async function _saveGMReminders(userFolderID, playChannelID, reminders) {
  var filename = 'gmReminders';
  var saveString = '';
  var gmContent = '';
  var gmRemindersID = await findStringIDByName(filename, userFolderID, playChannelID);

  if (gmRemindersID !== -1) {
    gmContent = await getStringContents(gmRemindersID, playChannelID);

  }
  for (var i = 0; i < reminders.length; i++) {
    if (gmContent !== '') gmContent += '\n';
    saveString = _makeReminderSaveString(reminders[i]);
    gmContent += saveString;
  }
  logSpam(`gmContent\n${gmContent}`);
  await setStringByNameAndParent({channel: {id: playChannelID}}, filename,
    userFolderID, gmContent);

}
async function _saveSystemReminders(reminders) {
  filename = 'activeReminders';
  var saveString = '';
  var sysContent = '';
  var reminderFolderID = global.folderID.reminders;
  var sysFileID = await findStringIDByName(filename, reminderFolderID, 'system');

  if (sysFileID !== -1) {
    sysContent = await getStringContents(sysFileID, 'system');

  }
  for (var i = 0; i < reminders.length; i++) {
    if (sysContent !== '') sysContent += '\n';
    saveString = _makeReminderSaveString(reminders[i]);
    sysContent += saveString;
  }
  logSpam(`sysContent:\n${sysContent}`);
  await setStringByNameAndParent({channel: {id: 'system'}}, filename,
    reminderFolderID, sysContent);

}
async function _addRemindersSetTimeoutPayload(reminder) {
  logWrite('\x1b[32m [ ==================== _addRemindersSetTimeoutPayload ======================= ]\x1b[0m');
  var d = new Date(reminder.sessionTimeDateF);
  var users = reminder.playersString.split(' ');
  for (var x = 0; x < users.length; x++) {
    logSpam(`Reminder ID: ${reminder.id} sending to ${users[x]}`);
    var user = await bot.fetchUser(users[x]);
    var gm = await bot.fetchUser(reminder.gmID);
    var gmName = gm.tag.split("#")[0];
    user.send(`This is a reminder of your upcoming game`
      + ` at ${d} with GM **${gmName}**.`)
    .catch((err) => { console.error(err); });
  }
  // upkeep system
  global.lastRemindersTime = Date.now();
  await _deleteReminder(reminder.id, reminder.userFolderID);
  logSpam(`System reminders var has ${global.reminders.length} entries`);
}
async function addReminders(msg, reminders) {
  // get play folder
  var playChannelID = await getPlayChannel(msg);

  // user folder
  var userFolderID = await findUserDBIDFromMsg(msg, true);

  // loop reminders
  for (var i = 0; i < reminders.length; i++) {
    // make id's
    reminders[i].id = crypto.randomBytes(32).toString('hex');
    reminders[i].shortID = crypto.randomBytes(3).toString('hex');
    // activate reminders
    var timeoutID = setTimeout(
      _addRemindersSetTimeoutPayload,
      reminders[i].MilliSecondsFromNow,
      reminders[i]
    );
    reminders[i].timeoutID = timeoutID;
    global.reminders[global.reminders.length] = reminders[i];
    logSpam(`reminder = {shortID: ${reminders[i].shortID}, id: ${reminders[i].id},`
      + ` dateTime: ${reminders[i].dateTime}, sessionTimeDateF: ${reminders[i].sessionTimeDateF},`
      + ` timeStamp: ${reminders[i].timeStamp}, playersString: ${reminders[i].playersString},`
      + ` MilliSecondsFromNow: ${reminders[i].MilliSecondsFromNow}, gmID: ${reminders[i].gmID}}`);
  }
  // save to GM's play folder
  await _saveGMReminders(userFolderID, playChannelID, reminders);

  // save to /(root)/UserData/reminders/activeReminders
  await _saveSystemReminders(reminders);

  logSpam(`System reminders var has ${global.reminders.length} entries`);
}
async function getSceneList(msg) {
  var gmPlayChannelID = await getPlayChannel(msg);

  var filename = 'gmSceneList';
  var userFolderID = await findUserDBIDFromMsg(msg, true);

  var fileID = await findStringIDByName(filename, userFolderID, gmPlayChannelID);

  if (fileID !== -1) {
    var content = await getStringContents(fileID, gmPlayChannelID);

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

  var sceneList = await getSceneList(msg);

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

  }
  if (makeNewEntry) i++;
  return i;
}
async function deleteSceneFromList(msg, sceneName) {

  logSpam(`Starting deleteSceneFromList for scene ${sceneName}`);
  var gmPlayChannelID = await getPlayChannel(msg);

  logSpam(`got gmPlayChannelID ${gmPlayChannelID}`)
  var sceneList = await getSceneList(msg);

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

    logSpam('deleteSceneFromList returning');
    return sceneList.length;
  }
}
async function saveSceneList(msg, sceneList) {
  var gmPlayChannelID = await getPlayChannel(msg);
  var filename = 'gmSceneList';

  var userFolderID = await findUserDBIDFromMsg(msg, true);

  var content = '';
  sceneList.map((scene) => {
    if (scene.googleID && scene.name) {
      content += `${scene.name}\n|||\n${scene.googleID}\n|||||\n`;
    }
  });
  await setStringByNameAndParent(msg, filename, userFolderID, content);

}
module.exports = {
  doNothing, resetCache, cacheHas, getCacheIndex,
  addToCache, delFromCache, getFromCache, ensureTriplet,
  findUserDBIDFromMsg, findUserDBIDFromDiscordID, ensureFolderByName,
  findFolderByName, createFolder, findStringIDByName, getStringContents,
  setStringByNameAndParent, deleteStringByID, removeHourglass, d6, d10,
  firstTwoLC, firstThreeLC, lastChar, getTNFromArgs, getModifierFromArgs,
  sortNumberDesc, sortReaction, sortInitPass, sortCPRTiebreaker,
  sort1ETiebreaker, getOpposedSetupArr, makeOpposedOutput, prepRollNote,
  rollDice, rollD10s, modifyNPCInput, validateNPCInput, getPlayChannel,
  getUserReminders, getActiveReminders, addReminders,
  getSceneList, updateSceneList, deleteSceneFromList, saveSceneList
}
