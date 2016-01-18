const assert = require('assert');
const pgp = require('pg-promise')();
const parseConnectionString = require('pg-connection-string').parse;
const pify = require('pify');
const exec = pify(require('child_process').exec);

require('dotenv').load();
assert(process.env.DB_CONNECTION);

const dbConfig = parseConnectionString(process.env.DB_CONNECTION);
assert(dbConfig.user);
assert(dbConfig.database);

module.exports = {
    createDb() {
        return exec(`createdb -U ${dbConfig.user} ${dbConfig.database}`)
    },

    dropDb() {
        return exec(`dropdb --if-exists -U ${dbConfig.user} ${dbConfig.database}`)
    },

    getDb() {
        return pgp(process.env.DB_CONNECTION)
    }
};
