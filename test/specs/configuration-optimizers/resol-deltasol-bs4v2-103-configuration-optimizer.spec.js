/*! resol-vbus | Copyright (c) 2013-2018, Daniel Wippermann | MIT license */
'use strict';



var _ = require('lodash');
var Q = require('q');


var vbus = require('../resol-vbus');

var testUtils = require('../test-utils');



var optimizerPromise = vbus.ConfigurationOptimizerFactory.createOptimizerByDeviceAddress(0x427B);



describe('ResolDeltaSolBs4V2103ConfigurationOptimizer', function() {

    describe('using ConfigurationOptimizerFactory', function() {

        promiseIt('should work correctly', function() {
            return testUtils.expectPromise(optimizerPromise).then(function(optimizer) {
                expect(optimizer).an('object');
            });
        });

    });

    describe('#completeConfiguration', function() {

        promiseIt('should work correctly', function() {
            return optimizerPromise.then(function(optimizer) {
                return Q.fcall(function() {
                    return testUtils.expectPromise(optimizer.completeConfiguration());
                }).then(function(config) {
                    expect(config).an('array').lengthOf(87);
                });
            });
        });

    });

    describe('#optimizeLoadConfiguration', function() {

        promiseIt('should work correctly after', function() {
            return optimizerPromise.then(function(optimizer) {
                return Q.fcall(function() {
                    return testUtils.expectPromise(optimizer.completeConfiguration());
                }).then(function(config) {
                    return testUtils.expectPromise(optimizer.optimizeLoadConfiguration(config));
                }).then(function(config) {
                    expect(config).an('array');

                    var valueIds = _.pluck(_.where(config, { pending: true }), 'valueId');
                    expect(valueIds).lengthOf(87);

                    _.forEach(config, function(value) {
                        if (value.pending) {
                            value.pending = false;
                            value.transceived = true;
                            value.value = null;
                        }
                    });

                    return testUtils.expectPromise(optimizer.optimizeLoadConfiguration(config));
                }).then(function(config) {
                    expect(config).an('array');

                    var valueIds = _.pluck(_.where(config, { pending: true }), 'valueId');
                    expect(valueIds).lengthOf(0);
                });
            });
        });

    });

});
