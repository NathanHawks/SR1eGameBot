class DiceBotConfig {
  constructor() {
    this.logspam = true;
    this.dbUrl = ``;
    this.cryptoVector = undefined;
    this.cryptoKey = undefined;
  }
}
const config = new DiceBotConfig();
module.exports = {config};
