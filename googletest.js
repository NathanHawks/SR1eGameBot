const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');

// If modifying these scopes, delete token.json.
const G_SCOPES = ['https://www.googleapis.com/auth/drive.appdata',
                'https://www.googleapis.com/auth/drive.file'];
// The file googletoken.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const G_TOKEN_PATH = 'googletoken.json';

// internal setup
// system folder(s)
global.folderID = {UserData : null};
// semaphores per channel id
global.channelDiskLock = { };
// config (debugging flags, etc)
global.config = {
  // debugging options
  skipInitInitiative: false,
  deleteUserDataIfFoundOnStartup: false,
  listAllFilesOnStartup: true,
  createASubfolderOnStartup: false,
  deleteAllFilesOnStartup: false,
};

// Load client secrets from a local file.
fs.readFile('googlecredentials.json', (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
  // Authorize a client with credentials, then call the Google Drive API.
  authorize(JSON.parse(content), initInitiative);
});

// =========== google's library functions ==========================
/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(G_TOKEN_PATH, (err, token) => {
    if (err) return getAccessToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getAccessToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: G_SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(G_TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', G_TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}
//==================================================================
// dx funcs
function listAllFiles(auth) {
  const drive = google.drive({version: 'v3', auth});
  drive.files.list({
    fields: 'nextPageToken, files(id, name, parents)',
  }, (err, res) => {
    if (err) return console.log('The API returned an error: ' + err);
    const files = res.data.files;
    if (files.length) {
      console.log('DX: Files --------------------- IDs --------------------- parents');
      files.map((file) => {
        console.log(`${file.name} (${file.id}) [${file.parents}]`);
      });
    } else {
      console.log('No files found.');
    }
  });
}
function deleteAllFiles(auth) {
  const drive = google.drive({version: 'v3', auth});
  drive.files.list({
    fields: 'nextPageToken, files(id, name)',
  }, (err, res) => {
    if (err) return console.log('The API returned an error: ' + err);
    const files = res.data.files;
    if (files.length) {
      console.log(`DX: Deleting ${files.length} files...`);
      files.map((file) => {
        deleteGDriveFileById(file.id, auth,
          (err, res) => { if (err) console.error(err); }
        );
      });
    } else {
      console.log('No files found.');
    }
  });
}
function dxCreateSubfolder(auth) {
  // test ensure
  ensureGDriveFolderByName('Subfolder', global.folderID['UserData'], auth);
}
//==================================================================
// my library functions
// this function poorly tested
function ensureGDriveFolderByName(name, parentID=null, auth) {
  findGDriveFolderByName(name, parentID, auth, (err, res) => {
    if (err) return console.error(err);
    console.log(`Ensuring folder ${name} exists`);
    const files = res.data.files;
    if (files.length == 0) {
      console.log('It doesn\'t exist; creating it');
      // create folder & let callback perform another find to get id
      createGDriveFolder(name, parentID, auth, (err, file) => {
        // after-creation action
        if (err) return console.error(err);
      });
    }
  });
}

// semaphore paradigm: disk locking per channel to prevent race conditions
// optional 2nd arg allows inverting the function
function lockDiskForChannel(channelID, unlock=false) {
  global.channelDiskLock[channelID] = !unlock;
}
function unlockDiskForChannel(channelID, lock=false) {
  global.channelDiskLock[channelID] = !lock;
}

function findGDriveFolderByName(folderName, parentID=null, auth, callback) {
  const drive = google.drive({version: 'v3', auth});
  var mainq = `name="${folderName}"`;
  mainq = (parentID == null) ? mainq : `"${parentID}" in parents`
  var q = {
    q: mainq,
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    fields: 'files(id, name)',
  };
  drive.files.list(q, (err, res) => { callback(err, res, auth); }
  );
}

function createGDriveFolder(folderName, parentID=null, auth, callback) {
  const drive = google.drive({version: 'v3', auth});
  var parents = [];
  if (parentID !== null) {
    parents = [parentID];
  }
  drive.files.create({
    resource: {
      'name': folderName,
      'parents': parents,
      'mimeType': 'application/vnd.google-apps.folder'
    },
    fields: 'id'
  },
    callback
  );
}

function deleteGDriveFileById(fileId, auth, callback) {
  const drive = google.drive({version: 'v3', auth});
  drive.files.delete({fileId:fileId}, (err, res) => { callback(err, res); });
}

//==================================================================
// Init the Initiative system. See also callbackInitInitiative, immediately below
function initInitiative(auth) {
  // diagnostic / testing junk
  if (global.config.deleteAllFilesOnStartup == true)
    { deleteAllFiles(auth); return; }
  if (global.config.listAllFilesOnStartup == true) listAllFiles(auth);
  if (global.config.skipInitInitiative == true) return;
  // initial startup payload depends on whether UserData folder exists
  findGDriveFolderByName('UserData', null, auth,
    (err, res) => { callbackInitInitiative(err, res, auth); }
  );
}
// Startup payload
function callbackInitInitiative(err, res, auth) {
  if (err)
    return console.log('Google Drive API returned an error: ' + err);

  var findAndSetFolderID = function (files, folderName) {
    files.map((file) => {
      if (file.name == folderName) { global.folderID[folderName] = file.id; }
    });
  }

  // determine if we've already been installed; if not, do install
  const files = res.data.files;
  if (files.length) {
    // SETUP =======================================================
    var folderName = 'UserData';
    findAndSetFolderID(files, folderName);
    if (global.config.deleteUserDataIfFoundOnStartup == true) {
      // testing/debugging: delete UserData folder (to test installer again)
      deleteGDriveFileById(global.folderID[folderName], auth,
        (err, res) => {if (err) console.log(err);});
    }
  } else {
    // INSTALL =====================================================
    var folderName = 'UserData';
    console.log(`Installing ${folderName} folder.`);
    createGDriveFolder(folderName, null, auth,
      (err, file) => {
        if (err) return console.error(err);
        // fetch ID of new folder
        findGDriveFolderByName(folderName, null, auth,
          (err, res, auth) => {
            const files = res.data.files;
            if (files.length) { findAndSetFolderID(files, folderName); }
          } );
      } );
  }
  // rest of startup
  // more diagnostic / testing junk
  if (global.config.createASubfolderOnStartup == true) dxCreateSubfolder(auth);

}
