# SR1eGameBot

## What It Is

A Discord dicebot for SR1e/2e/3e, which also has an **experimental initiative system** to help run Shadowrun 1st-3rd Editions over Discord.

## How to Install

[Click here to deploy the bot on your server](https://discordapp.com/oauth2/authorize?client_id=609274260007026689&scope=bot&permissions=0).

## Shadowrun Dicebot Features

### :game_die: Plain Old d6\'s :game_die:

* !***X***<br/>Roll ***X***d6 *without* Rule of 6<br/>***example:*** !5        rolls 5d6 *without* Rule of 6
* !X***t***<br/>Roll Xd6 *and total them*.<br/>***example:*** !6t       rolls 6d6 and *adds them up*.
* !Xt ***+Z***<br/>Roll Xd6, total them, and *add or subtract a modifier*.<br/>***example:*** !6t -5    rolls 6d6, totals them, and *subtracts 5 from the total*.

### :six: Rule of 6 & Target Numbers :dart:

* ***!X!***<br/>Roll ***X***d6 ***with*** Rule of 6<br/>***example:*** !5!       rolls 5d6 *with Rule of 6*
* !X ***tnY***<br/>Roll *without* Rule of 6 against Target Number ***Y***<br/>***example:*** !5 tn4    rolls 5d6 w/o Rule of 6 vs TN4
* ***!X! tnY***<br/>Roll ***with*** Rule of 6 against Target Number ***Y***<br/>***example:*** !5! tn4   rolls 5d6 w/ Rule of 6 vs TN4

### :boxing_glove: Opposed Rolls :boxing_glove:

!A! tnB ***vsX!*** ***otnY***<br/>Roll *A*d6 (with Rule of 6) with tn *B*, opposed by *X*d6 (with Rule of 6) with opponent\'s TN *Y*<br/>***vsX*** = the number of dice the opponent throws (***vsX!*** for Rule of 6)<br/>***otnY*** = the opponent\'s target number

***example:*** !5! tn3 vs6! otn4<br/>Roll 5d6 (Rule of 6) with TN 3, against 6d6 (Rule of 6) with TN 4

### :1234: Multiple Rolls per Message :1234:

You can order GameBot to do multiple rolls with one message. Just separate the dice commands with semicolons.

***example:*** !1 ; 2t ; 3!; 4t +5 and a note for good measure

### :label: Notes :label:

Notes are OK, and your options can be in the middle of the note.

examples:

*  !3! TN4 resist wagemage sorcery :arrow_left: works
*  !3! resist wagemage sorcery TN4 :arrow_left: works
*  !3! resist TN4 wagemage sorcery :arrow_left: works
*  resist wagemage sorcery !3! TN4 :arrow_left: won\'t work

### :fast_forward: Macros (Saved Rolls) :fast_forward:

* !***save*** *name* *roll_command_without_preceding_bang*<br/>Creates or updates a named "dice command". *(See all the sections above for valid "dice commands".)*
* !***roll*** *name*<br/>Rolls the saved "dice command" with the given name.
* !***lm***<br/>Lists your saved dice command macros for that channel.
* !***removemacro*** *name* or !***rmm*** *name*<br/>Removes one of your saved macros in that channel.

### :recycle: Reroll :recycle:

* Anyone can click the :game_die: reaction to reroll any *recent* roll.
* Remove and re-add your reaction to keep re-rolling that roll.

## :boom: EXPERIMENTAL: Initiative System :boom:

### Player setup:

  :one: !setgm @someone

  :two: !setinit X Y

### GM setup:

  :one: !setgm

  :two: !setplayers @player1 @player2 (etc)

  :three: !setnpcinits (see below)

  **!setinit** syntax is **!setinit X Y** where X is the number of dice and Y is the modifier. For example, !setinit 1 4 sets your initiative formula to 1d6+4.

  IMPORTANT: Commands won't work unless you @people correctly. Use the menu that pops-up while you type, or tab-completion.  **If it's blue with an underline, you did it right.**

### :game_die: **Rolling Initiative** :game_die:

  :arrow_right: **!init** - Shadowrun 1e initiative

  :arrow_right: **!initflip** - Shadowrun 1e initiative, reversed

  :arrow_right: **!init2** - Shadowrun 2e initiative

  :arrow_right: **!init2flip** - Shadowrun 2e initiative, reversed

  :arrow_right: **!init3** - Shadowrun 3e initiative

  :arrow_right: **!init3flip** - Shadowrun 3e initiative, reversed

  The bot remembers stuff; you won't need to redo setup, just update whatever changes. ***However:***

  :arrow_right: Everything is linked to GM **and chat channel.**

  :arrow_right: If you move to a different channel, you must re-enter everything.

  :arrow_right: Multiple GM's can share a channel, but anyone playing in both groups must repeat their set-up steps (starting with !setgm).

  :arrow_right: To play in two games at the same time, you'll need two channels.

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

## Misc ##

  All initiative-related and macro-related commands are a little slow. They get faster after the first use. The :hourglass_flowing_sand: reaction means it's working on your request.

  Commands are not case-sensitive. Go WiLd WitH tHaT.

  You can find my Patreon at https://patreon.com/nathanhawks if this bot helps you game.

## Legal

This software is released as-is under the terms of the UnLicense; it is available to the public domain.
