/*
 * Shadowrun 1e GameBot by Discord user AstroMacGuffin#1486 (Nathan Hawks)
 * https://github.com/NathanHawks/SR1eGameBot
 * Yes I do regret baking 1e into the name
 * version 0.3, yeah that sounds good
 * Released under the terms of the UnLicense. This work is in the public domain.
 * Released as-is with no warranty or claim of usability for any purpose.
 */
// checks the current play channel and replies with a channel link
const {logError} = require('./log');
const {
  addHourglass, removeHourglass, addMaintenanceStatusMessage, ensureTriplet,
  getPlayChannel, findUserFolderDBIDFromMsg, setStringByNameAndParent,
  addToCache
} = require('./api');
async function handleCheckChannelCommand(msg) {
  if (msg.channel.guild === undefined) {
    msg.reply(`This command doesn't work via DM. You must be in a server channel.`)
    .catch((e)=>{error.log(e);});
    return;
  }
  logWrite('\x1b[32m [ ==================== handleCheckChannelCommand =============== ]\x1b[0m');
  addHourglass(msg);
  await ensureTriplet(msg);
  let gmPlayChannelID = await getPlayChannel(msg);
  msg.reply(addMaintenanceStatusMessage(`Your current play channel is set to <#${gmPlayChannelID}>.`))
  .catch((e) => { logError(e); });
  logWrite(`🎲🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${gmPlayChannelID})/${msg.author.id}`);
  removeHourglass(msg);
}
// set the play channel so that commands can be entered in a secret channel
// useful for NPC inits and scene content
async function handleSetChannelCommand(msg, args) {
  if (msg.channel.guild === undefined) {
    msg.reply(`This command doesn't work via DM. You must be in a server channel.`)
    .catch((e)=>{error.log(e);});
    return;
  }
  logWrite('\x1b[32m [ ==================== handleSetChannelCommand ================= ]\x1b[0m');
  addHourglass(msg);
  let gmPlayChannelID;
  if (args.length === 1) {
    if (args[0].substring(0,2) === '<#') {
      gmPlayChannelID = args[0].substring(2, args[0].length-1);
      await ensureTriplet(msg);
      const filename = 'gmPlayChannel';
      const gmSecretFolderID = await findUserFolderDBIDFromMsg(msg);
      await setStringByNameAndParent(
        msg, filename, gmSecretFolderID, gmPlayChannelID
      );
      addToCache({
        server: msg.channel.guild.id,
        channel: msg.channel.id,
        user: msg.author.id,
        playChannel: gmPlayChannelID
      }, 'playChannel');
      msg.reply(addMaintenanceStatusMessage(`Play channel is now set to `
        + `<#${gmPlayChannelID}>. You can now issue commands for initiative and `
        + `scenes in this channel, and they will be saved to <#${gmPlayChannelID}>.`))
        .catch((e) => { logError(e); });
    }
    else {
      msg.reply(addMaintenanceStatusMessage('Error: make sure this command is followed only by a link to a channel.'))
      .catch((e) => { logError(e); });
    }
  }
  else {
    msg.reply(addMaintenanceStatusMessage('This command requires one (and only one) argument, a channel link.'))
    .catch((e) => { logError(e); });
  }
  logWrite(`🎲🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${gmPlayChannelID})/${msg.author.id}`);
  removeHourglass(msg);
}
module.exports = {
  handleCheckChannelCommand, handleSetChannelCommand
};
