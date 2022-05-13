# SR1eGameBot

## What It Is

A Discord dicebot for Shadowrun 1e/2e/3e, which does d6 rolls with modifiers, as well as Success Tests and Opposed Success Tests. It can also store **dice macros,** and even generates **initiative** for Shadowrun 1st-3rd Editions -- both forwards and backwards. **New in 2022**
it also does **reminders**, **ammo tracking**, **scene text and music**, and has a
**virtual GM screen** for hiding your prep from your players. And, hey, why not: it also
does **initiative for Cyberpunk 2020 and Cyberpunk RED**.

Instructions on using the bot are below, after the self-hosting instructions.

## How to Install

[Click here to deploy the bot on your server](https://discordapp.com/oauth2/authorize?client_id=609274260007026689&scope=bot&permissions=0).

### To self-host:

1. Install node.js and test that it's working. You'll need this in order to set up the bot.

2a. Get your Discord auth token via the *New Application* button at http://discordapp.com/developers/applications/me and put the auth token in a `discordauth.json` file, in the same directory as main.js. The format:
```
{
"token": "your auth token string from the New Application button at http://discordapp.com/developers/applications/me"
}
```
2b. Get credentials for the Google side of the app by creating a new project at https://console.cloud.google.com/getting-started using the "Select a Project" button in the upper-left. (Choose "External" and "Desktop Application".) From here you will be able to export the JSON-formatted data for your Google Drive API login. Save this in the same directory as main.js under the filename `googlecredentials.json`.

3. Run GameBot locally by going to its directory and running `node .` (with the period). Follow the instructions to authorize the bot as a Google app. *By the time you're done you'll have authorized the bot to use its own private slice of your Google Drive (for storing settings like initiative and macros).* When you paste the authorization code into the bot's console input, it will create and populate the file ***googletoken.json,*** in the same directory as main.js.
  * If you plan on self-hosting at home or pushing files to the web via FTP, you can skip to step #8.
  * If you plan on hosting via Heroku and deploying via GitHub, continue with the following steps:
4. On your deployment server, create 3 environment variables:
  * ***GOOGLE_CREDENTIALS*** should have the contents of the ***googlecredentials.json*** file.
  * ***GOOGLE_TOKEN*** should have the contents of the ***googletoken.json*** file.
  * ***TOKEN*** should have the contents of the ***discordauth.json*** file.
5. Publish your copy of the bot to your repo under the master branch.
6. Link Heroku to your GitHub repo, and tell Heroku to auto-deploy when you push to master.
7. In Heroku, under "Configure Dynos", use the "worker dyno", not the "web dyno".
8. Invite the bot to your server! Replace the XX's in the following link with your bot's ID number: discordapp.com/oauth2/authorize?client_id=XXXXXXXXXXX&scope=bot&permissions=0

### Gaining access to admin commands:

There are a few admin commands that are hard-coded only to respond to me, the bot's author. If you self-host, you can gain access to them:

1. Find out your Discord ID (it's ***not*** your username followed by a few numbers; it's all numbers; it will be the third number that appears in your bot's logfile when you use any of the initiative commands).
2. Do a find-and-replace in main.js, replacing all occurrences of my Discord ID, 360086569778020352, with your Discord ID.
3. Push the changes and restart the bot.

## Shadowrun Dicebot Features

### :game_die: Plain Old d6\'s :game_die:

* !***X***<br/>Roll ***X***d6 *without* Rule of 6<br/>***example:*** !5 <br/> rolls 5d6 *without* Rule of 6
* !X***t***<br/>Roll Xd6 *and total them*.<br/>***example:*** !6t <br/> rolls 6d6 and *adds them up*.
* !Xt ***+Z***<br/>Roll Xd6, total them, and *add or subtract a modifier*.<br/>***example:*** !6t -5 <br/> rolls 6d6, totals them, and *subtracts 5 from the total*.

### :six: Rule of 6 & Target Numbers :dart:

* ***!X!***<br/>Roll ***X***d6 ***with*** Rule of 6<br/>***example:*** !5! <br/> rolls 5d6 *with Rule of 6*
* !X ***tnY***<br/>Roll *without* Rule of 6 against Target Number ***Y***<br/>***example:*** !5 tn4 <br/> rolls 5d6 w/o Rule of 6 vs TN4
* ***!X! tnY***<br/>Roll ***with*** Rule of 6 against Target Number ***Y***<br/>***example:*** !5! tn4 <br/> rolls 5d6 w/ Rule of 6 vs TN4

### :boxing_glove: Opposed Rolls :boxing_glove:

* !A! tnB ***vsX!*** ***otnY***<br/>Roll *A*d6 (with Rule of 6) with tn *B*, opposed by *X*d6 (with Rule of 6) with opponent\'s TN *Y*<br/>:arrow_right: ***vsX*** = the number of dice the opponent throws (***vsX! for Rule of 6***)<br/>:arrow_right: ***otnY*** = the opponent\'s target number<br/>***example:*** !5! tn3 vs6! otn4<br/>Roll 5d6 (Rule of 6) with TN 3, against 6d6 (Rule of 6) with TN 4

### :1234: Multiple Rolls per Message :1234:

You can order GameBot to do multiple rolls with one message. Just separate the dice commands with semicolons.

***example:*** !1 ; 2t ; 3!; 4t +5 and a note for good measure

Be careful not to use semicolons for any other reason.

### :label: Notes :label:

Notes are OK, and your options can be in the middle of the note.

examples:

*  !3! TN4 resist wagemage sorcery :arrow_left: works
*  !3! resist wagemage sorcery TN4 :arrow_left: works
*  !3! resist TN4 wagemage sorcery :arrow_left: works
*  resist wagemage sorcery !3! TN4 :arrow_left: won\'t work

### :fast_forward: Macros (Saved Rolls) :fast_forward:

* !***save*** *name* *dice_command_without_preceding_bang*<br/>Creates or updates a named "dice command". *(See all the sections above for valid "dice commands".)*
* !***roll*** *name*<br/>Rolls the saved "dice command" with the given name.
* !***lm***<br/>Lists your saved dice command macros for that channel.
* !***removemacro*** *name* or !***rmm*** *name*<br/>Removes one of your saved macros in that channel.

### :recycle: Reroll :recycle:

* Anyone can click the :game_die: reaction to reroll any *recent* roll.
* Remove and re-add your reaction to keep re-rolling that roll.

## :boom: Initiative System :boom:

### Player setup:

  :one: !setgm @someone<br/>  :two: !setinit X Y

### GM setup:

  :one: !setgm<br/>  :two: !setplayers @player1 @player2 (etc)<br/>  :three: !setnpcinits (see below)

  **!setinit** syntax is **!setinit X Y** where X is the number of dice and Y is the modifier. For example, !setinit 1 4 sets your initiative formula to 1d6+4.

  IMPORTANT: Commands won't work unless you @people correctly. Use the menu that pops-up while you type, or tab-completion.  **If it's highlighted blue, you did it right.**

### :game_die: **Rolling Initiative** :game_die:

  :arrow_right: **!init** - Shadowrun 1e initiative<br/>  :arrow_right: **!initflip** - Shadowrun 1e initiative, reversed<br/>  :arrow_right: **!init2** - Shadowrun 2e initiative<br/>  :arrow_right: **!init2flip** - Shadowrun 2e initiative, reversed<br/>  :arrow_right: **!init3** - Shadowrun 3e initiative<br/>  :arrow_right: **!init3flip** - Shadowrun 3e initiative, reversed<br/>  :arrow_right: **!initcp** - Cyberpunk 2020 initiative<br/>
  :arrow_right: **!initcpr** - Cyberpunk RED initiative

  The bot remembers stuff; you won't need to redo setup, just update whatever changes. ***However:***

* Everything is linked to GM **and chat channel.**
* If you move to a different channel, you must re-enter everything.
* Multiple GM's can share a channel, but anyone playing in both groups must repeat their set-up steps (starting with !setgm).
* To play in two games at the same time, you'll need two channels.

### :game_die: **Other initiative commands** :game_die:

  ```
  Shortcut  Full command    [Required] options
  --------------------------------------------
            !setgm          @someone
  !si       !setinit        [X Y]
  !setp     !setplayers     [@player1 @player2 etc]
  !addp     !addplayers     [@player1 @player2 etc]
  !lp       !listplayers
  !rmp      !removeplayers  [@player1 @player2 etc]
  !clrp     !clearplayers
  !setn     !setnpcinits    [X1 Y1 label1 X2 Y2 label2 etc]
  !addn     !addnpcinits    [X1 Y1 label1 X2 Y2 label2 etc]
  !ln       !listnpcinits
  !rmn      !removenpcinits [label1 label2 etc]
  !clrn     !clearnpcinits
  ```

### :dragon_face: **Adding NPC's** :dragon_face:

  **!setnpcinits** and **!addnpcinits** syntax:<br/>**!(command) X Y label**<br/>Labels cannot have spaces or commas. Add as many NPCs as you want, separated by spaces.

  e.g. **!addnpcinits 1 5 thugs** (means the thugs have 1d6+5 initiative).

  If you have multiple NPC's with the same label, **!removeNPCInits** also accepts the format !removenpcinits X Y label which requires a full match. But, having multiple NPC's with the same label is confusing anyway, so maybe just don't do that.

## :blue_book: Prepared Scenes with (or without) Music :blue_book: ##

**It is strongly recommended** that you also read `!help gmscreen` so you can do your prep in secret!

Every adventure has passages of text that must be given to the players at each new scene.
You no longer need to type these out in real time! Now you can prepare the texts in advance via the bot, and deploy them easily later.

!**setscene** *name* *music_link* *scene_text*<br/>
Creates or updates a named scene. The music link is optional. Scene text can have line breaks and formatting, and is only limited by Discord message length limits.<br/>
**Example 1:** !setscene example1 <https://www.youtube.com/watch?v=zsq-tAz54Pg> The orks burst through the door carrying uzis and a grudge.<br/>
**Example 2:** !setscene example2 Suddenly the band stops playing as everyone stares at you in horror.

!**getscene** *name*<br/>
Deploys the named scene. The name of the scene is **not** displayed in the output. Music (if any) is shown as a link, with Discord\'s embedded player below that.

!**listscenes**<br/>
Shows a list of scene names that you\'ve saved to the current channel (or play channel, if you\'re using the virtual GM Screen feature).

!**delscene** *name*<br/>
Deletes one or more scenes identified by name(s). To delete multiple scenes, simply put spaces between the names. **Deleted scenes cannot be recovered!**

## :ninja: Virtual GM Screen :ninja: ##

Using this feature, **ammo tracking**, **reminders**, **initiative** and **scene** commands can be done in a hidden channel.

Players still need to **!setgm** and **!setinit** in the play channel.

**It's simple!**

Step :one:: Go to your hidden channel<br/>
This will be the channel where you do all your prep from now on.

Step :two:: **!setchannel** link_to_play_channel<br/>
Your "play channel" is the channel players have access to; your main channel for the game.<br/>
You make a channel link by typing the # sign and typing the channel name or choosing it from the pop-up menu.<br/>
**If the channel name is highlighted blue, you did it right.**

Step :three:: Do your prep!

**Notes about running various commands behind the GM screen:**<br/>
:arrow_forward: !getscene will output to the play channel so you don't need to reveal your scene titles.<br/>
:arrow_forward: You can now run !init in secret, or you can prep your NPC's in the secret channel and then do the !init command in the play channel.

## :alarm_clock: Reminders :alarm_clock: ##

The bot can DM reminders of your upcoming game sessions to your players.

**!addreminder** session_date&time timer1 timer2 etc<br/>
*session_date&time* needs the format **YYYY-MM-DD*T*HH:MM** *(note the "T" separating date from time)*<br/>
Note the hour of the session must be in 24-hour format; e.g. for 6pm, you enter 18:00<br/>
Each *timer* needs a format of minutes, hours, or days, such as **10m**, **3h**, **7d** etc<br/>
**Example:** !addreminder 2022-05-04T18:00 30m 6h 1d 3d 7d<br/>
Sets a game session at 6pm on May 4, and five reminders (30 minutes before the session, etc)<br/>
The reminders will go to everyone you've got in your players list at the time when you added the reminder.<br/>
To manage your players list, see the `!setplayers`, `!addplayers`, etc commands under `!help init`

**!listreminders**<br/>
Shows a list of your upcoming reminders, and the ID's you'd use to cancel them if necessary, plus who they're going to.<br/>
Due to Discord message size-limits this command can be slow if you have more than a few reminders.

**!cancelreminder** id#1 id#2 etc<br/>
Cancels one or more reminders. See `!listreminders` to get the ID's.


## :gun: **Ammo Tracking** :gun: ##

GameBot can track ammo during combat, enforcing max ROF and weapon capacity.

**!ammo addgun** name maxROF ammoContainerType ammoCapacity ammoTypes<br/>
Adds a weapon for ammo tracking purposes. The name must not have any spaces or commas.<br/>
If the gun is compatible with multiple types of round, separate them with spaces.<br/>
You should keep the name short, since you'll be typing it for the `!ammo fire` and `!ammo reload` commands.<br/>
If the rules don't specify maxROF any other way, don't forget autofire is Skill Rating +1.<br/>
**Example:** `!ammo addgun uzi3 7 clip 16 slug`

**!ammo delgun** name<br/>
**Example:** `!ammo delgun uzi3`<br/>
Removes the uzi3 from your inventory.

**!ammo addammo** qtyContainers containerType qtyRounds roundType maxRounds<br/>
The maxRounds should match the ammoCapacity of the gun you want to use this ammo for.<br/>
The roundType should match one of the ammoTypes for the matching weapon.<br/>
**Example:** `!ammo addammo 10 clip 16 slug 16`<br/>
Adds 10 clips that are fully loaded with 16 slugs each. This matches the uzi3.

**!ammo delammo** qtyContainers containerType qtyRounds roundType maxRounds<br/>
**Example:** `!ammo delammo 4 clip 16 slug 16`<br/>
Removes 4 of those clips for your uzi3 from your inventory.

**!ammo list**<br/>
Shows a list of guns, and what they're loaded with, plus a list of your ammo.<br/>
Empty clips are not shown, so track those yourself.

**!ammo fire** weaponName nbrShots<br/>
Depletes a number of rounds (nbrShots) from the gun identified by weaponName, assuming nbrShots doesn't exceed the gun's maxROF.<br/>
If you try to shoot more rounds than are currently loaded, the weapon will be depleted of all ammo and you will be told how many rounds were shot before the weapon clicked empty.

**!ammo reload** weaponName<br/>or<br/>**!ammo reload** weaponName shotType<br/>
The first form assumes you only have one compatible ammo type for that weapon.<br/>
**Example:** `!ammo reload uzi3`<br/>
The second form allows you to specify which type of round you want to load, for cases where your weapon has multiple compatible ammoTypes *and* you have compatible ammo entries for 2 or more of those ammoTypes.<br/>
**Example:** `!ammo reload enfield shot`

## Misc ##

  All initiative-related and macro-related commands are a little slow (due to communication with Google Drive). They get faster after the first use. The :hourglass_flowing_sand: reaction means it's working on your request.

  Commands are not case-sensitive. Go WiLd WitH tHaT.

  You can find my Patreon at https://patreon.com/nathanhawks if this bot helps you game.

## Legal

This software is released as-is under the terms of the UnLicense; it is available to the public domain.
