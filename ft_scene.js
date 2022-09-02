/*
 * Shadowrun 1e GameBot by Discord user AstroMacGuffin#1486 (Nathan Hawks)
 * https://github.com/NathanHawks/SR1eGameBot
 * Yes I do regret baking 1e into the name
 * version 0.3, yeah that sounds good
 * Released under the terms of the UnLicense. This work is in the public domain.
 * Released as-is with no warranty or claim of usability for any purpose.
 */
async function handleSetSceneCommand(msg, cmd, args, user) {
  if (msg.channel.guild === undefined) {
    msg.reply(`This command doesn't work via DM. You must be in a server channel.`)
    .catch((e)=>{error.log(e);});
    return;
  }
  logWrite('\x1b[32m [ ==================== handleSetSceneCommand =================== ]\x1b[0m');
  addHourglass(msg);

  await ensureTriplet(msg);

  let gmPlayChannelID = await getPlayChannel(msg);

  let sceneList = await getSceneList(msg);

  let userFolderID = await findUserFolderDBIDFromMsg(msg, true);

  let newScene = {};
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
  let filename = `gmScene_${newScene.name}`;
  let content = `${newScene.name}\n|||\n${newScene.music}\n|||\n${newScene.text}`;
  await setStringByNameAndParent(msg, filename, userFolderID, content);

  newScene.dbID = await findStringIDByName(filename, userFolderID, gmPlayChannelID);

  let countOfScenes = await updateSceneList(msg, newScene);
  msg.reply(addMaintenanceStatusMessage(` you now have ${countOfScenes} scenes in channel <#${gmPlayChannelID}>.`))
  .catch((e) => { logError(e); });
  logWrite(`🎲🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${gmPlayChannelID})/${msg.author.id}`);
  removeHourglass(msg);
}
async function handleDelSceneCommand(msg, cmd, args, user) {
  if (msg.channel.guild === undefined) {
    msg.reply(`This command doesn't work via DM. You must be in a server channel.`)
    .catch((e)=>{error.log(e);});
    return;
  }
  logWrite('\x1b[32m [ ==================== handleDelSceneCommand =================== ]\x1b[0m');
  addHourglass(msg);

  await ensureTriplet(msg);

  let gmPlayChannelID = await getPlayChannel(msg);

  let userFolderID = await findUserFolderDBIDFromMsg(msg, true);

  if (args.length > 0) {
    let waitForAsync = true;
    args.map(async (arg) => {
      let filename = `gmScene_${arg}`;
      let gID = await findStringIDByName(filename, userFolderID, gmPlayChannelID);

      if (gID != -1) {
        await deleteStringByID(gID, (err, res) => {}, gmPlayChannelID);

        delFromCache(gID, 'file');
        await deleteSceneFromList(msg, arg);

        let file = {content: '', id: gID};
        addToCache(file, 'fileContent');
      }
      else {
        msg.reply(addMaintenanceStatusMessage(`The scene named ${arg} wasn't found.`)).catch((e) => { logError(e); });
      }
      waitForAsync = false;
    });
    while (waitForAsync) { await sleep(15); }
    let sceneList = await getSceneList(msg);

    logSpam(`handleDelSceneCommand got sceneList ${sceneList}`);
    let count = sceneList.length;
    msg.reply(addMaintenanceStatusMessage(` you now have ${count} scenes in channel <#${gmPlayChannelID}>.`))
    .catch((e) => { logError(e); });
  }
  else {
    msg.reply(addMaintenanceStatusMessage(' this command requires one or more names of scenes.'))
    .catch((e) => { logError(e); });
  }
  logWrite(`🎲🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${gmPlayChannelID})/${msg.author.id}`);
  removeHourglass(msg);
}
async function handleGetSceneCommand(msg, cmd, args, user) {
  if (msg.channel.guild === undefined) {
    msg.reply(`This command doesn't work via DM. You must be in a server channel.`)
    .catch((e)=>{error.log(e);});
    return;
  }
  logWrite('\x1b[32m [ ==================== handleGetSceneCommand =================== ]\x1b[0m');
  addHourglass(msg);
  let gmPlayChannelID = await getPlayChannel(msg);

  if (args.length === 1) {
    let userFolderID = await findUserFolderDBIDFromMsg(msg, true);

    let filename = `gmScene_${args[0]}`;
    let gID = await findStringIDByName(filename, userFolderID, gmPlayChannelID);

    let content = await getStringContent(gID);

    let contentArray = content.split("\n|||\n");
    let scene = {};
    scene.name = contentArray[0];
    scene.music = contentArray[1];
    scene.text = contentArray[2];
    let playChannel = await bot.channels.get(gmPlayChannelID);
    let musicText = '';
    if (scene.music && scene.music.length > 0) {
      musicText = `\n\nSoundtrack:\n${scene.music}`;
    }
    playChannel.send(`${scene.text}${musicText}`);
    msg.reply(addMaintenanceStatusMessage(` scene "${scene.name}" was just deployed in channel <#${gmPlayChannelID}>.`))
    .catch((e) => { logError(e); });
  }
  else {
    msg.reply(addMaintenanceStatusMessage(' error: this command requires a single argument, '
      + 'the name of the scene. Try !listscenes for a list of your scenes in ')
      + `channel ${gmPlayChannelID}.`).catch((e) => { logError(e); });
  }
  logWrite(`🎲🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${gmPlayChannelID})/${msg.author.id}`);
  removeHourglass(msg);
}
async function handleListScenesCommand(msg, cmd, args, user) {
  if (msg.channel.guild === undefined) {
    msg.reply(`This command doesn't work via DM. You must be in a server channel.`)
    .catch((e)=>{error.log(e);});
    return;
  }
  logWrite('\x1b[32m [ ==================== handleListScenesCommand ================= ]\x1b[0m');
  addHourglass(msg);

  await ensureTriplet(msg);

  let gmPlayChannelID = await getPlayChannel(msg);
  logSpam(`Parent folder: ${gmPlayChannelID}`);

  let sceneList = await getSceneList(msg);

  let output = '';
  if (sceneList.length > 0) {
    sceneList.map((scene) => {
      output += `${scene.name}\n`;
    });
    msg.reply(addMaintenanceStatusMessage(" your scene names in channel <#" + gmPlayChannelID +
      "> are: ```\n" + output + "\n```")).catch((e) => { logError(e); });
  }
  else {
    msg.reply(addMaintenanceStatusMessage(` you have no scenes yet in channel <#${gmPlayChannelID}>.`))
    .catch((e) => { logError(e); });
  }
  logWrite(`🎲🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${gmPlayChannelID})/${msg.author.id}`);
  removeHourglass(msg);
}
module.exports = {
  handleSetSceneCommand, handleDelSceneCommand, handleGetSceneCommand,
  handleListScenesCommand
};
