/*
 * Shadowrun 1e GameBot by Discord user AstroMacGuffin#1486 (Nathan Hawks)
 * https://github.com/NathanHawks/SR1eGameBot
 * Yes I do regret baking 1e into the name
 * version 0.3, yeah that sounds good
 * Released under the terms of the UnLicense. This work is in the public domain.
 * Released as-is with no warranty or claim of usability for any purpose.
 */
 const {addMaintenanceStatusMessage} = require('./api');
 function handleHelpCommand(msg, cmd, args) {
   let whatToShow = 'main';
   // legacy help commands
   if (args.length && args[0] == 2 || cmd === 'inithelp') {
     whatToShow = 'init';
   }
   // new help commands
   else if (args.length) {
     switch (args[0]) {
       case 'main':
       case 'init':
       case 'scene':
       case 'macros':
       case 'gmscreen':
       case 'reminders':
       case 'ammo':
       case 'troubleshoot':
         whatToShow = args[0];
       break;
       default:
         whatToShow = 'index';
       break;
     }
   }
   else {
     whatToShow = 'index';
   }
   let index1 = '\nHelp Topics:\n'
     + '`main        ` - Dice rolls, Rule of 6, Target Numbers, Opposed Tests\n'
     + '`init        ` - Initiative for Shadowrun 1e-3e\n'
     + '`scene       ` - Prepare text and music for deploying later :new:\n'
     + '`macros      ` - Saving and re-using named dice rolls\n'
     + '`gmscreen    ` - Doing initiative and/or scene prep in a hidden channel :new:\n'
     + '`reminders   ` - Automatically DM your players on timers of your choosing :new:\n'
     + '`ammo        ` - Track ammo during combat :new:\n'
     + '`troubleshoot` - Command stuck? Bot not responding in a channel? Try this\n'
     + '\n'
     + 'Example: type `!help main` for the main help.\n'
   ;
   let main1 = '\nMain Help:\n'
     + '**====== Plain Old d6\'s ======**\n'
     + '!***X***         Roll ***X***d6 *without* Rule of 6'
     + '  ***example:*** !5        rolls 5d6 *without* Rule of 6\n'
     + '!X***t***        Roll Xd6 *and total them*.'
     + '  ***example:*** !6t       rolls 6d6 and *adds them up*.\n'
     + '!Xt ***+Z***     Roll Xd6, total them, and *add or subtract a modifier*.'
     + '  ***example:*** !6t -5    rolls 6d6, totals them, and *subtracts 5 from the total*.\n'
     + '\n'
     + '**====== Rule of 6 & Target Numbers ======**\n'
     + '!X***!***        Roll ***X***d6 ***with*** Rule of 6'
     + '  ***example:*** !5!       rolls 5d6 *with Rule of 6*\n'
     + '!X ***tnY***     Roll *without* Rule of 6 against Target Number ***Y***'
     + '  ***example:*** !5 tn4    rolls 5d6 w/o Rule of 6 vs TN4\n'
     + '!X***! tnY***    Roll ***with*** Rule of 6 against Target Number ***Y***'
     + '  ***example:*** !5! tn4   rolls 5d6 w/ Rule of 6 vs TN4\n'
     + '\n'
     + '**====== Opposed Rolls ======**\n'
     + '!A! tnB ***vsX!*** ***otnY***\n'
     + '   Roll *A*d6 (with Rule of 6) with tn *B*, opposed by *X*d6 (with Rule of 6) with opponent\'s TN *Y*\n'
     + '   vs*X* = the number of dice the opponent throws (vs*X*! for Rule of 6)\n'
     + '   otn*Y* = the opponent\'s target number\n'
     + '  ***example:*** !5! tn3 vs6! otn4    '
     + 'Roll 5d6 (Rule of 6) with TN 3, against 6d6 (Rule of 6) with TN 4\n'
     + '\n'
     + '**===== Multiple Rolls per Message =====**\n'
     + 'You can order GameBot to do more than one roll without sending multiple'
     + ' messages. Just separate the commands with semicolons.\n'
     + '***example:*** !1 (grenade scatter direction);'
     + ' 2t (max non-aero grenade scatter distance)\n';
     let main2 =
     '\n**====== Notes ======**\n'
     + 'Notes are OK, and your options can be in the middle of the note.\n'
     + 'examples:\n'
     + '  !3! TN4 resist wagemage sorcery      works\n'
     + '  !3! resist wagemage sorcery TN4      works\n'
     + '  !3! resist TN4 wagemage sorcery      works\n'
     + '  resist wagemage sorcery !3! TN4      won\'t work\n'
     + '\n'
     + '**===== Reroll =====**\n'
     + 'Anyone can click the :game_die: reaction to reroll any *recent* roll.\n'
     + 'Remove and re-add your reaction to keep re-rolling that roll.\n'
     + '\n'
     + 'Patreon: <https://patreon.com/nathanhawks> | <@360086569778020352>'
   ;
   let init1 =
       '\n:boom: **Initiative System** :boom:\n'
     + '\n'
     + 'Player setup:\n:one: **!setgm @someone**\n:two: **!setinit X Y**\n'
     + 'GM setup:\n:one: **!setgm**\n:two: **!setplayers @player1 @player2 (etc)**'
       + '\n:three: **!setnpcinits *(see below)***\n'
     + '\n'
     + '**!setinit** syntax is **!setinit X Y** where X is the number of dice '
     + 'and Y is the modifier. For example, **!setinit 1 4** sets your initiative '
     + 'formula to 1d6+4.\n'
     + '\n'
     + 'IMPORTANT: Commands won\'t work unless you @people correctly. '
       + 'Use the menu that pops-up while you type, or tab-completion. \n'
       + '**If it\'s highlighted blue, you did it right.**\n'
     + '\n'
     + ':game_die: **Rolling Initiative** :game_die:\n'
       + ':arrow_right: **!init** - Shadowrun 1e initiative\n'
       + ':arrow_right: **!initflip** - Shadowrun 1e initiative, reversed\n'
       + ':arrow_right: **!init2** - Shadowrun 2e initiative\n'
       + ':arrow_right: **!init2flip** - Shadowrun 2e initiative, reversed\n'
       + ':arrow_right: **!init3** - Shadowrun 3e initiative\n'
       + ':arrow_right: **!init3flip** - Shadowrun 3e initiative, reversed\n'
       + ':arrow_right: **!initcp** - Cyberpunk 2020 initiative\n'
       + ':arrow_right: **!initcpr** - Cyberpunk RED initiative\n'
       + '\n'
       + 'The bot remembers stuff; you won\'t need to redo setup, just update whatever '
         + 'changes. **However:**\n'
       + ':arrow_right: Everything is linked to GM **and chat channel**.\n'
       + ':arrow_right: If you move to a different channel, you must re-enter everything.\n'
       + ':arrow_right: Multiple GM\'s can share a channel, but anyone playing in '
       + 'both groups must repeat their set-up steps (starting with !setgm).\n'
       + ':arrow_right: To play in two games *at the same time,* you\'ll need two channels.\n'
       + '\n'
     ;
     let init2 = '\n\n:boom: **Initiative System** continued :boom:\n'
     + '\n'
     + ':nerd: **Other initiative commands** :nerd:\n```'
       + 'Shortcut  Full command    [Required] options\n'
       + '--------------------------------------------\n'
       + '          !setgm          @someone\n'
       + '!si       !setinit        [X Y]\n'
       + '!setp     !setplayers     [@player1 @player2 etc]\n'
       + '!addp     !addplayers     [@player1 @player2 etc]\n'
       + '!lp       !listplayers\n'
       + '!rmp      !removeplayers  [@player1 @player2 etc]\n'
       + '!clrp     !clearplayers\n'
       + '!setn     !setnpcinits    [X1 Y1 label1 X2 Y2 label2 etc]\n'
       + '!addn     !addnpcinits    [X1 Y1 label1 X2 Y2 label2 etc]\n'
       + '!ln       !listnpcinits\n'
       + '!rmn      !removenpcinits [label1 label2 etc]\n'
       + '!clrn     !clearnpcinits\n'
       + '```'
     + '\n'
     + ':dragon_face: **Adding NPC\'s** :dragon_face:\n'
     + '**!setnpcinits** and **!addnpcinits** syntax: !(command) **X Y label**\n -- labels cannot have spaces or commas\n --'
       + ' e.g. **!addnpcinits 1 5 thugs** (means the thugs have 1d6+5 initiative).\n -- Add as many NPCs as you want, separated by spaces.\n'
     + '\n'
     + 'If you have multiple NPC\'s with the same label, !removeNPCInits also accepts '
       + 'the format **!removenpcinits X Y label** which requires a full match. But, '
       + 'having multiple NPC\'s with the same label is confusing anyway, so maybe just don\'t do that.\n'
     + '\n'
     + 'All initiative-related commands are slow (until the cache gets loaded with your data). '
       + 'The :hourglass_flowing_sand: reaction means it\'s working on your request.\n'
     + '\n'
     + 'Commands are **not** case-sensitive. Go WiLd WitH tHaT.\n'
     + '\n'
     + '**See also:** !help gmscreen\n'
     + '\n'
     + 'Patreon: <https://patreon.com/nathanhawks> | <@360086569778020352>'
   ;
   let scene1 = '\n:blue_book: **Prepared Scenes with (or without) Music** :blue_book:\n'
     + '\n'
     + '**It is strongly recommended** that you also read `!help gmscreen` so you can do your prep in secret!\n'
     + '\n'
     + 'Every adventure has passages of text that must be given to the players at each new scene. '
     + 'You no longer need to type these out in real time! Now you can prepare the texts in advance via the bot, and deploy them easily later.\n'
     + '\n'
     + '!**setscene** *name* *music_link* *scene_text*\n'
     + 'Creates or updates a named scene. The music link is optional. Scene text can have line breaks and formatting, and is only limited by Discord message length limits.\n'
     + '**Example 1:** !setscene example1 <https://www.youtube.com/watch?v=zsq-tAz54Pg> The orks burst through the door carrying uzis and a grudge.\n'
     + '**Example 2:** !setscene example2 Suddenly the band stops playing as everyone stares at you in horror.\n'
     + '\n'
     + '!**getscene** *name*\n'
     + 'Deploys the named scene. The name of the scene is **not** displayed in the output. Music (if any) is shown as a link, with Discord\'s embedded player below that.\n'
     + '\n'
     + '!**listscenes**\n'
     + 'Shows a list of scene names that you\'ve saved to the current channel (or play channel, if you\'re using the virtual GM Screen feature).\n'
     + '\n'
     + '!**delscene** *name*\n'
     + 'Deletes one or more scenes identified by name(s). To delete multiple scenes, simply put spaces between the names. **Deleted scenes cannot be recovered!**\n'
     + '\n'
     + '**See also:** !help gmscreen\n'
     + '\n'
     + 'Patreon: <https://patreon.com/nathanhawks> | <@360086569778020352>';
   ;
   let macros1 = '\n:scroll: **Macros (Saved Rolls)** :scroll:\n'
     + '\n'
     + 'These commands allow you to manage named dice rolls and use them any time just by typing a quick command.\n'
     + '\n'
     + '!***save*** *name* *dice_command_without_preceding_bang*\n'
     + 'Creates or updates a named "dice command". *(See `!help main` for valid "dice commands".)*\n'
     + '\n'
     + '!***roll*** *name*\n'
     + 'Rolls the saved "dice command" with the given name.\n'
     + '\n'
     + '!***lm***\n'
     + 'Lists your saved dice command macros for that channel.\n'
     + '\n'
     + '!***removemacro*** *name* or !***rmm*** *name*\n'
     + 'Removes one of your saved macros in that channel.\n'
     + '\n'
     + '**Pro tip:** Don\'t forget you can have multiple dice rolls in a single command by separating the rolls with semicolons (;)\n'
     + '\n'
     + 'Patreon: <https://patreon.com/nathanhawks> | <@360086569778020352>'
   ;
   let gmscreen1 = '\n:ninja: **Virtual GM Screen** :ninja:\n\n'
     + 'Using this feature, **reminders**, **initiative** and **scene** commands can be done in a hidden channel.\n'
     + '\n'
     + 'Players still need to **!setgm** and **!setinit** in the play channel.\n'
     + '\n'
     + '**It\'s simple!**\n'
     + '\n'
     + 'Step :one:: Go to your hidden channel\n'
     + 'This will be the channel where you do all your prep from now on.\n'
     + '\n'
     + 'Step :two:: **!setchannel** *linkToPlayChannel*\n'
     + 'Your "play channel" is the channel players have access to; your main channel for the game. '
     + 'You make a channel link by typing the # sign and typing the channel name or choosing it from the pop-up menu. '
     + '**If the channel name is highlighted blue, you did it right.**\n'
     + '\n'
     + 'Step :three:: Do your prep!\n'
     + '\n'
     + '**Notes about running various commands behind the GM screen:**\n'
     + ':arrow_forward: !getscene will output to the play channel so you don\'t need to reveal your scene titles.\n'
     + ':arrow_forward: You can now run !init in secret, or you can prep your NPC\'s in the secret channel and then do the !init command in the play channel.\n'
     + '\n'
     + 'Patreon: <https://patreon.com/nathanhawks> | <@360086569778020352>'
   ;
   let reminders1 = '\n:alarm_clock: **Reminders** :alarm_clock:\n\n'
     + 'The bot can DM reminders of your upcoming game sessions to your players.\n\n'
     + '**!addreminder** sessionDate&Time timer1 timer2 etc\n'
     + '*sessionDate&Time* needs the format **YYYY-MM-DD*T*HH:MM** *(note the "T" separating date from time)*\n'
     + 'Note the hour of the session must be in 24-hour format; e.g. for 6pm, you enter 18:00\n'
     + 'Each *timer* needs a format of minutes, hours, or days, such as **10m**, **3h**, **7d** etc\n'
     + '**Example:** !addreminder 2022-05-04T18:00 30m 6h 1d 3d 7d\n'
     + 'Sets a game session at 6pm on May 4, and five reminders (30 minutes before the session, etc)\n'
     + 'The reminders will go to everyone you\'ve got in your players list at the time when you added the reminder.\n'
     + 'To manage your players list, see the `!setplayers`, `!addplayers`, etc commands under `!help init`\n'
     + '\n'
     + '**!listreminders**\n'
     + 'Shows a list of your upcoming reminders, and the ID\'s you\'d use to cancel them if necessary, plus who they\'re going to.\n'
     + 'Due to Discord message size-limits this command can be slow if you have more than a few reminders.\n'
     + '\n'
     + '**!cancelreminder** id#1 id#2 etc\n'
     + 'Cancels one or more reminders. See `!listreminders` to get the ID\'s.\n'
     + '\n'
     + 'Patreon: <https://patreon.com/nathanhawks> | <@360086569778020352>'
   ;
   let ammo1 = '\n:gun: **Ammo Tracking** :gun:\n\n'
     + 'GameBot can track ammo during combat, enforcing max ROF and weapon capacity.\n\n'
     + '**!ammo addgun** name maxROF ammoContainerType ammoCapacity ammoTypes\n'
     + 'Adds a weapon for ammo tracking purposes. The name must not have any spaces or commas.\n'
     + 'If the gun is compatible with multiple types of round, separate them with spaces.\n'
     + 'You should keep the name short, since you\'ll be typing it for the `!ammo fire` and `!ammo reload` commands.\n'
     + 'If the rules don\'t specify maxROF any other way, don\'t forget autofire is Skill Rating +1.\n'
     + '**Example:** `!ammo addgun uzi3 7 clip 16 slug`\n\n'
     + '**!ammo delgun** name\n'
     + '**Example:** `!ammo delgun uzi3`\n'
     + 'Removes the uzi3 from your inventory.\n\n'
     + '**!ammo addammo** qtyContainers containerType qtyRounds roundType maxRounds\n'
     + 'The maxRounds should match the ammoCapacity of the gun you want to use this ammo for.\n'
     + 'The roundType should match one of the ammoTypes for the matching weapon.\n'
     + '**Example:** `!ammo addammo 10 clip 16 slug 16`\n'
     + 'Adds 10 clips that are fully loaded with 16 slugs each. This matches the uzi3.\n\n'
   ;
   let ammo2 = '\n:gun: **Ammo Tracking** continued :gun:\n'
     + '**!ammo delammo** qtyContainers containerType qtyRounds roundType maxRounds\n'
     + '**Example:** `!ammo delammo 4 clip 16 slug 16`\n'
     + 'Removes 4 of those clips for your uzi3 from your inventory.\n\n'
     + '**!ammo list**\n'
     + 'Shows a list of guns, and what they\'re loaded with, plus a list of your ammo.\n'
     + 'Empty clips are not shown, so track those yourself.\n\n'
     + '**!ammo fire** weaponName nbrShots\n'
     + 'Depletes a number of rounds (nbrShots) from the gun identified by weaponName, assuming nbrShots doesn\'t exceed the gun\'s maxROF.\n'
     + 'If you try to shoot more rounds than are currently loaded, the weapon will be depleted of all ammo and you will be told how many rounds were shot before the weapon clicked empty.\n\n'
     + '**!ammo reload** weaponName\nor\n**!ammo reload** weaponName shotType\n'
     + 'The first form assumes you only have one compatible ammo type for that weapon.\n'
     + '**Example:** `!ammo reload uzi3`\n'
     + 'The second form allows you to specify which type of round you want to load, for cases where your weapon has multiple compatible ammoTypes *and* you have compatible ammo entries for 2 or more of those ammoTypes.\n'
     + '**Example:** `!ammo reload enfield shot`\n'
     + '\n'
     + 'Patreon: <https://patreon.com/nathanhawks> | <@360086569778020352>'
   ;
   let troubleshoot1 = '\n:fire_extinguisher: **Troubleshooting** :fire_extinguisher:\n\n'
     + 'GameBot has a few bugs, plus Google Drive API can occasionally drop a request.\n\n'
     + '**IMPORTANT:** The bot needs the following channel permissions to work: View Channel, Send Messages, and Add Reactions. '
     + '**Make sure you\'re giving these permissions to the bot, and not everyone!**\n'
     + '\n'
     + 'If you get no response from a command and the hourglass doesn\'t go away, you can '
     + 'often fix it yourself by typing `!unlock`.\n'
     + '\n'
     + 'If you\'re using a virtual GM Screen (see `!help gmscreen`) you may need to go into '
     + 'the play channel before typing `!unlock` or it won\'t have any effect.\n'
     + '\n'
     + 'Give each command at least 15 seconds to complete before you use `!unlock` or **weird, '
     + 'bad things might happen to your data.** Reminders-related commands are even slower; give '
     + 'them up to 2 minutes if they seem stuck. Also make sure you\'re issuing each command '
     + '**one at a time.**\n'
     + '\n'
     + 'Notify me of any suspected bugs with a screenshot showing the time of the command, '
     + 'and your timezone: <@360086569778020352>\n'
     + '\n'
     + 'If we don\'t share a server, you can find me on Classic Shadowrun: https://discord.gg/HBDPU6k\n'
     + '\n'
     + 'You can also report bugs at <https://github.com/NathanHawks/SR1eGameBot/issues>.'
   ;
   switch (whatToShow) {
     case 'index':
       index1 = addMaintenanceStatusMessage(index1);
       msg.reply(index1).catch((e) => { logError(e); });
     break;
     case 'main':
       main2 = addMaintenanceStatusMessage(main2);
       msg.reply(main1).catch((e) => { logError(e); });
       msg.reply(main2, {embed: null}).catch((e) => { logError(e); });
     break;
     case 'init':
       init2 = addMaintenanceStatusMessage(init2);
       msg.reply(init1).catch((e) => { logError(e); });
       msg.reply(init2, {embed: null}).catch((e) => { logError(e); });
     break;
     case 'scene':
       scene1 = addMaintenanceStatusMessage(scene1);
       msg.reply(scene1, {embed: null}).catch((e) => { logError(e); });
     break;
     case 'macros':
       macros1 = addMaintenanceStatusMessage(macros1);
       msg.reply(macros1, {embed: null}).catch((e) => { logError(e); });
     break;
     case 'gmscreen':
       gmscreen1 = addMaintenanceStatusMessage(gmscreen1);
       msg.reply(gmscreen1, {embed: null}).catch((e) => { logError(e); });
     break;
     case 'reminders':
       reminders1 = addMaintenanceStatusMessage(reminders1);
       msg.reply(reminders1).catch((e) => {console.error(e);});
     break;
     case 'ammo':
       ammo2 = addMaintenanceStatusMessage(ammo2);
       msg.reply(ammo1).catch((e) => {console.error(e);});
       msg.reply(ammo2).catch((e) => {console.error(e);});
     break;
     case 'troubleshoot':
       troubleshoot1 = addMaintenanceStatusMessage(troubleshoot1);
       msg.reply(troubleshoot1).catch((e) => {console.error(e);});
     break;
   }
 }
 module.exports = {
   handleHelpCommand
 };
