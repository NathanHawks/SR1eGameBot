/*
 * Shadowrun 1e GameBot by Discord user AstroMacGuffin#1486 (Nathan Hawks)
 * https://github.com/NathanHawks/SR1eGameBot
 * Yes I do regret baking 1e into the name
 * version 0.3, yeah that sounds good
 * Released under the terms of the UnLicense. This work is in the public domain.
 * Released as-is with no warranty or claim of usability for any purpose.
 */
const { resetCache, fetchAndStoreAllLabels } = require('./api');
const { logSpam, logWrite, logError } = require('./log');
const {initAll} = require('./init');
// set true to activate warning messages
global.isMaintenanceModeBool = true;
// set status message to send as warning when isMaintenanceModeBool is true
global.maintenanceStatusMessage = '\n**Bzzt. Hoi!** '
//+ 'See `!help` for **new features!** See `!help troubleshoot` if you suspect a bug.'
+ `Encryption is go! \`!skipstatus\` to hide this message! See \`!help troubleshoot\` if you suspect a bug!`
;
// internal setup
// for reminders
global.reminders = [];
global.lastRemindersTime = '';
// for listAllFiles
global.filesFound = [];
// system folder(s)
global.folderID = {UserData: null, reminders: null};
// config (debugging flags, etc)
global.config = {
  // debugging options
  logspam:                            true,
};
resetCache();
// ============= main script =======================================
initAll();
// @ ============== DISCORD SETUP SCRIPT ==============
const Discord = require('discord.js');

// load auth token
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
  ],
  partials: [ Discord.Partials.Channel ]
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

global.bot.on('ready', async () => {
  logWrite('Connected to Discord as ['+ bot.user.tag + ']');
  global.bot.user.setActivity(`!help`, { type: 2 });
  await fetchAndStoreAllLabels();
});

global.bot.on('error', (error) => {
  error; // for linter
  logSpam('Network error.')
});

global.bot.on('disconnect', (message) => {
  message; // for linter
  logSpam('Disconnected.');
});

global.bot.on('reconnecting', (message) => {
  message; //for linter
  // this goes off every 30-45 seconds, kill it
  // logSpam('Reconnecting...');
});

global.bot.on('resume', (message) => {
  message; // for linter
  // same issue as reconnecting event
  // logSpam('Reconnected.');
});
