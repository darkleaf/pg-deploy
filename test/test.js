"use strict";

const assert = require('assert');
const pgp = require('pg-promise')();


const db = pgp('postgres://postgres@/pg-deploy');

const PgDeploy = require('../');


function addAlreadyPerformed(db, name) {
    return db.none("INSERT INTO pg_deploy_migrations(name) VALUES(${name})", {name})
}

describe('PgDeploy', () => {
    before(done => {
        PgDeploy
            .deploy({
                beforeScripts: ['test/before-scripts/**/*.sql'],
                migrations: ['test/migrations/**/*.sql'],
                afterScripts: ['test/after-scripts/**/*.sql']
            })
            .then(done, done);
    });

    before(done => {
        addAlreadyPerformed(db, 'test/migrations/0-already-performed.sql')
            .then(done, done);
    });

    it('run before scripts', (done) => {
        db
            .func('before_test_func', [42])
            .then(res => assert.equal(42, res[0].before_test_func))
            .then(done, done);
    });

    it('run after scripts', (done) => {
        db
            .func('after_test_func', [42])
            .then(res => assert.equal(42, res[0].after_test_func))
            .then(done, done);
    });
});
