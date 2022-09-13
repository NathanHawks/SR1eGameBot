/*
 * Shadowrun 1e GameBot by Discord user AstroMacGuffin#1486 (Nathan Hawks)
 * https://github.com/NathanHawks/SR1eGameBot
 * Yes I do regret baking 1e into the name
 * version 0.3, yeah that sounds good
 * Released under the terms of the UnLicense. This work is in the public domain.
 * Released as-is with no warranty or claim of usability for any purpose.
 */
// require crypto for reminders (random strings)
const crypto = require('crypto');
const {config} = require('./config');
const { logSpam, logWrite, logError } = require('./log');
const {Database} = require('./db');
const {ObjectId} = require('mongodb');
// for defaulting if's & callbacks
function doNothing () {}
// config object
function getConfig() { return config; }
// @ =================== CACHE ====================
function resetCache() {
  global.cache = {
    server: [],  // arr of obj: dbID, discordID
    channel: [], // arr of obj: dbID, discordID, parentID,
    userInChannel: [], // arr of obj: dbID, discordID, parentID
    file: [], // arr of obj: dbID, name, parentID
    fileContent: [], // arr of obj: dbID, content
    playChannel: [], // arr of obj: server, channel, user, playChannel
    triplet: [] // arr of obj: server, channel, user, dbID
  };
}
// Checked 9/1/22
function _cache_nameAndParentMatch(obj, file) {
  if (obj.discordID && file.name && obj.discordID === file.name
    && file.parents && file.parents.length === 1 && obj.parentID
    && obj.parentID === file.parents[0])
    return true;
  else return false;
}
// Rewritten 9/1/22
function _cache_serverNameMatch(obj, file) {
  if (file.name && file.name === obj.discordID) return true;
  return false;
}
// Checked 9/1/22
function cacheHas(file, cacheAs) {
  let i = getCacheIndex(file, cacheAs, false);
  if (i > -1) return true;
  else return false;
}
// Checked 9/1/22
function getCacheIndex(file, cacheAs, create=true) {
  let r = -1;
  let id = file.id;
  if (cacheAs === 'playChannel' || cacheAs === 'triplet') {
    // fast-track playChannel seek
    for (let i = 0; i < global.cache[cacheAs].length; i++) {
      const obj = global.cache[cacheAs][i];
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
    let idIndex = [];
    for (let i = 0; i < global.cache[cacheAs].length; i++) {
      idIndex[i] = global.cache[cacheAs][i].dbID;
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
    // if (_cache_dbIDMatch(obj, file)) r = i;
    // servers don't need a parent, just the filename
    const obj = global.cache[cacheAs][i];
    if (cacheAs === 'server' && _cache_serverNameMatch(obj, file)) return i;
    if (cacheAs != 'playChannel' && cacheAs != 'server'
    && _cache_nameAndParentMatch(obj, file))
      return i;
    if (cacheAs === 'file') {
      if (file.parents && file.parents.length === 1
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
// Checked 9/1/22
function addToCache(file, cacheAs) {
  let ci = getCacheIndex(file, cacheAs);
  switch(cacheAs) {
    case 'triplet':
      global.cache.triplet[ci] = {
        server: file.server, channel: file.channel, user: file.user,
        dbID: file.id
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
      global.cache.server[ci].dbID = file.id;
      global.cache.server[ci].discordID = file.name;
    break;
    case 'channel':
    case 'userInChannel':
      global.cache[cacheAs][ci].dbID = file.id;
      global.cache[cacheAs][ci].discordID = file.name;
      global.cache[cacheAs][ci].parentID = file.parents[0];
    break;
    case 'file':
      if (file.id)      global.cache.file[ci].dbID = file.id;
      if (file.name)    global.cache.file[ci].discordID = file.name;
      if (file.parents) global.cache.file[ci].parentID = file.parents[0];
    break;
    case 'fileContent':
      if (file.content) {
        if (file.id)      global.cache.fileContent[ci].dbID = file.id;
        if (file.content) global.cache.fileContent[ci].content = file.content;
      }
      else {
        // no content; remove the element from the cache
        global.cache.fileContent.splice(ci, 1);
      }
    break;
  }
}
// Checked 9/1/22
function delFromCache(id, cacheAs) {
  let ci = getCacheIndex({id: id}, cacheAs, false);
  if (ci !== -1) {
    global.cache[cacheAs].splice(ci, 1);
  }
}
// Checked 9/1/22
function getFromCache(file, cacheAs) {
  let ci = getCacheIndex(file, cacheAs, false);
  return global.cache[cacheAs][ci];
}
// Rewritten 9/1/22
async function ensureTriplet(msg) {
  let serverFolderID = null;
  let channelFolderID = null;
  let userDataFolderID = global.folderID.UserData;
  let serverDiscordID = msg.channel.guild.id;
  let gmPlayChannelID = await getPlayChannel(msg);
  // Try asking the cache for the whole triplet endpoint
  let q = {
    server: msg.channel.guild.id,
    channel: gmPlayChannelID,
    user: msg.author.id
  };
  if (cacheHas(q, 'triplet')) return;
  // Get the server folder's ID
  q = {name: serverDiscordID};
  if (cacheHas(q, 'server')) {
    serverFolderID = getFromCache(q, 'server').dbID;
  } else {
    try {
      await ensureFolderByName(serverDiscordID, userDataFolderID);
      serverFolderID = await findFolderByName(serverDiscordID, userDataFolderID);
      serverFolderID = serverFolderID._id.toString();
      if (serverFolderID)
        addToCache(
          {name: msg.channel.guild.id, id: serverFolderID}, 'server'
        );
    } catch (e) { logError(e); }
  }
  // channel folder
  q = {name: gmPlayChannelID, parents: [serverFolderID]};
  if (cacheHas(q, 'channel')) {
    channelFolderID = getFromCache(q, 'channel').dbID;
  } else {
    try {
      await ensureFolderByName(gmPlayChannelID, serverFolderID);
      channelFolderID = await findFolderByName(gmPlayChannelID, serverFolderID);
      channelFolderID = channelFolderID._id.toString();
      if (channelFolderID)
        addToCache(
          {name: msg.channel.id, id: channelFolderID, parents: [serverFolderID]}, 'channel'
        );
    } catch (e) { console.log(e); }
  }
  // user folder
  q = {name: msg.author.id, parents: [channelFolderID]};
  if (cacheHas(q, 'userInChannel')) {
    // we're only here to ensure it exists; it does so we're done
    return;
  }
  else {
    try {
      await ensureFolderByName(msg.author.id, channelFolderID);
      const userFolder = await findFolderByName(msg.author.id, channelFolderID);
      addToCache({
        name: msg.author.id, parents: [userFolder.parent.toString()], id: userFolder._id.toString()
      }, 'userInChannel');
      addToCache({
        server: msg.channel.guild.id,
        channel: gmPlayChannelID,
        user: msg.author.id,
        id: userFolder._id.toString()
      }, 'triplet');
    } catch (e) { console.log(e); }
  }
  logSpam(' [ ==================== exiting ensureTriplet ============ ]')
}
// Rewritten 9/1/22
async function findUserFolderDBIDFromMsg(msg, usePlayChannel=false) {
  let r = null; // the userFolderID
  let s = null; // the server id
  let discordChannelID = -1;
  if (usePlayChannel) {
    discordChannelID = await getPlayChannel(msg);
  }
  else discordChannelID = msg.channel.id;
  // first try to get it from cache
  let q = {name: msg.channel.guild.id}
  if (cacheHas(q, 'server')) {
    s = getFromCache(q, 'server').dbID;
    logSpam(`findUserFolderDBIDFromMsg found server in cache: ${s}`);
    q = {name: discordChannelID, parents: [s]};
    if (s && cacheHas(q, 'channel')) {
      let c = getFromCache(q, 'channel').dbID;
      logSpam(`findUserFolderDBIDFromMsg found channel in cache: ${c}`);
      q = {name: msg.author.id, parents: [c]};
      if (c && cacheHas(q, 'userInChannel')) {
        r = getFromCache(q, 'userInChannel').dbID;
        logSpam("findUserFolderDBIDFromMsg found user folder at " + s + "/" + c + "/" + r);
        return r;
      }
    }
  }
  // the cache didn't return -- do it the slow way
  let serverFolder;
  serverFolder = await findFolderByName(
    msg.channel.guild.id, global.folderID.UserData
  );
  if (serverFolder) logSpam("Seek sID: " + serverFolder._id.toString());
  if (!serverFolder) {
    msg.reply(':man_facepalming: Something went wrong. Please try your command '
      + 'again. :man_facepalming:')
    .catch((e) => { logError(e); });
    return -1;
  }
  let channelFolder = await findFolderByName(
    discordChannelID, serverFolder._id.toString()
  );
  if (channelFolder) logSpam("Seek cID: " + channelFolder._id.toString());
  if (!channelFolder) {
    msg.reply(':man_facepalming: Something went wrong. Please try your command '
      + 'again. :man_facepalming:')
    .catch((e) => { logError(e); });
    return -1;
  }
  // return the file ID
  r = await findFolderByName(msg.author.id, channelFolder._id.toString());
  logSpam("Seek uID: " + r._id.toString());
  return r._id.toString();
}
// Rewritten 9/1/22
async function findUserDBIDFromDiscordID(msg, userID, usePlayChannel=false) {
  let gmPlayChannelID = -1;
  if (usePlayChannel) gmPlayChannelID = await getPlayChannel(msg);
  else gmPlayChannelID = msg.channel.id;
  let r = null;
  // try to get it from cache first
  let q = {name: msg.channel.guild.id};
  if (cacheHas(q, 'server')) {
    let serverID = getFromCache(q, 'server').dbID;
    q = {name: gmPlayChannelID, parents: [serverID]};
    if (cacheHas(q, 'channel')) {
      let channelID = getFromCache(q, 'channel').dbID;
      q = {name: userID, parents: [channelID]};
      if (cacheHas(q, 'userInChannel')) {
        r = getFromCache(q, 'userInChannel').dbID;
        return r;
      }
    }
  }
  // cache didn't return -- do it the slow way
  const serverFolder = await findFolderByName(msg.channel.guild.id,
    global.folderID.UserData);
  if (serverFolder) {
    addToCache({
      name:msg.channel.guild.id, id:serverFolder._id.toString()
    }, 'server');
    let channelFolder = await findFolderByName(
      gmPlayChannelID, serverFolder._id.toString()
    );
    if (channelFolder) {
      addToCache({
        name:gmPlayChannelID,
        parents:[msg.channel.guild.id],
        id:channelFolder._id.toString()
      }, 'channel');
      r = await findFolderByName(userID, channelFolder._id.toString());
      if (r) {
        addToCache({
          name:userID,
          parents:[channelFolder._id.toString()],
          id:r._id.toString()
        }, 'userInChannel');
        addToCache({
          server:msg.channel.guild.id,
          channel:gmPlayChannelID,
          user:userID,
          id:r._id.toString()
        }, 'triplet');
      }
      return r._id.toString();
    }
  }
  return -1;
}
// Rewritten 9/1/22
async function ensureFolderByName(name, parentID=null, encrypted=true) {
  const folder = await findFolderByName(name, parentID, doNothing, encrypted);
  if ((!folder || folder === -1) && parentID !== -1)
    await createFolder(name, parentID, doNothing, encrypted);
}
// Rewritten 9/1/22
async function findFolderByName(
  folderName,
  parentID=null,
  callback=doNothing,
  encrypted=true
) {
  if (parentID === -1) {
    logWrite(`findFolderByName: parentID was -1, `
      + `folderName was ${folderName}`);
    return -1;
  }
  const query = { $and: [] };
  if (encrypted) query['$and'].push({name: encrypt(folderName)})
  else query['$and'].push({name: folderName});
  try {
    if (parentID !== null) query.$and.push({parent: ObjectId(parentID)});
    const c = await Database.getTable("folders").findOne(query);
    callback(c);
    return c;
  }
  catch (e) { logError(e); }
}
// Rewritten 9/1/22
async function createFolder(
  folderName,
  parentID=null,
  callback=doNothing,
  encrypted=true
) {
  try {
    const doc = {};
    if (encrypted) {
      doc.name = encrypt(folderName);
      doc.encrypted = true;
    }
    else {
      doc.name = folderName;
      doc.encrypted = false;
    }
    if (parentID !== null) doc.parent = ObjectId(parentID);
    await Database.getTable("folders").insertOne(doc);
    callback();
  }
  catch (e) { logError(e); }
}
// Rewritten 9/1/22
async function findStringIDByName(filename, parentID, useCache=true) {
  let q = {name: filename, parents: [parentID]};
  if (useCache && cacheHas(q, 'file')) {
    return getFromCache(q, 'file').dbID;
  }
  try {
    const c = await Database.getTable("strings").findOne({
      $and: [ {name: filename}, {parent: ObjectId(parentID)} ]
    });
    if (c) {
      if (useCache)
        addToCache({
          id: c._id.toString(), name: c.name, parents: [ c.parent.toString() ]
        }, 'file');
      return c._id.toString();
    }
    else return -1;
  }
  catch (e) { logError(e); return -1; }
}
// Rewritten 9/1/22
async function getStringContent(fileID, useCache=true) {
  if (fileID === -1) return "";
  let fileContents = '';
  if (useCache) {
    let q = {id: fileID};
    if (cacheHas(q, 'fileContent')) {
      let c = getFromCache(q, 'fileContent');
      if (c.hasOwnProperty('content')) {
        logSpam("Found in cache: " + c.content);
        return c.content;
      }
    }
  }
  try {
    const c = await Database.getTable("strings").findOne({ _id: ObjectId(fileID) });
    if (c && c.content && c.content !== '') {
      if (c.encrypted) fileContents = decrypt(c.content);
      else fileContents=c.content;
      if (useCache) addToCache({id: fileID, content: fileContents}, 'fileContent');
    }
    return fileContents;
  }
  catch (e) { logError(e); }
}
// Rewritten 9/1/22
async function setStringByNameAndParent(filename, parentFolderID, contents) {
  try {
    await Database.getTable("strings").updateOne(
      {$and: [ {name: filename, parent: ObjectId(parentFolderID)} ]},
      {$set: {
        content: encrypt(contents),
        name: filename,
        parent: ObjectId(parentFolderID),
        encrypted: true
      }},
      {upsert: true}
    );
    const id = await findStringIDByName(filename, parentFolderID);
    delFromCache(id, 'fileContent');
    addToCache({id: id, content: contents}, 'fileContent');
  }
  catch (e) { logError(e); }
}
// Rewritten 9/1/22
async function deleteStringByID(fileId, callback=doNothing) {
  try {
    await Database.getTable("strings").deleteOne({_id: ObjectId(fileId)});
    callback();
  }
  catch (e) { logError(e); }
}
// Legacy: hourglass is no longer needed (and the bot appears to need special
// permissions to remove its own reaction)
async function addHourglass(msg) {
  msg; // for linter
  return;
}
// see note above
function removeHourglass(msg) {
  msg; // for linter
  return;
}
function d6(explode=false) {
    let roll = Math.floor(Math.random() * 6 + 1);
    if (roll == 6 && explode == true) roll += d6(true);
    return roll;
}
function d10() {
  let roll = Math.floor(Math.random() * 10 + 1);
  return roll;
}
function firstTwoLC(ofWhat) {
  let r = ofWhat.substring(0,2);
  r = r.toLowerCase();
  return r;
}
function firstThreeLC(ofWhat) {
  let r = ofWhat.substring(0,3);
  r = r.toLowerCase();
  return r;
}
function lastChar(ofWhat) {
  let r = ofWhat.substring(ofWhat.length-1, ofWhat.length).toLowerCase();
  return r;
}
function getTNFromArgs(args) {
  let tn = -1;
  for (x = 0; x < args.length; x++) {
    let firsttwo = firstTwoLC(args[x]);
    if (firsttwo == 'tn') {
      // peel off the number after "tn"
      tn = args[x].substring(2, args[x].length);
      // if there wasn't a number, look ahead to next arg
      if (isNaN(Number(tn)) || tn < 2) {
        let y = x + 1;
        let tmptn = args[y];
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
    let firstchar = args[x].substring(0, 1);
    if (firstchar === '+' || firstchar === '-') {
      // make sure the rest of the arg is a number
      let subj = args[x].substring(1, args[x].length);
      if (subj == Number(subj)) {
        // return the version with the +/- sign as a Number()
        return Number(args[x]);
      }
    }
  }
}
function sortNumberDesc(a, b) { return b - a; }
function sortReaction(a, b) {
  let aArr = a.split("(");
  let aReaction, bReaction;
  if (aArr.length > 1) {
    aReaction = aArr[1].substring(0, aArr[1].length-1);
  } else aReaction = 0;
  let bArr = b.split("(");
  if (bArr.length > 1) {
    bReaction = bArr[1].substring(0, bArr[1].length-1);
  } else bReaction = 0;
  return bReaction - aReaction;
}
function sortInitPass(a, b) {
  let aArr = a.split("]");
  let aReaction, bReaction;
  if (aArr.length > 1) {
    aReaction = aArr[0].substring(2);
  } else aReaction = 0;
  let bArr = b.split("]");
  if (bArr.length > 1) {
    bReaction = bArr[0].substring(2);
  } else bReaction = 0;
  return bReaction - aReaction;
}
function sortCPRTiebreaker(a, b) {
  if (a !== b) return b - a;
  let aReroll = 0;
  let bReroll = 0;
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
  let isOpposedBool = false;
  let opponentDiceInt = -1;
  let opponentTNInt = -1;
  let isOpposedTestBool = false;
  // check every arg for opponent dice & opponent TN
  for (x = 0; x < args.length; x++) {
    let firsttwo = firstTwoLC(args[x]);
    let firstthree = firstThreeLC(args[x]);
    if (firsttwo == 'vs' && args[x].length > 2 && firstthree !== "vs.") {
      isOpposedBool = true;
      let lastchar = lastChar(args[x]);
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
      let y = x + 1;
      let tmptn = args[y];
      if (!isNaN(Number(tmptn)) && tmptn > 1) opponentTNInt = tmptn;
      else opponentTNInt = -1;
    }
  }
  return [isOpposedBool,opponentDiceInt,opponentTNInt,isOpposedTestBool];
}
function makeOpposedOutput(successesInt, opponentSuccessesInt,
  user, rollsIntArr, opponentRollsIntArr, note)
{
  let successesFormattedString = '';
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
  let r = user + ' rolled ' + successesFormattedString
  + '('+rollsIntArr+') vs ('+opponentRollsIntArr+') ' + note;
  return r;
}
function prepRollNote(cmd, args, tnInt) {
  let note = cmd;
  let spacer = "";
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
  let rollsIntArr = [];
  let successesInt = 0;
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
  let rollsIntArr = [];
  for (x = 0; x < numDiceInt; x++) {
    rollsIntArr[x] = d10();
  }
  rollsIntArr.sort(sortNumberDesc);
  return rollsIntArr;
}
function modifyNPCInput(args) {
  // allow human-readable format without space
  if (args && args.length && args.length%2 === 0) {
    let gotCha = false; // true if d6+ detected
    let fixArgs = []; // to hold the fixed data format
    let y = 0; // to increment by 3's for the fixed array
    for (let x = 0; x < args.length; x+=2) {
      if (args[x].toLowerCase().indexOf('d6+') !== -1) {
        gotCha = true;
        args[x] = args[x].toLowerCase();
        let tmpArr = args[x].split('d6+');
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
  for (let x = 0; x < args.length; x+=3) {
    if (args[x] && args[x].length) {
      let suspect = args[x].substring(args[x].length-2, args[x].length).toLowerCase();
      if (suspect === 'd6') {
        args[x] = args[x].substring(0, args[x].length-2);
      }
    }
    if (args[x+1] && args[x+1].length) {
      let suspect = args[x+1].substring(0, 1);
      if (suspect === '+') {
        args[x+1] = args[x+1].substring(1, args[x+1].length);
      }
    }
  }
  return args;
}
async function validateNPCInput(msg, args) {
  // some input validation
  let errOutput = '';
  if (args.length%3 !== 0) {
    errOutput += ':no_entry_sign: Wrong number of options; '
      + 'maybe you put spaces in a label?\n';
  }
  for (let x = 0; x < args.length; x++) {
    if (args[x].indexOf(',') !== -1) {
      errOutput += ':no_entry_sign: No commas allowed anywhere in this command.\n';
    }
  }
  let gotIt_Stop = false;
  for (let x = 0; x < args.length; x+=3) {
    // filter non-numeric inputs for 1st & 2nd args (& display error only once)
    if (gotIt_Stop === false
      // loose comparison below is intentional DO NOT FIX
      && (Number(args[x]) != args[x] || Number(args[x+1]) != args[x+1]))
    {
      errOutput += ':thinking: See ":dragon_face: Adding NPC\'s :dragon_face:" '
        + 'in **!help init** for help.\n';
      gotIt_Stop = true;
    }
  }
  // abort if any errors
  if (errOutput !== '') {
    msg.reply(await addMaintenanceStatusMessage(msg, `There was a problem.\n${errOutput}`))
    .catch((e) => { logError(e); });
    return false;
  } else return true;
}
// Rewritten 9/1/22
async function getPlayChannel(msg) {
  // check cache first
  const file = {
    server: msg.channel.guild.id, channel: msg.channel.id, user: msg.author.id
  };
  if (cacheHas(file, 'playChannel')) {
    const r = getFromCache(file, 'playChannel');
    logSpam('Returning play channel from cache');
    return r.playChannel;
  }
  const userFolderID = await findUserFolderDBIDFromMsg(msg);
  if (userFolderID === -1) return -1;
  const filename = 'gmPlayChannel';
  const playChannelDBID = await findStringIDByName(filename, userFolderID);
  try {
    if (playChannelDBID !== -1) {
      const gmPlayChannelID = await getStringContent(playChannelDBID);
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
    return logError(e);
  }
}
// Checked 9/1/22
async function getUserReminders(userFolderID, useCache=true) {
  const filename = 'gmReminders';
  const gmRemindersID = await findStringIDByName(filename, userFolderID, useCache);
  let gmContent = '';
  const reminders = [];
  if (gmRemindersID !== -1) {
    gmContent = await getStringContent(gmRemindersID, useCache);
    if (gmContent !== '') {
      let gmFileArr = gmContent.split('\n');
      for (let x = 0; x < gmFileArr.length; x++) {
        let r = gmFileArr[x].split(',');
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
// Checked 9/1/22
async function getActiveReminders() {
  const filename = 'activeReminders';
  const sysRemindersID = await findStringIDByName(
    filename, global.folderID.reminders
  );
  let sysContent = '';
  const reminders = [];
  if (sysRemindersID !== -1) {
    sysContent = await getStringContent(sysRemindersID);
    if (sysContent !== '') {
      let sysFileArr = sysContent.split('\n');
      for (let x = 0; x < sysFileArr.length; x++) {
        let r = sysFileArr[x].split(',');
        reminders.push({
          shortID: r[0], id: r[1], sessionTimeDateF: r[2], dateTime: r[3],
          timeStamp: r[4], gmID: r[5], userFolderID: r[6], playChannelID: r[7],
          playersString: r[8]
        });
      }
    }
    return reminders;
  }
  else {
    return reminders; // empty array
  }
}
// Checked 9/1/22
async function _deleteReminder(reminderID, userFolderID) {
  for (let y = 0; y < global.reminders.length; y++) {
    if (global.reminders[y].id === reminderID) {
      // delete the element from gm's userfolder which was passed as an arg
      const gmFileID = await findStringIDByName('gmReminders', userFolderID);
      const gmFileContent = await getStringContent(gmFileID);
      const gmFileArr = gmFileContent.split('\n');
      for (let z = 0; z < gmFileArr.length; z++) {
        const gmEntryArr = gmFileArr[z].split(',');
        if (gmEntryArr[1] === reminderID) {
          gmFileArr.splice(z, 1);
          z--;
        }
      }
      // write after the loop
      await setStringByNameAndParent(
        'gmReminders',
        userFolderID,
        gmFileArr.join('\n')
      );
      // delete the element from the activeReminders file
      let sysFileID = await findStringIDByName('activeReminders',
        global.folderID.reminders);
      const sysFileContent = await getStringContent(sysFileID);
      let sysFileArr = sysFileContent.split('\n');
      for (let z = 0; z < sysFileArr.length; z++) {
        const sysEntryArr = sysFileArr[z].split(',');
        if (sysEntryArr[1] === reminderID) {
          sysFileArr.splice(z, 1);
          z--;
        }
      }
      // write after the loop
      await setStringByNameAndParent(
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
// Checked 9/1/22
function _makeReminderSaveString(reminder) {
  return `${reminder.shortID},${reminder.id},${reminder.sessionTimeDateF},${reminder.dateTime},`
    + `${reminder.timeStamp},${reminder.gmID},${reminder.userFolderID},`
    + `${reminder.playChannelID},${reminder.playersString}`;
}
// Checked 9/1/22
async function _saveGMReminders(userFolderID, reminders) {
  const filename = 'gmReminders';
  let gmContent = '';
  const gmRemindersID = await findStringIDByName(filename, userFolderID);
  if (gmRemindersID !== -1) {
    gmContent = await getStringContent(gmRemindersID);
  }
  for (let i = 0; i < reminders.length; i++) {
    if (gmContent !== '') gmContent += '\n';
    gmContent += _makeReminderSaveString(reminders[i]);
  }
  logSpam(`gmContent\n${gmContent}`);
  await setStringByNameAndParent(filename, userFolderID, gmContent);

}
// Checked 9/1/22
async function _saveSystemReminders(reminders) {
  const filename = 'activeReminders';
  let sysContent = '';
  const reminderFolderID = global.folderID.reminders;
  const sysFileID = await findStringIDByName(filename, reminderFolderID);
  if (sysFileID !== -1) {
    sysContent = await getStringContent(sysFileID);
  }
  for (let i = 0; i < reminders.length; i++) {
    if (sysContent !== '') sysContent += '\n';
    sysContent += _makeReminderSaveString(reminders[i]);
  }
  logSpam(`sysContent:\n${sysContent}`);
  await setStringByNameAndParent(filename, reminderFolderID, sysContent);
}
// Checked 9/1/22
async function _addRemindersSetTimeoutPayload(reminder) {
  logWrite('\x1b[32m [ ==================== _addRemindersSetTimeoutPayload ======================= ]\x1b[0m');
  const d = new Date(reminder.sessionTimeDateF);
  const users = reminder.playersString.split(' ');
  for (let x = 0; x < users.length; x++) {
    logSpam(`Reminder ID: ${reminder.id} sending to ${users[x]}`);
    const user = await global.bot.users.fetch(users[x]);
    const gm = await global.bot.users.fetch(reminder.gmID);
    const gmName = gm.tag.split("#")[0];
    user.send(`This is a reminder of your upcoming game`
      + ` at ${d} with GM **${gmName}**.`)
    .catch((err) => { logError(err); });
  }
  // upkeep system
  global.lastRemindersTime = Date.now();
  await _deleteReminder(reminder.id, reminder.userFolderID);
  logSpam(`System reminders var has ${global.reminders.length} entries`);
}
// Checked 9/1/22
async function addReminders(msg, reminders) {
  // user folder (or play channel per 2nd argument)
  let userFolderID = await findUserFolderDBIDFromMsg(msg, true);
  if (userFolderID === -1) return -1;
  // loop reminders
  for (let i = 0; i < reminders.length; i++) {
    // make id's
    reminders[i].id = crypto.randomBytes(32).toString('hex');
    reminders[i].shortID = crypto.randomBytes(3).toString('hex');
    // activate reminders
    reminders[i].timeoutID = setTimeout(
      _addRemindersSetTimeoutPayload,
      reminders[i].MilliSecondsFromNow,
      reminders[i]
    );
    global.reminders.push(reminders[i]);
  }
  // save to GM's play folder
  await _saveGMReminders(userFolderID, reminders);
  // save to /(root)/UserData/reminders/activeReminders
  await _saveSystemReminders(reminders);
  logSpam(`System reminders var has ${global.reminders.length} entries`);
}
// Checked 9/1/22
async function getSceneList(msg) {
  const filename = 'gmSceneList';
  const userFolderID = await findUserFolderDBIDFromMsg(msg, true);
  if (userFolderID === -1) return -1;
  const fileID = await findStringIDByName(filename, userFolderID);
  if (fileID !== -1) {
    const content = await getStringContent(fileID);
    if (content && content.length && content.length > 0) {
      let contentArr = content.split("\n|||||\n");
      let i = 0;
      const sceneList = [];
      contentArr.forEach((scene) => {
        if (scene.length > 0) {
          let sceneArr = scene.split("\n|||\n");
          sceneList[i] = {};
          sceneList[i].name = sceneArr[0];
          sceneList[i].dbID = sceneArr[1];
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
// Checked 9/1/22
async function updateSceneList(msg, newScene) {
  const sceneList = await getSceneList(msg);
  let i = sceneList.length;
  let makeNewEntry = true;
  if (i > 0) {
    // don't add the same scene name twice
    sceneList.forEach((scene) => {
      if (scene.name === newScene.name) makeNewEntry = false;
    });
  }
  if (makeNewEntry) {
    sceneList[i] = {};
    sceneList[i].dbID = newScene.dbID;
    sceneList[i].name = newScene.name;
    await saveSceneList(msg, sceneList);
  }
  if (makeNewEntry) i++;
  return i;
}
// Checked 9/1/22
async function deleteSceneFromList(msg, sceneName) {
  logSpam(`Starting deleteSceneFromList for scene ${sceneName}`);
  const sceneList = await getSceneList(msg);
  logSpam(`got sceneList: ${sceneList}`);
  let i = 0;
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
// Checked 9/1/22
async function saveSceneList(msg, sceneList) {
  const filename = 'gmSceneList';
  const userFolderID = await findUserFolderDBIDFromMsg(msg, true);
  if (userFolderID === -1) return -1;
  let content = '';
  sceneList.forEach((scene) => {
    if (scene.dbID && scene.name) {
      content += `${scene.name}\n|||\n${scene.dbID}\n|||||\n`;
    }
  });
  await setStringByNameAndParent(filename, userFolderID, content);
}
// conditionally add warning message
async function addMaintenanceStatusMessage(msg, output) {
  let r = "";
  let opt = await getUserOption(msg.author, 'skipStatusMsg');
  if (
    global.isMaintenanceModeBool === true
    && opt != global.maintenanceStatusMessage
  )
    r = output + " " + global.maintenanceStatusMessage;
  else r = output;
  return r;
}
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
async function getUserOption(user, optionName) {
  try {
    const userOptFolder = await getUserOptionFolder(user.id);
    const optValueID = await findStringIDByName(
      optionName, userOptFolder._id.toString()
    );
    if (!optValueID) return;
    return await getStringContent(optValueID);
  }
  catch (e) {
    logError(e);
    return undefined;
  }
}
async function setUserOption(user, optionName, optionValue) {
  try {
    const userOptFolder = await getUserOptionFolder(user.id);
    await setStringByNameAndParent(
      optionName, userOptFolder._id.toString(), optionValue
    );
  }
  catch (e) {
    logError(e);
    return false;
  }
}
async function getUserOptionFolder(userID) {
  await ensureFolderByName('options', global.folderID.UserData, false);
  const optFolder = await findFolderByName(
    'options', global.folderID.UserData, doNothing, false
  );
  await ensureFolderByName(userID, optFolder._id.toString());
  return await findFolderByName(
    userID, optFolder._id.toString()
  );
}
async function findDiscordUserIDByLinkCode(code) {
  try {
    const c = await Database.getTable("strings").findOne({ $and: [
      {name: 'webLinkCode'}, {content: encrypt(code)}
    ]});
    if (!c) return undefined;
    const folder = await Database.getTable("folders").findOne({
      _id: ObjectId(c.parent.toString())
    });
    if (!folder) return undefined;
    return decrypt(folder.name);
  }
  catch (e) { logError(e); }
}
function encrypt(string) {
  const key = getConfig().cryptoKey;
  const vector = getConfig().cryptoVector;
  const algo = "aes-256-cbc";
  try {
    const cipher = crypto.createCipheriv(algo, key, vector);
    return cipher.update(string, "utf-8", "hex") + cipher.final('hex');
  }
  catch (e) { logError(e); return undefined; }
}
function decrypt(cipherText) {
  const key = getConfig().cryptoKey;
  const vector = getConfig().cryptoVector;
  const algo = "aes-256-cbc";
  try {
    const decipher = crypto.createDecipheriv(algo, key, vector);
    return decipher.update(cipherText, "hex", "utf-8") + decipher.final("utf8");
  }
  catch(e) { logError(e); return undefined; }
}
async function fetchLabel(type, serverID, channelID=null, userID=null) {
  let label;
  switch (type) {
    case "server":
      if (!serverID) return undefined;
      global.bot.guilds.fetch(serverID).then((g) => {
        label = g.name;
      }).catch(logError);
    break;
    case "channel":
      if (!serverID || !channelID) return undefined;
      global.bot.guilds.fetch(serverID).then((g) => {
        g.channels.fetch(channelID).then((c) => {
          label = c.name;
        }).catch(logError);
      }).catch(logError);
    break;
    case "user":
      if (!serverID || !userID) return undefined;
      global.bot.guilds.fetch(serverID).then((g) => {
        g.members.fetch(userID).then((u) => {
          label = u.displayName;
        }).catch(logError);
      }).catch(logError);
    break;
    default:
      return undefined;
  }
  while (label === undefined) { await sleep(15); }
  return label;
}
async function fetchAndStoreAllLabels() {
  // get servers
  const serverCTexts = await Database.getTable("folders").distinct(
    'name', {parent: ObjectId(global.folderID.UserData)}
  );
  serverCTexts.forEach(async (serverCText) => {
    // skip system folders
    if (['UserData', 'reminders', 'options'].indexOf(serverCText) > -1) return;
    // get cleartext snowflake
    const serverID = decrypt(serverCText);
    // skip if we failed to decrypt
    if (!serverID) return;
    // get label
    const serverLabel = await fetchLabel("server", serverID);
    // encrypt label
    const serverLabelCText = encrypt(serverLabel);
    // now we need the folder id
    const server = await Database.getTable("folders").findOne(
      {name: serverCText}
    );
    // skip if failed to query
    if (!server) return;
    // add label to database
    await Database.getTable("folders").updateOne(
      {_id: ObjectId(server._id.toString())},
      {$set: { label: serverLabelCText }},
      {upsert: false}
    );
    // get channels in server
    const channelCTexts = await Database.getTable("folders").distinct(
      'name', {parent: ObjectId(server._id.toString())}
    );
    channelCTexts.forEach(async (channelCText) => {
      // get cleartext snowflake
      const channelID = decrypt(channelCText);
      // skip if we failed to decrypt
      if (!channelID) return;
      // get label
      const channelLabel = await fetchLabel("channel", serverID, channelID);
      // encrypt label
      const channelLabelCText = encrypt(channelLabel);
      // get folder id
      const channel = await Database.getTable("folders").findOne(
        {$and: [{name: channelCText}, {parent: ObjectId(server._id.toString())}]}
      )
      // skip if failed to query
      if (!channel) return;
      // add label to database
      await Database.getTable("folders").updateOne(
        {_id: ObjectId(channel._id.toString())},
        {$set: { label: channelLabelCText}},
        {upsert: false}
      );
      // get users in channel
      const count = await Database.getTable("folders").countDocuments(
        {parent: ObjectId(channel._id.toString())}
      );
      if (count === 0) return;
      else logWrite(`${count} users in ${serverLabel}/${channelLabel}`);
      const userCTexts = await Database.getTable("folders").distinct(
        'name', {parent: ObjectId(channel._id.toString())}
      );
      userCTexts.forEach(async (userCText) => {
        // get cleartext snowflake
        const userID = decrypt(userCText);
        // skip if we failed to decrypt
        if (!userID) return;
        // get label
        const userLabel = await fetchLabel("user", serverID, null, userID);
        // encrypt label
        const userLabelCText = encrypt(userLabel);
        // get folder id
        const user = await Database.getTable("folders").findOne(
          {$and: [{name: userCText}, {parent: ObjectId(channel._id.toString())}]}
        );
        // skip if we failed to query
        if (!user) return;
        // add label to database
        await Database.getTable("folders").updateOne(
          {_id: ObjectId(user._id.toString())},
          {$set: {label: userLabelCText}},
          {upsert: false}
        );
      });
    });
  });
}
async function getParentFolder(id) {
  const folder = await Database.getTable("folders").findOne({_id: ObjectId(id)});
  if (!folder || !folder.parent) return null;
  return await Database.getTable("folders").findOne({
    _id: ObjectId(folder.parent.toString())
  })
}
module.exports = {
  doNothing, getConfig, resetCache, cacheHas, getCacheIndex,
  addToCache, delFromCache, getFromCache, ensureTriplet,
  findUserFolderDBIDFromMsg, findUserDBIDFromDiscordID, ensureFolderByName,
  findFolderByName, createFolder, findStringIDByName, getStringContent,
  setStringByNameAndParent, deleteStringByID, removeHourglass, addHourglass,
  d6, d10,
  firstTwoLC, firstThreeLC, lastChar, getTNFromArgs, getModifierFromArgs,
  sortNumberDesc, sortReaction, sortInitPass, sortCPRTiebreaker,
  sort1ETiebreaker, getOpposedSetupArr, makeOpposedOutput, prepRollNote,
  rollDice, rollD10s, modifyNPCInput, validateNPCInput, getPlayChannel,
  getUserReminders, getActiveReminders, addReminders,
  getSceneList, updateSceneList, deleteSceneFromList, saveSceneList,
  addMaintenanceStatusMessage, sleep, getUserOption, setUserOption,
  findDiscordUserIDByLinkCode, getUserOptionFolder, encrypt, decrypt,
  fetchAndStoreAllLabels, fetchLabel, getParentFolder,

  _addRemindersSetTimeoutPayload, _makeReminderSaveString
}
