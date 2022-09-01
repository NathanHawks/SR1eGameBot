/*
 * Shadowrun 1e GameBot by Discord user AstroMacGuffin#1486 (Nathan Hawks)
 * https://github.com/NathanHawks/SR1eGameBot
 * Yes I do regret baking 1e into the name
 * version 0.3, yeah that sounds good
 * Released under the terms of the UnLicense. This work is in the public domain.
 * Released as-is with no warranty or claim of usability for any purpose.
 */
async function initAll() {
  // init disk locking for system
  initInitiative(auth);
  await initReminders();
}
// Init the Initiative system. See also callbackInitInitiative, immediately below
function initInitiative(auth) {
  // initial startup payload depends on whether UserData folder exists
  findFolderByName('UserData', 'root', (err, res) => {
    callbackInitInitiative(err, res);
  });
}
// Startup payload
async function callbackInitInitiative(err, res) {
  if (err)
    return console.log('Google Drive API returned an error: ' + err);
  // currently global.folderID only holds one element, UserData; I expect others
  // e.g configs, helptexts, etc
  var findAndSetFolderID = function (files, folderName) {
    files.map((file) => {
      if (file.name == folderName) { global.folderID[folderName] = file.id; }
    });
  }
  // INSTALL/SETUP determine if we've already been installed; if not, do install
  const files = res.data.files;
  if (files.length) {
    // SETUP =======================================================
    var folderName = 'UserData';
    findAndSetFolderID(files, folderName);

  } else {
    // INSTALL =====================================================
    var folderName = 'UserData';
    console.log(`Installing ${folderName} folder.`);
    createFolder(folderName, null, (err, file) => {
        if (err) return console.error(err);
        // fetch ID of new folder
        findFolderByName(folderName, null, (err, res) => {

            const files = res.data.files;
            if (files.length) { findAndSetFolderID(files, folderName); }
          }
        );
      }
    );
  }
}
// Init reminders
async function initReminders() {
  var userDataFolderID = await findFolderByName('UserData', 'root');

  await ensureFolderByName('reminders', userDataFolderID);

  var reminderFolderID = await findFolderByName('reminders', userDataFolderID);

  global.folderID.reminders = reminderFolderID;
  global.reminders = await getActiveReminders();

  if (global.reminders.length > 0) {
    for (var x = 0; x < global.reminders.length; x++) {
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
  initAll, initInitiative, callbackInitInitiative, initReminders
};
