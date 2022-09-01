/*
 * Shadowrun 1e GameBot by Discord user AstroMacGuffin#1486 (Nathan Hawks)
 * https://github.com/NathanHawks/SR1eGameBot
 * Yes I do regret baking 1e into the name
 * version 0.3, yeah that sounds good
 * Released under the terms of the UnLicense. This work is in the public domain.
 * Released as-is with no warranty or claim of usability for any purpose.
 */
// checks the current play channel and replies with a channel link
async function handleCheckChannelCommand(msg, cmd, args, user) {
  if (msg.channel.guild === undefined) {
    msg.reply(`This command doesn't work via DM. You must be in a server channel.`)
    .catch((e)=>{error.log(e);});
    return;
  }
  logWrite('\x1b[32m [ ==================== handleCheckChannelCommand =============== ]\x1b[0m');
  await msg.react('⏳').catch((e) => {console.log(e);});

  await ensureTriplet(msg);

  var gmPlayChannelID = await getPlayChannel(msg);

  msg.reply(addMaintenanceStatusMessage(` your current play channel is set to <#${gmPlayChannelID}>.`))
  .catch((e) => {console.log(e);});
  logWrite(`🎲🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${gmPlayChannelID})/${msg.author.id}`);
  removeHourglass(msg);
}
// set the play channel so that commands can be entered in a secret channel
// useful for NPC inits and scene content
async function handleSetChannelCommand(msg, cmd, args, user) {
  if (msg.channel.guild === undefined) {
    msg.reply(`This command doesn't work via DM. You must be in a server channel.`)
    .catch((e)=>{error.log(e);});
    return;
  }
  logWrite('\x1b[32m [ ==================== handleSetChannelCommand ================= ]\x1b[0m');
  await msg.react('⏳').catch((e) => {console.log(e);});
  if (args.length === 1) {
    if (args[0].substring(0,2) === '<#') {
      var gmPlayChannelID = args[0].substring(2, args[0].length-1);
      await ensureTriplet(msg);
      var filename = 'gmPlayChannel';

      var gmSecretFolderID = await findUserDBIDFromMsg(msg);

      await setStringByNameAndParent(msg, filename, gmSecretFolderID, gmPlayChannelID);

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
  logWrite(`🎲🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${gmPlayChannelID})/${msg.author.id}`);
  removeHourglass(msg);
}
module.exports = {
  handleCheckChannelCommand, handleSetChannelCommand
};
