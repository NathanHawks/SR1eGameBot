// The dice-rolling function
function d6(explode=false) {
    var roll = Math.floor(Math.random() * 6 + 1);
    if (roll == 6 && explode == true) roll += d6(true);
    return roll;
}

/* Credit to stackoverflow.com/questions/1063007/how-to-sort-an-array-of-integers-correctly */
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
// old way: var bot = new Discord.Client({ token: token, autorun: true });
// new way
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
    //reaction.message.channel.send(user.username + ' wants to re-roll ' + reaction.message.content);
    handleMessage(reaction.message, user);
  }
});

function handleHelpCommand(msg) {
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
    + '***NO SPACE between "TN" and number;*** example:\n'
    + '  !5! TN4     works\n'
    + '  !5! TN 4    won\'t work\n'
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
            handleHelpCommand(msg);
          break;
          default:
            // it's a dice roll
            // provide reroll ui (dice reaction)
            msg.react('🎲');
            // get setup ===================================
            // SETUP: how many dice, and do we explode?
            var lastchar = cmd.substring(cmd.length-1, cmd.length);
            var explode = false;
            var howmany = 0;
            if (lastchar == '!') {
              explode = true;
              howmany = cmd.substring(0, cmd.length-1);
            }
            else {
              howmany = cmd.substring(0, cmd.length);
            }
            // SETUP: was a TN given?
            var tngiven = false;
            var tn = -1;
            for (x = 0; x < args.length; x++) {
              var firsttwo = args[x].substring(0,2);
              firsttwo = firsttwo.toLowerCase();
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
            var opposed = false;
            var opponentdice = -1;
            var opponenttn = -1;
            var opposedexplode = false;
            for (x = 0; x < args.length; x++) {
              var firsttwo = args[x].substring(0,2);
              var firstthree = args[x].substring(0,3);
              firsttwo = firsttwo.toLowerCase();
              firstthree = firstthree.toLowerCase();
              if (firsttwo == 'vs' && args[x].length > 2 && firstthree !== "vs.") {
                opposed = true;
                var lastchar = args[x].substring(args[x].length-1, args[x].length);
                if (lastchar == '!') {
                  opposedexplode = true;
                  opponentdice = args[x].substring(2, args[x].length-1);
                }
                else {
                  opponentdice = args[x].substring(2, args[x].length);
                }
                if (isNaN(Number(otn)) || otn < 2) {
                  var y = x + 1;
                  var tmptn = args[y];
                  if (!isNaN(Number(tmptn)) && tmptn > 1) otn = tmptn;
                  else otn = -1;
                 }
              }
              else if (firstthree == 'otn') {
                opponenttn = args[x].substring(3, args[x].length);
              }
            }
            logger.info('OD: ' + opponentdice + '; OTN: ' + opponenttn + '; OX ' + opposedexplode);

            // SETUP: anything remaining is a note; prepare to pass it thru
            var notegiven = false;
            var note = "";
            var spacer = "";
            for (x = 0; x < args.length; x++) {
              // for this complex command, repeat everything verbatim as a note
              notegiven = true;
              spacer = (note !== "") ? " " : "";
              note += spacer + args[x];
            }
            if (note !== "") note = "(" + note + ")";
            else if (tn > 0) note = "(TN" + tn + ")";
            // GO: Roll dem bones ============================================
            var successes = 0;
            var rolls = [];
            for (x = 0; x < howmany; x++) {
              rolls[x] = d6(explode);
              if (tn > -1 && rolls[x] >= tn) successes++;
            }
            // Convenience, or hiding terrible RNG? you decide! (it's both)
            rolls.sort(sortNumberDesc);
            // handle opposed roll
            if (opposed) {
              var osuccesses = 0;
              var orolls = [];
              for (x = 0; x < opponentdice; x++) {
                orolls[x] = d6(opposedexplode);
                if (opponenttn > -1 && orolls[x] >= opponenttn) osuccesses++;
              }
              orolls.sort(sortNumberDesc);
            }
            // prep output and ... put it out
            var output = '';
            if (opposed) {
              var successoutput = '';
              if (successes > osuccesses) { successoutput = (successes-osuccesses) + ' net successes '; }
              else if (successes == osuccesses) { successoutput = '0 net successes'; }
              else if (osuccesses > successes) { successoutput = (osuccesses-successes) + ' *fewer* successes than the opponent! '; }
              output = user + ' rolled ' +successoutput+ '('+rolls+') vs ('+orolls+') ' + note;
            }
            else {
              var successoutput = "";
              if (successes > 0) { successoutput = successes + ' successes '; }
              output = user + ', you rolled ' +successoutput+ '(' +rolls+ ') ' + note;
            }
            msg.channel.send(output);
          break;
       }
   }
   // no return
}

// Setup message handler
bot.on('message', (msg) => {
  handleMessage(msg);
});
