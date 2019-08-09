function d6(explode=false) {
    var roll = Math.floor(Math.random() * 6 + 1);
    if (roll == 6 && explode == true) {
        roll += d6(true);
    }
    return roll;
}

var Discord = require('discord.io');
var logger = require('winston');
var auth = require('./auth.json');
// Configure logger
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console, { colorize: true });
logger.level = 'debug';
// Connect to Discord
var bot = new Discord.Client({ token: auth.token, autorun: true });
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
        switch(cmd) {
            case 'demo-roll':
              bot.sendMessage({to: channelID, message: d6(true)});
            break;
            default:
              // it's a dice roll; get setup ===================================
              //logger.info('cmd = ' + cmd + '; message = ' + message);
              // SETUP: how many dice, and do we explode?
              var minusone = cmd.length-1;
              var minustwo = cmd.length-2;
              var lastchar = cmd.substring(minusone, 1+minusone);
              //logger.info('lastchar = ' + lastchar);
              var explode = false;
              var howmany = 0;
              if (lastchar == '!') {
                explode = true;
                howmany = cmd.substring(0, 1+minustwo);
              }
              else {
                howmany = cmd.substring(0, 1+minusone);
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
              // GO: Roll dem bones ============================================
              //logger.info('Dice to roll: ' + howmany + '; explode = ' + explode);
              var successes = 0;
              var rolls = [];
              for (x = 0; x < howmany; x++) {
                rolls[x] = d6(explode);
                if (tn > -1 && rolls[x] >= tn) successes++;
              }
              var output = 'Rolled ' +successes+ ' successes (' +rolls+ ')' ;
              //logger.info(output);
              bot.sendMessage({to: channelID, message: output});
            break;
         }
     }
});
