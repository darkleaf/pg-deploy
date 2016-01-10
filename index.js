"use strict";

const pify = require('pify');
const glob = require('glob');
const pgp = require('pg-promise')(/*options*/);
const fs = require('fs');

const MIGRATIONS_TABLE_NAME = 'pg_deploy_migrations';


//function promiseChain(functions, initial) {
//    if (!initial) initial = Promise.resolve();
//    return functions.reduce((previous, func) => previous.then(func), initial)
//}

function flatArray(array) {
    return Array.prototype.concat.apply([], array);
}

function getFilePaths(patterns) {
    return Promise.all(patterns.map(pattern => pify(glob)(pattern)))
        .then(flatArray);
}

function getPassedMigrations(db) {
    return db
        .manyOrNone(`SELECT name from ${MIGRATIONS_TABLE_NAME};`)
        .then(r => console.log(r))
}

//function runMigration(db, filePath) {
//    return Promise.resolve();
//}
//




function initTables(db) {
    return db.query(`CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE_NAME} (name TEXT);`);
}


function runScript(db, path) {
    pify(fs.readFile)(path, 'utf8')
        .then(content => db.query(content));
}

function runScripts(db, globs) {
    return Promise.resolve()
        .then(() => getFilePaths(globs))
        .then(paths => Promise.all(paths.map(path => runScript(db, path))));
}

function runMigrations(db, globs) {
    return Promise.all([getFilePaths(globs), getPassedMigrations(db)])

        //.then(getFilePaths(globs))
        //.then(getPassedMigrations(db))

    //.then((paths) => promiseChain(paths.map(path => runMigration(db, path))))
}

function saveStructure() {
    return Promise.resolve();
}

module.exports.deploy = function(rawOptions) {
    const defaultOptions = {
        beforeScripts: [],
        migrations: [],
        afterScripts: [],
        structurePath: ''
    };
    const options = Object.assign(defaultOptions, rawOptions);


    const db = pgp('postgres://postgres@/pg-deploy');

    return Promise.resolve()
        .then(() => initTables(db))
        .then(() => runScripts(db, options.beforeScripts))
        .then(() => runMigrations(db, options.migrations))
        .then(() => runScripts(db, options.afterScripts))
        .then(() => saveStructure(db, options.structurePath))
        .then(() => undefined)
};
