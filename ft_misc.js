const {logError} = require('./log');
const {setUserOption, getUserOption} = require('./api');
async function handleSkipStatusCommand(msg) {
  let status = await setUserOption(
    msg.author, 'skipStatusMsg', global.maintenanceStatusMessage
  );
  if (status !== false)
    msg.reply(
      `Responses to your commands won't include status messages again until `
      + `the message changes.`
    )
    .catch((e)=>{ logError(e); })
  else
    msg.reply(`Something went wrong. Try again.`).catch((e)=>{ logError(e); });
}
async function handleLinkCodeCommand(msg, args) {
  try {
    logError('Got here');
    const code = await getUserOption(msg.author, 'webLinkCode');
    if (code) {
      msg.reply(`You've already linked this account to the website.`)
      .catch((e) => { logError(e); });
      return;
    }
    else if (
      args.length !== 1
      || args[0].split('/').length !== 2
    ) {
      msg.reply(`Incorrect code input. Use the button on the website to copy the `
        + `full code and command.`)
      .catch((e) => { logError(e); });
      return;
    }
    else {
      await setUserOption(msg.author, 'webLinkCode', args[0]);
      msg.reply(`Link code registered.`).catch((e) => { logError(e); });
      return 1;
    }
  }
  catch (e) { logError(e); }
}
module.exports = {
  handleSkipStatusCommand, handleLinkCodeCommand
};
