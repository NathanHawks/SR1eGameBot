/*
 * Shadowrun 1e GameBot by Discord user AstroMacGuffin#1486 (Nathan Hawks)
 * https://github.com/NathanHawks/SR1eGameBot
 * Yes I do regret baking 1e into the name
 * version 0.3, yeah that sounds good
 * Released under the terms of the UnLicense. This work is in the public domain.
 * Released as-is with no warranty or claim of usability for any purpose.
 */
const { resetCache } = require('./api');
const { openFile, listAllFiles, deleteFile, showCache, clearCache, adminUnlock,
  adminUnlockAll, deleteAllFiles } = require('./admin');
const { logSpam, logWrite, logError } = require('./log');
const {handleAmmoCommand} = require('./ft_ammo');
const {handleRollCommand} = require('./ft_dicebot');
const {handleCheckChannelCommand, handleSetChannelCommand}
  = require('./ft_gmscreen');
const {handleHelpCommand} = require('./ft_help');
const {handleInitCommand, handleSetGMCommand, handleRemovePlayersCommand,
  handleClearPlayersCommand, handleSetInitCommand, handleSetNPCInitCommand,
  handleAddNPCInitCommand, handleListNPCInitCommand, handleRemoveNPCInitCommand,
  handleClearNPCInitCommand, handleListPlayersCommand, handleAddPlayersCommand,
  handleSetPlayersCommand} = require('./ft_initiative');
const {handleSaveMacroCommand, handleRollMacroCommand, handleRemoveMacroCommand,
  handleListMacrosCommand} = require('./ft_macro');
const {handleListRemindersCommand, handleAddReminderCommand,
  handleCancelReminderCommand} = require('./ft_reminders');
const {handleSetSceneCommand, handleDelSceneCommand, handleGetSceneCommand,
  handleListScenesCommand} = require('./ft_scene');
const {initAll} = require('./init');
// set true to activate warning messages
global.isMaintenanceModeBool = true;
// set status message to send as warning when isMaintenanceModeBool is true
global.maintenanceStatusMessage = '\n**Bzzt. Hoi!** '
//+ 'See `!help` for **new features!** See `!help troubleshoot` if you suspect a bug.'
+ `Testing a new version! Everything seems to work, see \`!help troubleshoot\` if you suspect a bug!`
;
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
// function _cache_dbIDMatch(obj, file) {
//   if (obj.dbID && file.id && obj.dbID === file.id)
//     return true;
//   else return false;
// }

// ============= main script =======================================
initAll();
// @ ============== DISCORD SETUP SCRIPT ==============
const Discord = require('discord.js');

// load auth & other tokens
let token = null;
if (process.env.hasOwnProperty('TOKEN')) {
  token = process.env.TOKEN;
}
else {
  let auth = require('./discordauth.json');
  token = auth.token;
}

// Connect to Discord
global.bot = new Discord.Client({
  intents: [
    Discord.GatewayIntentBits.Guilds,
    Discord.GatewayIntentBits.GuildMessages,
    Discord.GatewayIntentBits.GuildMessageReactions,
    Discord.GatewayIntentBits.DirectMessages,
    Discord.GatewayIntentBits.MessageContent
  ]
});
try {
  global.bot.login(token);
}
catch (e) {
  console.error(e);
  logWrite('Trying to connect again in 15 seconds...');
  sleep(15000);
  try {
    global.bot.login(token);
  }
  catch (e) {
    logWrite('Couldn\'t connect.');
  }
}

global.bot.on('ready', () => {
  logWrite('Connected to Discord as ['+ bot.user.tag + ']');
  global.bot.user.setPresence({
    activities: [{
      type: `LISTENING`,
      name: `!help`
    }]
  });
});

// Setup reaction handler (when 🎲 UI for triggering re-roll is clicked)
global.bot.on('messageReactionAdd', (reaction, user) => {
  if ((reaction.emoji.name == '🎲' || reaction.emoji.name == 'game_die' ||
        reaction.emoji.name == ':game_die:') && user.username !== 'GameBot') {
    handleMessage(reaction.message, user);
  }
});

