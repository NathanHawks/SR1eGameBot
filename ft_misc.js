const {logError} = require('./log');
const {setUserOption} = require('./api');
async function handleSkipStatusCommand(msg) {
  await setUserOption(
    msg.author, 'skipStatusMsg', global.maintenanceStatusMessage
  );
  msg.reply(`Your commands won't include status messages again until the message changes.`)
  .catch((e)=>{ logError(e); })
}
module.exports = {
  handleSkipStatusCommand
};
