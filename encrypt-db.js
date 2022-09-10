const {Database, db} = require('./db');
const {encrypt} = require('./api');
const {ObjectId} = require('mongodb');
async function encryptNonSystemFolders() {
  db.mdb.connect( async (err, ) => {
    if (err) {
      console.log(err);
      console.log(`Can't proceed: terminating`);
      process.exit();
    }
    else {
      const query = {encrypted: undefined};
      const c = Database.getTable("folders").find(query);
      let count = 0;
      let encrypted = 0;
      const sysFolders = ['UserData', 'reminders', 'options'];
      await c.forEach((r) => {
        count++;
        if (sysFolders.indexOf(r.name) > -1) {
          const filter = {
            _id: ObjectId(r._id.toString())
          };
          const doc = { $set: {
            encrypted: false
          }};
          Database.getTable("folders").updateOne(filter, doc);
          return;
        }
        if (r.encrypted) return;
        encrypted++;
        const filter = {
          _id: ObjectId(r._id.toString())
        };
        const doc = { $set: {
          name: encrypt(r.name),
          encrypted: true,
        }};
        Database.getTable("folders").updateOne(filter, doc)
      });
      console.log(`${count} folders processed, ${encrypted} encrypted.`);
    }
  });
}
async function encryptStrings() {
  db.mdb.connect( async (err, ) => {
    if (err) {
      console.log(err);
      console.log(`Can't proceed: terminating`);
      process.exit();
    }
    else {
      const query = {encrypted: undefined};
      const c = Database.getTable("strings").find(query);
      let count = 0;
      let encrypted = 0;
      await c.forEach((r) => {
        count++;
        if (r.encrypted) return;
        encrypted++;
        const filter = {
          _id: ObjectId(r._id.toString())
        };
        const doc = { $set: {
          content: encrypt(r.content),
          encrypted: true,
        }};
        Database.getTable("strings").updateOne(filter, doc)
      });
      console.log(`${count} strings processed, ${encrypted} encrypted.`);
    }
  });
}

// All folders except system folders must be encrypted
encryptNonSystemFolders();
// All strings must be encrypted
encryptStrings();
