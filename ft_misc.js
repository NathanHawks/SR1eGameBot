const {logError} = require('./log');
const {setUserOption} = require('./api');
async function handleSkipStatusCommand(msg) {
  let status = await setUserOption(
    msg.author, 'skipStatusMsg', global.maintenanceStatusMessage
  );
  if (status !== false)
    msg.reply(`Your commands won't include status messages again until the message changes.`)
    .catch((e)=>{ logError(e); })
  else
    msg.reply(`Something went wrong. Try again.`).catch((e)=>{ logError(e); });
}
module.exports = {
  handleSkipStatusCommand
};
