// The dice-rolling function
function d6(explode=false) {
    var roll = Math.floor(Math.random() * 6 + 1);
    if (roll == 6 && explode == true) roll += d6(true);
    return roll;
}

function firstTwoLC(ofWhat) {
  var r = ofWhat.substring(0,2);
  r = r.toLowerCase();
  return r;
}
function firstThreeLC(ofWhat) {
  var r = ofWhat.substring(0,3);
  r = r.toLowerCase();
  return r;
}
function lastChar(ofWhat) {
  var r = ofWhat.substring(ofWhat.length-1, ofWhat.length);
  return r;
}
/* Credit to
  stackoverflow.com/questions/1063007/how-to-sort-an-array-of-integers-correctly
*/
function sortNumberDesc(a, b) { return b - a; }

// Libs
// disabled: var Discord = require('discord.io');
const Discord = require('discord.js'); // new hotness
var logger = require('winston'); // why not

// load auth token (this must be configured in heroku)
var token = null;
if (process.env.hasOwnProperty('TOKEN')) { token = process.env.TOKEN; }
else {
  var auth = require('./auth.json');
  token = auth.token;
}

// Configure logger
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console, { colorize: true });
logger.level = 'debug';

// Connect to Discord
var bot = new Discord.Client();
bot.login(token);

bot.on('ready', () => {
    logger.info('Connected; Logged in as: ['+ bot.user.tag + ']');
    bot.user.setPresence({game:{name:'!help for help'}});
});

// Setup reaction handler
bot.on('messageReactionAdd', (reaction, user) => {
  if ((reaction.emoji == '🎲' || reaction.emoji == 'game_die' ||
        reaction.emoji == ':game_die:') && user.username !== 'GameBot') {
    handleMessage(reaction.message, user);
  }
});