global.bot.on('error', (error) => {
  logSpam('Network error.')
});

global.bot.on('disconnect', (message) => {
  logSpam('Disconnected.');
});

global.bot.on('reconnecting', (message) => {
  // this goes off every 30-45 seconds, kill it
  // logSpam('Reconnecting...');
});

global.bot.on('resume', (message) => {
  // same issue as reconnecting event
  // logSpam('Reconnected.');
});

// @ =========== HANDLEMESSAGE FUNCTION ============
function handleMessage(msg, user=msg.author) {
  // stop confusing people during development!!
  // if (user.id !== '360086569778020352') return;
  // check if message starts with `!`
  let message = msg.content;
  if (message.substring(0, 1) === '!') {
      let args = message.substring(1).split(' ');
      let cmd = args[0];
      args = args.splice(1);
      cmd = cmd.toLowerCase();
      switch(cmd) {
          case 'help':
          case 'inithelp':
            handleHelpCommand(msg, cmd, args);
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
            handleInitCommand(msg, cmd, user);
          break;
          case 'setgm':
            handleSetGMCommand(msg, args, user);
          break;
          case 'setp':
          case 'setplayers':
          case 'setplayer':
            handleSetPlayersCommand(msg, args);
          break;
          case 'addp':
          case 'addplayers':
          case 'addplayer':
            handleAddPlayersCommand(msg, args);
          break;
          case 'lp':
          case 'listplayers':
            handleListPlayersCommand(msg);
          break;
          case 'rmp':
          case 'removeplayer':
          case 'removeplayers':
            handleRemovePlayersCommand(msg, args);
          break;
          case 'clrp':
          case 'clearplayers':
            handleClearPlayersCommand(msg);
          break;
          case 'si':
          case 'seti':
          case 'setinit':
            handleSetInitCommand(msg, args);
          break;
          case 'setn':
          case 'setnpc':
          case 'setnpcs':
          case 'setnpcinits':
          case 'setnpcinit':
            handleSetNPCInitCommand(msg, args);
          break;
          case 'addn':
          case 'addnpc':
          case 'addnpcs':
          case 'addnpcinits':
          case 'addnpcinit':
            handleAddNPCInitCommand(msg, args);
          break;
          case 'ln':
          case 'listnpcs':
          case 'listnpcinits':
          case 'listnpcinit':
            handleListNPCInitCommand(msg);
          break;
          case 'rmn':
          case 'rmnpc':
          case 'rmnpcs':
          case 'removenpc':
          case 'removenpcs':
          case 'removenpcinit':
          case 'removenpcinits':
            handleRemoveNPCInitCommand(msg, args);
          break;
          case 'clrn':
          case 'clearnpcinits':
          case 'clearnpcinit':
            handleClearNPCInitCommand(msg);
          break;
          case 'save':
            handleSaveMacroCommand(msg, args);
          break;
          case 'roll':
            handleRollMacroCommand(msg, cmd, args, user);
          break;
          case 'removemacro':
          case 'rmm':
            handleRemoveMacroCommand(msg, args);
          break;
          case 'lm':
          case 'listmacros':
            handleListMacrosCommand(msg);
          break;
          case 'checkchannel':
            handleCheckChannelCommand(msg);
          break;
          case 'setchannel':
            handleSetChannelCommand(msg, args);
          break;
          case 'setscene':
            handleSetSceneCommand(msg, args);
          break;
          case 'delscene':
            handleDelSceneCommand(msg, args);
          break;
          case 'getscene':
            handleGetSceneCommand(msg, args);
          break;
          case 'listscenes':
            handleListScenesCommand(msg);
          break;
          case 'listreminders':
            handleListRemindersCommand(msg);
          break;
          case 'addreminder':
            handleAddReminderCommand(msg, args);
          break;
          case 'cancelreminder':
            handleCancelReminderCommand(msg, args);
          break;
          case 'ammo':
            handleAmmoCommand(msg, args);
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
  global.bot.on('messageCreate', (msg) => {    handleMessage(msg);   });
}
catch (e) {
  logError(e);
}
