/*
 * Shadowrun 1e GameBot by Discord user AstroMacGuffin#1486 (Nathan Hawks)
 * https://github.com/NathanHawks/SR1eGameBot
 * Yes I do regret baking 1e into the name
 * version 0.3, yeah that sounds good
 * Released under the terms of the UnLicense. This work is in the public domain.
 * Released as-is with no warranty or claim of usability for any purpose.
 */
async function handleAmmoAddGunSubcommand(msg, cmd, args, user) {
  if (msg.channel.guild === undefined) {
    msg.reply(`This command doesn't work via DM. You must be in a server channel.`)
    .catch((e)=>{error.log(e);});
    return;
  }
  logWrite('\x1b[32m [ ==================== handleAmmoAddGunSubcommand =============== ]\x1b[0m');
  await msg.react('⏳').catch((e) => {console.log(e);});
  var output = '';
  var gun = {
    name: args[1],
    maxROF: args[2],
    ammoContainerType: args[3],
    ammoCapacity: args[4],
    ammoTypeLoaded: 'not loaded',
    ammoQtyLoaded: '0'
  };
  gun.ammoTypes = args;
  gun.ammoTypes.splice(0,5);
  gun.ammoTypes = gun.ammoTypes.join(' ');
  var gunData = `${gun.name},${gun.maxROF},`
    + `${gun.ammoContainerType},${gun.ammoCapacity},${gun.ammoTypeLoaded},`
    + `${gun.ammoQtyLoaded},${gun.ammoTypes}`;
  logSpam(`handleAmmoAddGunSubcommand: ${gunData}`);
  var playChannelID = await getPlayChannel(msg);

  await ensureTriplet(msg);

  var parentFolderID = await findUserDBIDFromMsg(msg, true);

  var filename = 'gunList';
  var fileID = await findStringIDByName(filename, parentFolderID, playChannelID);

  if (fileID === -1) {
    // create file
    await setStringByNameAndParent(msg, filename, parentFolderID, gunData);

    output = ` gun added; you now have 1 gun in channel <#${playChannelID}>.`;
  }
  else {
    // update file
    var content = await getStringContents(fileID, playChannelID);

    // ensure the name is unique
    var guns = content.split('\n');
    var unique = true;
    guns.map((g) => {
      gunArr = g.split(',');
      if (gunArr[0] === gun.name) unique = false;
    });
    if (unique) {
      if (content === '') content = gunData;
      else content = `${content}\n${gunData}`;
      var count = content.split('\n').length
      await setStringByNameAndParent(msg, filename, parentFolderID, content);

      output = ` gun added; you now have ${count} guns in channel <#${playChannelID}>.`;
    }
    else {
      output = ` you can't use the same name for multiple guns and you've `
        + `already used the name **${gun.name}**.`;
    }
  }
  msg.reply(addMaintenanceStatusMessage(output)).catch((e)=>{console.error(e);});
  removeHourglass(msg);
  logWrite(`🎲🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${playChannelID})/${msg.author.id}`);
}
async function handleAmmoDelGunSubcommand(msg, cmd, args, user) {
  if (msg.channel.guild === undefined) {
    msg.reply(`This command doesn't work via DM. You must be in a server channel.`)
    .catch((e)=>{error.log(e);});
    return;
  }
  logWrite('\x1b[32m [ ==================== handleAmmoDelGunSubcommand =============== ]\x1b[0m');
  await msg.react('⏳').catch((e) => {console.log(e);});
  var output = '';
  var gun = {
    name: args[1],
  };
  logSpam(`handleAmmoDelGunSubcommand: ${gun.name}`);
  var playChannelID = await getPlayChannel(msg);

  await ensureTriplet(msg);

  var parentFolderID = await findUserDBIDFromMsg(msg, true);

  var filename = 'gunList';
  var fileID = await findStringIDByName(filename, parentFolderID, playChannelID);

  if (fileID === -1) {
    // create file
    await setStringByNameAndParent(msg, filename, parentFolderID, '');

    output = ` you have no guns to remove in channel <#${playChannelID}>.`;
  }
  else {
    // update file
    var content = await getStringContents(fileID, playChannelID);

    if (content === '') {
      output = ` you have no guns to remove in channel <#${playChannelID}>.`;
    }
    else {

      var guns = content.split('\n');
      var output = '';
      guns.map((g) => {
        var gArr = g.split(',');
        if (gArr[0] !== gun.name) {
          if (output !== '') output += '\n';
          output += gArr.join(',');
        }
      });
      await setStringByNameAndParent(msg, filename, parentFolderID, output);

      var count = 0;
      if (output === '') count = 0;
      else count = output.split('\n').length
      output = ` gun removed; you now have ${count} guns in channel <#${playChannelID}>.`;
    }
  }
  msg.reply(addMaintenanceStatusMessage(output)).catch((e)=>{console.error(e);});
  removeHourglass(msg);
  logWrite(`🎲🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${playChannelID})/${msg.author.id}`);
}
function _ammoContentAsObject(oldAmmosContent) {
  var oldAmmosArray = [];
  var oldAmmos = [];
  var oldAmmosLines = oldAmmosContent.split('\n');
  for (var x = 0; x < oldAmmosLines.length; x++) {
    if (oldAmmosLines[x] !== '') {
      oldAmmosArray[x] = oldAmmosLines[x].split(',');
      oldAmmos[x] = {
        qtyContainers: oldAmmosArray[x][0],
        containerType: oldAmmosArray[x][1],
        qtyRounds: oldAmmosArray[x][2],
        roundType: oldAmmosArray[x][3],
        maxRounds: oldAmmosArray[x][4]
      };
    }
  }
  return oldAmmos;
}
function _mergeNewAmmo(oldAmmosContent, newAmmo) {
  var oldAmmosArray = [];
  var oldAmmos = _ammoContentAsObject(oldAmmosContent);
  logSpam(`_mergeNewAmmo converted content into ${oldAmmos.length} elements`);
  var foundMatch = false;
  for (var x = 0; x < oldAmmos.length; x++) {
    if (
        foundMatch === false
        && oldAmmos[x].containerType === newAmmo.containerType
        && oldAmmos[x].qtyRounds === newAmmo.qtyRounds
        && oldAmmos[x].roundType === newAmmo.roundType
        && oldAmmos[x].maxRounds === newAmmo.maxRounds
    )
    {
      logSpam(`_mergeNewAmmo found a match`);
      foundMatch = true;
      oldAmmos[x].qtyContainers =
        Number(oldAmmos[x].qtyContainers) + Number(newAmmo.qtyContainers);
    }
  }
  if (foundMatch === false) {
    logSpam(`_mergeNewAmmo did not find a match`);
    oldAmmos[oldAmmos.length] = newAmmo;
  }
  logSpam(`_mergeNewAmmo returning array with ${oldAmmos.length} elements`);
  return oldAmmos;
}
function _makeAmmoSaveString(ammos) {
  var saveString = '';
  ammos.map((ammo) => {
    if (
      Number(ammo.qtyContainers) > 0
      && Number(ammo.qtyRounds) > 0
      && ammo.roundType !== 'undefined'
      && ammo.roundType !== undefined
    )
    {
      if (saveString !== '') saveString = `${saveString}\n`;
      saveString = `${saveString}${ammo.qtyContainers},${ammo.containerType},`
      + `${ammo.qtyRounds},${ammo.roundType},${ammo.maxRounds}`
    }
  });
  logSpam(`_makeAmmoSaveString: ${saveString}`);
  return saveString;
}
async function handleAmmoAddAmmoSubcommand(msg, cmd, args, user) {
  if (msg.channel.guild === undefined) {
    msg.reply(`This command doesn't work via DM. You must be in a server channel.`)
    .catch((e)=>{error.log(e);});
    return;
  }
  logWrite('\x1b[32m [ ==================== handleAmmoAddAmmoSubcommand =============== ]\x1b[0m');
  await msg.react('⏳').catch((e) => {console.log(e);});
  var output = '';
  var ammo = {
    qtyContainers: args[1],
    containerType: args[2],
    qtyRounds: args[3],
    roundType: args[4],
    maxRounds: args[5]
  };
  var filename = 'ammoList';
  var ammoData = `${ammo.qtyContainers},${ammo.containerType},${ammo.qtyRounds},`
    + `${ammo.roundType},${ammo.maxRounds}`;
  var playChannelID = await getPlayChannel(msg);

  await ensureTriplet(msg);

  var parentFolderID = await findUserDBIDFromMsg(msg, true);

  var fileID = await findStringIDByName(filename, parentFolderID, playChannelID);

  // create file
  if (fileID === -1) {
    var content = _makeAmmoSaveString([ammo]);
    await setStringByNameAndParent(msg, filename, parentFolderID, content);

    output = ` you added ${ammo.qtyContainers} ${ammo.containerType}s `
      + `(${ammo.qtyRounds}/${ammo.maxRounds} ${ammo.roundType}s) in channel `
      + `<#${playChannelID}>.`;
  }
  // update file
  else {
    var content = await getStringContents(fileID, playChannelID);

    var ammos = _mergeNewAmmo(content, ammo);
    var content = _makeAmmoSaveString(ammos);
    await setStringByNameAndParent(msg, filename, parentFolderID, content);

    output = ` you added ${ammo.qtyContainers} ${ammo.containerType}s `
      + `(${ammo.qtyRounds}/${ammo.maxRounds} ${ammo.roundType}s) in channel `
      + `<#${playChannelID}>.`;
  }
  msg.reply(addMaintenanceStatusMessage(output)).catch((e)=>{console.error(e);});
  removeHourglass(msg);
  logWrite(`🎲🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${playChannelID})/${msg.author.id}`);
}
async function handleAmmoDelAmmoSubcommand(msg, cmd, args, user) {
  if (msg.channel.guild === undefined) {
    msg.reply(`This command doesn't work via DM. You must be in a server channel.`)
    .catch((e)=>{error.log(e);});
    return;
  }
  logWrite('\x1b[32m [ ==================== handleAmmoDelAmmoSubcommand =============== ]\x1b[0m');
  await msg.react('⏳').catch((e) => {console.log(e);});
  var output = '';
  var delAmmo = {
    qtyContainers: args[1],
    containerType: args[2],
    qtyRounds: args[3],
    roundType: args[4],
    maxRounds: args[5]
  };
  var filename = 'ammoList';
  var playChannelID = await getPlayChannel(msg);

  await ensureTriplet(msg);

  var parentFolderID = await findUserDBIDFromMsg(msg, true);

  var fileID = await findStringIDByName(filename, parentFolderID, playChannelID);

  if (fileID === -1) {
    // no ammo to delete
    output = ` you have no ammo to delete in channel <#${playChannelID}>.`;
  }
  else {
    var content = await getStringContents(fileID, playChannelID);

    var oldAmmos = _ammoContentAsObject(content);
    var foundMatch = false;
    for (var x = 0; x < oldAmmos.length; x++) {
      if (
          foundMatch === false
          && oldAmmos[x].containerType === delAmmo.containerType
          && oldAmmos[x].qtyRounds === delAmmo.qtyRounds
          && oldAmmos[x].roundType === delAmmo.roundType
          && oldAmmos[x].maxRounds === delAmmo.maxRounds
      )
      {
        logSpam(`handleAmmoDelAmmoSubcommand found a match`);
        foundMatch = true;
        var hadQty = oldAmmos[x].qtyContainers;
        oldAmmos[x].qtyContainers =
          Number(oldAmmos[x].qtyContainers) - Number(delAmmo.qtyContainers);
        if (oldAmmos[x].qtyContainers < 0) {
          oldAmmos[x].qtyContainers = 0;
          output = ` you only had ${hadQty} of that ammo to begin with; they`
            + ` will be removed.`;
        }
        else {
          output = ` ${delAmmo.qtyContainers} ${delAmmo.containerType}s of`
            + ` ${delAmmo.roundType} (qty ${delAmmo.qtyRounds}/${delAmmo.maxRounds}`
            + ` max) were removed from channel <#${playChannelID}>.`;
        }
        var saveString = _makeAmmoSaveString(oldAmmos);
        await setStringByNameAndParent(msg, filename, parentFolderID, saveString);

      }
    }
  }
  msg.reply(addMaintenanceStatusMessage(output)).catch((e)=>{console.error(e);});
  removeHourglass(msg);
  logWrite(`🎲🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${playChannelID})/${msg.author.id}`);
}
function _gunsContentAsObject(content) {
  var gunsLines = content.split('\n');
  var gunsArr = [];
  if (content !== '') {
    for (var x = 0; x < gunsLines.length; x++) {
      g = gunsLines[x].split(',');
      gunsArr[x] = {
        name: g[0],
        maxROF: g[1],
        ammoContainerType: g[2],
        ammoCapacity: g[3],
        ammoTypeLoaded: g[4],
        ammoQtyLoaded: g[5],
        ammoTypes: g[6]
      };
    }
  }
  return gunsArr;
}
async function handleAmmoListSubcommand(msg, cmd, args, user) {
  if (msg.channel.guild === undefined) {
    msg.reply(`This command doesn't work via DM. You must be in a server channel.`)
    .catch((e)=>{error.log(e);});
    return;
  }
  logWrite('\x1b[32m [ ==================== handleAmmoListSubcommand =============== ]\x1b[0m');
  await msg.react('⏳').catch((e) => {console.log(e);});
  var filename = 'ammoList';
  var playChannelID = await getPlayChannel(msg);

  await ensureTriplet(msg);

  var parentFolderID = await findUserDBIDFromMsg(msg, true);

  var fileID = await findStringIDByName(filename, parentFolderID, playChannelID);

  var ammos = [];
  if (fileID !== -1) {
    var content = await getStringContents(fileID, playChannelID);

    ammos = _ammoContentAsObject(content);
  }
  filename = 'gunList';
  fileID = await findStringIDByName(filename, parentFolderID, playChannelID);

  var guns = [];
  if (fileID !== -1) {
    var content = await getStringContents(fileID, playChannelID);

    guns = _gunsContentAsObject(content);
  }
  var output = '\n***==[ GUNS ]==***\n';
  if (guns.length === 0) {
    output += `You have no guns setup yet in channel <#${playChannelID}>.\n`;
  }
  else {
    for (var x = 0; x < guns.length; x++) {
      output += `:arrow_right: **${guns[x].name}** ${guns[x].ammoContainerType} `
        + `(${guns[x].ammoCapacity}), ROF: ${guns[x].maxROF}, Ammo type(s): `
        + `${guns[x].ammoTypes.split(' ').join('/')}, `;
      if (guns[x].ammoTypeLoaded == 'not loaded') {
        output += `**Not loaded**\n`
      }
      else {
        output += `Loaded with ${guns[x].ammoQtyLoaded} ${guns[x].ammoTypeLoaded}s\n`;
      }
    }
  }
  output += '***==[ AMMO ]==***\n';
  if (ammos.length === 0) {
    output += `You have no ammo setup yet in channel <#${playChannelID}>.\n`;
  }
  else {
    var hasAmmo = false;
    for (var x = 0; x < ammos.length; x++) {
      if (
        Number(ammos[x].qtyContainers) > 0
        && Number(ammos[x].qtyRounds) > 0
      )
      {
        hasAmmo = true;
        output += `:arrow_right: ${ammos[x].qtyContainers} ${ammos[x].containerType}s `
        + `of ${ammos[x].roundType} with ${ammos[x].qtyRounds} rounds (max `
          + `${ammos[x].maxRounds})\n`;
      }
    }
    if (hasAmmo === false) output += `All your ammo containers are empty.\n`;
  }
  msg.reply(addMaintenanceStatusMessage(output)).catch((e)=>{console.error(e);});
  removeHourglass(msg);
  logWrite(`🎲🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${playChannelID})/${msg.author.id}`);
}
function _makeGunSaveString(guns) {
  var gunData = '';
  for (var x = 0; x < guns.length; x++) {
    var gun = guns[x];
    if (gunData !== '') gunData += '\n';
    gunData += `${gun.name},${gun.maxROF},`
      + `${gun.ammoContainerType},${gun.ammoCapacity},${gun.ammoTypeLoaded},`
      + `${gun.ammoQtyLoaded},${gun.ammoTypes}`;
  }
  logSpam(`_makeGunSaveString: ${gunData}`);
  return gunData;
}
async function handleAmmoFireSubcommand(msg, cmd, args, user) {
  if (msg.channel.guild === undefined) {
    msg.reply(`This command doesn't work via DM. You must be in a server channel.`)
    .catch((e)=>{error.log(e);});
    return;
  }
  logWrite('\x1b[32m [ ==================== handleAmmoFireSubcommand =============== ]\x1b[0m');
  await msg.react('⏳').catch((e) => {console.log(e);});
  var output = '';
  var gunFired = args[1];
  var nbrShots = args[2];
  var filename = 'gunList';
  var guns = [];
  var gun = {}; // contains a match from guns, if any; the gun being fired
  var playChannelID = await getPlayChannel(msg);

  await ensureTriplet(msg);

  var parentFolderID = await findUserDBIDFromMsg(msg, true);

  var fileID = await findStringIDByName(filename, parentFolderID, playChannelID);

  if (fileID === -1) {
    output = ` you have no guns setup yet in channel <#${playChannelID}>.`;
  }
  else {
    var content = await getStringContents(fileID, playChannelID);

    guns = _gunsContentAsObject(content);
    for (var x = 0; x < guns.length; x++) {
      if (guns[x].name === gunFired) gun = guns[x];
    }
    if (gun === {}) {
      output = ` I couldn't find a gun named ${gunFired} in your list of guns `
        + `in channel <#${playChannelID}>.`;
    }
    else if (gun.ammoTypeLoaded === 'not loaded') {
      output = ` weapon **${gunFired}** is not loaded!`;
    }
    else if (Number(gun.maxROF) < Number(nbrShots)) {
      output = ` this gun's maximum rate of fire is only ${gun.maxROF}.`
        + ` Try firing again with a valid number of shots.`;
    }
    else {
      if (Number(gun.ammoQtyLoaded) < Number(nbrShots)) {
        output = ` you fired ${gun.ammoQtyLoaded} ${gun.ammoTypeLoaded}s from `
          + `your ${gunFired} before the weapon clicked empty.`;
        gun.ammoQtyLoaded = 0;
        gun.ammoTypeLoaded = 'not loaded';
      }
      else {
        output = ` you fired ${nbrShots} ${gun.ammoTypeLoaded}s from your `
          + `${gunFired}.`;
        gun.ammoQtyLoaded = Number(gun.ammoQtyLoaded) - Number(nbrShots);
      }
      // save the gunList now that some ammo has been removed
      for (var x = 0; x < guns.length; x++) {
        if (guns[x].name === gunFired) guns[x] = gun;
      }
      var saveString = _makeGunSaveString(guns);
      await setStringByNameAndParent(msg, filename, parentFolderID, saveString);

    }
  }
  msg.reply(addMaintenanceStatusMessage(output)).catch((e)=>{console.error(e);});
  removeHourglass(msg);
  logWrite(`🎲🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${playChannelID})/${msg.author.id}`);
}
async function handleAmmoReloadSubcommand(msg, cmd, args, user) {
  if (msg.channel.guild === undefined) {
    msg.reply(`This command doesn't work via DM. You must be in a server channel.`)
    .catch((e)=>{error.log(e);});
    return;
  }
  logWrite('\x1b[32m [ ==================== handleAmmoReloadSubcommand =============== ]\x1b[0m');
  await msg.react('⏳').catch((e) => {console.log(e);});
  var output = '';
  if (args[1] === undefined || args.length === 1) {
    output = ` you need to specify a weapon to reload.`
    msg.reply(addMaintenanceStatusMessage(output)).catch((e)=>{console.error(e);});
    removeHourglass(msg);
    logWrite(`🎲🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${playChannelID})/${msg.author.id}`);
    return;
  }
  var gunReloading = args[1];
  var ammoReloading = (args.length === 3) ? args[2] : undefined;
  var filename = 'ammoList';
  var ammoPartial = {};
  var gun = {};
  var playChannelID = await getPlayChannel(msg);

  await ensureTriplet(msg);

  var parentFolderID = await findUserDBIDFromMsg(msg, true);

  var fileID = await findStringIDByName(filename, parentFolderID, playChannelID);

  var ammos = [];
  if (fileID !== -1) {
    var content = await getStringContents(fileID, playChannelID);

    ammos = _ammoContentAsObject(content);
  }
  filename = 'gunList';
  fileID = await findStringIDByName(filename, parentFolderID, playChannelID);

  var guns = [];
  if (fileID !== -1) {
    logSpam(`Loading guns content`);
    var content = await getStringContents(fileID, playChannelID);

    guns = _gunsContentAsObject(content);
  }
  if (guns.length === 0) {
    output = ` you have no gun to reload.`;
  }
  else if (ammos.length === 0) {
    output = ` you have no ammo to reload with.`;
  }
  else {
    gun = {}; // will contain the match from guns
    logSpam(`Seeking gun match`);
    for (var x = 0; x < guns.length; x++) {
      if (guns[x].name.toLowerCase() === gunReloading.toLowerCase()) {
        logSpam(`Gun match found`);
        gun = guns[x];
      }
    }
    if (gun === {}) {
      output = ` the gun name ${gunReloading} did not match any gun you have `
        + `setup in channel <#${playChannelID}>.`;
    }
    else {
      // we have a gun match; try to match ammo
      var ammoMatches = []; // multiple matches
      var ammo = {}; // single match
      for (var x = 0; x < ammos.length; x++) {
        if (
          ammos[x].containerType === gun.ammoContainerType
          && ammos[x].maxRounds === gun.ammoCapacity
          && gun.ammoTypes.split(' ').indexOf(ammos[x].roundType) > -1
          && Number(ammos[x].qtyRounds) > 0
          && Number(ammos[x].qtyContainers) > 0
        )
        {
          logSpam(`Ammo match found`);
          logSpam(`${gun.ammoCapacity} === ${ammos[x].maxRounds}`);
          ammoMatches[ammoMatches.length] = ammos[x];
        }
      }
      if (ammoMatches.length === 0) {
        output = ` you have no ammo compatible with this gun.`;
      }
      else if (ammoMatches.length > 1 && ammoReloading === undefined) {
        // first determine if the ammo types are all the same
        var multiTypes = false;
        var firstType = '';
        for (var x = 0; x < ammoMatches.length; x++) {
          if (firstType === '') { firstType = ammoMatches[x].roundType; }
          else if (ammoMatches[x].roundType !== firstType) { multiTypes = true; }
        }
        if (multiTypes) {
          // if they are not all the same type, the user must specify
          output = ` multiple ammo entries with different round types are `
            + `compatible with this gun, so you `
            + `must specify which round type you want to reload.`;
        }
        else {
          // if they are all the same ammo type, use the most full container
          for (var x = 0; x < ammoMatches.length; x++) {
            if (ammo === {}) ammo = ammoMatches[x];
            else if (Number(ammo.qtyRounds) < Number(ammoMatches[x].qtyRounds)) {
              ammo = ammoMatches[x];
            }
          }
          output = ` your weapon was reloaded.`;
        }
      }
      else if (ammoMatches.length === 1) {
        // we have a match
        ammo = ammoMatches[0];
        logSpam(`Single ammo match found`);
      }
      else if (ammoReloading !== undefined) {
        // make sure there's a match with the ammo type in ammoReloading
        for (var x = 0; x < ammoMatches.length; x++) {
          // use the compatible container with the most rounds in it
          if (ammoMatches[x].roundType === ammoReloading) {
            logSpam(`Trying specific type of round: ${ammoReloading}`);
            if (ammo === {} || ammo.roundType === undefined) {
              logSpam('Setting ammo var because it is empty');
              ammo = ammoMatches[x];
            }
            else if (Number(ammo.qtyRounds < Number(ammoMatches[x].qtyRounds))) {
              logSpam('Setting ammo var because we found a more-full container');
              ammo = ammoMatches[x];
            }
          }
        }
        output = ` your weapon was reloaded.`;
      }
      if (ammo !== {} && ammo.roundType !== undefined) {
        logSpam(`Proceeding with singular ammo match`);
        // deplete the 1 container being injected into the gun from the ammo list
        var foundMatch = false;
        for (var x = 0; x < ammos.length; x++) {
          if (
            foundMatch === false
            && ammos[x].containerType === ammo.containerType
            && ammos[x].qtyRounds === ammo.qtyRounds
            && ammos[x].roundType === ammo.roundType
            && ammos[x].maxRounds === ammo.maxRounds
            && ammos[x].qtyContainers > 0
          )
          {
            foundMatch = true;
            ammos[x].qtyContainers = Number(ammos[x].qtyContainers) - 1;
          }
        }
        if (gun.ammoTypeLoaded !== 'not loaded') {
          // eject any remaining rounds from the gun and save as an ammo entry
          ammoPartial = {
            qtyContainers: 1,
            containerType: gun.ammoContainerType,
            qtyRounds: gun.ammoQtyLoaded,
            roundType: gun.ammoTypeLoaded,
            maxRounds: gun.ammoCapacity
          };
          ammoContentString = _makeAmmoSaveString(ammos);
          ammos = _mergeNewAmmo(ammoContentString, ammoPartial);
        }
        var ammoSaveString = _makeAmmoSaveString(ammos);
        await setStringByNameAndParent(msg, 'ammoList', parentFolderID, ammoSaveString);

        // reload the weapon
        gun.ammoQtyLoaded = ammo.qtyRounds;
        gun.ammoTypeLoaded = ammo.roundType;
        for (var x = 0; x < guns.length; x++) {
          if (guns[x].name === gun.name) {
            guns[x] = gun;
          }
        }
        // save the ammo list and the gun list
        logSpam(`Attempting to save gunList`);
        filename = 'gunList';
        var saveString = _makeGunSaveString(guns);
        logSpam(`saveString\n${saveString}`);
        await setStringByNameAndParent(msg, filename, parentFolderID, saveString);
        while (isDiskLockedForChannel(playChannelID)) { sleep(15); }
        logSpam(`Attempting to save ammoList`);
        filename = 'ammoList';
        saveString = _makeAmmoSaveString(ammos);
        logSpam(`saveString\n${saveString}`);
        await setStringByNameAndParent(msg, filename, parentFolderID, saveString);
        while (isDiskLockedForChannel(playChannelID)) { sleep(15); }
        output = ` your weapon was reloaded.`;
      }
    }
  }
  msg.reply(addMaintenanceStatusMessage(output)).catch((e)=>{console.error(e);});
  removeHourglass(msg);
  logWrite(`🎲🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}(${playChannelID})/${msg.author.id}`);
}
async function handleAmmoCommand(msg, cmd, args, user) {
    var sub = args[0];
    switch (sub.toLowerCase()) {
      case 'addgun':
        handleAmmoAddGunSubcommand(msg, cmd, args, user);
      break;
      case 'delgun':
        handleAmmoDelGunSubcommand(msg, cmd, args, user);
      break;
      case 'addammo':
        handleAmmoAddAmmoSubcommand(msg, cmd, args, user);;
      break;
      case 'delammo':
        handleAmmoDelAmmoSubcommand(msg, cmd, args, user);
      break;
      case 'list':
        handleAmmoListSubcommand(msg, cmd, args, user);
      break;
      case 'fire':
        handleAmmoFireSubcommand(msg, cmd, args, user);
      break;
      case 'reload':
        handleAmmoReloadSubcommand(msg, cmd, args, user);
      break;
      default:
      break;
    }
}
module.exports = {
  handleAmmoAddGunSubcommand, handleAmmoDelGunSubcommand,
  handleAmmoAddAmmoSubcommand, handleAmmoDelAmmoSubcommand,
  handleAmmoListSubcommand, handleAmmoFireSubcommand,
  handleAmmoReloadSubcommand, handleAmmoCommand
};