function handleRollCommand(msg, cmd) {
  // provide reroll ui (dice reaction)
  msg.react('🎲');
  // get setup ===================================
  // SETUP: how many dice, and do we explode?
  var lastchar = lastChar(cmd);
  var isTest = false;
  var howmany = 0;
  if (lastchar == '!') {
    isTest = true;
    howmany = cmd.substring(0, cmd.length-1);
  }
  else {
    howmany = cmd.substring(0, cmd.length);
  }
  // SETUP: was a TN given?
  var tn = -1;
  for (x = 0; x < args.length; x++) {
    var firsttwo = firstTwoLC(args[x]);
    if (firsttwo == 'tn') {
      tn = args[x].substring(2, args[x].length);
      if (isNaN(Number(tn)) || tn < 2) {
        var y = x + 1;
        var tmptn = args[y];
        if (!isNaN(Number(tmptn)) && tmptn > 1) tn = tmptn;
        else tn = -1;
       }
    }
  }
  // SETUP: is this an opposed roll?
  var isOpposedBool = false;
  var opponentDiceInt = -1;
  var opponentTNInt = -1;
  var isOpposedTestBool = false;
  for (x = 0; x < args.length; x++) {
    var firsttwo = firstTwoLC(args[x]);
    var firstthree = firstThreeLC(args[x]);
    if (firsttwo == 'vs' && args[x].length > 2 && firstthree !== "vs.") {
      isOpposedBool = true;
      var lastchar = lastChar(args[x]);
      if (lastchar == '!') {
        isOpposedTestBool = true;
        opponentDiceInt = args[x].substring(2, args[x].length-1);
      }
      else {
        opponentDiceInt = args[x].substring(2, args[x].length);
      }
    }
    else if (firstthree == 'otn') {
      opponentTNInt = args[x].substring(3, args[x].length);
    }
    if (isNaN(Number(opponentTNInt)) || opponentTNInt < 2) {
      var y = x + 1;
      var tmptn = args[y];
      if (!isNaN(Number(tmptn)) && tmptn > 1) opponentTNInt = tmptn;
      else opponentTNInt = -1;
    }
  }
  logger.info('OD: ' + opponentDiceInt + '; OTN: ' + opponentTNInt
    + '; OX ' + isOpposedTestBool);

  // SETUP: anything remaining is a note; prepare to pass it thru
  var note = cmd;
  var spacer = "";
  for (x = 0; x < args.length; x++) {
    // for this complex command, repeat everything verbatim as a note
    spacer = (note !== "") ? " " : "";
    note += spacer + args[x];
  }
  if (note !== "") note = "(" + note + ")";
  else if (tn > 0) note = "(TN" + tn + ")";
  // GO: Roll dem bones ============================================
  var successesInt = 0;
  var rolls = [];
  for (x = 0; x < howmany; x++) {
    rolls[x] = d6(isTest);
    if (tn > -1 && rolls[x] >= tn) successesInt++;
  }
  // Convenience, or hiding terrible RNG? you decide! (it's both)
  rolls.sort(sortNumberDesc);
  // handle opposed roll
  if (isOpposedBool) {
    var opponentSuccessesInt = 0;
    var orolls = [];
    for (x = 0; x < opponentDiceInt; x++) {
      orolls[x] = d6(isOpposedTestBool);
      if (opponentTNInt > -1 && orolls[x] >= opponentTNInt)
        opponentSuccessesInt++;
    }
    orolls.sort(sortNumberDesc);
  }
  // prep output and ... put it out
  //
  var output = '';
  if (isOpposedBool) {
    var successesFormattedString = '';
    if (successesInt > opponentSuccessesInt) {
      successesFormattedString = (successesInt-opponentSuccessesInt)
      + ' net successes ';
    }
    else if (successesInt == opponentSuccessesInt) {
      successesFormattedString = '0 net successes';
    }
    else if (opponentSuccessesInt > successesInt) {
      successesFormattedString = (opponentSuccessesInt-successesInt)
      + ' *fewer* successes than the opponent! ';
    }
    output = user + ' rolled ' + successesFormattedString
    + '('+rolls+') vs ('+orolls+') ' + note;
  }
  else {
    var successesFormattedString = "";
    if (successesInt > 0) {
      successesFormattedString = successesInt + ' successes ';
    }
    output = user + ', you rolled ' + successesFormattedString
    + '(' +rolls+ ') ' + note;
  }
  msg.channel.send(output);
  // no return
}
function handleHelpCommand(msg, cmd) {
  msg.reply('GameBot usage:\n'
    + '!***X***         Roll ***X***d6 *without* exploding 6\'s'
    + '  ***example:*** !5   rolls 5d6 without exploding\n'
    + '!X***!***        Roll ***X***d6 ***with*** exploding 6\'s'
    + '  ***example:*** !5!  rolls 5d6 with exploding\n'
    + '!X ***tnY***     Roll *without* exploding 6\'s against Target Number ***Y***'
    + '  ***example:*** !5 tn4   rolls 5d6 w/o exploding vs TN4\n'
    + '!X! ***tnY***     Roll ***with*** exploding 6\'s against Target Number ***Y***'
    + '  ***example:*** !5! tn4   rolls 5d6 w/ exploding vs TN4\n'
    + '\n'
    + 'Notes are OK, and your TN can be in the middle of the note\n'
    + 'examples:\n'
    + '  !3! TN4 resist wagemage sorcery      works\n'
    + '  !3! resist wagemage sorcery TN4      works\n'
    + '  !3! resist TN4 wagemage sorcery      works\n'
    + '  resist wagemage sorcery !3! TN4      won\'t work\n'
    + '\n'
    + 'Anyone can click the :game_die: reaction to reroll any *recent* roll.\n'
    + 'Remove and re-add your reaction to keep re-rolling that roll.\n'
    + '\n'
    + 'Opposed Rolls:\n'
    + '!A! tnB ***vsX!*** ***otnY***\n'
    + '   Roll *A*d6 (exploding) with tn *B*, opposed by *X*d6 (exploding) with opponent\'s tn *Y*\n'
    + '   vs*X* = the number of dice the opponent throws (vs*X*! for exploding dice)\n'
    + '   otn*Y* = the opponent\'s target number\n'
    + '  ***example:*** !5! tn3 vs6! otn4    Roll 5d6 (exploding) with TN 3, against 6d6 (exploding) with TN 4\n'
  );
}

function handleMessage(msg, user=msg.author) {
  // check if message starts with `!`
  var message = msg.content;
  if (message.substring(0, 1) == '!') {
      var args = message.substring(1).split(' ');
      var cmd = args[0];
      args = args.splice(1);
      cmd = cmd.toLowerCase();
      switch(cmd) {
          case 'help':
            handleHelpCommand(msg, cmd);
          break;
          default:
            handleRollCommand(msg, cmd);
          break;
       }
   }
   // no return
}

// Hook the handler
bot.on('message', (msg) => {    handleMessage(msg);   });
