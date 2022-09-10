let vector, key;
function setupCrypto() {
  const crypto = require('crypto');
  const fs = require('fs');
  vector = JSON.parse(JSON.stringify(crypto.randomBytes(16)));
  key = JSON.parse(JSON.stringify(crypto.randomBytes(32)));
  fs.writeFile(`${__dirname}/crypto-vars.txt`,
    `this.cryptoVector = Buffer.from(${JSON.stringify(vector.data)});\n`
    + `this.cryptoKey = Buffer.from(${JSON.stringify(key.data)});\n`,
    (err) => { if (err) { console.log(err); }
  });
}
setupCrypto();
