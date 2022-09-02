/*
* Shadowrun 1e GameBot by Discord user AstroMacGuffin#1486 (Nathan Hawks)
* https://github.com/NathanHawks/SR1eGameBot
* Yes I do regret baking 1e into the name
* version 0.3, yeah that sounds good
* Released under the terms of the UnLicense. This work is in the public domain.
* Released as-is with no warranty or claim of usability for any purpose.
*/
const {logWrite, logError, logSpam} = require('./log');
const {
  handleRollCommand, addMaintenanceStatusMessage, addHourglass, ensureTriplet,
  findUserFolderDBIDFromMsg, findStringIDByName, getStringContent,
  setStringByNameAndParent
} = require('./ft_dicebot');
async function handleSaveMacroCommand(msg, args) {
  if (msg.channel.guild === undefined) {
    msg.reply(`This command doesn't work via DM. You must be in a server channel.`)
    .catch((e)=>{error.log(e);});
    return;
  }
  if (args.length < 2)
    return msg.reply(addMaintenanceStatusMessage(
      ':no_entry_sign: Not enough options. Needs a name followed by any valid dice roll command.'
    )).catch((e) => { logError(e); });
  logWrite('\x1b[32m [ ==================== handleSaveMacroCommand ================== ]\x1b[0m');
  addHourglass(msg);
  await ensureTriplet(msg);
  const filename = 'savedRolls';
  let parentFolderID = -1;
  let savedRollsFileID = -1;
  let savedRollsStr = '';
  let savedRollsArr = [];
  const savedRollsNames = [];
  const inputName = args[0];
  let inputRoll = args;
  inputRoll.splice(0, 1);
  inputRoll = inputRoll.join(" ");
  const formattedEntry = `${inputName} ${inputRoll}`;
  parentFolderID = await findUserFolderDBIDFromMsg(msg);
  savedRollsFileID = await findStringIDByName(filename, parentFolderID);
  if (savedRollsFileID !== -1) {
    // get existing file content
    savedRollsStr = await getStringContent(savedRollsFileID);
    if (savedRollsStr) {
      savedRollsArr = savedRollsStr.split("\n");
      // get an index of name per line
      savedRollsArr.forEach((macro)=>{
        let tmpArr = macro.split(" ");
        savedRollsNames[savedRollsNames.length] = tmpArr[0];
      });
      let i = savedRollsNames.indexOf(inputName);
      if (i !== -1) {
        // if name already exists, update that entry
        savedRollsArr[i] = formattedEntry;
      } else {
        // if name is new, append to existing rolls
        savedRollsArr[savedRollsArr.length] = formattedEntry;
      }
    } else {
      // if empty file, put entry
      savedRollsArr = [formattedEntry];
    }
    savedRollsStr = savedRollsArr.join("\n");
    await setStringByNameAndParent(filename, parentFolderID, savedRollsStr);
  }
  else {
    // savedRolls file didn't exist; initialize it with this roll macro
    savedRollsArr = [formattedEntry];
    savedRollsStr = savedRollsArr.join("\n");
    await setStringByNameAndParent(filename, parentFolderID, savedRollsStr);
  }
  removeHourglass(msg);
  msg.reply(addMaintenanceStatusMessage(
    `You now have ${savedRollsArr.length} roll macros saved.`
  )).catch((e) => { logError(e); });
  logWrite(`🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}/${msg.author.id}`);
}
async function handleRollMacroCommand(msg, cmd, args, user) {
  if (msg.channel.guild === undefined) {
    msg.reply(`This command doesn't work via DM. You must be in a server channel.`)
    .catch((e)=>{error.log(e);});
    return;
  }
  // coexist with Dice Maiden;
  // hat tip https://stackoverflow.com/questions/43564985/regex-for-dice-rolling-system-and-capturing-using-javascript
  let argsString = args.join(' ');
  let argsStringMatches = argsString.match(/(\d*)(D\d*)((?:[+*-](?:\d+|\([A-Z]*\)))*)(?:\+(D\d*))?/i);
  if (!argsStringMatches && argsStringMatches.length > 0) {
    logSpam(`Coexisting with Dice Maiden (by ignoring !roll ${argsString})`);
    return;
  }
  if (args.length < 1)
    return msg.reply(addMaintenanceStatusMessage(
      ':no_entry_sign: You didn\'t specify which macro I should roll.'
    )).catch((e) => { logError(e); });
  logWrite('\x1b[32m [ ==================== handleRollMacroCommand ================== ]\x1b[0m');
  addHourglass(msg);
  await ensureTriplet(msg);
  const filename = 'savedRolls';
  const parentFolderID = await findUserFolderDBIDFromMsg(msg);
  const savedRollsFileID = await findStringIDByName(filename, parentFolderID);
  let savedRollsStr = '';
  let savedRollsArr = [];
  const savedRollsNames = [];
  const inputName = args[0];
  if (savedRollsFileID !== -1) {
    // get existing file content
    savedRollsStr = await getStringContent(savedRollsFileID);
    if (savedRollsStr) {
      savedRollsArr = savedRollsStr.split("\n");
      // get an index of name per line
      savedRollsArr.forEach((macro)=>{
        let tmpArr = macro.split(" ");
        savedRollsNames[savedRollsNames.length] = tmpArr[0];
      });
      const i = savedRollsNames.indexOf(inputName);
      if (i !== -1) {
        // found it; roll it
        let roll = savedRollsArr[i];
        args = roll.split(" ");
        cmd = args[1];
        // be nice if they add the preceding bang, i do it constantly
        if (cmd.substring(0,1) !== '!') cmd = `!${cmd}`;
        args.splice(0, 2);
        //console.log(`cmd: ${cmd} & args: ${args}`);
        let newContent = `${cmd} ${args.join(" ")}`;
        logSpam(newContent);
        handleRollCommand(msg, cmd, args, user, newContent);
        removeHourglass(msg);
      }
    }
  }
  else {
    // savedRolls file didn't exist
    msg.reply(addMaintenanceStatusMessage(" you don't have any saved macros in this channel yet."))
    .catch((e) => { logError(e); });
  }
  logWrite(`🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}/${msg.author.id}`);
  removeHourglass(msg);
}
async function handleRemoveMacroCommand(msg, args) {
  if (msg.channel.guild === undefined) {
    msg.reply(`This command doesn't work via DM. You must be in a server channel.`)
    .catch((e)=>{error.log(e);});
    return;
  }
  if (args.length < 1)
    return msg.reply(addMaintenanceStatusMessage(
      ':no_entry_sign: You didn\'t specify which macro I should remove.'
    )).catch((e) => { logError(e); });
  logWrite('\x1b[32m [ ==================== handleRemoveMacroCommand ================ ]\x1b[0m');
  addHourglass(msg);
  await ensureTriplet(msg);
  const filename = 'savedRolls';
  const parentFolderID = await findUserFolderDBIDFromMsg(msg);
  const savedRollsFileID = await findStringIDByName(filename, parentFolderID);
  let savedRollsStr = '';
  let savedRollsArr = [];
  const savedRollsNames = [];
  const inputName = args[0];
  if (savedRollsFileID !== -1) {
    // get existing file content
    savedRollsStr = await getStringContent(savedRollsFileID);
    if (savedRollsStr) {
      savedRollsArr = savedRollsStr.split("\n");
      // get an index of name per line
      savedRollsArr.forEach((macro)=>{
        savedRollsNames[savedRollsNames.length] = macro.split(" ");
      });
      const i = savedRollsNames.indexOf(inputName);
      if (i !== -1) {
        // found it; remove it
        savedRollsArr.splice(i, 1);
        savedRollsStr = savedRollsArr.join("\n");
        await setStringByNameAndParent(filename, parentFolderID, savedRollsStr);

        msg.reply(addMaintenanceStatusMessage(`Removed the macro; `
          + `you now have ${savedRollsArr.length} macros saved in this channel.`))
          .catch((e) => { logError(e); });
        removeHourglass(msg);
      } else
        msg.reply(addMaintenanceStatusMessage(
          'That name didn\'t match any of your saved macros in this channel.'
        )).catch((e) => { logError(e); });
    }
    else {
      // file exists but is empty
      msg.reply(addMaintenanceStatusMessage(
        "You don't have any saved macros in this channel yet."
      )).catch((e) => { logError(e); });
    }
  }
  else {
    // savedRolls file didn't exist
    msg.reply(addMaintenanceStatusMessage(
      "You don't have any saved macros in this channel yet."
    )).catch((e) => { logError(e); });
  }
  logWrite(`🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}/${msg.author.id}`);
  removeHourglass(msg);
}
async function handleListMacrosCommand(msg) {
  if (msg.channel.guild === undefined) {
    msg.reply(`This command doesn't work via DM. You must be in a server channel.`)
    .catch((e)=>{error.log(e);});
    return;
  }
  logWrite('\x1b[32m [ ==================== handleListMacrosCommand ================= ]\x1b[0m');
  addHourglass(msg);
  await ensureTriplet(msg);
  const filename = 'savedRolls';
  const parentFolderID = await findUserFolderDBIDFromMsg(msg);
  const savedRollsFileID = await findStringIDByName(filename, parentFolderID);
  let savedRollsStr = '';
  let savedRollsArr = [];
  let output = '';
  logSpam('Found file ID: ' + savedRollsFileID);
  if (savedRollsFileID !== -1) {
    // get existing file content
    savedRollsStr = await getStringContent(savedRollsFileID);

    if (savedRollsStr) {
      savedRollsArr = savedRollsStr.split("\n");
      // get an index of name per line
      savedRollsArr.forEach((macro)=>{
        let tmpArr = macro.split(" ");
        let name = tmpArr[0];
        tmpArr.splice(0, 1);
        let tmpStr = tmpArr.join(" ");
        output += `***${name}*** :arrow_right: ${tmpStr}\n`;
      });
      msg.reply(addMaintenanceStatusMessage(
        `You have the following macros in this channel:\n${output}`
      )).catch((e) => { logError(e); });
    }
    else {
      // file exists but is empty
      msg.reply(addMaintenanceStatusMessage(
        "You don't have any saved macros in this channel yet."
      )).catch((e) => { logError(e); });
    }
  }
  else {
    // savedRolls file didn't exist
    msg.reply(addMaintenanceStatusMessage(
      "You don't have any saved macros in this channel yet."
    )).catch((e) => { logError(e); });
  }
  logWrite(`🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}/${msg.author.id}`);
  removeHourglass(msg);
}
module.exports = {
  handleSaveMacroCommand, handleRollMacroCommand, handleRemoveMacroCommand,
  handleListMacrosCommand
};
