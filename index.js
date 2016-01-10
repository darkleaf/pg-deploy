"use strict";

const glob = require('glob');
var pgp = require('pg-promise')(/*options*/);

function globp(pattern, options) {
    return new Promise((resolve, reject) => {
        glob(pattern, options, (err, files) => {
            err ? reject(err) : resolve(files);
        })
    });
}

function promiseChain(functions, initial) {
    if (!initial) initial = Promise.resolve();
    return functions.reduce((previous, func) => previous.then(func), initial)
}

function getFilePaths(patterns) {
    return Promise
        .all(patterns.map(pattern => globp(pattern)))
        .then(fileGroups => Array.prototype.concat.apply([], fileGroups))

}

function runMigration(db, filePath) {
    return Promise.resolve();
}

function runMigrations(db, migrationsGlobs) {
    return function() {
        return db
            .any(`SELECT name FROM migrations`)
            .then(res => console.log(res))
            .then(() => getFilePaths(migrationsGlobs))
    };
    //    .then((paths) => promiseChain(paths.map(path => runMigration(db, path))))
}

function initTables(db) {
    return function() {
        return db.query(`CREATE TABLE IF NOT EXISTS migrations (name TEXT);`);
    }
}

module.exports.deploy = function(rawOptions) {
    const defaultOptions = {
        migrations: []
    };
    const options = Object.assign(defaultOptions, rawOptions);


    const db = pgp('postgres://postgres@/pg-deploy');



    return Promise.resolve()
        .then(initTables(db))
        .then(runMigrations(db, options.migrations))



    //pg.connect('postgres', function(err, client, done) {
    //    client.query('SELECT $1::int AS number', ['1'], function(err, result) {
    //        call `done()` to release the client back to the pool
            //done();
            //console.log(result.rows[0].number);
            //output: 1
        //});
    //});
    //
    //
    //
    //console.log(migrations);
};
