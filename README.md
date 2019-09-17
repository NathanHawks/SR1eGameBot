# SR1eGameBot
A discord dicebot for SR1e, which may someday have additional tools to help run Shadowrun 1st Edition over Discord. 

### Roll Dice

<pre>!X         Roll Xd6 without exploding 6's
           example: !5   rolls 5d6 without exploding
!X!        Roll Xd6 with exploding 6's
           example: !5!  rolls 5d6 with exploding</pre>

### Roll Dice vs Target Number

<pre>!X tnY     Roll without exploding 6's against Target Number Y  
           example: !5 tn4   rolls 5d6 vs TN4 (no exploding)
!X! tnY    Roll with exploding 6's against Target Number Y
           example: !5! tn4   rolls 5d6 w/ exploding vs TN4</pre>

NO SPACE between "TN" and number; example:
<pre>!5! TN4     is correct
!5! TN 4    won't work</pre>

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

!A! tnB vsX! otnY
   Roll Ad6 (exploding) with tn B, opposed by Xd6 (exploding) with opponent's tn Y
   vsX = the number of dice the opponent throws (vsX! for exploding dice)
   otnY = the opponent's target number
  example: !5! tn3 vs6! otn4    Roll 5d6 (exploding) with TN 3, against 6d6 (exploding) with TN 4

## Legal

This software is released as-is under the terms of the UnLicense; it is available to the public domain.
