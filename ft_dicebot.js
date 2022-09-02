/*
 * Shadowrun 1e GameBot by Discord user AstroMacGuffin#1486 (Nathan Hawks)
 * https://github.com/NathanHawks/SR1eGameBot
 * Yes I do regret baking 1e into the name
 * version 0.3, yeah that sounds good
 * Released under the terms of the UnLicense. This work is in the public domain.
 * Released as-is with no warranty or claim of usability for any purpose.
 */
function handleRollCommand(msg, cmd, args, user, override=null) {
  // allow multiple roll commands separated by semicolon
  let cmdArr = null;
  if (override !== null) cmdArr = override.split(";");
  else cmdArr = msg.content.split(";");
  let output = '';
  for (let x = 0; x < cmdArr.length; x++) {
    if (output !== '') output += `\nRoll #${x+1}: `;
    // kill preceding or trailing space before it kills my parsing
    cmdArr[x] = cmdArr[x].trim();
    args = cmdArr[x].split(' ');
    cmd = args[0];
    args = args.splice(1);
    cmd = cmd.toLowerCase();
    if (cmd.substring(0, 1) === '!') cmd = cmd.substring(1);
    // SETUP: how many dice, and do we explode?
    let isTestBool = false;
    let isTotalBool = false;
    let numDiceInt = 0;
    let lastchar = lastChar(cmd);
    let modifier = 0;
    if (lastchar == '!') {
      isTestBool = true;
      numDiceInt = cmd.substring(0, cmd.length-1);
    } else if (lastchar == 't') {
      isTotalBool = true;
      numDiceInt = cmd.substring(0, cmd.length-1);
      // look for a modifier
      modifier = getModifierFromArgs(args);
    }
    else {
      numDiceInt = cmd.substring(0, cmd.length);
    }

    // SETUP: was a TN given?
    let tnInt = getTNFromArgs(args);

    // SETUP: is this an opposed roll?
    let retarr = getOpposedSetupArr(args);
    let isOpposedBool = retarr[0];
    let opponentDiceInt = retarr[1];
    let opponentTNInt = retarr[2];
    let isOpposedTestBool = retarr[3];
    if (isOpposedTestBool === true && opponentTNInt === -1) {
      msg.reply(addMaintenanceStatusMessage(":no_entry_sign: you ordered an opposed test without an "
      + "opponent TN (the **otn** option).\nExample: **!6! tn4 vs5! *otn4***"))
      .catch((e) => { logError(e); });
      return;
    }

    // SETUP: anything remaining is a note; prepare to pass it thru
    let note = prepRollNote(cmd, args, tnInt);

    // GO: Roll the bones ============================================
    let retarr = rollDice(numDiceInt, isTestBool, tnInt);
    let successesInt = retarr[0];
    let rollsIntArr = retarr[1];
    // handle opposed roll
    if (isOpposedBool) {
      let retarr = rollDice(opponentDiceInt, isOpposedTestBool, opponentTNInt);
      let opponentSuccessesInt = retarr[0];
      let opponentRollsIntArr = retarr[1];
    }
    // prep output and deliver it ====================================
    // handle total'd roll
    if (isTotalBool) {
      let total = 0;
      rollsIntArr.map((roll)=>{total+=roll;})
      if (modifier) total += modifier;
      output += `[Total: ${total}] | `;
    }
    if (isOpposedBool) {
      output += makeOpposedOutput(isOpposedBool, successesInt,
        opponentSuccessesInt, user, rollsIntArr, opponentRollsIntArr, note
      );
    }
    else {
      let successesFormattedString = "";
      if (successesInt > 0) {
        successesFormattedString = successesInt + ' successes ';
      }
      output += user + ', you rolled ' + successesFormattedString
      + '(' +rollsIntArr+ ') ' + note;
    }
    // end of for cmdArr loop
  }
  // avoid false positives e.g. when chatting about Astral Tabeltop dice formats
  if (numDiceInt > 0) {
    // modify output for maintenance mode status
    output = addMaintenanceStatusMessage(output);
    // post results
    msg.channel.send(output).catch((e) => { logError(e); });
    // log activity
    logWrite('🎲');
    // provide reroll ui (dice reaction)
    msg.react('🎲').catch((e) => { logError(e); });
    // no return
  }

}
module.exports = {
  handleRollCommand
}
