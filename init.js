/*
 * Shadowrun 1e GameBot by Discord user AstroMacGuffin#1486 (Nathan Hawks)
 * https://github.com/NathanHawks/SR1eGameBot
 * Yes I do regret baking 1e into the name
 * version 0.3, yeah that sounds good
 * Released under the terms of the UnLicense. This work is in the public domain.
 * Released as-is with no warranty or claim of usability for any purpose.
 */
const { logSpam, logWrite } = require('./log');
const {
  findFolderByName, _addRemindersSetTimeoutPayload, getActiveReminders
} = require('./api');
// Checked 9/1/22
async function initAll() {
  await initInitiative();
  await initReminders();
}
// Checked 9/1/22
async function initInitiative() {
  // initial startup payload depends on whether UserData folder exists
  const folderName = 'UserData';
  const c = await findFolderByName(folderName);
  const findAndSetFolderID = function (c, folderName) {
    if (c.name === folderName) global.folderID[folderName] = c._id.toString();
  }
  // INSTALL/SETUP determine if we've already been installed; if not, do install
  if (c) {
    // SETUP =======================================================
    findAndSetFolderID(c, folderName);
  } else {
    // INSTALL =====================================================
    logWrite(`Installing ${folderName} folder.`);
    createFolder(folderName, null, () => {
        // fetch ID of new folder
        findFolderByName(folderName, null, (folder) => {
            if (folder) { findAndSetFolderID(folder, folderName); }
          }
        );
      }
    );
  }
}
// Checked 9/1/22
async function initReminders() {
  let userDataFolder = await findFolderByName('UserData');
  await ensureFolderByName('reminders', userDataFolder._id.toString());
  let reminderFolder = await findFolderByName(
    'reminders', userDataFolder._id.toString()
  );

  global.folderID.reminders = reminderFolder._id.toString();
  global.reminders = await getActiveReminders();

  if (global.reminders.length > 0) {
    for (let x = 0; x < global.reminders.length; x++) {
      global.reminders[x].MilliSecondsFromNow =
        new Date(global.reminders[x].dateTime).valueOf() - Date.now();
      if (global.reminders[x].playersString !== undefined) {
        logSpam(`Reminder shortID ${global.reminders[x].shortID} found:`
          + ` playersString = ${global.reminders[x].playersString}`);
        global.reminders[x].timeoutID = setTimeout(
          _addRemindersSetTimeoutPayload,
          global.reminders[x].MilliSecondsFromNow,
          global.reminders[x]
        );
      }
    }
  }
}
module.exports = {
  initAll, initInitiative, initReminders
};
