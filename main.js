/*
 * Shadowrun 1e GameBot by Discord user AstroMacGuffin#1486 (Nathan Hawks)
 * https://github.com/NathanHawks/SR1eGameBot
 * Yes I do regret baking 1e into the name
 * version 0.3, yeah that sounds good
 * Released under the terms of the UnLicense. This work is in the public domain.
 * Released as-is with no warranty or claim of usability for any purpose.
 */
const { openFile, listAllFiles, deleteFile, showCache, clearCache, adminUnlock,
adminUnlockAll, deleteAllFiles } = require('./admin');
const { logSpam, logWrite, logError } = require('./log');
const {handleAmmoCommand} = require('./ft_ammo');
const {handleRollCommand} = require('./ft_dicebot');
const {handleCheckChannelCommand, handleSetChannelCommand}
  = require('ft_gmscreen');
const {handleHelpCommand} = require('ft_help');
const {handleInitCommand} = require('ft_initiative');
const {handleSaveMacroCommand, handleRollMacroCommand, handleRemoveMacroCommand,
  handleListMacrosCommand} = require('ft_macro');
const {handleListRemindersCommand, handleAddReminderCommand,
  handleCancelReminderCommand} = require('ft_reminders');
const {handleSetSceneCommand, handleDelSceneCommand, handleGetSceneCommand,
  handleListScenesCommand} = require('ft_scene');
const {initAll} = require('./init');
// set true to activate warning messages
var isMaintenanceModeBool = true;
// set status message to send as warning when isMaintenanceModeBool is true
var maintenanceStatusMessage = '\n**Bzzt. Hoi!** '
+ ' See `!help` for **new features!** See `!help troubleshoot` if you suspect a bug.'
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
};
resetCache();
// function _cache_googleIDMatch(obj, file) {
//   if (obj.googleID && file.id && obj.googleID === file.id)
//     return true;
//   else return false;
// }

// ============= main script =======================================
initAll();
// @ ============== DISCORD SETUP SCRIPT ==============
const Discord = require('discord.js');

// load auth & other tokens
var token = null;
if (process.env.hasOwnProperty('TOKEN')) {
  token = process.env.TOKEN;
}
else {
  var auth = require('./discordauth.json');
  token = auth.token;
}

// Connect to Discord
var bot = new Discord.Client({
  intents: [
    Discord.Intents.FLAGS.GUILDS,
    Discord.Intents.FLAGS.GUILD_MESSAGES,
    Discord.Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
  ]
});
try {
  bot.login(token);
}
catch (e) {
  console.error(e);
  logWrite('Trying to connect again in 15 seconds...');
  sleep(15000);
  try {
    bot.login(token);
  }
  catch (e) {
    logWrite('Couldn\'t connect.');
  }
}

bot.on('ready', () => {
    logWrite('Connected as ['+ bot.user.tag + ']');
    bot.user.setPresence({game:{name:'!help for help'}});
});

// Setup reaction handler (when 🎲 UI for triggering re-roll is clicked)
bot.on('messageReactionAdd', (reaction, user) => {
  if ((reaction.emoji == '🎲' || reaction.emoji == 'game_die' ||
        reaction.emoji == ':game_die:') && user.username !== 'GameBot') {
    handleMessage(reaction.message, user);
  }
});

bot.on('error', (error) => {
  logSpam('Network error.')
});

bot.on('disconnect', (message) => {
  logSpam('Disconnected.');
});

bot.on('reconnecting', (message) => {
  // this goes off every 30-45 seconds, kill it
  // logSpam('Reconnecting...');
});

bot.on('resume', (message) => {
  // same issue as reconnecting event
  // logSpam('Reconnected.');
});

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
          // case 'delall':
          //   if (user.id == '360086569778020352') deleteAllFiles();
          // break;
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
          case 'initcpr':
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
          case 'ammo':
            handleAmmoCommand(msg, cmd, args, user);
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
  bot.on('messageCreate', (msg) => {    handleMessage(msg);   });
}
catch (e) {
  logError(e);
}
