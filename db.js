const {getConfig} = require('./api');
const {MongoClient, ObjectId} = require('mongodb');
class Database {
  constructor() {
    this.mdb = new MongoClient( getConfig().dbUrl );
  }
  static getTable(tableName) {
    return this.mdb.collection("sr1egamebot");
  }
}
module.exports = {db: new Database()};
