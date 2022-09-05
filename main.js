/*
 * Shadowrun 1e GameBot by Discord user AstroMacGuffin#1486 (Nathan Hawks)
 * https://github.com/NathanHawks/SR1eGameBot
 * Yes I do regret baking 1e into the name
 * version 0.3, yeah that sounds good
 * Released under the terms of the UnLicense. This work is in the public domain.
 * Released as-is with no warranty or claim of usability for any purpose.
 */
const { resetCache } = require('./api');
const { openFile, showCache, clearCache } = require('./admin');
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
+ `See \`!help troubleshoot\` if you suspect a bug!`
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
  logError(e);
  logWrite('Trying to connect again in 15 seconds...');
  sleep(15000);
  try {
    global.bot.login(token);
  }
  catch (e) {
    logError('Couldn\'t connect to Discord.');
  }
}

global.bot.on('ready', () => {
  logWrite('Connected to Discord as ['+ bot.user.tag + ']');
  global.bot.user.setActivity(`Listening to !help`);
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
    let handlerStatus;
    switch(cmd) {
      case 'help':
      case 'inithelp':
        handleHelpCommand(msg, cmd, args);
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
      case 'init':
      case 'init2':
      case 'init3':
      case 'initflip':
      case 'init2flip':
      case 'init3flip':
      case 'initcp':
      case 'initcpr':
        handlerStatus = handleInitCommand(msg, cmd, user);
      break;
      case 'setgm':
        handlerStatus = handleSetGMCommand(msg, args, user);
      break;
      case 'setp':
      case 'setplayers':
      case 'setplayer':
        handlerStatus = handleSetPlayersCommand(msg, args);
      break;
      case 'addp':
      case 'addplayers':
      case 'addplayer':
        handlerStatus = handleAddPlayersCommand(msg, args);
      break;
      case 'lp':
      case 'listplayers':
        handlerStatus = handleListPlayersCommand(msg);
      break;
      case 'rmp':
      case 'removeplayer':
      case 'removeplayers':
        handlerStatus = handleRemovePlayersCommand(msg, args);
      break;
      case 'clrp':
      case 'clearplayers':
        handlerStatus = handleClearPlayersCommand(msg);
      break;
      case 'si':
      case 'seti':
      case 'setinit':
        handlerStatus = handleSetInitCommand(msg, args);
      break;
      case 'setn':
      case 'setnpc':
      case 'setnpcs':
      case 'setnpcinits':
      case 'setnpcinit':
        handlerStatus = handleSetNPCInitCommand(msg, args);
      break;
      case 'addn':
      case 'addnpc':
      case 'addnpcs':
      case 'addnpcinits':
      case 'addnpcinit':
        handlerStatus = handleAddNPCInitCommand(msg, args);
      break;
      case 'ln':
      case 'listnpcs':
      case 'listnpcinits':
      case 'listnpcinit':
        handlerStatus = handleListNPCInitCommand(msg);
      break;
      case 'rmn':
      case 'rmnpc':
      case 'rmnpcs':
      case 'removenpc':
      case 'removenpcs':
      case 'removenpcinit':
      case 'removenpcinits':
        handlerStatus = handleRemoveNPCInitCommand(msg, args);
      break;
      case 'clrn':
      case 'clearnpcinits':
      case 'clearnpcinit':
        handlerStatus = handleClearNPCInitCommand(msg);
      break;
      case 'save':
        handlerStatus = handleSaveMacroCommand(msg, args);
      break;
      case 'roll':
        handlerStatus = handleRollMacroCommand(msg, cmd, args, user);
      break;
      case 'removemacro':
      case 'rmm':
        handlerStatus = handleRemoveMacroCommand(msg, args);
      break;
      case 'lm':
      case 'listmacros':
        handlerStatus = handleListMacrosCommand(msg);
      break;
      case 'checkchannel':
        handlerStatus = handleCheckChannelCommand(msg);
      break;
      case 'setchannel':
        handlerStatus = handleSetChannelCommand(msg, args);
      break;
      case 'setscene':
        handlerStatus = handleSetSceneCommand(msg, args);
      break;
      case 'delscene':
        handlerStatus = handleDelSceneCommand(msg, args);
      break;
      case 'getscene':
        handlerStatus = handleGetSceneCommand(msg, args);
      break;
      case 'listscenes':
        handlerStatus = handleListScenesCommand(msg);
      break;
      case 'listreminders':
        handlerStatus = handleListRemindersCommand(msg);
      break;
      case 'addreminder':
        handlerStatus = handleAddReminderCommand(msg, args);
      break;
      case 'cancelreminder':
        handlerStatus = handleCancelReminderCommand(msg, args);
      break;
      case 'ammo':
        handlerStatus = handleAmmoCommand(msg, args);
      break;
      default:
        handlerStatus = handleRollCommand(msg, cmd, args, user);
      break;
    }
    if (handlerStatus === -1) {
      msg.reply(
        `Something went wrong. Please report it at `
        + `<https://github.com/NathanHawks/SR1eGameBot/issues>\n`
        + `Include the following in your report:\n\n`
        + `\`\`\`\ncmd:${cmd}\nargs:${args}\`\`\`\n`
      )
      .catch((e) => { logError(e); });
      logError(`Something went wrong; asking for a bug report.`)
    }
  }
}

// Hook the handler
try {
  global.bot.on('messageCreate', (msg) => {    handleMessage(msg);   });
}
catch (e) {
  logError(e);
}
