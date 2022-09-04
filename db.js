const {config} = require('./config');
const {logError, logWrite} = require('./log');
const {MongoClient} = require('mongodb');
const mdb = new MongoClient( config.dbUrl );
try {
  mdb.connect( (err, ) => {
    if (err) {
      logError(err);
      logError(`Can't proceed: terminating`);
      process.exit();
    }
    else {
      logWrite(`Connected to MongoDB`);
    }
  });
}
catch (e) {
  logError(`Caught: ${e}`);
}
class Database {
  constructor() {
    this.mdb = mdb;
  }
  static getTable(tableName) {
    return mdb.db("sr1egamebot").collection(tableName);
  }
}
module.exports = {db: new Database(), Database: Database};
