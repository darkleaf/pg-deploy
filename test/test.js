"use strict";

require('dotenv').load();

const assert = require('assert');
const pgp = require('pg-promise')();
const PgDeploy = require('../');

const db = pgp(process.env.DB_CONNECTION);
const pgDeploy = new PgDeploy({
    connectionString: process.env.DB_CONNECTION,
    beforeScripts: ['test/before-scripts/**/*.sql'],
    migrations: ['test/migrations/**/*.sql'],
    afterScripts: ['test/after-scripts/**/*.sql']
});

describe('PgDeploy', () => {
    before(() => {
        return Promise.resolve()
            .then(() => pgDeploy.dropLocalDb())
            .then(() => pgDeploy.createLocalDb())
    });

    before(() => pgDeploy.initMigrationTable());
    before(() => pgDeploy._markMigrationsAsPassed(['test/migrations/0-already-performed.sql']));
    before(() => pgDeploy.deploy());

    it('run before scripts', () => {
        return db
            .func('before_test_func', [42])
            .then(res => assert.equal(42, res[0].before_test_func))
    });

    it('run migration', () => {
        return db
            .any("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='test'")
            .then(rows => assert(rows.length == 1))
    });

    it('run after scripts', () => {
        return db
            .func('after_test_func', [42])
            .then(res => assert.equal(42, res[0].after_test_func))
    });
});
