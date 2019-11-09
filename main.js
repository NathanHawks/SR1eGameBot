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
+ ' Psshht! -Astro';
// conditionally add warning message
function addMaintenanceStatusMessage(output) {
  var r = output + " " + maintenanceStatusMessage;
  return r;
}
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
// ====== GOOGLE = google = Google =================================
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

// internal setup
// system folder(s)
global.folderID = {UserData : null};
// a way to get recently created folder IDs per channel
global.lastCreatedFolder = { };
// semaphores per channel id, to avoid race conditions
global.lock = { };
// config (debugging flags, etc)
global.config = {
  // debugging options
  skipInitInitiative:                 false,
  deleteUserDataIfFoundOnStartup:     false,
  listAllFilesOnStartup:              true,
  createASubfolderOnStartup:          false,
  deleteAllFilesOnStartup:            false,
};

// Load client secrets from a local file.
fs.readFile('googlecredentials.json', (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
  // Authorize a client with credentials, then call the Google Drive API.
  authorize(JSON.parse(content), initInitiative);
});

// =========== google's library functions ==========================
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
// dx funcs
function openFile(args) {
  var auth = global.auth;
  const drive = google.drive({version: 'v3', auth});
  drive.files.get({fileId: args[0], alt: "media"}, (err, res) => {
    if (err) return console.error(err);
    console.log(res.data.substring(0, res.data.length-2));
  });
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
        deleteGDriveFileById(file.id,(err,res)=>{if (err) console.error(err);});
      });
    } else {
      console.log('No files found.');
    }
  });
}
function dxCreateSubfolder() {
  // test ensure
  ensureGDriveFolderByName('Subfolder', global.folderID.UserData);
}
//==================================================================
// my library functions
// this function poorly tested
function ensureGDriveFolderByName(name, parentID=null, channelID="system") {
  findGDriveFolderByName(name, parentID, (err, res) => {
    if (err) return console.error(err);
    console.log(`Ensuring folder ${name} exists`);
    const files = res.data.files;
    if (files.length == 0) {
      console.log('It doesn\'t exist; creating it');
      // create folder & let callback perform another find to get id
      createGDriveFolder(name, parentID, (err, file) => {
        // after-creation action
        if (err) return console.error(err);
      }, channelID);
    }
  }, channelID);
}

// semaphore paradigm: disk locking per channel to prevent race conditions
function isDiskLockedForChannel(channelID) {
  return global.lock[channelID];
}
// optional 2nd arg allows inverting the function
function lockDiskForChannel(channelID, unlock=false) {
  if (unlock==true) return unlockDiskForChannel(channelID);
  global.lock[channelID] = true;
}
function unlockDiskForChannel(channelID, lock=false) {
  if (lock==true) return lockDiskForChannel(channelID);
  global.lock[channelID] = false;
}

async function findGDriveFolderByName(folderName, parentID=null, callback, channelID="system") {
  while (isDiskLockedForChannel(channelID)) {
    console.log('Waiting to find ' + folderName);
    await sleep(50);
  }
  lockDiskForChannel(channelID);
  var auth = global.auth;
  const drive = google.drive({version: 'v3', auth});
  var mainq = `name="${folderName}"`;
  mainq = (parentID == null) ? mainq : `"${parentID}" in parents`
  var q = {
    q: mainq,
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    fields: 'files(id, name)',
  };
  drive.files.list(q, (err, res) => {
    unlockDiskForChannel(channelID);
    callback(err, res);
  });
}

