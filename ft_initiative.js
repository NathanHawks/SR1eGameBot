/*
* Shadowrun 1e GameBot by Discord user AstroMacGuffin#1486 (Nathan Hawks)
* https://github.com/NathanHawks/SR1eGameBot
* Yes I do regret baking 1e into the name
* version 0.3, yeah that sounds good
* Released under the terms of the UnLicense. This work is in the public domain.
* Released as-is with no warranty or claim of usability for any purpose.
*/
const {logError, logWrite, logSpam} = require('./log');
const {
  addHourglass, getPlayChannel, ensureTriplet, doNothing, modifyNPCInput,
  validateNPCInput, findUserFolderDBIDFromMsg, findStringIDByName,
  getStringContent, findUserDBIDFromDiscordID, addMaintenanceStatusMessage,
  removeHourglass, rollDice, sortReaction, sortInitPass, sort1ETiebreaker,
  sortCPRTiebreaker, rollD10s, setStringByNameAndParent
} = require('./api');
async function handleInitCommand(msg, cmd, user) {
  if (msg.channel.guild === undefined) {
    msg.reply(`This command doesn't work via DM. You must be in a server channel.`)
    .catch((e)=>{error.log(e);});
    return;
  }
  addHourglass(msg);
  logWrite('\x1b[32m [ ==================== handleInitCommand ======================= ]\x1b[0m');
  let gmPlayChannelID = await getPlayChannel(msg);
  await ensureTriplet(msg);
  let userFolderID = '';
  let gmPlayersFileID = '';
  let gmPlayersString = '';
  let gmPlayersArr = [];
  let gmNPCFileID = '';
  let gmNPCFileContent = '';
  let gmNPCArr = [];
  let playerInitContent = [];
  let someoneIsntReady_GM = false;
  let someoneIsntReady_Init = false;
  let playerFolderIDs = [];
  let playerGMFileID = [];
  let playerInitFileID = [];
  let playersNotSetGM = [];
  let playersNotSetInit = [];
  let initWillFail = false;
  let output = '';
  let filename = '';
  let npcRolls = [];
  let playerRolls = [];
  let npcPhases = [];
  let playerPhases = [];
  // get author's userFolderID for play channel
  userFolderID = await findUserFolderDBIDFromMsg(msg, true);
  if (userFolderID === -1) return -1;
  // get file ID of gm's (msg.author's) gmPlayers file, if any
  filename = 'gmPlayers';
  gmPlayersFileID = await findStringIDByName(filename, userFolderID);
  // make array of playerIDs from msg.author's gmPlayers file content, if any
  if (gmPlayersFileID !== -1) {
    gmPlayersString = await getStringContent(gmPlayersFileID);
    gmPlayersArr = gmPlayersString.split(',');
  }
  // ensure all players have setgm to user, and have setinit
  // prune empty entries from gmPlayersArr
  let tmpArr = [];
  gmPlayersArr.forEach((p)=>{
    if (p.length && p !== ' ') tmpArr[tmpArr.length] = p;
  });
  gmPlayersArr = tmpArr;
  // loop on gm's (msg.author's) list of players
  for (let x = 0; x < gmPlayersArr.length; x++) {
    filename = 'gmWhoIsGM';
    // create an index of each player's folderID
    playerFolderIDs[x] = await findUserDBIDFromDiscordID(msg, gmPlayersArr[x], true);
    // if the player doesn't have a user folder in this channel, skip other checks
    if (playerFolderIDs[x] == -1) {
      someoneIsntReady_GM = true;
      playersNotSetGM[x] = gmPlayersArr[x];
      playerGMFileID[x] = -1;
      someoneIsntReady_Init = true;
      playersNotSetInit[x] = gmPlayersArr[x];
      playerInitFileID[x] = -1;
    } else {
      // another index for each player's gmWhoIsGM fileID
      playerGMFileID[x] = await findStringIDByName(filename, playerFolderIDs[x]);
      if (playerGMFileID[x] == -1) {
        // not ready because they don't have a gmWhoIsGM file at all
        someoneIsntReady_GM = true;
        playersNotSetGM[x] = gmPlayersArr[x];
      }
      else {
        let playerGMContent = await getStringContent(playerGMFileID[x]);
        if (playerGMContent !== user.id) {
          // not ready because their gmWhoIsGM file indicates another GM
          someoneIsntReady_GM = true;
          playersNotSetGM[x] = gmPlayersArr[x];
        }
      }
      // ensure all players have setinit
      filename = "playerInit";
      // another index for each player's playerInit fileID
      playerInitFileID[x] = await findStringIDByName(filename, playerFolderIDs[x]);
      if (playerInitFileID[x] == -1) {
        // not ready because they don't have a playerInit file at all
        someoneIsntReady_Init = true;
        playersNotSetInit[x] = gmPlayersArr[x];
      }
      else {
        playerInitContent[x] = await getStringContent(playerInitFileID[x]);
        if (playerInitContent[x].length == 0) {
          // not ready because their playerInit file is empty
          someoneIsntReady_Init = true;
          playersNotSetInit[x] = gmPlayersArr[x];
        }
      }
    }
  }
  if (someoneIsntReady_GM) {
    // someone hasn't !setgm; append output to list them; set flag to fail
    output += `Some players haven't set you as their gm yet:\n`;
    playersNotSetGM.forEach((p)=>{output+=`:no_entry_sign: <@${p}>\n`});
    initWillFail = true;
  }
  if (someoneIsntReady_Init) {
    // someone hasn't !setinit; append output to list them; set flag to fail
    if (output !== '') output += 'and';
    output += `Some players haven't set their initiative formulas yet:\n`;
    playersNotSetInit.forEach((p)=>{output+=`:no_entry_sign: <@${p}>\n`});
    initWillFail = true;
  }
  // get NPC's, if any
  filename = 'gmNPCInit';
  gmNPCFileID = await findStringIDByName(filename, userFolderID);
  if (gmNPCFileID == -1) {
    doNothing();
  }
  else {
    gmNPCFileContent = await getStringContent(gmNPCFileID);
    gmNPCArr = gmNPCFileContent.split(",");
  }
  // abort if we have no players and no NPC's, or if anyone's init will fail
  if ((gmNPCArr.length == 0 && gmPlayersArr.length == 0) || initWillFail) {
    // init will fail one of two ways; notify
    if (gmPlayersArr.length == 0 && gmNPCArr.length == 0) {
      initWillFail = true;
      output += ` -- can't roll initiative: you have no players or NPC's in channel <#${gmPlayChannelID}>.`;
    }
    else if (initWillFail) {
      output += " -- Can't roll initiative: players aren't ready.\n"
      + ":thinking: :bulb: See **!inithelp** or ask your GM how to get set up!";
    }
  } else {
    output += "\n*[Roll]* Player or NPC (Mod)\n========================\n";
  }
  // if we have a valid setup, roll init
  if (!initWillFail) {
    playerRolls = [];
    // determine which init system we're emulating
    let passTH = [];
    let passSub = [];
    switch (cmd) {
      case 'init':
      case 'initflip':
        passTH = [10, 16, 22, 1000];
        passSub = [7, 14, 21, 0];
      break;
      case 'init2':
      case 'init2flip':
      case 'init3':
      case 'init3flip':
        passTH = [10, 20, 30, 40];
        passSub = [10, 20, 30, 40];
      break;
      case 'initcp':
      case 'initcpr':
        passTH = [1000, 2000, 3000, 4000];
        passSub = [0, 0, 0, 0];
      break;
    }
    // roll & calculate for players
    for (let x = 0; x < gmPlayersArr.length; x++) {
      let total = 0;
      let init = playerInitContent[x].split(" ");
      let rolls;
      if (cmd !== 'initcp' && cmd !== 'initcpr') {
        [,rolls] = rollDice(init[0], false, -1)
      }
      else rolls = rollD10s(init[0]);
      for (let y = 0; y < rolls.length; y++) {
        rolls[y] = Number(rolls[y]);
        total += rolls[y];
      }
      total += Number(init[1]);
      playerRolls[x] = rolls;
      // store initial initiative passes
      playerPhases[x] = [];
      playerPhases[x][playerPhases[x].length] = total;
      // calculate & store extra initiative passes
      if (total > passTH[0]) {
        playerPhases[x][playerPhases[x].length] = total - passSub[0];
      }
      if (total > passTH[1]) {
        playerPhases[x][playerPhases[x].length] = total - passSub[1];
      }
      if (total > passTH[2]) {
        playerPhases[x][playerPhases[x].length] = total - passSub[2];
      }
      if (total > passTH[3]) {
        playerPhases[x][playerPhases[x].length] = total - passSub[3];
      }
    }
    // roll & calculate for NPCs
    for (let x = 0; x < gmNPCArr.length; x++) {
      if (gmNPCArr[x].length) {
        let total = 0;
        let rolls;
        let init = gmNPCArr[x].split(" ");
        if (cmd !== 'initcp' && cmd !== 'initcpr') {
          [,rolls] = rollDice(init[0], false, -1)
        }
        else rolls = rollD10s(init[0]);
        for (let y = 0; y < rolls.length; y++) {
          rolls[y] = Number(rolls[y]);
          total += rolls[y];
        }
        total += Number(init[1]);
        npcRolls[x] = rolls;
        // store initial initiative passes
        npcPhases[x] = [];
        npcPhases[x][npcPhases[x].length] = total;
        // calculate & store extra initiative passes
        if (total > passTH[0]) {
          npcPhases[x][npcPhases[x].length] = total - passSub[0];
        }
        if (total > passTH[1]) {
          npcPhases[x][npcPhases[x].length] = total - passSub[1];
        }
        if (total > passTH[2]) {
          npcPhases[x][npcPhases[x].length] = total - passSub[2];
        }
        if (total > passTH[3]) {
          npcPhases[x][npcPhases[x].length] = total - passSub[3];
        }
      }
    }
  }
  // create dummy entries for output array so we can address higher items first
  let ordArr = [];
  // has each player or npc (by array index) gone yet this pass?
  let playerWentArr = [];
  let npcWentArr = [];
  // to bump people to the bottom
  let nextOrdArr = [];
  let nextPlayerWentArr = [];
  let nextNPCWentArr = [];
  let laterOrdArr = [];
  let laterPlayerWentArr = [];
  let laterNPCWentArr = [];
  let furtherOrdArr = [];
  let furtherPlayerWentArr = [];
  let furtherNPCWentArr = [];
  let farOrdArr = [];
  let farPlayerWentArr = [];
  let farNPCWentArr = [];
  for (let x = 0; x <= 40; x++) { ordArr[x] = ''; }
  // sort & format for output
  // create a downward loop for populating ordArr
  for (let x = 40; x > 0; x--) {
    // loop thru players array (containing arrays of their dice-based phases)
    for (let y = 0; y < playerPhases.length; y++) {
      // if the player is supposed to go on this phase (init passes aside)
      if (playerPhases[y].indexOf(x) !== -1) {
        let formattedEntry = `*[${x}]* <@${gmPlayersArr[y]}> (${playerInitContent[y].split(" ")[1]})`;
        if (
          cmd !== 'init' && cmd !== 'initflip' && cmd !== 'init2'
          && cmd !== 'init2flip' && cmd !== 'initcp' && cmd !== 'initcpr'
        ) {
          // it's probably 3rd edition: enforce the init passes rule
          if (playerWentArr.indexOf(y) === -1) {
            // the player hasn't gone yet this pass
            playerWentArr[playerWentArr.length] = y;
            if (ordArr[x]) { ordArr[x] += ","; }
            ordArr[x] += formattedEntry;
            if (y === 1) {
            }
          } else {
            // the player already went this pass
            if (nextPlayerWentArr.indexOf(y) === -1) {
              nextPlayerWentArr[nextPlayerWentArr.length] = y;
              nextOrdArr[nextOrdArr.length] = formattedEntry;
            } else {
              // the player is also already in the next pass
              if (laterPlayerWentArr.indexOf(y) === -1) {
                laterPlayerWentArr[laterPlayerWentArr.length] = y;
                laterOrdArr[laterOrdArr.length] = formattedEntry;
              } else {
                // i can do this all day (not really)
                if (furtherPlayerWentArr.indexOf(y) === -1) {
                  furtherPlayerWentArr[furtherPlayerWentArr.length] = y;
                  furtherOrdArr[furtherOrdArr.length] = formattedEntry;
                } else {
                  // 5th pass
                  farPlayerWentArr[farPlayerWentArr.length] = y;
                  farOrdArr[farOrdArr.length] = formattedEntry;
                }
              }
            }
          }
        } else {
          // don't enforce init passes for 2nd edition
          if (ordArr[x]) ordArr[x] += ",";
          ordArr[x] += formattedEntry;
        }
      }
    }
    // loop thru npc array (containing arrays their dice-based phases)
    for (let y = 0; y < npcPhases.length; y++) {
      // if the npc is supposed to go this phase (init passes aside)
      if (npcPhases[y].indexOf(x) !== -1) {
        let formattedEntry = `*[${x}]* ${gmNPCArr[y].split(" ")[2]} (${gmNPCArr[y].split(" ")[1]})`;
        if (
          cmd !== 'init' && cmd !== 'initflip' && cmd !== 'init2'
          && cmd !== 'init2flip' && cmd !== 'initcp' && cmd !== 'initcpr'
        ) {
          // enforce the init passes rule
          if (npcWentArr.indexOf(y) === -1) {
            // the npc hasn't gone yet this pass
            npcWentArr[npcWentArr.length] = y;
            if (ordArr[x]) ordArr[x] += ",";
            ordArr[x] += formattedEntry;
          } else {
            // the npc already went this pass
            if (nextNPCWentArr.indexOf(y) === -1) {
              nextNPCWentArr[nextNPCWentArr.length] = y;
              nextOrdArr[nextOrdArr.length] = formattedEntry;
            } else {
              if (laterNPCWentArr.indexOf(y) === -1) {
                // the npc is also already in the next pass
                laterNPCWentArr[laterNPCWentArr.length] = y;
                laterOrdArr[laterOrdArr.length] = formattedEntry;
              } else {
                if (furtherNPCWentArr.indexOf(y) === -1) {
                  // i can do this all day (not really)
                  furtherNPCWentArr[furtherNPCWentArr.length] = y;
                  furtherOrdArr[furtherOrdArr.length] = formattedEntry;
                } else {
                  // 5th pass
                  farNPCWentArr[farNPCWentArr.length] = y;
                  farOrdArr[farOrdArr.length] = formattedEntry;
                }
              }
            }
          }
        } else {
          // don't enforce init passes
          if (ordArr[x]) ordArr[x] += ",";
          ordArr[x] += formattedEntry;
        }
      }
    }
    if (
      cmd !== 'init' && cmd !== 'initflip' && cmd !== 'init2'
      && cmd !== 'init2flip' && cmd !== 'initcp' && cmd !== 'initcpr'
    ) {
      // has everyone gone yet this pass?
      if (playerWentArr.length == gmPlayersArr.length
        && npcWentArr.length == gmNPCArr.length
        || (x <= 1))
      {
        // sort first pass if it's time to
        if (playerWentArr.length == gmPlayersArr.length
          && npcWentArr.length == gmNPCArr.length)
        {
          //ordArr.sort(sortInitPass); // that made a mess...?
        }
        if (nextOrdArr.length) {
          nextOrdArr.sort(sortInitPass);
          for (let z = 0; z < nextOrdArr.length; z++) {
            ordArr.splice(x, 0, nextOrdArr[z]);
          }
        }
        nextOrdArr = laterOrdArr;
        laterOrdArr = furtherOrdArr
        furtherOrdArr = farOrdArr;
        farOrdArr = [];
        npcWentArr = nextNPCWentArr;
        nextNPCWentArr = laterNPCWentArr;
        laterNPCWentArr = furtherNPCWentArr;
        furtherNPCWentArr = farNPCWentArr;
        farNPCWentArr = [];
        playerWentArr = nextPlayerWentArr;
        nextPlayerWentArr = laterPlayerWentArr;
        laterPlayerWentArr = furtherPlayerWentArr;
        furtherPlayerWentArr = farPlayerWentArr;
        farPlayerWentArr = [];
        if (x <= 1) {
          // second pass
          if (nextOrdArr.length) {
            nextOrdArr.sort(sortInitPass);
            for (let z = 0; z < nextOrdArr.length; z++) {
              ordArr.splice(x, 0, nextOrdArr[z]);
            }
          }
          // third pass
          if (laterOrdArr.length) {
            laterOrdArr.sort(sortInitPass);
            for (let z = 0; z < laterOrdArr.length; z++) {
              ordArr.splice(x, 0, laterOrdArr[z]);
            }
          }
          // fourth pass
          if (furtherOrdArr.length) {
            furtherOrdArr.sort(sortInitPass);
            for (let z = 0; z < furtherOrdArr.length; z++) {
              ordArr.splice(x, 0, furtherOrdArr[z]);
            }
          }
          //. fifth pass
          if (farOrdArr.length) {
            farOrdArr.sort(sortInitPass);
            for (let z = 0; z < farOrdArr.length; z++) {
              ordArr.splice(x, 0, farOrdArr[z]);
            }
          }
        }
      }
    }
  }
  // prep for possible 1e tiebreaker rule
  let tbArr = [{name: '', phases: 0}];
  // prep for sorting
  tmpArr = [];
  // re-sort each phase for Reaction and 1e tiebreaker rule, and then split lines
  // backwards loop of element-per-phase array
  for (let x = ordArr.length - 1; x > -1 ; x--) {
    // at this point each phase is a comma-separated list of formattedEntry's
    tmpArr = ordArr[x].split(",");
    if (cmd !== 'initcp' && cmd !== 'initcpr') {
      // sortReaction is a nice tidy affair
      tmpArr = tmpArr.sort(sortReaction);
    }
    else if (cmd === 'initcpr') {
      // roll d10 for each tie until one party beats the other
      tmpArr = tmpArr.sort(sortCPRTiebreaker);
    }
    // 1e tiebreaker rule: a player on 2nd phase comes after a player on 1st phase, etc
    if (cmd === 'init' || cmd === 'initflip') {
      // loop of characters acting this phase
      for (let y = 0; y < tmpArr.length; y++) {
        // build an array (tbArr) noting how many phases each character has had so far including this one
        try {
          // get the character name (or discord id, mention-formatted)
          let character = tmpArr[y].split(" ")[1];
          // abundance of caution
          if (character !== undefined) {
            let index = -1;
            // get the index of that character in the tbArr (tiebreaker array)
            for (let z = 0; z < tbArr.length; z++) {
              if (tbArr[z].name === character) { index = z; }
            }
            // if the character isn't in the tbArr yet, put them there
            if (index === -1) {
              index = tbArr.length;
              tbArr[index] = {name: character, phases: 0};
            }
            // increment how many phases this character has had so far
            if (index > -1) {
              tbArr[index].phases++;
              logSpam('incrementing ' + character);
            }
          }
        } catch (e) { logError(e); }
      }
      // recursively loop, bumping array elements down if they've acted more times than the next one
      try { [tmpArr,tbArr] = sort1ETiebreaker(tmpArr, tbArr); }
      catch (e) { logError(e); }
      if (tmpArr[0] !== '') logSpam('__________________next_________\n');
    }

    ordArr[x] = tmpArr.join("\n")
  }
  switch (cmd) {
    case 'init':
    case 'init2':
    case 'init3':
    case 'initcp':
    case 'initcpr':
      // add to output from high to low
      for (let x = ordArr.length-1; x > 0; x--) {
        if (ordArr[x].length) { output += `${ordArr[x]}\n`; }
      }
    break;
    case 'initflip':
    case 'init2flip':
    case 'init3flip':
      // add to output from low to high
      for (let x = 0; x < ordArr.length; x++) { // 40 per pass times 5 passes
        if (ordArr[x].length) { output += `${ordArr[x]}\n`; }
      }
    break;
  }
  if ((gmNPCArr.length > 0 || gmPlayersArr.length > 0) && !initWillFail) {
    output += "========================\n";
  }
  // report
  msg.reply(addMaintenanceStatusMessage(msg, output)).catch((e) => { logError(e); });

  logWrite(`🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${gmPlayChannelID})/${msg.author.id}`);
  removeHourglass(msg);
}
async function handleSetGMCommand(msg, args, user) {
  // serverID.channelID.userID.gmWhoIsGM STRING
  // without flag: set self as GM
  if (msg.channel.guild === undefined) {
    msg.reply(`This command doesn't work via DM. You must be in a server channel.`)
    .catch((e)=>{error.log(e);});
    return;
  }
  logWrite('\x1b[32m [ ==================== handleSetGMCommand ====================== ]\x1b[0m');
  const gmPlayChannelID = await getPlayChannel(msg);
  let targetID = "";
  if (args.length) {
    if (args[0].substring(0,2) !== '<@') {
      msg.reply(addMaintenanceStatusMessage(msg, 
        'This command requires you to "@" people correctly.'
      )).catch((e) => { logError(e); });
      return;
    }
    targetID = args[0].substring(2, args[0].length-1);
    if (targetID.substring(0, 1) == '!')
      targetID = args[0].substring(3, args[0].length-1);
  }
  else targetID = user.id;
  addHourglass(msg);
  // ensure folder/subfolder chain: (root)/(UserData)/ServerID/ChannelID/UserID
  await ensureTriplet(msg);
  // now get the folderID of the user folder in this channel
  let userFolderID = await findUserFolderDBIDFromMsg(msg, true);
  if (userFolderID === -1) return -1;
  await setStringByNameAndParent('gmWhoIsGM', userFolderID, targetID);
  removeHourglass(msg);
  if (targetID == msg.author.id)
    msg.reply(addMaintenanceStatusMessage(msg, 
      `You are now a GM in channel <#${gmPlayChannelID}>.`
    )).catch((e) => { logError(e); });
  else
    msg.reply(addMaintenanceStatusMessage(msg, 
      `Your GM is now <@${targetID}> in this channel.`
    )).catch((e) => { logError(e); });
  logWrite(`🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${gmPlayChannelID})/${msg.author.id}`);
}
async function handleSetPlayersCommand(msg, args) {
  if (msg.channel.guild === undefined) {
    msg.reply(`This command doesn't work via DM. You must be in a server channel.`)
    .catch((e)=>{error.log(e);});
    return;
  }
  logWrite('\x1b[32m [ ==================== handleSetPlayersCommand ================= ]\x1b[0m');
  addHourglass(msg);
  const gmPlayChannelID = await getPlayChannel(msg);
  await ensureTriplet(msg);
  // fixme: Discord has two formats, <@! vs <@
  for (x=0; x < args.length; x++){
    args[x]=args[x].substring(2,args[x].length-1);
    if (args[x].substring(0, 1) == '!')
      args[x] = args[x].substring(1, args[x].length);
  }
  const content = args.join(",");
  const userFolderID = await findUserFolderDBIDFromMsg(msg, true);
  if (userFolderID === -1) return -1;
  await setStringByNameAndParent('gmPlayers', userFolderID, content);
  // remove reaction
  removeHourglass(msg);
  msg.reply(addMaintenanceStatusMessage(msg, ` your group in channel <#${gmPlayChannelID}> is now ${args.length} players.`)).catch((e) => { logError(e); });
  // listAllFiles();
  logWrite(`🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${gmPlayChannelID})/${msg.author.id}`);
}
async function handleAddPlayersCommand(msg, args) {
  if (msg.channel.guild === undefined) {
    msg.reply(`This command doesn't work via DM. You must be in a server channel.`)
    .catch((e)=>{error.log(e);});
    return;
  }
  if (args.length) {
    if (args[0].substring(0,2) !== '<@') {
      msg.reply(addMaintenanceStatusMessage(msg, 
        'This command requires you to "@" people correctly.'
      )).catch((e) => { logError(e); });
      return;
    }
  }
  logWrite('\x1b[32m [ ==================== handleAddPlayersCommand ================= ]\x1b[0m');
  addHourglass(msg);
  const gmPlayChannelID = await getPlayChannel(msg);
  await ensureTriplet(msg);
  let filename = 'gmPlayers';
  const userFolderID = await findUserFolderDBIDFromMsg(msg, true);
  if (userFolderID === -1) return -1;
  // see if the gmPlayers file already exists
  const gmPlayersFileID = await findStringIDByName(filename, userFolderID);
  // get and parse the contents of the file
  try {
    if (gmPlayersFileID !== -1) {
      let oldPlayerString = await getStringContent(gmPlayersFileID);
      let newPlayersArr = [];
      newPlayersArr = oldPlayerString.split(",");
      let tmpArr = [];
      for (let x = 0; x < newPlayersArr.length; x++) {
        if (newPlayersArr[x].length > 0) tmpArr[tmpArr.length] = newPlayersArr[x];
      }
      newPlayersArr = tmpArr;
      // add the new players
      for (x = 0; x < args.length; x++) {
        newPlayersArr[newPlayersArr.length] = args[x].substring(2, args[x].length-1);
        if (newPlayersArr[newPlayersArr.length-1].substring(0,1) == '!') {
          newPlayersArr[newPlayersArr.length-1] = args[x].substring(3, args[x].length-1);
        }
      }
      let newPlayersCount = newPlayersArr.length;
      // format for output/saving
      content = newPlayersArr.join(",");
      // save the new player list
      await setStringByNameAndParent(filename, userFolderID, content);
      msg.reply(addMaintenanceStatusMessage(msg, ` you added ${args.length} players `
      + ` to your group in channel <#${gmPlayChannelID}>;`
      + ` now there are ${newPlayersCount}.`)).catch((e) => { logError(e); });
      removeHourglass(msg);
    } else {
      // if there is no file we fail forward to the !set version of the command
      return handleSetPlayersCommand(msg, args);
    }
  } catch (e) {
    return logError(e);
  }
  logWrite(`🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${gmPlayChannelID})/${msg.author.id}`);
}
async function handleListPlayersCommand(msg) {
  if (msg.channel.guild === undefined) {
    msg.reply(`This command doesn't work via DM. You must be in a server channel.`)
    .catch((e)=>{error.log(e);});
    return;
  }
  logWrite('\x1b[32m [ ==================== handleListPlayersCommand ================ ]\x1b[0m');
  let fileID = -1;
  addHourglass(msg);
  const gmPlayChannelID = await getPlayChannel(msg);
  await ensureTriplet(msg);
  const filename = 'gmPlayers';
  const userFolderID = await findUserFolderDBIDFromMsg(msg, true);
  if (userFolderID === -1) return -1;
  fileID = await findStringIDByName(filename, userFolderID);
  if (fileID === -1) {
    msg.reply(addMaintenanceStatusMessage(msg, 
      `You currently have no group in channel <#${gmPlayChannelID}>.`
    )).catch((e) => { logError(e); });
    removeHourglass(msg);
    return;
  }
  // get contents, parse, and count
  let gmPlayersFileID = fileID;
  logSpam(`userFolderID ${userFolderID}`);
  logSpam('gmPlayersFileID ' + gmPlayersFileID);
  let playersString = await getStringContent(gmPlayersFileID);
  let playersArr = playersString.split(',');
  let tmpArr = [];
  playersArr.forEach((p) => { if (p.length > 0) tmpArr[tmpArr.length] = p; });
  playersArr = tmpArr;
  let output = '';
  // format for discord
  playersArr.forEach((p) => {
    if (p !== '') {
      p = `:arrow_right: <@${p}>`;
      output += `\n${p}`;
    }
  });
  if (playersArr.length == 0)
    msg.reply(addMaintenanceStatusMessage(msg, 
      `You don\'t have a group in channel <#${gmPlayChannelID}> yet.`
    )).catch((e) => { logError(e); });
  else
    msg.reply(addMaintenanceStatusMessage(msg, 
      `Your group in channel <#${gmPlayChannelID}> is ${playersArr.length} `
      + `players strong: ${output}`
    )).catch((e) => { logError(e); });
  logWrite(`🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${gmPlayChannelID})/${msg.author.id}`);
  // remove reaction
  removeHourglass(msg);
}
async function handleRemovePlayersCommand(msg, args) {
  if (msg.channel.guild === undefined) {
    msg.reply(`This command doesn't work via DM. You must be in a server channel.`)
    .catch((e)=>{error.log(e);});
    return;
  }
  logWrite('\x1b[32m [ ==================== handleRemovePlayersCommand ============== ]\x1b[0m');
  addHourglass(msg);
  const gmPlayChannelID = await getPlayChannel(msg);

  let fileID = -1;
  await ensureTriplet(msg);
  const filename = "gmPlayers"
  let userFolderID = await findUserFolderDBIDFromMsg(msg, true);
  if (userFolderID === -1) return -1;
  fileID = await findStringIDByName(filename, userFolderID);
  if (fileID === -1)
    await setStringByNameAndParent(filename, userFolderID, '');
  // now the file surely exists -- redo the find, get the file id
  fileID = await findStringIDByName(filename, userFolderID);
  // get the file's id
  gmPlayersFileID = fileID;
  // get and parse the contents
  let oldContentString = await getStringContent(gmPlayersFileID);
  let contentArray = null;
  if (oldContentString == '') contentArray = [];
  else contentArray = oldContentString.split(",");
  let newContentArray = [];
  // parse the args entries and delete the requested entries
  let removedIndex = [];
  for (let y = 0; y < contentArray.length; y++) {
    for (let x = 0; x < args.length; x++) {
      let remove = args[x].substring(2, args[x].length-1); // <@!user_ID>
      if (remove.substring(0,1) == '!') {
        remove = remove.substring(1, remove.length);
      }
      if (contentArray[y] == remove
        || contentArray[y].length == 0
        || contentArray[y] == ' ') {
        // don't keep it
        removedIndex[removedIndex.length] = y;
      }
    }
  }
  // now rebuild it better
  for (let y = 0; y < contentArray.length; y++) {
    if (removedIndex.indexOf(y) == -1)
      newContentArray[newContentArray.length] = contentArray[y];
  }
  // save, notify, remove hourglass
  let newContentString = newContentArray.join(",");
  await setStringByNameAndParent(filename, userFolderID, newContentString);
  removeHourglass(msg);
  msg.reply(addMaintenanceStatusMessage(msg, 
    `You removed ${removedIndex.length} players. `
    + `You now have ${newContentArray.length} players in channel `
    + `<#${gmPlayChannelID}>.`
  )).catch((e) => { logError(e); });
  logWrite(`🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${gmPlayChannelID})/${msg.author.id}`);
}
async function handleClearPlayersCommand(msg) {
  if (msg.channel.guild === undefined) {
    msg.reply(`This command doesn't work via DM. You must be in a server channel.`)
    .catch((e)=>{error.log(e);});
    return;
  }
  logWrite('\x1b[32m [ ==================== handleClearPlayersCommand =============== ]\x1b[0m');
  addHourglass(msg);
  const gmPlayChannelID = await getPlayChannel(msg);
  await ensureTriplet(msg);
  const filename = 'gmPlayers';
  const parentFolderID = await findUserFolderDBIDFromMsg(msg, true);
  if (parentFolderID === -1) return -1;
  const fileID = await findStringIDByName(filename, parentFolderID);
  deleteStringByID(fileID);
  addToCache({id: fileID, content: ''}, 'fileContent');
  // remove reaction
  removeHourglass(msg);
  msg.reply(addMaintenanceStatusMessage(msg, 
    `Your group for channel <#${gmPlayChannelID}> was reset to 0 players.`
  )).catch((e) => { logError(e); });
  logWrite(`🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${gmPlayChannelID})/${msg.author.id}`);
}
async function handleSetInitCommand(msg, args) {
  if (msg.channel.guild === undefined) {
    msg.reply(`This command doesn't work via DM. You must be in a server channel.`)
    .catch((e)=>{error.log(e);});
    return;
  }
  let errOutput = '';
  let tmpArr = [];
  if (args) {
    // deal with the inevitable player who can't grok pressing a spacebar between fields
    if (args[0] && args.length == 1 && args[0].toLowerCase().indexOf('d6+') !== -1) {
      args[0] = args[0].toLowerCase();
      tmpArr = args[0].split('d6+');
      args = tmpArr;
    }
    // allow the d6 and the +
    if (args[0] && args[0].length) {
      let suspect = args[0].substring(args[0].length-2, args[0].length).toLowerCase();
      if (suspect == 'd6' || suspect == 'D6') {
        args[0] = args[0].substring(0, args[0].length-2);
      }
    }
    if (args && args[1] && args[1].length) {
      let suspect = args[1].substring(0, 1);
      if (suspect == '+') {
        args[1] = args[1].substring(1, args[1].length);
      }
    }
    errOutput = '';
    if (args.length !== 2) {
      errOutput += ':no_entry_sign: Wrong number of options; \n'
        + 'it\'s two numbers separated by a space.\n'
        + 'For example: **!setinit 1 5** for **1**d6 +**5**';
    }
    if (Number(args[0]) != args[0] || (args[1] && Number(args[1]) != args[1])) {
      errOutput += ':no_entry_sign: Wrong type of options; '
        + 'it should be two numbers separated by a space.\n'
        + 'For example: **!setinit 1 5** for **1**d6 +**5**';
    }
  } else {
    errOutput += ':no_entry_sign: Options required; \n'
      + 'two numbers separated by a space.\n'
      + 'For example: **!setinit 1 5** for **1**d6 +**5**'
    }
  // abort if any errors
  if (errOutput !== '') {
    msg.reply(addMaintenanceStatusMessage(msg, `There was a problem.\n${errOutput}`))
    .catch((e) => { logError(e); });
    return;
  }
  // and on to the show
  logWrite('\x1b[32m [ ==================== handleSetInitCommand ==================== ]\x1b[0m');
  addHourglass(msg);
  // serverID.channelID.userID.playerInit STRING
  let content = args.join(" ");
  await ensureTriplet(msg);
  // now get the folderID of the user folder in this channel
  const userFolderID = await findUserFolderDBIDFromMsg(msg);
  if (userFolderID === -1) return -1;
  await setStringByNameAndParent('playerInit', userFolderID, content);
  // reformat for output (better user feedback)
  tmpArr = content.split(" ");
  let output = `${tmpArr[0]}d6 +${tmpArr[1]}`;
  // remove reaction
  removeHourglass(msg);
  msg.reply(addMaintenanceStatusMessage(msg, 
    `Your initiative formula (in this channel) is now ${output}.`
  )).catch((e)=>{ logError(e); });
  logWrite(`🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}/${msg.author.id}`);
}
async function handleSetNPCInitCommand(msg, args) {
  if (msg.channel.guild === undefined) {
    msg.reply(`This command doesn't work via DM. You must be in a server channel.`)
    .catch((e)=>{ logError(e); });
    return;
  }
  args = modifyNPCInput(args);
  if (!validateNPCInput(msg, args)) {
    return;
  }
  // and on to the show
  logWrite('\x1b[32m [ ==================== handleSetNPCInitCommand ================= ]\x1b[0m');
  addHourglass(msg);
  let gmPlayChannelID = await getPlayChannel(msg);
  await ensureTriplet(msg);
  const userFolderID = await findUserFolderDBIDFromMsg(msg, true);
  if (userFolderID === -1) return -1;
  let contentArray = [];
  for (let x = 0; x < args.length; x++) {
    contentArray[contentArray.length] = `${args[x]} ${args[x+1]} ${args[x+2]}`;
    x = x + 2;
  }
  let content = contentArray.join(",");
  await setStringByNameAndParent('gmNPCInit', userFolderID, content);
  // remove reaction
  removeHourglass(msg);
  msg.reply(addMaintenanceStatusMessage(msg, 
    `Your NPC's for this channel were reset, `
    + `and you added ${contentArray.length} NPC's.`
  )).catch((e) => { logError(e); });
  logWrite(`🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${gmPlayChannelID})/${msg.author.id}`);
}
async function handleAddNPCInitCommand(msg, args) {
  if (msg.channel.guild === undefined) {
    msg.reply(`This command doesn't work via DM. You must be in a server channel.`)
    .catch((e)=>{error.log(e);});
    return;
  }
  args = modifyNPCInput(args);
  if (!validateNPCInput(msg, args)) {
    return;
  }
  addHourglass(msg);
  logWrite('\x1b[32m [ ==================== handleAddNPCInitCommand ================= ]\x1b[0m');
  let gmPlayChannelID = await getPlayChannel(msg);
  await ensureTriplet(msg);
  const filename = "gmNPCInit"
  let userFolderID = await findUserFolderDBIDFromMsg(msg, true);
  if (userFolderID === -1) return -1;
  // find the file
  let gmNPCFileID = await findStringIDByName(filename, userFolderID);
  // don't get attached to the id just yet
  if (gmNPCFileID === -1) {
    // create if nonexistent
    await setStringByNameAndParent(filename, userFolderID, '');
  }
  // if it didn't exist the first time, repeat the find
  if (gmNPCFileID === -1)
    gmNPCFileID = await findStringIDByName(filename, userFolderID);
  // now we can have the id
  // get and parse the contents
  let oldContentString = await getStringContent(gmNPCFileID);
  let contentArray = null;
  if (oldContentString == '') contentArray = [];
  else contentArray = oldContentString.split(",");
  // add the new entries
  for (let x = 0; x < args.length; x++) {
    let newNPC = `${args[x]} ${args[x+1]} ${args[x+2]}`;
    contentArray[contentArray.length] = newNPC;
    x = x + 2;
  }
  // save, notify, remove hourglass
  let newContentString = contentArray.join(",");
  setStringByNameAndParent(filename, userFolderID, newContentString);
  removeHourglass(msg);
  msg.reply(addMaintenanceStatusMessage(msg, 
    `You now have ${contentArray.length} NPC's in channel <#${gmPlayChannelID}>.`
  )).catch((e) => { logError(e); });
  logWrite(`🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${gmPlayChannelID})/${msg.author.id}`);
}
async function handleRemoveNPCInitCommand(msg, args) {
  if (msg.channel.guild === undefined) {
    msg.reply(`This command doesn't work via DM. You must be in a server channel.`)
    .catch((e)=>{error.log(e);});
    return;
  }
  logWrite('\x1b[32m [ ==================== handleRemoveNPCInitCommand ============== ]\x1b[0m');
  let fileID = -1;
  addHourglass(msg);
  const gmPlayChannelID = await getPlayChannel(msg);
  await ensureTriplet(msg);
  const filename = "gmNPCInit"
  const userFolderID = await findUserFolderDBIDFromMsg(msg, true);
  if (userFolderID === -1) return -1;
  fileID = await findStringIDByName(filename, userFolderID);
  // ensure the file
  if (fileID === -1) {
    setStringByNameAndParent(filename, userFolderID, '');
    fileID = await findStringIDByName(filename, userFolderID);
  }
  const gmNPCFileID = fileID;
  const oldContentString = await getStringContent(gmNPCFileID);
  let contentArray;
  if (oldContentString === '') contentArray = [];
  else contentArray = oldContentString.split(",");
  const newContentArray = [];
  // parse the args entries and delete the requested entries
  const removedIndex = [];
  for (let y = 0; y < contentArray.length; y++) {
    for (let x = 0; x < args.length; x++) {
      const remove = `${args[x]} ${args[x+1]} ${args[x+2]}`;
      if (contentArray[y] == remove) {
        // don't keep it
        removedIndex[removedIndex.length] = y;
        x = x + 2; // the top of the for() loop does x++; we skip to next trio
      } else {
        // try matching just the label
        caySplitArray = contentArray[y].split(" ");
        if (args[x] !== null && caySplitArray[2] == args[x]) {
          removedIndex[removedIndex.length] = y;
        }
      }
    }
  }
  // now rebuild it better
  for (let y = 0; y < contentArray.length; y++) {
    if (removedIndex.indexOf(y) == -1)
      newContentArray[newContentArray.length] = contentArray[y];
  }
  // save, notify, remove hourglass
  const newContentString = newContentArray.join(",");
  setStringByNameAndParent(filename, userFolderID, newContentString);
  removeHourglass(msg);
  msg.reply(addMaintenanceStatusMessage(msg, 
    `You removed ${removedIndex.length} NPC's. `
    + `You now have ${newContentArray.length} NPC's in channel `
    + `<#${gmPlayChannelID}>.`
  )).catch((e) => { logError(e); });
  logWrite(`🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${gmPlayChannelID})/${msg.author.id}`);
}
async function handleListNPCInitCommand(msg) {
  if (msg.channel.guild === undefined) {
    msg.reply(`This command doesn't work via DM. You must be in a server channel.`)
    .catch((e)=>{error.log(e);});
    return;
  }
  logWrite('\x1b[32m [ ==================== handleListNPCInitCommand ================ ]\x1b[0m');
  addHourglass(msg);
  const gmPlayChannel = await getPlayChannel(msg);
  await ensureTriplet(msg);
  const filename = 'gmNPCInit';
  const parentFolderID = await findUserFolderDBIDFromMsg(msg, true);
  if (parentFolderID === -1) return -1;
  const gmNPCFileID = await findStringIDByName(filename, parentFolderID);
  let output;
  if (gmNPCFileID == -1) {
    // file doesn't exist
    output = "You have no NPC's configured in this channel yet.";
  } else {
    // file exists
    const contentString = await getStringContent(gmNPCFileID);
    let contentArray = contentString.split(",");
    // clean any blank entries
    let tmpArr = [];
    contentArray.forEach((content)=> {
      if (content.length > 0) tmpArr[tmpArr.length] = content;
    });
    contentArray = tmpArr;
    // determine/build output
    if (contentArray.length > 0) {
      // file exists and has NPC's in it
      output = "Your NPC's inits in this channel are:";
      for (let x = 0; x < contentArray.length; x++) {
        let [dice,mod,label] = contentArray[x].split(" ");
        output += `\n:arrow_right: ${dice}d6 +${mod} :label: ${label}`
      }
    } else {
      // file exists but was blank
      output = "You have no NPC's in this channel yet.";
    }
  }
  msg.reply(addMaintenanceStatusMessage(msg, output)).catch((e) => { logError(e); });
  logWrite(`🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${gmPlayChannel})/${msg.author.id}`);
  removeHourglass(msg);
}
async function handleClearNPCInitCommand(msg) {
  if (msg.channel.guild === undefined) {
    msg.reply(`This command doesn't work via DM. You must be in a server channel.`)
    .catch((e)=>{error.log(e);});
    return;
  }
  logWrite('\x1b[32m [ ==================== handleClearNPCInitCommand =============== ]\x1b[0m');
  addHourglass(msg);
  const gmPlayChannelID = await getPlayChannel(msg);
  await ensureTriplet(msg);
  const filename = 'gmNPCInit';
  const parentFolderID = await findUserFolderDBIDFromMsg(msg, true);
  if (parentFolderID === -1) return -1;
  const fileID = await findStringIDByName(filename, parentFolderID);
  if (fileID === -1) return;
  // delete it
  deleteStringByID(fileID);
  addToCache({id: fileID, content: ''}, 'fileContent');
  // remove reaction
  removeHourglass(msg);
  msg.reply(addMaintenanceStatusMessage(msg, 
    'You cleared your NPC initiative formulas for this channel.'
  )).catch((e) => { logError(e); });
  logWrite(`🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${gmPlayChannelID})/${msg.author.id}`);
}
module.exports = {
  handleInitCommand, handleSetGMCommand, handleSetPlayersCommand,
  handleAddPlayersCommand, handleListPlayersCommand,
  handleRemovePlayersCommand, handleClearPlayersCommand,
  handleSetInitCommand, handleSetNPCInitCommand, handleAddNPCInitCommand,
  handleRemoveNPCInitCommand, handleListNPCInitCommand,
  handleClearNPCInitCommand
};
