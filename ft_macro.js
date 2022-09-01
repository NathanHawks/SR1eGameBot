/*
 * Shadowrun 1e GameBot by Discord user AstroMacGuffin#1486 (Nathan Hawks)
 * https://github.com/NathanHawks/SR1eGameBot
 * Yes I do regret baking 1e into the name
 * version 0.3, yeah that sounds good
 * Released under the terms of the UnLicense. This work is in the public domain.
 * Released as-is with no warranty or claim of usability for any purpose.
 */
 async function handleSaveMacroCommand(msg, cmd, args, user) {
   if (msg.channel.guild === undefined) {
     msg.reply(`This command doesn't work via DM. You must be in a server channel.`)
     .catch((e)=>{error.log(e);});
     return;
   }
   if (args.length < 2)
     return msg.reply(addMaintenanceStatusMessage(':no_entry_sign: Not enough options. Needs a name followed by any valid dice roll command.'))
     .catch((e) => {console.log(e);});
   logWrite('\x1b[32m [ ==================== handleSaveMacroCommand ================== ]\x1b[0m');
   await msg.react('⏳').catch((e) => {console.log(e);});
   await ensureTriplet(msg);
   var auth = global.auth;
   var drive = google.drive({version: 'v3', auth});
   var filename = 'savedRolls';
   var parentFolderID = -1;
   var savedRollsFileID = -1;
   var savedRollsStr = '';
   var savedRollsArr = [];
   var savedRollsNames = [];
   var inputName = args[0];
   var inputRoll = args;
   inputRoll.splice(0, 1);
   inputRoll = inputRoll.join(" ");
   var formattedEntry = `${inputName} ${inputRoll}`;
   // console.log(`inputName=${inputName} & inputRoll=${inputRoll}`);

   parentFolderID = await findUserDBIDFromMsg(msg);
   savedRollsFileID = await findStringIDByName(filename, parentFolderID, msg.channel.id);

   if (savedRollsFileID !== -1) {
     // get existing file content
     savedRollsStr = await getStringContents(savedRollsFileID, msg.channel.id);

     if (savedRollsStr) {
       savedRollsArr = savedRollsStr.split("\n");
       // get an index of name per line
       savedRollsArr.map((macro)=>{
         var tmpArr = macro.split(" ");
         savedRollsNames[savedRollsNames.length] = tmpArr[0];
       });
       var found = false;
       var i = savedRollsNames.indexOf(inputName);
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
     await setStringByNameAndParent(msg, filename, parentFolderID, savedRollsStr);

   }
   else {
     // savedRolls file didn't exist; initialize it with this roll macro
     savedRollsArr = [formattedEntry];
     savedRollsStr = savedRollsArr.join("\n");
     await setStringByNameAndParent(msg, filename, parentFolderID, savedRollsStr);

   }
   msg.reply(addMaintenanceStatusMessage(` you now have ${savedRollsArr.length} roll macros saved.`))
   .catch((e) => {console.log(e);});
   logWrite(`🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}/${msg.author.id}`);
   removeHourglass(msg);
 }
 async function handleRollMacroCommand(msg, cmd, args, user) {
   if (msg.channel.guild === undefined) {
     msg.reply(`This command doesn't work via DM. You must be in a server channel.`)
     .catch((e)=>{error.log(e);});
     return;
   }
   // coexist with Dice Maiden;
   // hat tip https://stackoverflow.com/questions/43564985/regex-for-dice-rolling-system-and-capturing-using-javascript
   var argsString = args.join(' ');
   var argsStringMatches = argsString.match(/(\d*)(D\d*)((?:[+*-](?:\d+|\([A-Z]*\)))*)(?:\+(D\d*))?/i);
   if (!argsStringMatches && argsStringMatches.length > 0) {
     logSpam(`Coexisting with Dice Maiden (by ignoring !roll ${argsString})`);
     return;
   }
   if (args.length < 1)
     return msg.reply(addMaintenanceStatusMessage(':no_entry_sign: You didn\'t specify which macro I should roll.'))
     .catch((e) => {console.log(e);});
   logWrite('\x1b[32m [ ==================== handleRollMacroCommand ================== ]\x1b[0m');
   await msg.react('⏳').catch((e) => {console.log(e);});
   await ensureTriplet(msg);
   var auth = global.auth;
   var drive = google.drive({version: 'v3', auth});
   var filename = 'savedRolls';
   var parentFolderID = -1;
   var savedRollsFileID = -1;
   var savedRollsStr = '';
   var savedRollsArr = [];
   var savedRollsNames = [];
   var inputName = args[0];

   parentFolderID = await findUserDBIDFromMsg(msg);
   savedRollsFileID = await findStringIDByName(filename, parentFolderID, msg.channel.id);

   if (savedRollsFileID !== -1) {
     // get existing file content
     savedRollsStr = await getStringContents(savedRollsFileID, msg.channel.id);

     if (savedRollsStr) {
       savedRollsArr = savedRollsStr.split("\n");
       // get an index of name per line
       savedRollsArr.map((macro)=>{
         var tmpArr = macro.split(" ");
         savedRollsNames[savedRollsNames.length] = tmpArr[0];
       });
       var i = savedRollsNames.indexOf(inputName);
       if (i !== -1) {
         // found it; roll it
         var roll = savedRollsArr[i];
         roll = roll.split(" ");
         cmd = roll[1];
         // be nice if they add the preceding bang, i do it constantly
         if (cmd.substring(0,1) !== '!') cmd = `!${cmd}`;
         roll.splice(0, 2);
         args = roll;
         //console.log(`cmd: ${cmd} & args: ${args}`);
         var newContent = `${cmd} ${args.join(" ")}`;
         logSpam(newContent);
         handleRollCommand(msg, cmd, args, user, newContent);
         removeHourglass(msg);
       }
     }
   }
   else {
     // savedRolls file didn't exist
     msg.reply(addMaintenanceStatusMessage(" you don't have any saved macros in this channel yet."))
     .catch((e) => {console.log(e);});
   }
   logWrite(`🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}/${msg.author.id}`);
   removeHourglass(msg);
 }
 async function handleRemoveMacroCommand(msg, cmd, args, user) {
   if (msg.channel.guild === undefined) {
     msg.reply(`This command doesn't work via DM. You must be in a server channel.`)
     .catch((e)=>{error.log(e);});
     return;
   }
   if (args.length < 1)
     return msg.reply(addMaintenanceStatusMessage(':no_entry_sign: You didn\'t specify which macro I should remove.'))
     .catch((e) => {console.log(e);});
   logWrite('\x1b[32m [ ==================== handleRemoveMacroCommand ================ ]\x1b[0m');
   await msg.react('⏳').catch((e) => {console.log(e);});
   await ensureTriplet(msg);
   var auth = global.auth;
   var drive = google.drive({version: 'v3', auth});
   var filename = 'savedRolls';
   var parentFolderID = -1;
   var savedRollsFileID = -1;
   var savedRollsStr = '';
   var savedRollsArr = [];
   var savedRollsNames = [];
   var inputName = args[0];

   parentFolderID = await findUserDBIDFromMsg(msg);
   savedRollsFileID = await findStringIDByName(filename, parentFolderID, msg.channel.id);

   if (savedRollsFileID !== -1) {
     // get existing file content
     savedRollsStr = await getStringContents(savedRollsFileID, msg.channel.id);

     if (savedRollsStr) {
       savedRollsArr = savedRollsStr.split("\n");
       // get an index of name per line
       savedRollsArr.map((macro)=>{
         var tmpArr = macro.split(" ");
         savedRollsNames[savedRollsNames.length] = tmpArr[0];
       });
       var i = savedRollsNames.indexOf(inputName);
       if (i !== -1) {
         // found it; remove it
         savedRollsArr.splice(i, 1);
         savedRollsStr = savedRollsArr.join("\n");
         await setStringByNameAndParent(msg, filename, parentFolderID, savedRollsStr);

         msg.reply(addMaintenanceStatusMessage(`Removed the macro; `
           + `you now have ${savedRollsArr.length} macros saved in this channel.`))
           .catch((e) => {console.log(e);});
         removeHourglass(msg);
       } else
         msg.reply(addMaintenanceStatusMessage('That name didn\'t match any of your saved macros in this channel.'))
         .catch((e) => {console.log(e);});
     }
     else {
       // file exists but is empty
       msg.reply(addMaintenanceStatusMessage(" you don't have any saved macros in this channel yet."))
       .catch((e) => {console.log(e);});
     }
   }
   else {
     // savedRolls file didn't exist
     msg.reply(addMaintenanceStatusMessage(" you don't have any saved macros in this channel yet."))
     .catch((e) => {console.log(e);});
   }
   logWrite(`🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}/${msg.author.id}`);
   removeHourglass(msg);
 }
 async function handleListMacrosCommand(msg, cmd, args, user) {
   if (msg.channel.guild === undefined) {
     msg.reply(`This command doesn't work via DM. You must be in a server channel.`)
     .catch((e)=>{error.log(e);});
     return;
   }
   logWrite('\x1b[32m [ ==================== handleListMacrosCommand ================= ]\x1b[0m');
   await msg.react('⏳').catch((e) => {console.log(e);});
   await ensureTriplet(msg);
   var filename = 'savedRolls';
   var parentFolderID = -1;
   var savedRollsFileID = -1;
   var savedRollsStr = '';
   var savedRollsArr = [];
   var savedRollsNames = [];
   var output = '';

   parentFolderID = await findUserDBIDFromMsg(msg);
   savedRollsFileID = await findStringIDByName(filename, parentFolderID, msg.channel.id);
   logSpam('Found file ID: ' + savedRollsFileID);

   if (savedRollsFileID !== -1) {
     // get existing file content
     savedRollsStr = await getStringContents(savedRollsFileID, msg.channel.id);

     if (savedRollsStr) {
       savedRollsArr = savedRollsStr.split("\n");
       // get an index of name per line
       savedRollsArr.map((macro)=>{
         var tmpArr = macro.split(" ");
         var name = tmpArr[0];
         tmpArr.splice(0, 1);
         var tmpStr = tmpArr.join(" ");
         var macro = tmpStr;
         output += `***${name}*** :arrow_right: ${macro}\n`;
       });
       msg.reply(addMaintenanceStatusMessage(` you have the following macros in this channel:\n${output}`))
       .catch((e) => {console.log(e);});
     }
     else {
       // file exists but is empty
       msg.reply(addMaintenanceStatusMessage(" you don't have any saved macros in this channel yet."))
       .catch((e) => {console.log(e);});
     }
   }
   else {
     // savedRolls file didn't exist
     msg.reply(addMaintenanceStatusMessage(" you don't have any saved macros in this channel yet."))
     .catch((e) => {console.log(e);});
   }
   logWrite(`🎲🎲 ${msg.channel.guild.id}/${msg.channel.id}/${msg.author.id}`);
   removeHourglass(msg);
 }
 module.exports = {
   handleSaveMacroCommand, handleRollMacroCommand, handleRemoveMacroCommand,
   handleListMacrosCommand
 };
