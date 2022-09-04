/*
 * Shadowrun 1e GameBot by Discord user AstroMacGuffin#1486 (Nathan Hawks)
 * https://github.com/NathanHawks/SR1eGameBot
 * Yes I do regret baking 1e into the name
 * version 0.3, yeah that sounds good
 * Released under the terms of the UnLicense. This work is in the public domain.
 * Released as-is with no warranty or claim of usability for any purpose.
 */
const {resetCache} = require('./api');
async function openFile(msg, args) {
  let output = await getStringContent(args[0]);
  msg.channel.send("```\n" + output + "```").catch((e) => { logError(e); });
}
function showCache(msg) {
  let output = '\nGeneral\n[CacheID]  - name/discordID - ---------- dbID -------- --------- parentID ---------\n';
  let finalout = '';
  let cxArr = ['server', 'channel', 'userInChannel', 'file'];
  let foundCache = false;
  cxArr.map((cx) => {
    for (let x = 0; x < global.cache[cx].length; x++) {
      if (!global.cache[cx][x]) continue;
      foundCache = true;
      let id = `${cx.substring(0,4)}${x}`;
      id = id.padEnd(10, " ");
      let did = (global.cache[cx][x].hasOwnProperty('discordID'))
        ? global.cache[cx][x].discordID.padEnd(18, " ")
        : " ".padEnd(18, " ");
      let gid = global.cache[cx][x].dbID;
      let par = global.cache[cx][x].parentID;
      if (par === undefined) par = "[UserData]".padStart(11, " ");
      output += `${id} ${did} ${gid} ${par}\n`
    }
  });
  if (foundCache === false) output += " Cache empty\n";
  let x = 0;
  output += '\nFile Contents\n[CacheID] ------------------- ---------- dbID -------- ------------ content ------------\n';
  global.cache.fileContent.map((c) => {
    let id = `fcon${x}`.padEnd(10, " ");
    let spa = " ".padEnd(18, " ");
    let gid = c.dbID;
    if (c.content === undefined) c.content = "";
    let con = c.content.substring(0, 33);
    con = con.replace(/\n/g, " ");
    output += `${id} ${spa} ${gid} ${con}\n`;
    x++;
  });
  if (x === 0) output += " Cache empty\n";
  let pcx = 0;
  output += '\nPlay Channels\n[CacheID]  ----- server ----- ----- channel ---- ------ user ------ ----- playChannel -----\n';
  global.cache.playChannel.map((pc) => {
    let id = `play${pcx}`.padEnd(10, " ");
    let s = pc.server;
    let c = pc.channel;
    let u = pc.user;
    let p = pc.playChannel;
    output += `${id} ${s} ${c} ${u} ${p}\n`;
    pcx++;
  });
  if (pcx === 0) output += " Cache empty\n";
  let ftx = 0;
  output += '\nFolder Triplets\n[CacheID]  ----- server ----- ---- channel ----- ------ user ------ ----- dbID -----\n';
  global.cache.triplet.map((ft) => {
    let id = `trip${ftx}`.padEnd(10, " ");
    let s = ft.server;
    let c = ft.channel;
    let u = ft.user;
    let t = ft.dbID;
    output += `${id} ${s} ${c} ${u} ${t}\n`;
    ftx++;
  });
  if (ftx === 0) output += " Cache empty\n";
  // 2000 or fewer characters please
  let outArr = output.split("\n");
  output = '';
  for (let i = 0; i < outArr.length; i++) {
    output += outArr[i] + "\n";
    if (i%15===0 && i != 0) {
      msg.channel.send('```' + output + '```')
      .catch((e) => { logError(e); });
      output = '';
    } else if (outArr.length - i < 15) {
      finalout = output;
    }
  }
  if (finalout) msg.channel.send('```' + finalout + '```')
  .catch((e) => { logError(e); });
}
function clearCache(msg) {
  resetCache();
  showCache(msg);
}
module.exports = {
  openFile, showCache, clearCache
};