async function createGDriveFolder(folderName, parentID=null, callback, channelID="system") {
  while (isDiskLockedForChannel(channelID)) {
    console.log('Waiting to create ' + folderName);
    await sleep(50);
  }
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

async function deleteGDriveFileById(fileId, callback=(err,res)=>{}, channelID="system") {
  while (isDiskLockedForChannel(channelID)) {
    console.log('Waiting to delete ' + fileId);
    await sleep(50);
  }
  lockDiskForChannel(channelID);
  var auth = global.auth;
  const drive = google.drive({version: 'v3', auth});
  drive.files.delete({fileId:fileId}, (err, res) => {
    unlockDiskForChannel(channelID);
    callback(err, res);
  });
}

//==================================================================
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
  findGDriveFolderByName('UserData', null, (err, res) => {
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
      deleteGDriveFileById(global.folderID[folderName],(err,res)=>{if(err)console.log(err);});
    }
  } else {
    // INSTALL =====================================================
    var folderName = 'UserData';
    console.log(`Installing ${folderName} folder.`);
    createGDriveFolder(folderName, null, (err, file) => {
        if (err) return console.error(err);
        // fetch ID of new folder
        findGDriveFolderByName(folderName, null, (err, res) => {
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
    while (isDiskLockedForChannel("system")) { await sleep(50); }
    dxCreateSubfolder();
  }

}

// ====== Original GameBot code ====================================
// The dice-rolling function
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
// Libs
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

// Setup reaction handler (when UI for triggering re-roll is clicked)
bot.on('messageReactionAdd', (reaction, user) => {
  if ((reaction.emoji == '🎲' || reaction.emoji == 'game_die' ||
        reaction.emoji == ':game_die:') && user.username !== 'GameBot') {
    handleMessage(reaction.message, user);
  }
});

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
    + '  ***example:*** !5! tn3 vs6! otn4    Roll 5d6 (exploding) with TN 3, against 6d6 (exploding) with TN 4\n';
  output = addMaintenanceStatusMessage(output);
  msg.reply(output);
}
async function handleSetGMCommand(msg, cmd, args, user) {
  // serverID.userID.gmWhoIsGM STRING
  // without flag: set self as GM
  var targetID = `${args[0].substring(3, args[0].length-1)}`;
  msg.reply(`User ${user}, ID: ${user.id}\n`
    + `Channel ${msg.channel}, ID: ${msg.channel.id}\n`
    + `Server ${msg.channel.guild}, ID: ${msg.channel.guild.id}\n\n`
    + `<@${user.id}>\n`
    + `${args[0]}\n`
    + targetID
  );
  // ensure folder/subfolder chain: (root)/UserData/ServerID/ChannelID/UserID
  var serverFolderID = null;
  var channelFolderID = null;
  var userFolderID = null;
  await ensureGDriveFolderByName(msg.channel.guild.id, global.folderID.UserData, msg.channel.id);
  await findGDriveFolderByName(msg.channel.guild.id, global.folderID.UserData, (err, res) => {
    if (err) return console.error(err);
    lockDiskForChannel(msg.channel.id);
    var files = res.data.files;
    if (files.length) files.map((file)=>{ global.lastCreatedFolder[msg.channel.id] = file.id; });
    unlockDiskForChannel(msg.channel.id);
  }, msg.channel.id);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(25); }
  serverFolderID = global.lastCreatedFolder[msg.channel.id];
  await ensureGDriveFolderByName(msg.channel.id, serverFolderID, msg.channel.id);
  await findGDriveFolderByName(msg.channel.id, serverFolderID, (err, res) => {
    if (err) return console.error(err);
    lockDiskForChannel(msg.channel.id);
    var files = res.data.files;
    if (files.length) files.map((file)=>{ global.lastCreatedFolder[msg.channel.id] = file.id; });
    unlockDiskForChannel(msg.channel.id);
  }, msg.channel.id);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(25); }
  channelFolderID = global.lastCreatedFolder[msg.channel.id];
  await ensureGDriveFolderByName(user.id, channelFolderID, msg.channel.id);
  await findGDriveFolderByName(user.id, channelFolderID, (err, res) => {
    if (err) return console.error(err);
    lockDiskForChannel(msg.channel.id);
    var files = res.data.files;
    if (files.length) files.map((file)=>{ global.lastCreatedFolder[msg.channel.id] = file.id; });
    unlockDiskForChannel(msg.channel.id);
  }, msg.channel.id);
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(25); }
  userFolderID = global.lastCreatedFolder[msg.channel.id];
  var auth = global.auth;
  const drive = google.drive({version: 'v3', auth});
  lockDiskForChannel(msg.channel.id);
  drive.files.create({
    resource: {
      'name': "gm",
      'parents': [userFolderID]
    }, media: {
      'mimeType': 'text/plain',
      'body': `${targetID}/2`
    },
    fields: 'id'
  }, (err, file) => {
    if (err) return console.error(err);
    unlockDiskForChannel(msg.channel.id);
    console.log(`Wrote ${targetID}`);
  }
  );
  while (isDiskLockedForChannel(msg.channel.id)) { await sleep(25); }
  listAllFiles();
}
function handleSetPlayersCommand(msg, cmd, args, user) {
  // serverID.userID.gmPlayers ARRAY
}

function handleMessage(msg, user=msg.author) {
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
            listAllFiles();
          break;
          case 'delall':
            deleteAllFiles();
          break;
          case 'open':
            openFile(args);
          break;
          case 'setgm':
            handleSetGMCommand(msg, cmd, args, user);
          break;
          case 'setplayers':
            handleSetPlayersCommand(msg, cmd, args, user);
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
