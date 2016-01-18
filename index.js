"use strict";

const pify = require('pify');
const glob = pify(require('glob'));
const pgp = require('pg-promise')(/*options*/);

function flatArray(array) {
    return Array.prototype.concat.apply([], array);
}

const defaultOptions = {
    beforeScripts: [],
    migrations: [],
    afterScripts: [],
    structurePath: '',
    migrationsTableName: 'pg_deploy_migrations'
};

class PgDeploy {
    constructor(options) {
        this.db = pgp('postgres://postgres@/pg-deploy');
        this.options = Object.assign(defaultOptions, options)
    }

    _runScript(path) {
        const script = new pgp.QueryFile(path);
        return this.db.none(script);
    }

    _runScriptsInParallel(paths) {
        return Promise.all(paths.map(path => this._runScript(path)));
    }

    _runScriptsSequentially(paths) {
        const initial = Promise.resolve();
        return paths.reduce((previous, path) => previous.then(() => this._runScript(path)), initial)
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

    _markMigrationsAsPassed(paths) {
        const values = paths.map(path => pgp.as.format("($1)", path)).join(', ');
        return this.db.none(
            "INSERT INTO ${migrationsTableName^}(name) VALUES${values^}",
            {values, migrationsTableName: this.options.migrationsTableName})
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
            .then(paths => Promise.all([this._runScriptsSequentially(paths), this._markMigrationsAsPassed(paths)]))
    }

    runAfterScripts() {
        return this._runScriptsFromGlobs(this.options.afterScripts);
    }

    saveStructure() {
        //TODO: implement
        return Promise.resolve();
    }

    deploy() {
        return Promise.resolve()
            .then(() => this.initMigrationTable())
            .then(() => this.runBeforeScripts())
            .then(() => this.runMigrations())
            .then(() => this.runAfterScripts())
            .then(() => this.saveStructure())
            .then()
    }
}

module.exports = PgDeploy;
