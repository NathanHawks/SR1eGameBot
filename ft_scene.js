/*
 * Shadowrun 1e GameBot by Discord user AstroMacGuffin#1486 (Nathan Hawks)
 * https://github.com/NathanHawks/SR1eGameBot
 * Yes I do regret baking 1e into the name
 * version 0.3, yeah that sounds good
 * Released under the terms of the UnLicense. This work is in the public domain.
 * Released as-is with no warranty or claim of usability for any purpose.
 */
const { logError, logSpam, logWrite } = require('./log');
const {
  getPlayChannel, getSceneList, findUserFolderDBIDFromMsg, sleep,
  setStringByNameAndParent, findStringIDByName, updateSceneList,
  addMaintenanceStatusMessage, addHourglass, removeHourglass, ensureTriplet,
  getStringContent, deleteStringByID, delFromCache, deleteSceneFromList
} = require('./api');
async function handleSetSceneCommand(msg, args) {
  if (!msg.channel.guild) {
    msg.reply(`This command doesn't work via DM. You must be in a server channel.`)
    .catch((e)=>{error.log(e);});
    return;
  }
  logWrite('\x1b[32m [ ==================== handleSetSceneCommand =================== ]\x1b[0m');
  addHourglass(msg);
  await ensureTriplet(msg);
  let gmPlayChannelID = await getPlayChannel(msg);
  const userFolderID = await findUserFolderDBIDFromMsg(msg, true);
  if (userFolderID === -1) return -1;
  const newScene = {};
  newScene.name = args[0];
  if (args[1].substring(0,4).toLowerCase() === 'http') {
    newScene.music = args[1];
    args.splice(0, 2);
    newScene.text = args.join(' ');
  }
  else {
    newScene.music = '';
    args.splice(0, 1);
    newScene.text = args.join(' ');
  }
  const filename = `gmScene_${newScene.name}`;
  const content = `${newScene.name}\n|||\n${newScene.music}\n|||\n${newScene.text}`;
  await setStringByNameAndParent(filename, userFolderID, content);
  newScene.dbID = await findStringIDByName(filename, userFolderID);
  let countOfScenes = await updateSceneList(msg, newScene);
  msg.reply(await addMaintenanceStatusMessage(msg, 
    `You now have ${countOfScenes} scenes in channel <#${gmPlayChannelID}>.`
  )).catch((e) => { logError(e); });
  logWrite(`🎲🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${gmPlayChannelID})/${msg.author.id}`);
  removeHourglass(msg);
}
async function handleDelSceneCommand(msg, args) {
  if (!msg.channel.guild) {
    msg.reply(`This command doesn't work via DM. You must be in a server channel.`)
    .catch((e)=>{error.log(e);});
    return;
  }
  logWrite('\x1b[32m [ ==================== handleDelSceneCommand =================== ]\x1b[0m');
  addHourglass(msg);
  await ensureTriplet(msg);
  const gmPlayChannelID = await getPlayChannel(msg);
  const userFolderID = await findUserFolderDBIDFromMsg(msg, true);
  if (userFolderID === -1) return -1;
  if (args.length > 0) {
    let waitForAsync = true;
    args.forEach(async (arg) => {
      const filename = `gmScene_${arg}`;
      const fileID = await findStringIDByName(filename, userFolderID);
      if (fileID !== -1) {
        await deleteStringByID(fileID);
        delFromCache(fileID, 'file');
        delFromCache(fileID, 'fileContent')
        await deleteSceneFromList(msg, arg);
      }
      else {
        msg.reply(await addMaintenanceStatusMessage(msg, 
          `The scene named ${arg} wasn't found.`
        )).catch((e) => { logError(e); });
      }
      waitForAsync = false;
    });
    while (waitForAsync) { await sleep(15); }
    let sceneList = await getSceneList(msg);
    logSpam(`handleDelSceneCommand got sceneList ${sceneList}`);
    const count = sceneList.length;
    msg.reply(await addMaintenanceStatusMessage(msg, 
      `You now have ${count} scenes in channel <#${gmPlayChannelID}>.`
    )).catch((e) => { logError(e); });
  }
  else {
    msg.reply(await addMaintenanceStatusMessage(msg, 
      'This command requires one or more names of scenes.'
    )).catch((e) => { logError(e); });
  }
  logWrite(`🎲🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${gmPlayChannelID})/${msg.author.id}`);
  removeHourglass(msg);
}
async function handleGetSceneCommand(msg, args) {
  if (!msg.channel.guild) {
    msg.reply(`This command doesn't work via DM. You must be in a server channel.`)
    .catch((e)=>{error.log(e);});
    return;
  }
  logWrite('\x1b[32m [ ==================== handleGetSceneCommand =================== ]\x1b[0m');
  addHourglass(msg);
  const gmPlayChannelID = await getPlayChannel(msg);
  if (args.length === 1) {
    const userFolderID = await findUserFolderDBIDFromMsg(msg, true);
    if (userFolderID === -1) return -1;
    const filename = `gmScene_${args[0]}`;
    const fileID = await findStringIDByName(filename, userFolderID);
    const content = await getStringContent(fileID);
    if (!content || content === '')
      return msg.reply(await addMaintenanceStatusMessage(msg, 
        `That scene wasn't found.`
      )).catch((e) => { logError(e); })
    const contentArray = content.split("\n|||\n");
    const scene = {};
    scene.name = contentArray[0];
    scene.music = contentArray[1];
    scene.text = contentArray[2];
    const playChannel = await bot.channels.cache.get(gmPlayChannelID);
    let musicText = '';
    if (scene.music && scene.music.length > 0) {
      musicText = `\n\nSoundtrack:\n${scene.music}`;
    }
    playChannel.send(`${scene.text}${musicText}`);
    msg.reply(await addMaintenanceStatusMessage(msg, 
      `Scene "${scene.name}" was just deployed in channel <#${gmPlayChannelID}>.`
    )).catch((e) => { logError(e); });
  }
  else {
    msg.reply(await addMaintenanceStatusMessage(msg, 
      'Error: this command requires a single argument, '
      + 'the name of the scene. Try !listscenes for a list of your scenes in '
      + `channel ${gmPlayChannelID}.`)).catch((e) => { logError(e); });
  }
  logWrite(`🎲🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${gmPlayChannelID})/${msg.author.id}`);
  removeHourglass(msg);
}
async function handleListScenesCommand(msg) {
  if (!msg.channel.guild) {
    msg.reply(`This command doesn't work via DM. You must be in a server channel.`)
    .catch((e)=>{error.log(e);});
    return;
  }
  logWrite('\x1b[32m [ ==================== handleListScenesCommand ================= ]\x1b[0m');
  addHourglass(msg);
  await ensureTriplet(msg);
  const gmPlayChannelID = await getPlayChannel(msg);
  logSpam(`Parent folder: ${gmPlayChannelID}`);
  const sceneList = await getSceneList(msg);
  let output = '';
  if (sceneList.length > 0) {
    sceneList.forEach((scene) => {
      output += `${scene.name}\n`;
    });
    msg.reply(await addMaintenanceStatusMessage(msg, 
      "Your scene names in channel <#" + gmPlayChannelID +
      "> are: ```\n" + output + "\n```")).catch((e) => { logError(e); });
  }
  else {
    msg.reply(await addMaintenanceStatusMessage(msg, 
      `You have no scenes yet in channel <#${gmPlayChannelID}>.`
    )).catch((e) => { logError(e); });
  }
  logWrite(`🎲🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${gmPlayChannelID})/${msg.author.id}`);
  removeHourglass(msg);
}
module.exports = {
  handleSetSceneCommand, handleDelSceneCommand, handleGetSceneCommand,
  handleListScenesCommand
};
