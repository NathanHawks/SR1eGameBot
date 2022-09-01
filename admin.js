/*
 * Shadowrun 1e GameBot by Discord user AstroMacGuffin#1486 (Nathan Hawks)
 * https://github.com/NathanHawks/SR1eGameBot
 * Yes I do regret baking 1e into the name
 * version 0.3, yeah that sounds good
 * Released under the terms of the UnLicense. This work is in the public domain.
 * Released as-is with no warranty or claim of usability for any purpose.
 */
async function openFile(msg, args) {
  var output = await getStringContents(args[0], 'system');

  msg.channel.send("```\n" + output + "```").catch((e) => {console.log(e);});
}
async function listAllFiles(msg) {
  var nextPageToken = undefined;
  var output = '--- [filename] ---------   ------------ googleID ------------- ------------ parentID -------------\n';
  var finalout = '';
  const drive = google.drive({version: 'v3', auth: global.auth});
  var iteratePage = async function (nextPageToken=undefined, level=0) {
    var q = { fields: 'nextPageToken, files(id, name, parents)' };
    if (nextPageToken !== undefined) q.pageToken = nextPageToken;
    logSpam('Querying GDrive for a list');

    drive.files.list(q, async (err, res) => {

      if (res.data.files) {
        logSpam(`res.data.files got ${res.data.files.length}`);
      }
      else {
        logSpam('res.data.files got nothing');
      }
      if (err) {
        if (err.hasOwnProperty('code') && err.code === 500) {
          console.error(err);
          logWrite('Trying again in 2 seconds');
          await sleep(2000);
          await iteratePage(nextPageToken, level);
        }
      }
      logSpam('No significant error returned');
      var files = res.data.files;
      if (files.length) {
        logSpam(res.data.nextPageToken);
        var x = 0;
        for (x = 0; x < files.length; x++) {
          global.filesFound[global.filesFound.length] = files[x];
        }
        nextPageToken = res.data.nextPageToken;
        logSpam('nextPageToken = ' + nextPageToken);
      } else if (res.data.nextPageToken === 'undefined' || res.data.nextPageToken === undefined) {
        nextPageToken = undefined;
      } else {
        nextPageToken = undefined;
        output += 'No files found.';
      }
      logSpam(`Finishing callback with ${global.filesFound.length} files found on level ${level}`);
      if (nextPageToken !== undefined) {
        iteratePage(nextPageToken, level+1);
      }
      else {
        var x;
        for (x = 0; x < global.filesFound.length; x++) {
          // temporary / fallback (old version)
          var file = global.filesFound[x];
          output += `${file.name.padEnd(26)} (${file.id}) [${file.parents}]\n`;
        }
        if (msg !== undefined && output.length < 1994)
          msg.channel.send(`\`\`\`${output}\`\`\``)
          .catch((e) => {console.log(e);});
        else if (msg !== undefined) {
          var outArr = output.split("\n");
          output = '';
          for (var x = 0; x < outArr.length; x++) {
            output += outArr[x] + "\n";
            if (output !== '\n') {
              if (x%20 === 0) {
                msg.channel.send('```\n' + output + '```')
                .catch((e) => {console.log(e);});
                output = '';
              } else if (outArr.length - x < 20) {
                finalout = output;
              }
            }
          }
          if (finalout !== '\n') {
            msg.channel.send('```\n' + finalout + '```')
            .catch((e) => {console.log(e);});
          }
        }
        else console.log(output);
        global.filesFound = [];
      }
    });
  }
  while(isDiskLockedForChannel('system')) { sleep(15); }
  iteratePage();
  logSpam('Disk unlocked');
}
function deleteFile(msg, args) {
  if (args && args[0]) {
    deleteStringByID(args[0], (err, res) => {
      msg.channel.send("```" + args[0] + ' deleted.```')
      .catch((e) => {console.log(e);});
    });
  }
}
function showCache(msg) {
  var output = '\nGeneral\n[CacheID]  - name/discordID - ------------ googleID ----------- ----------- parentID ------------\n';
  var finalout = '';
  var cxArr = ['server', 'channel', 'userInChannel', 'file'];
  var foundCache = false;
  cxArr.map((cx) => {
    for (var x = 0; x < global.cache[cx].length; x++) {
      if (!global.cache[cx][x]) continue;
      foundCache = true;
      var id = `${cx.substring(0,4)}${x}`;
      id = id.padEnd(10, " ");
      var did = (global.cache[cx][x].hasOwnProperty('discordID'))
        ? global.cache[cx][x].discordID.padEnd(18, " ")
        : " ".padEnd(18, " ");
      var gid = global.cache[cx][x].googleID;
      var par = global.cache[cx][x].parentID;
      if (par === undefined) par = "[UserData]".padStart(11, " ");
      output += `${id} ${did} ${gid} ${par}\n`
    }
  });
  if (foundCache === false) output += " Cache empty\n";
  var x = 0;
  output += '\nFile Contents\n[CacheID] ------------------- ------------ googleID ----------- ------------ content ------------\n';
  global.cache.fileContent.map((c) => {
    var id = `fcon${x}`.padEnd(10, " ");
    var spa = " ".padEnd(18, " ");
    var gid = c.googleID;
    if (c.content === undefined) c.content = "";
    var con = c.content.substring(0, 33);
    con = con.replace(/\n/g, " ");
    output += `${id} ${spa} ${gid} ${con}\n`;
    x++;
  });
  if (x === 0) output += " Cache empty\n";
  var pcx = 0;
  output += '\nPlay Channels\n[CacheID]  ----- server ----- ----- channel ---- ------ user ------ ----- playChannel -----\n';
  global.cache.playChannel.map((pc) => {
    var id = `play${pcx}`.padEnd(10, " ");
    var s = pc.server;
    var c = pc.channel;
    var u = pc.user;
    var p = pc.playChannel;
    output += `${id} ${s} ${c} ${u} ${p}\n`;
    pcx++;
  });
  if (pcx === 0) output += " Cache empty\n";
  var ftx = 0;
  output += '\nFolder Triplets\n[CacheID]  ----- server ----- ----- channel ---- ------ user ------ ----- googleID -----\n';
  global.cache.triplet.map((ft) => {
    var id = `trip${ftx}`.padEnd(10, " ");
    var s = ft.server;
    var c = ft.channel;
    var u = ft.user;
    var t = ft.googleID;
    output += `${id} ${s} ${c} ${u} ${t}\n`;
    ftx++;
  });
  if (ftx === 0) output += " Cache empty\n";
  // 2000 or fewer characters please
  var outArr = output.split("\n");
  output = '';
  for (var i = 0; i < outArr.length; i++) {
    output += outArr[i] + "\n";
    if (i%15===0 && i != 0) {
      msg.channel.send('```' + output + '```')
      .catch((e) => {console.log(e);});
      output = '';
    } else if (outArr.length - i < 15) {
      finalout = output;
    }
  }
  if (finalout) msg.channel.send('```' + finalout + '```')
  .catch((e) => {console.log(e);});
}
function clearCache(msg) {
  resetCache();
  showCache(msg);
}
// unlock global.lock for a specific channel
function adminUnlock(msg, args) {
  var channel = -1;
  if (msg && msg.channel && args.length === 0) {
    channel = msg.channel.id
  } else { channel = args[0]; }
  global.lock[channel] = false;
}
function adminUnlockAll(msg) {
  var i;
  for (i = 0; i < global.lock.length; i++) {
    global.lock[i] = false;
  };
}
function deleteAllFiles() {
  var auth = global.auth;
  const drive = google.drive({version: 'v3', auth});
  drive.files.list({
    fields: 'nextPageToken, files(id, name)',
  }, async (err, res) => {
    if (err && err.hasOwnProperty('code') && err.code === 500) {
      console.error(err);
      logWrite('Trying again in 2 seconds...');
      await sleep(2000);
      return deleteAllFiles();
    }
    else if (err) {
      return console.error(err);
    }
    const files = res.data.files;
    if (files.length) {
      console.log(`DX: Deleting ${files.length} files...`);
      files.map((file) => {
        deleteStringByID(file.id, doNothing);
      });
      logWrite("DX: All commands sent.")
    } else {
      logWrite('No files found.');
    }
  });
}
module.exports = {
  openFile, listAllFiles, deleteFile, showCache, clearCache, adminUnlock,
  adminUnlockAll, deleteAllFiles
};
