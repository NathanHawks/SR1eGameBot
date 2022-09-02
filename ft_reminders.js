/*
 * Shadowrun 1e GameBot by Discord user AstroMacGuffin#1486 (Nathan Hawks)
 * https://github.com/NathanHawks/SR1eGameBot
 * Yes I do regret baking 1e into the name
 * version 0.3, yeah that sounds good
 * Released under the terms of the UnLicense. This work is in the public domain.
 * Released as-is with no warranty or claim of usability for any purpose.
 */

async function handleListRemindersCommand(msg, cmd, args, user) {
  if (msg.channel.guild === undefined) {
    msg.reply(`This command doesn't work via DM. You must be in a server channel.`)
    .catch((e)=>{error.log(e);});
    return;
  }
  addHourglass(msg);
  logWrite('\x1b[32m [ ==================== handleListRemindersCommand ======================= ]\x1b[0m');
  let playChannelID = await getPlayChannel(msg);

  let userFolderID = await findUserFolderDBIDFromMsg(msg, true);

  let reminders = await getUserReminders(userFolderID, playChannelID);

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
    if (output === '\n') output = ` you have no reminders set in channel <#${playChannelID}>.`;
    else {
      if (output.length < 1900) msg.reply(output).catch((err)=>{console.error(err);});
      else {
        let items = output.split('\n\n');
        for (let x = 0; x < items.length; x++) {
          msg.reply(`\n${items[x]}\n\n`).catch((err)=>{console.error(err);});
        }
      }
    }
  }
  else {
    msg.reply(` you have no reminders set in channel <#${playChannelID}>.`)
    .catch((err)=>{console.error(err);});
  }
  removeHourglass(msg);
  logWrite(`🎲🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${playChannelID})/${msg.author.id}`);
}
async function handleAddReminderCommand(msg, cmd, args, user) {
  if (msg.channel.guild === undefined) {
    msg.reply(`This command doesn't work via DM. You must be in a server channel.`)
    .catch((e)=>{error.log(e);});
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
    msg.reply(` the session date & time you entered was invalid. Check it carefully and try again.`)
    .catch((err)=>{console.error(err);});
    return;
  }
  // get play folder
  let playChannelID = await getPlayChannel(msg);

  // get player list
  let userFolderID = await findUserFolderDBIDFromMsg(msg, true);

  let filename = 'gmPlayers';
  playersFileID = await findStringIDByName(filename, userFolderID, playChannelID);

  let playersString = await getStringContent(playersFileID, playChannelID);

  if (playersString.length === 0) {
    await msg.reply(` you have no players in channel <#${playChannelID}> yet to send reminders to.`)
    .catch((err) => {console.error(err)});
    return;
  }
  // parse list of timings
  for (let x = 0; x < timings.length; x++) {
    timing = timings[x];
    let timingUnit = timing.substring(timing.length-1);
    let timingNumber = timing.substring(0, timing.length-1);
    let asSeconds = timingNumber*1000;
    logSpam(`unit ${timingUnit}, number ${timingNumber}`);
    let timestampMinus = 0;
    switch (timingUnit.toLowerCase()) {
      case "d":
        logSpam(`${timingNumber} days reminder`);
        let asMinutes = asSeconds*60;
        let asHours = asMinutes*60;
        let asDays = asHours*24;
        timestampMinus = asDays;
      break;
      case "h":
        logSpam(`${timingNumber} hours reminder`);
        let asMinutes = asSeconds*60;
        let asHours = asMinutes*60;
        timestampMinus = asHours;
      break;
      case "m":
        logSpam(`${timingNumber} minutes reminder`);
        let asMinutes = asSeconds*60;
        timestampMinus = asMinutes;
      break;
      default:
        logSpam('Timing not parsed');
      break;
    }
    logSpam(`timestampMinus ${timestampMinus}`);
    let targetTimestamp = sessionTimestamp.valueOf() - timestampMinus;
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
  }
  await addReminders(msg, reminders);
  msg.reply(` ${x} reminders added.`)
  .catch((err)=>{console.error(err);});
  removeHourglass(msg);
  logWrite(`🎲🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${playChannelID})/${msg.author.id}`);
}
async function handleCancelReminderCommand(msg, cmd, args, user) {
  if (msg.channel.guild === undefined) {
    msg.reply(`This command doesn't work via DM. You must be in a server channel.`)
    .catch((e)=>{error.log(e);});
    return;
  }
  addHourglass(msg);
  logWrite('\x1b[32m [ ==================== handleCancelReminderCommand ======================= ]\x1b[0m');
  // parse args
  let shortIDs = [...args];
  logSpam(shortIDs);
  if (shortIDs.length === 0) {
    msg.reply(` this command needs one or more ID's. You'll find the ID's by using \`!listreminders\`.`)
    .catch((err)=>{console.error(err);});
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
  await setStringByNameAndParent({channel: {id: 'system'}}, filename, global.folderID.reminders, saveString);

  // user folder last
  saveString = '';
  let playChannelID = await getPlayChannel(msg);

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

  await setStringByNameAndParent({channel: {id: playChannelID}}, filename, userFolderID, saveString);

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
