"use strict";

const pify = require('pify');
const glob = pify(require('glob'));
const exec = pify(require('child_process').exec);
const fs = pify(require('fs'));
const pgp = require('pg-promise')(/*options*/);
const parseConnectionString = require('pg-connection-string').parse;

function flatArray(array) {
    return Array.prototype.concat.apply([], array);
}

function identityTransformation(fileContent) {
    return Promise.resolve(fileContent);
}

function promiseChain(initialPromise, thenFns) {
    return thenFns.reduce((previous, thenFn) => previous.then(thenFn), initialPromise)
}

function applyTransformations(initialContent, transformations) {
    const initialPromise = Promise.resolve(initialContent);
    const thenFns = transformations.map(t => content => t(content));
    return promiseChain(initialPromise, thenFns);
}

const defaultOptions = {
    connectionString: undefined,
    beforeScripts: [],
    migrations: [],
    afterScripts: [],
    structurePath: '',
    migrationsTableName: 'pg_deploy_migrations',
    transformations: [identityTransformation]
};

class PgDeploy {
    constructor(options) {
        this.options = Object.assign(defaultOptions, options);
        this.db = pgp(this.options.connectionString);
        this.connectionOptions = parseConnectionString(this.options.connectionString)
    }

    _runScript(db, path) {
        return fs.readFile(path, 'utf8')
            .then(content => applyTransformations(content, this.options.transformations))
            .then(content => db.none(content));
    }

    _runMigration(db, path) {
        return db.tx(tx => {
            return tx.batch([
                this._runScript(tx, path),
                this._markMigrationAsPassed(tx, path)
            ])
        })
    }

    _runScriptsInParallel(paths) {
        return this.db.task(t => {
            return t.batch(paths.map(path => {
                return t.tx(tx => this._runScript(tx, path))
            }))
        })
    }

    _runMigrationsSequentially(paths) {
        const initial = Promise.resolve();
        return this.db.task(t => {
            const thenFns = paths.map(path => () => this._runMigration(t, path));
            return promiseChain(initial, thenFns)
        })
    }

    _getFilePaths(patterns) {
        return Promise.all(patterns.map(pattern => glob(pattern))).then(flatArray);
    }

    _getPassedMigrations() {
        return this.db
            .manyOrNone("SELECT name from ${migrationsTableName^};", this.options)
            .then(rows => rows.map(r => r.name));
    }

    _runScriptsFromGlobs(globs) {
        return Promise.resolve()
            .then(() => this._getFilePaths(globs))
            .then(paths => this._runScriptsInParallel(paths));
    }

    _selectNewMigrationFiles(all, passed) {
        //TODO: use set
        return all.filter(path => passed.indexOf(path) == -1)
    }

    _markMigrationAsPassed(db, path) {
        return db.none(
            "INSERT INTO ${migrationsTableName^}(name) VALUES(${path})",
            {path, migrationsTableName: this.options.migrationsTableName})
    }

    initMigrationTable() {
        return this.db.query("CREATE TABLE IF NOT EXISTS ${migrationsTableName^} (name TEXT);", this.options);
    }

    runBeforeScripts() {
        return this._runScriptsFromGlobs(this.options.beforeScripts);
    }

    runMigrations() {
        return Promise.all([this._getFilePaths(this.options.migrations), this._getPassedMigrations()])
            .then(allAndPassed => this._selectNewMigrationFiles(allAndPassed[0], allAndPassed[1]))
            .then(paths => this._runMigrationsSequentially(paths))
    }

    runAfterScripts() {
        return this._runScriptsFromGlobs(this.options.afterScripts);
    }

    /* TODO: implement */
    //saveStructure() {
    //    return Promise.resolve();
    //}

    createLocalDb() {
        return exec(`createdb -U ${this.connectionOptions.user} ${this.connectionOptions.database}`)
    }

    dropLocalDb() {
        return exec(`dropdb --if-exists -U ${this.connectionOptions.user} ${this.connectionOptions.database}`)
    }

    deploy() {
        return Promise.resolve()
            .then(() => this.initMigrationTable())
            .then(() => this.runBeforeScripts())
            .then(() => this.runMigrations())
            .then(() => this.runAfterScripts())
            //.then(() => this.saveStructure())
            .then()
    }
}

module.exports = PgDeploy;
