/*
 * Shadowrun 1e GameBot by Discord user AstroMacGuffin#1486 (Nathan Hawks)
 * https://github.com/NathanHawks/SR1eGameBot
 * Yes I do regret baking 1e into the name
 * version 0.3, yeah that sounds good
 * Released under the terms of the UnLicense. This work is in the public domain.
 * Released as-is with no warranty or claim of usability for any purpose.
 */
const {logWrite, logSpam, logError} = require('./log');
const {
  getPlayChannel, addHourglass, findUserFolderDBIDFromMsg, getUserReminders,
  removeHourglass, findStringIDByName, getStringContent, addReminders,
  _makeReminderSaveString, setStringByNameAndParent, ensureTriplet
} = require('./api');
async function handleListRemindersCommand(msg) {
  if (msg.channel.guild === null) {
    msg.reply(`This command doesn't work via DM. You must be in a server channel.`)
    .catch((e)=>{logError(e);});
    return;
  }
  addHourglass(msg);
  logWrite('\x1b[32m [ ==================== handleListRemindersCommand ======================= ]\x1b[0m');
  await ensureTriplet(msg);
  const playChannelID = await getPlayChannel(msg);
  const userFolderID = await findUserFolderDBIDFromMsg(msg, true);
  if (userFolderID === -1) return -1;
  const reminders = await getUserReminders(userFolderID, playChannelID);
  if (reminders.length > 0) {
    let output = '\n';
    for (let x = 0; x < reminders.length; x++) {
      if (reminders[x].playersString !== undefined) {
        if (x > 0) output += '\n\n';
        output += `**ID:** ${reminders[x].smallID}\n`
        + `**Reminder Time/Date:** ${reminders[x].dateTime}\n`
        + `**Session Time/Date:** ${new Date(reminders[x].sessionTimeDateF)}\n`
        + `**Players to Remind:** `;
        let players = reminders[x].playersString.split(' ');
        for (let y = 0; y < players.length; y++) {
          if (y > 0) output += ', '
          output += `<@${players[y]}>`;
        }
      }
    }
    if (output === '\n') output = `You have no reminders set in channel <#${playChannelID}>.`;
    else {
      if (output.length < 1900) msg.reply(output).catch((err)=>{logError(err);});
      else {
        let items = output.split('\n\n');
        for (let x = 0; x < items.length; x++) {
          msg.reply(`\n${items[x]}\n\n`).catch((err)=>{logError(err);});
        }
      }
    }
  }
  else {
    msg.reply(`You have no reminders set in channel <#${playChannelID}>.`)
    .catch((err)=>{logError(err);});
  }
  removeHourglass(msg);
  logWrite(`🎲🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${playChannelID})/${msg.author.id}`);
}
async function handleAddReminderCommand(msg, args) {
  if (msg.channel.guild === null) {
    msg.reply(`This command doesn't work via DM. You must be in a server channel.`)
    .catch((e)=>{logError(e);});
    return;
  }
  addHourglass(msg);
  logWrite('\x1b[32m [ ==================== handleAddReminderCommand ======================= ]\x1b[0m');
  let sessionTimeDateF = args[0];
  let sessionTimestamp = undefined;
  args.splice(0, 1);
  let reminders = []; // list of reminder objects (below)
  // .shortID, .id, .sessionTimeDateF, .dateTime, .timeStamp, .playersString,
  // .MilliSecondsFromNow, gmID, userFolderID, playChannelID
  let timings = [...args]; // post-splice contains only list of timing strings
  let timing = ''; // a time string e.g. 15m, 1d, etc
  // parse sessionTimeDateF string
  sessionTimestamp = new Date(sessionTimeDateF);
  logSpam(`Timestamp compare: ${Date.now()} is now, ${sessionTimestamp.valueOf()} is target`);
  logSpam(`sessionTimestamp ${sessionTimestamp}`);
  if (isNaN(Date.parse(sessionTimestamp))) {
    msg.reply(`The session date & time you entered was invalid. Check it carefully and try again.`)
    .catch((err)=>{logError(err);});
    return;
  }
  // get play folder
  await ensureTriplet(msg);
  let playChannelID = await getPlayChannel(msg);
  // get player list
  let userFolderID = await findUserFolderDBIDFromMsg(msg, true);
  if (userFolderID === -1) return -1;
  let filename = 'gmPlayers';
  playersFileID = await findStringIDByName(filename, userFolderID);
  let playersString = await getStringContent(playersFileID);
  if (playersString.length === 0) {
    await msg.reply(`You have no players in channel <#${playChannelID}> yet to send reminders to.`)
    .catch((err) => {logError(err)});
    return;
  }
  // parse list of timings
  let count = 0;
  for (let x = 0; x < timings.length; x++) {
    timing = timings[x];
    const timingUnit = timing.substring(timing.length-1);
    const timingNumber = timing.substring(0, timing.length-1);
    const asSeconds = timingNumber*1000;
    let asMinutes, asHours, asDays;
    logSpam(`unit ${timingUnit}, number ${timingNumber}`);
    let timestampMinus = 0;
    switch (timingUnit.toLowerCase()) {
      case "d":
        logSpam(`${timingNumber} days reminder`);
        asMinutes = asSeconds*60;
        asHours = asMinutes*60;
        asDays = asHours*24;
        timestampMinus = asDays;
      break;
      case "h":
        logSpam(`${timingNumber} hours reminder`);
        asMinutes = asSeconds*60;
        asHours = asMinutes*60;
        timestampMinus = asHours;
      break;
      case "m":
        logSpam(`${timingNumber} minutes reminder`);
        asMinutes = asSeconds*60;
        timestampMinus = asMinutes;
      break;
      default:
        logSpam('Timing not parsed');
      break;
    }
    logSpam(`timestampMinus ${timestampMinus}`);
    const targetTimestamp = sessionTimestamp.valueOf() - timestampMinus;
    // set minimum delay to 15 seconds in case reminder is instant
    let msFromNow = targetTimestamp - Date.now();
    if (msFromNow < 15000) msFromNow = 15000;
    // start reminder object
    reminders[reminders.length] = {
      dateTime: new Date(targetTimestamp),
      sessionTimeDateF: sessionTimeDateF,
      timeStamp: targetTimestamp,
      playersString: playersString.split(',').join(' '),
      MilliSecondsFromNow: msFromNow,
      gmID: msg.author.id,
      userFolderID: userFolderID,
      playChannelID: playChannelID
    };
    count++
  }
  await addReminders(msg, reminders);
  msg.reply(`${count} reminders added. **NOTE:** Reminders are now based on GMT+0.`)
  .catch((err)=>{logError(err);});
  removeHourglass(msg);
  logWrite(`🎲🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${playChannelID})/${msg.author.id}`);
}
async function handleCancelReminderCommand(msg, args) {
  if (msg.channel.guild === null) {
    msg.reply(`This command doesn't work via DM. You must be in a server channel.`)
    .catch((e)=>{logError(e);});
    return;
  }
  addHourglass(msg);
  logWrite('\x1b[32m [ ==================== handleCancelReminderCommand ======================= ]\x1b[0m');
  // parse args
  const shortIDs = [...args];
  logSpam(shortIDs);
  if (shortIDs.length === 0) {
    msg.reply(`This command needs one or more ID's. You'll find the ID's by using \`!listreminders\`.`)
    .catch((err)=>{logError(err);});
    return;
  }
  // loop thru shortIDs
  for (let x = 0; x < shortIDs.length; x++) {
    // find reminder in global.reminders
    for (let y = 0; y < global.reminders.length; y++) {
      if (global.reminders[y].shortID === shortIDs[x]) {
        // clearTimeout
        clearTimeout(global.reminders[y].timeoutID);
        // splice the element from global.reminders
        global.reminders.splice(y, 1);
        // decrement because next item just became current item
        y--;
      }
    }
  }
  // update files from what's left of global.reminders
  // system folder first
  let saveString = '';
  for (let x = 0; x < global.reminders.length; x++) {
    if (saveString !== '') saveString += '\n';
    saveString += _makeReminderSaveString(global.reminders[x]);
  }
  let filename = 'activeReminders';
  await setStringByNameAndParent(filename, global.folderID.reminders, saveString);
  // user folder last
  saveString = '';
  await ensureTriplet(msg);
  const playChannelID = await getPlayChannel(msg);
  for (let x = 0; x < global.reminders.length; x++) {
    if (saveString !== '') saveString += '\n';
    if (global.reminders[x].gmID === msg.author.id
      && global.reminders[x].playChannelID == playChannelID)
    {
      saveString += _makeReminderSaveString(global.reminders[x]);
    }
  }
  filename = 'gmReminders';
  let userFolderID = await findUserFolderDBIDFromMsg(msg, true);
  if (userFolderID === -1) return -1;
  await setStringByNameAndParent(filename, userFolderID, saveString);
  // user feedback
  msg.reply(`${shortIDs.length} reminder cancellations were requested.`)
  .catch((err) => {console.error(err);});
  removeHourglass(msg);
  logWrite(`🎲🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${playChannelID})/${msg.author.id}`);
}
module.exports = {
  handleListRemindersCommand, handleAddReminderCommand,
  handleCancelReminderCommand
}
