// set true to activate warning messages
var isMaintenanceModeBool = true;
// set status message to send as warning when isMaintenanceModeBool is true
var maintenanceStatusMessage = '\n**Bzzt. Hoi!** '
/*
+ 'We\'re back! Occasional disruptions may occur as I prep for initiative.'

+ 'The bot\'s in maintenance mode.** If it forgets rerolls faster than normal, '
+ 'it means I rebooted the bot.'
*/
+ ' Actively testing some ideas; the bot will reboot often, thus the 🎲 icon will often fail.'
+ ' Pzzhht! -Astro';
// conditionally add warning message
function addMaintenanceStatusMessage(output) {
  var r = output + " " + maintenanceStatusMessage;
  return r;
}
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
// internal setup
// system folder(s)
global.folderID = {UserData : null};
// a way to get recently created IDs per channel
global.lastCreatedFolder = { };
// a cursor for returning found files per channel
global.lastFoundFileID = { };
// semaphores per channel id, to avoid race conditions
global.lock = { };
// a place to store the results of getFileContents
global.lastFileContents = { };
// config (debugging flags, etc)
global.config = {
  // debugging options
  skipInitInitiative:                 false,
  deleteUserDataIfFoundOnStartup:     false,
  listAllFilesOnStartup:              true,
  createASubfolderOnStartup:          false,
  deleteAllFilesOnStartup:            false,
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

// Load client secrets from a local file.
fs.readFile('googlecredentials.json', (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
  // Authorize a client with credentials, then call the Google Drive API.
  authorize(JSON.parse(content), initInitiative);
});

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
  fs.readFile(G_TOKEN_PATH, (err, token) => {
    if (err) return getAccessToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
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
async function openFile(args) {
  console.log(await getFileContents(args[0], 'system'));
}
function listAllFiles() {
  var auth = global.auth;
  const drive = google.drive({version: 'v3', auth});
  drive.files.list({
    fields: 'nextPageToken, files(id, name, parents)',
  }, (err, res) => {
    if (err) return console.log('The API returned an error: ' + err);
    const files = res.data.files;
    if (files.length) {
      console.log('DX: File list ----------------- IDs --------------------- parents');
      files.map((file) => {
        console.log(`${file.name} (${file.id}) [${file.parents}]`);
      });
    } else {
      console.log('No files found.');
    }
  });
}
function deleteAllFiles() {
  var auth = global.auth;
  const drive = google.drive({version: 'v3', auth});
  drive.files.list({
    fields: 'nextPageToken, files(id, name)',
  }, (err, res) => {
    if (err) return console.log('The API returned an error: ' + err);
    const files = res.data.files;
    if (files.length) {
      console.log(`DX: Deleting ${files.length} files...`);
      files.map((file) => {
        deleteFileById(file.id,(err,res)=>{if (err) console.error(err);});
      });
      console.log("DX: All commands sent.")
    } else {
      console.log('No files found.');
    }
  });
}
function dxCreateSubfolder() {
  // test ensure
  ensureFolderByName('Subfolder', global.folderID.UserData);
}
//==================================================================
// @ =========== INITIATIVE LIBRARY FUNCS ============
// ensure folder/subfolder chain: (root)/(UserData)/ServerID/ChannelID/UserID
async function ensureFolderTriplet(msg) {
  var serverFolderID = null;
  var channelFolderID = null;
  var userDataFolderID = global.folderID.UserData;
  var serverDiscordID = msg.channel.guild.id;
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  await ensureFolderByName(serverDiscordID, userDataFolderID, msg.channel.id);
  await findFolderByName(serverDiscordID, userDataFolderID, (err, res) => {
    if (err) return console.error(err);
    lockDiskForChannel(msg.channel.id);
    var files = res.data.files;
    if (files.length == 1)
      files.map((file)=>{global.lastCreatedFolder[msg.channel.id] = file.id;});
    else { console.error(`> BAD: ${msg.channel.guild.id} in UserData.`); }
    unlockDiskForChannel(msg.channel.id);
  }, msg.channel.id);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  serverFolderID = global.lastCreatedFolder[msg.channel.id];

  await ensureFolderByName(msg.channel.id, serverFolderID, msg.channel.id);
  await findFolderByName(msg.channel.id, serverFolderID, (err, res) => {
    if (err) return console.error(err);
    lockDiskForChannel(msg.channel.id);
    var files = res.data.files;
    if (files.length == 1)
      files.map((file)=>{global.lastCreatedFolder[msg.channel.id] = file.id;});
    else { console.error(`> BAD: ${msg.channel.id} in ${serverFolderID}.`); }
    unlockDiskForChannel(msg.channel.id);
  }, msg.channel.id);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  channelFolderID = global.lastCreatedFolder[msg.channel.id];

  await ensureFolderByName(msg.author.id, channelFolderID, msg.channel.id);
  await findFolderByName(msg.author.id, channelFolderID, (err, res) => {
    if (err) return console.error(err);
    lockDiskForChannel(msg.channel.id);
    var files = res.data.files;
    if (files.length == 1)
      files.map((file)=>{global.lastCreatedFolder[msg.channel.id] = file.id;});
    else { console.error(`> BAD: ${msg.author.id} in ${channelFolderID}.`)}
    unlockDiskForChannel(msg.channel.id);
  }, msg.channel.id);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
}

async function findUserFolderFromMsg(msg) {
  var r = null;
  // a User's folder exists in (root)/UserData/ServerID/ChannelID/UserID
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  await findFolderByName(msg.channel.guild.id, global.folderID.UserData,
    (err, res) => {
      if (res.data.files.length > 0) {
        // store the file id
        res.data.files.map((file)=>{
          global.lastFoundFileID[msg.channel.id] = file.id;
        });
        unlockDiskForChannel(msg.channel.id);
      }
  }, msg.channel.id);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  var serverFolderID = global.lastFoundFileID[msg.channel.id];
  await findFolderByName(msg.channel.id, serverFolderID, (err, res) => {
    if (res.data.files.length > 0) {
      // store the file id
      res.data.files.map((file)=>{
        global.lastFoundFileID[msg.channel.id] = file.id;
      });
      unlockDiskForChannel(msg.channel.id);
    }
  }, msg.channel.id);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  var channelFolderID = global.lastFoundFileID[msg.channel.id];
  await findFolderByName(msg.author.id, channelFolderID, (err, res) => {
    if (err) return console.error(err);
    lockDiskForChannel(msg.channel.id);
    if (res.data.files.length > 0) {
      // store the file id
      res.data.files.map((file)=>{
        global.lastFoundFileID[msg.channel.id] = file.id;
      });
      unlockDiskForChannel(msg.channel.id);
    }
  }, msg.channel.id);
  // return the file ID
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  r = global.lastFoundFileID[msg.channel.id];
  return r;
}

async function findUserFolderFromUserID(msg, userID) {
  var r = null;
  // a User's folder exists in (root)/UserData/ServerID/ChannelID/UserID
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  await findFolderByName(msg.channel.guild.id, global.folderID.UserData,
    (err, res) => {
      if (res.data.files.length > 0) {
        // store the file id
        res.data.files.map((file)=>{
          global.lastFoundFileID[msg.channel.id] = file.id;
        });
        unlockDiskForChannel(msg.channel.id);
      }
  }, msg.channel.id);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  var serverFolderID = global.lastFoundFileID[msg.channel.id];
  await findFolderByName(msg.channel.id, serverFolderID, (err, res) => {
    if (res.data.files.length > 0) {
      // store the file id
      res.data.files.map((file)=>{
        global.lastFoundFileID[msg.channel.id] = file.id;
      });
      unlockDiskForChannel(msg.channel.id);
    }
  }, msg.channel.id);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  var channelFolderID = global.lastFoundFileID[msg.channel.id];
  await findFolderByName(userID, channelFolderID, (err, res) => {
    if (err) return console.error(err);
    lockDiskForChannel(msg.channel.id);
    if (res.data.files.length > 0) {
      // store the file id
      res.data.files.map((file)=>{
        global.lastFoundFileID[msg.channel.id] = file.id;
      });
    } else { global.lastFoundFileID[msg.channel.id] = -1; }
    unlockDiskForChannel(msg.channel.id);
  }, msg.channel.id);
  // return the file ID
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  r = global.lastFoundFileID[msg.channel.id];
  return r;
}

// @ function ensureFolderByName(name, parentID=null, channelID="system")
function ensureFolderByName(name, parentID=null, channelID="system") {
  findFolderByName(name, parentID, (err, res) => {
    if (err) return console.error(err);
    console.log(`Ensuring folder ${name} exists`);
    const files = res.data.files;
    if (files.length == 0) {
      console.log('It doesn\'t exist; creating it');
      // create folder & let callback perform another find to get id
      createFolder(name, parentID, (err, file) => {
        // after-creation action
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
async function findFolderByName(folderName, parentID=null, callback, channelID="system") {
  while (isDiskLockedForChannel(channelID)) { await sleep(15); }
  lockDiskForChannel(channelID);
  var auth = global.auth;
  const drive = google.drive({version: 'v3', auth});
  var mainq = `name="${folderName}"`;
  mainq = (parentID == null) ? mainq : `${mainq} and "${parentID}" in parents`
  var q = {
    q: mainq,
    mimeType: 'application/vnd.google-apps.folder',
    fields: 'files(id, name, parents)',
  };
  drive.files.list(q, (err, res) => {
    unlockDiskForChannel(channelID);
    callback(err, res);
  });
}

// @ function createFolder(folderName, parentID=null, callback, channelID="system")
async function createFolder(folderName, parentID=null, callback, channelID="system") {
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
    if (err) return console.error(err);
    unlockDiskForChannel(channelID);
    callback(err,file);
  });
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
      if (res.data.files.length == 0) {
        // create it
        drive.files.create({
          resource: { 'name': filename, 'parents': [parentFolderID] },
          media: { 'mimeType': 'text/plain', 'body': `${contents}/2` },
          fields: 'id'
        }, (err, file) => {
          if (err) return console.error(err);
          unlockDiskForChannel(channelID);
        });
      } else {
        // it already exists, update it
        res.data.files.map((file) => {
            drive.files.update({
              fileId: file.id, media: {body: `${contents}/2`}},
              (err, res) => {
                if (err) return console.error(err);
                unlockDiskForChannel(channelID);
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
// @ ================= INIT INITIATIVE ================
// Init the Initiative system. See also callbackInitInitiative, immediately below
function initInitiative(auth) {
  // frag it
  global.auth = auth;
  // diagnostic / testing junk
  if (global.config.deleteAllFilesOnStartup == true)
    { deleteAllFiles(); return; }
  if (global.config.listAllFilesOnStartup == true) listAllFiles();
  if (global.config.skipInitInitiative == true) return;
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

  var findAndSetFolderID = function (files, folderName) {
    files.map((file) => {
      if (file.name == folderName) { global.folderID[folderName] = file.id; }
    });
  }

  // determine if we've already been installed; if not, do install
  const files = res.data.files;
  if (files.length) {
    // SETUP =======================================================
    var folderName = 'UserData';
    findAndSetFolderID(files, folderName);
    if (global.config.deleteUserDataIfFoundOnStartup == true) {
      // testing/debugging: delete UserData folder (to test installer again)
      deleteFileById(global.folderID[folderName],(err,res)=>{if(err)console.log(err);});
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
          } );
      } );
  }
  // rest of startup
  // more diagnostic / testing junk
  if (global.config.createASubfolderOnStartup == true) {
    while (isDiskLockedForChannel("system")) { await sleep(15); }
    dxCreateSubfolder();
  }

}

// ====== Original GameBot code ====================================
// @ ============= DICEBOT LIBRARY FUNCS ==============
function d6(explode=false) {
    var roll = Math.floor(Math.random() * 6 + 1);
    if (roll == 6 && explode == true) roll += d6(true);
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
  var r = ofWhat.substring(ofWhat.length-1, ofWhat.length);
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
  var numDiceInt = 0;
  var lastchar = lastChar(cmd);
  if (lastchar == '!') {
    isTestBool = true;
    numDiceInt = cmd.substring(0, cmd.length-1);
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

  // SETUP: anything remaining is a note; prepare to pass it thru
  var note = prepRollNote(cmd, args, tnInt);

  // GO: Roll the bones ============================================
  var retarr = rollDice(numDiceInt, isTestBool, tnInt);
  var successesInt = retarr[0];
  var rollsIntArr = retarr[1];
  var output = '';
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
    console.log(output);
  }

  // avoid false positives e.g. when chatting about Astral Tabeltop dice formats
  if (numDiceInt > 0) {
    // modify output for maintenance mode status
    output = addMaintenanceStatusMessage(output);
    // post results
    msg.channel.send(output);
    // provide reroll ui (dice reaction)
    msg.react('🎲');
    // no return
  }
}
function handleHelpCommand(msg, cmd, args, user) {
  var output = 'GameBot usage:\n'
    + '!***X***         Roll ***X***d6 *without* exploding 6\'s'
    + '  ***example:*** !5   rolls 5d6 without exploding\n'
    + '!X***!***        Roll ***X***d6 ***with*** exploding 6\'s'
    + '  ***example:*** !5!  rolls 5d6 with exploding\n'
    + '!X ***tnY***     Roll *without* exploding 6\'s against Target Number ***Y***'
    + '  ***example:*** !5 tn4   rolls 5d6 w/o exploding vs TN4\n'
    + '!X! ***tnY***     Roll ***with*** exploding 6\'s against Target Number ***Y***'
    + '  ***example:*** !5! tn4   rolls 5d6 w/ exploding vs TN4\n'
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
    + 'Opposed Rolls:\n'
    + '!A! tnB ***vsX!*** ***otnY***\n'
    + '   Roll *A*d6 (exploding) with tn *B*, opposed by *X*d6 (exploding) with opponent\'s tn *Y*\n'
    + '   vs*X* = the number of dice the opponent throws (vs*X*! for exploding dice)\n'
    + '   otn*Y* = the opponent\'s target number\n'
    + '  ***example:*** !5! tn3 vs6! otn4    '
      + 'Roll 5d6 (exploding) with TN 3, against 6d6 (exploding) with TN 4\n'
    + '\n';
  var output2 =
      '[page 2]\n:boom: **EXPERIMENTAL: Initiative System** :boom:\n'
    + 'The initiative system throws a lotta lotta notifications around, so GameBot '
      + 'needs everyone in the group to proactively consent via these commands:\n'
    + '\n'
    + 'Player setup:\n:one: **!setgm @someone**\n:two: **!setinit X Y**\n'
    + 'GM setup:\n:one: **!setgm**\n:two: **!setplayers @player1 @player2 (etc)**\n'
    + '\n'
    + 'IMPORTANT: Commands won\'t work unless you @people correctly. '
      + 'Use the menu that pops-up while you type, '
      + 'or tab-completion. \n**If it\'s blue with an underline, you did it right.**\n'
    + '\n'
    + 'After setup, the GM rolls initiative via the **!init** command.\n'
    + '\n'
    + '\n*The !setinit format* is **!setinit X Y** where X is the number of dice '
      + 'and Y is the modifier. For example, **!setinit 1 4** sets an initiative '
      + 'formula of 1d6+4.'
    + '\n'
    + 'The bot remembers stuff; you won\'t need to redo any setup unless something '
      + 'changes. **However:**\n'
    + ':arrow_right: Everything is linked to GM **and chat channel**.\n'
    + ':arrow_right: If you move to a different channel, you must re-enter everything.\n'
    + ':arrow_right: Multiple GM\'s can share a channel, but anyone playing in '
    + 'both groups must repeat their set-up steps (starting with !setgm).\n'
    + ':arrow_right: To play in two games *at the same time,* you\'ll need two channels.\n'
    + '\n'
    + '**Other initiative system commands**\n'
    + '!clearplayers, !addplayers, !listplayers, !setnpcinits, !addnpcinits, '
      + '!listnpcinits, !clearnpcinits\n'
    + 'The format for !setnpcinit and !addnpcinit is **X Y label** '
      + 'e.g. **!addnpcinit 1 5 thugs** (means the thugs have 1d6+5 initiative).\n'
    + '!setnpcinit and !addnpcinit are different in that !setnpcinit clears '
      + 'your NPC list and then adds the new NPC.\n'
    + '\n'
    + 'All initiative-related commands are a little slow. '
      + 'The :hourglass_flowing_sand: reaction means it\'s working on your request.\n'
    ;
  output2 = addMaintenanceStatusMessage(output2);
  msg.reply(output);
  msg.reply(output2);
}
async function handleInitCommand(msg, cmd, args, user) {
  msg.react('⏳');
  global.lastFoundFileID[msg.channel.id] = null;
  await ensureFolderTriplet(msg);
  var gmPlayersFileID = null;
  var auth = global.auth;
  var drive = google.drive({version: 'v3', auth});
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  // get author's userFolderID for this channel
  var userFolderID = await findUserFolderFromMsg(msg);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  lockDiskForChannel(msg.channel.id);
  // get file ID of gm's (msg.author's) gmPlayers file, if any
  var filename = 'gmPlayers';
  drive.files.list(
    {q: `"${userFolderID}" in parents and name="${filename}"`,
    fields: 'nextPageToken, files(id, name, parents)'},
    (err, res) => {
      if (err) console.err(err);
      if (res.data.files.length) {
        res.data.files.map((file) => {
          global.lastFoundFileID[msg.channel.id] = file.id;
        });
      }
      else { global.lastFoundFileID[msg.channel.id] = -1; }
      unlockDiskForChannel(msg.channel.id);
    }
  );
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  var gmPlayersFileID = global.lastFoundFileID[msg.channel.id];
  //--- disabled because I want it to run even with only NPCs / only players
  // if (gmPlayersFileID == -1) {
  //   msg.reply("you don't have any players in your group right now.");
  //   removeHourglass(msg);
  //   return;
  // }
  //---
  // make array of playerIDs from msg.author's gmPlayers file content, if any
  var gmPlayersString = await getFileContents(gmPlayersFileID, msg.channel.id);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  lockDiskForChannel(msg.channel.id);
  var gmPlayersArr = gmPlayersString.split(',');
  var gmNPCArr = [];
  var playerInitContent = [];
  var gmNPCFileContent = [];
  // ensure all players have setgm to user, and have setinit
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
  // prune empty entries from gmPlayersArr
  var tmpArr = [];
  gmPlayersArr.map((p)=>{
    if (p.length && p !== ' ') tmpArr[tmpArr.length] = p;
  });
  gmPlayersArr = tmpArr;
  // loop on gm's (msg.author's) list of players
  for (var x = 0; x < gmPlayersArr.length; x++) {
    var filename = 'gmWhoIsGM';
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
      lockDiskForChannel(msg.channel.id);
      drive.files.list({q: `"${playerFolderIDs[x]}" in parents and name="${filename}"`},
        (err, res) => {
          if (err) console.error(err);
          if (res.data.files.length) {
            res.data.files.map((file)=>{
              global.lastFoundFileID[msg.channel.id] = file.id;
            });
          } else {
            global.lastFoundFileID[msg.channel.id] = -1;
          }
          unlockDiskForChannel(msg.channel.id);
        }
      );
      // another index for each player's gmWhoIsGM fileID
      while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
      playerGMFileID[x] = global.lastFoundFileID[msg.channel.id];
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
      lockDiskForChannel(msg.channel.id);
      drive.files.list({q: `"${playerFolderIDs[x]}" in parents and name="${filename}"`},
        (err, res) => {
          if (err) console.error(err);
          if (res.data.files.length) {
            res.data.files.map((file)=>{
              global.lastFoundFileID[msg.channel.id] = file.id;
            });
          } else {
            global.lastFoundFileID[msg.channel.id] = -1;
          }
          unlockDiskForChannel(msg.channel.id);
        }
      );
      // another index for each player's playerInit fileID
      while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
      playerInitFileID[x] = global.lastFoundFileID[msg.channel.id];
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
  lockDiskForChannel(msg.channel.id);
  drive.files.list({q:`"${userFolderID}" in parents and name="${filename}"`},
    (err, res) => {
      if (err) {unlockDiskForChannel(msg.channel.id); return console.error(err);}
      if (res.data.files.length === 1) {
        res.data.files.map((file)=>{
          global.lastFoundFileID[msg.channel.id] = file.id;
        });
      } else {
        global.lastFoundFileID[msg.channel.id] = -1;
      }
      unlockDiskForChannel(msg.channel.id)
    }
  );
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  var gmNPCFileID = global.lastFoundFileID[msg.channel.id];
  if (gmNPCFileID == -1) {
    console.log(`No NPC file was found.`);
  } else {
    gmNPCFileContent[x] = await getFileContents(gmNPCFileID, msg.channel.id);
    while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
    gmNPCArr = gmNPCFileContent[x].split(",");
    console.log(`NPC's configured: ${gmNPCArr.length} [${gmNPCFileContent[x]}]`);
  }
  // abort if we have no players and no NPC's, or if anyone's init will fail
  if (gmNPCArr.length == 0 && (gmPlayersArr.length == 0 || initWillFail)) {
    // init will fail; notify
    if (gmPlayersArr.length == 0 && gmPlayersArr.length == 0) {
      initWillFail = true;
      output += " -- can't roll initiative: in this channel, you have neither players nor NPC's.";
    }
    else if (initWillFail) {
      output += " -- can't roll initiative: players aren't ready.\n"
      + "See !help or ask your GM how to get set up!";
    }
  } else {
    output += " the initiative order is:\n";
  }
  // if we have a valid setup, roll init
  var npcRolls = [];
  var playerRolls = [];
  var npcPasses = [];
  var playerPasses = [];
  if (!initWillFail) {
    // roll & calculate for players
    for (var x = 0; x < gmPlayersArr.length; x++) {
      var total = 0;
      var init = playerInitContent[x].split(" ");
      var [junk,rolls] = rollDice(init[0], false, -1)
      console.log(`Natural: ${rolls}`);
      for (var y = 0; y < rolls.length; y++) {
        rolls[y] = Number(rolls[y]);
        total += rolls[y];
      }
      total += Number(init[1]);
      console.log(`Total: ${total}`);
      playerRolls = rolls;
      // store initial initiative passes
      playerPasses[x] = [];
      playerPasses[x][playerPasses[x].length] = total;
      // calculate & store extra initiative passes
      if (total > 10) {
        playerPasses[x][playerPasses[x].length] = total - 7;
      }
    }
    // roll & calculate for NPCs
    for (var x = 0; x < gmNPCArr.length; x++) {
      if (gmNPCArr[x].length) {
        var total = 0;
        var init = gmNPCArr[x].split(" ");
        var [junk,rolls] = rollDice(init[0], false, -1)
        console.log(`NPC ${x} Natural: ${rolls}`);
        for (var y = 0; y < rolls.length; y++) {
          rolls[y] = Number(rolls[y]);
          total += rolls[y];
        }
        total += Number(init[1]);
        console.log(`NPC ${x} Total: ${total}`);
        npcRolls = rolls;
        // store initial initiative passes
        npcPasses[x] = [];
        npcPasses[x][npcPasses[x].length] = total;
        // calculate & store extra initiative passes
        if (total > 10) {
          npcPasses[x][npcPasses[x].length] = total - 7;
        }
      }
    }
    console.log(`Player passes: ${playerPasses}`);
    console.log(`NPC passes: ${npcPasses}`);
  }
  // create dummy array so we can address higher items
  var ordArr = [];
  for (var x = 0; x <= 30; x++) { ordArr[x] = ''; }
  // sort
  for (var x = 30; x > 0; x--) {
    for (var y = 0; y < playerPasses.length; y++) {
      if (playerPasses[y].indexOf(x) !== -1) {
        if (ordArr[x]) ordArr[x] += ", ";
        ordArr[x] += `<@${gmPlayersArr[y]}>`;
      }
    }
    for (var y = 0; y < npcPasses.length; y++) {
      if (npcPasses[y].indexOf(x) !== -1) {
        if (ordArr[x]) ordArr[x] += ", ";
        ordArr[x] += gmNPCArr[y].split(" ")[2];
      }
    }
  }
  console.log("OrdArr: " + ordArr);
  for (var x = 30; x > 0; x--) {
    if (ordArr[x].length) {
      output += `${x}: ${ordArr[x]}\n`;
    }
  }
  // report
  msg.reply(output);
  unlockDiskForChannel(msg.channel.id);
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
  listAllFiles();
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
  listAllFiles();
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
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  lockDiskForChannel(msg.channel.id);
  // first we need to ensure the file
  drive.files.list(
    {q: `"${userFolderID}" in parents and name="${filename}"`,
    fields: 'nextPageToken, files(id, name, parents)'},
    (err, res) => {
      if (err) console.err(err);
      // in the event of no match
      if (res.data.files.length == 0) {
        // user must use setPlayer first
        setContentsByFilenameAndParent(msg, filename, userFolderID, '');
        global.lastFoundFileID[msg.channel.id] = -1;
        unlockDiskForChannel(msg.channel.id);
      } else {
        // verify filename match and abort if not
        var found = false;
        res.data.files.map((file)=>{if(file.name==filename){found=true;}});
        if (found==false) {
          global.lastFoundFileID[msg.channel.id] = -1;
        }
        unlockDiskForChannel(msg.channel.id);
      }
      // now the file surely exists -- redo the find, get the file id
      lockDiskForChannel(msg.channel.id);
      drive.files.list({q: `"${userFolderID}" in parents and name="${filename}"`,
        fields: 'nextPageToken, files(id, name, parents)'},
        (err, res) => {
          if (err) return console.error(err);
          // we must check for filename match
          if (res.data && res.data.files.length) {
            res.data.files.map((file)=>{
              global.lastFoundFileID[msg.channel.id] = file.id;
            });
          }
          unlockDiskForChannel(msg.channel.id);
      });
  });
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  gmPlayersFileID = global.lastFoundFileID[msg.channel.id];
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
    } else { handleSetPlayersCommand(msg, cmd, args, user); }
  } catch (e) {
    return;
  }
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
      if (err) return console.error(err);
      // the file doesn't exist for this channel/user pairing
      if (res.data.files.length == 0) {
        // no group; report so, and prep to abort
        msg.reply(' you currently have no group in this channel.')
        global.lastFoundFileID[msg.channel.id] = -1;
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
  listAllFiles();
}
async function handleRemovePlayersCommand(msg, cmd, args, user) {
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
  listAllFiles();
}
async function handleSetInitCommand(msg, cmd, args, user) {
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
  var tmpArr = content.split(" ");
  var output = `${tmpArr[0]}d6 +${tmpArr[1]}`;
  // remove reaction
  removeHourglass(msg);
  msg.reply(` your initiative formula (in this channel) is now ${output}.`);
  listAllFiles();
}
async function handleSetNPCInitCommand(msg, cmd, args, user) {
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
  + `and you added ${contentArray.length} NPC's`);
  listAllFiles();
}
async function handleAddNPCInitCommand(msg, cmd, args, user) {
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
        global.lastFoundFileID[msg.channel.id] = -1;
      }
      unlockDiskForChannel(msg.channel.id);
  });
  // get the file's id
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  if (global.lastFoundFileID[msg.channel.id] == -1)
    await setContentsByFilenameAndParent(msg, filename, userFolderID, '');
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }

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
      unlockDiskForChannel(msg.channel.id);
    }
  );
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  gmNPCFileID = global.lastFoundFileID[msg.channel.id];
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
}
async function handleRemoveNPCInitCommand(msg, cmd, args, user) {
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
}
async function handleListNPCInitCommand(msg, cmd, args, user) {
  msg.react('⏳');
  await ensureFolderTriplet(msg);
  var auth = global.auth;
  var drive = google.drive({version: 'v3', auth});
  var filename = 'gmNPCInit';
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  var parentFolderID = await findUserFolderFromMsg(msg);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  lockDiskForChannel(msg.channel.id);
  drive.files.list({q:`"${parentFolderID}" in parents and name="${filename}"`,
    fields: 'nextPageToken, files(id, name, parents)'},
    (err, res) => {
      // if(err){unlockDiskForChannel(msg.channel.id); return console.error(err);}
      if (res.data.files.length == 0) {
        global.lastFoundFileID[msg.channel.id] = -1;
      } else {
        res.data.files.map((file) => {
          global.lastFoundFileID[msg.channel.id] = file.id;
        });
      }
      unlockDiskForChannel(msg.channel.id);
    }
  );
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
  if (global.lastFoundFileID[msg.channel.id] == -1) {
    // file doesn't exist
    var output = " you have no NPC's configured in this channel yet.";
  } else {
    // file exists
    while (isDiskLockedForChannel(msg.channel.id)) { await sleep(15); }
    var contentString = await getFileContents(global.lastFoundFileID[msg.channel.id]);
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
        output = `${output}\n:arrow_right: ${contentArray[x]}`
      }
    } else {
      // file exists but was blank
      var output = " you have no NPC's in this channel yet.";
    }
  }
  removeHourglass(msg);
  msg.reply(output);
  listAllFiles();
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
  listAllFiles();
}
// @ =========== HANDLEMESSAGE FUNCTION ============
function handleMessage(msg, user=msg.author) {
  // stop confusing people during development!!
  //if (user.id !== '360086569778020352') return;
  // check if message starts with `!`
  var message = msg.content;
  if (message.substring(0, 1) == '!') {
      var args = message.substring(1).split(' ');
      var cmd = args[0];
      args = args.splice(1);
      cmd = cmd.toLowerCase();
      switch(cmd) {
          case 'help':
            handleHelpCommand(msg, cmd, args, user);
          break;
          case 'list':
            if (user.id == '360086569778020352') listAllFiles();
          break;
          case 'delall':
            if (user.id == '360086569778020352') deleteAllFiles();
          break;
          case 'open':
            if (user.id == '360086569778020352') openFile(args);
          break;
          case 'init':
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
