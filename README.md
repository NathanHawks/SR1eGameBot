# SR1eGameBot

## What It Is

A Discord dicebot for SR1e/2e/3e, which also has an **experimental initiative system** to help run Shadowrun 1st-3rd Editions over Discord.

## How to Install

[Click here to deploy the bot on your server](https://discordapp.com/oauth2/authorize?client_id=609274260007026689&scope=bot&permissions=0).

## Shadowrun Dicebot Features

### Roll Dice (d6's only)

<pre>!X         Roll Xd6 without exploding 6's
           example: !5   rolls 5d6 without exploding
!X!        Roll Xd6 with exploding 6's
           example: !5!  rolls 5d6 with exploding</pre>

### Roll Dice vs Target Number

<pre>!X tnY     Roll without exploding 6's against Target Number Y  
           example: !5 tn4   rolls 5d6 vs TN4 (no exploding)
!X! tnY    Roll with exploding 6's against Target Number Y
           example: !5! tn4   rolls 5d6 w/ exploding vs TN4</pre>

### Adding Notes to the Command

Notes are OK, and your TN can even be in the middle of the note.

examples:
<pre>
  !3! TN4 resist wagemage sorcery      works
  !3! resist wagemage sorcery TN4      works
  !3! resist TN4 wagemage sorcery      works
  resist wagemage sorcery !3! TN4      won't work</pre>

### Reroll

Anyone can click the :game_die: reaction to reroll your roll.
Remove and re-add your "reaction" to keep re-rolling that roll.

### Opposed Rolls

<pre>!A! tnB vsX! otnY
   Roll Ad6 (exploding) with tn B, opposed by Xd6 (exploding) with opponent's tn Y
   vsX = the number of dice the opponent throws (vsX! for exploding dice)
   otnY = the opponent's target number
  example: !5! tn3 vs6! otn4    Roll 5d6 (exploding) with TN 3, against 6d6 (exploding) with TN 4</pre>

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

  ```Shortcut  Full command    [Required] options
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

  **!setnpcinit** and **!addnpcinit** syntax: **!(command) X Y label** -- labels cannot have spaces or commas --e.g. **!addnpcinit 1 5 thugs** (means the thugs have 1d6+5 initiative). Add as many NPCs as you want, separated by spaces.

  If you have multiple NPC's with the same label, **!removeNPCInits** also accepts the format !removenpcinits X Y label which requires a full match. But, having multiple NPC's with the same label is confusing anyway, so maybe just don't do that.

  All initiative-related commands are slow. The :hourglass_flowing_sand: reaction means it's working on your request.

  Commands are not case-sensitive. Go WiLd WitH tHaT.

## Legal

This software is released as-is under the terms of the UnLicense; it is available to the public domain.
