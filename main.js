function d6(explode=false) {
    var roll = Math.floor(Math.random() * 6 + 1);
    if (roll == 6 && explode == true) {
        roll += d6(true);
    }
    return roll;
}

/* Credit to
 stackoverflow.com/questions/1063007/how-to-sort-an-array-of-integers-correctly
*/
function sortNumberDesc(a, b) {
  return b - a;
}

var Discord = require('discord.io');
var logger = require('winston');

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
var bot = new Discord.Client({ token: token, autorun: true });
bot.on('ready', function (evt) {
    logger.info('Connected; Logged in as: ['+ bot.username + '] (' + bot.id + ')');
    bot.setPresence({game:{name:'!help for help'}});
});
// Setup message handler
bot.on('message', function (user, userID, channelID, message, evt) {
    // check if message starts with `!`
    if (message.substring(0, 1) == '!') {
        var args = message.substring(1).split(' ');
        var cmd = args[0];
        args = args.splice(1);
        cmd = cmd.toLowerCase();
        switch(cmd) {
            case 'help':
              bot.sendMessage({to: channelID, message: 'GameBot usage:\n'
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
                + '  !5! TN4     is correct\n'
                + '  !5! TN 4    won\'t work\n'
                + '\n'
                + 'Notes are OK, and your TN can be in the middle of the note\n'
                + 'examples:\n'
                + '  !3! TN4 resist wagemage sorcery      works\n'
                + '  resist wagemage sorcery !3! TN4      won\'t work\n'
                + '  !3! resist wagemage sorcery TN4      works\n'
              });
            break;
            default:
              // it's a dice roll; get setup ===================================
              //logger.info('cmd = ' + cmd + '; message = ' + message);
              // SETUP: how many dice, and do we explode?
              var lastchar = cmd.substring(cmd.length-1, cmd.length);
              //logger.info('lastchar = ' + lastchar);
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
                //logger.info('firsttwo = ' + firsttwo);
                if (firsttwo == 'tn') {
                  //logger.info('TN found: ' + args[x]);
                  tn = args[x].substring(2, args[x].length);
                  //logger.info('TN is: ' + tn);
                }
              }
              // SETUP: anything remaining is a note; prepare to pass it thru
              var notegiven = false;
              var note = "";
              var spacer = "";
              for (x = 0; x < args.length; x++) {
                var firsttwo = args[x]. substring(0,2);
                firsttwo = firsttwo.toLowerCase();
                if (firsttwo !== 'tn' || notegiven == true) {
                  notegiven = true;
                  spacer = (note !== "") ? " " : "";
                  note += spacer + args[x];
                }
              }
              if (note !== "") note = "(" + note + ")";
              // GO: Roll dem bones ============================================
              //logger.info('Dice to roll: ' + howmany + '; explode = ' + explode);
              var successes = 0;
              var rolls = [];
              for (x = 0; x < howmany; x++) {
                rolls[x] = d6(explode);
                if (tn > -1 && rolls[x] >= tn) successes++;
              }
              // Convenience, or hiding terrible RNG? you decide! (it's both)
              rolls.sort(sortNumberDesc);
              // prep output and ... put it out
              var successoutput = "";
              if (successes > 0) { successoutput = successes + ' successes '; }
              var output = user + ' rolled ' +successoutput+ '(' +rolls+ ') ' + note;
              //logger.info(output);
              bot.sendMessage({to: channelID, message: output});
            break;
         }
     }
});
