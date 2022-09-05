const {setUserOption} = require('./api');
async function handleSkipStatusCommand(msg) {
  await setUserOption(
    msg.author, 'skipStatusMsg', global.maintenanceStatusMessage
  );
  msg.reply()
}
module.exports = {
  handleSkipStatusCommand
};
