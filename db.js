const {getConfig} = require('./api');
const {MongoClient} = require('mongodb');
class Database {
  constructor() {
    this.mdb = new MongoClient( getConfig().dbUrl );
  }
  static getTable(tableName) {
    return this.mdb.db("sr1egamebot").collection(tableName);
  }
}
module.exports = {db: new Database()};
