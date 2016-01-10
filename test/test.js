"use strict";

const assert = require('assert');

const PgDeploy = require('../');

describe('PgDeploy', () => {

    it('ok', (done) => {
        PgDeploy
            .deploy({migrations: ['test/migrations/**/*.sql']})
            .then(done, done);



        //assert.equal(-1, [1,2,3].indexOf(5));
        //assert.equal(-1, [1,2,3].indexOf(0));
    });
});
