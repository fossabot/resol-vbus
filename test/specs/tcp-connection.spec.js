/*! resol-vbus | Copyright (c) 2013-2018, Daniel Wippermann | MIT license */
'use strict';



var _ = require('lodash');
var Q = require('q');


var vbus = require('./resol-vbus');



var TcpConnection = vbus.TcpConnection;
var TcpConnectionEndpoint = vbus.TcpConnectionEndpoint;



var testConnection = function(done, callback) {
    var endpoint = new TcpConnectionEndpoint({
        port: 0,
    });

    var infos = [];

    var onConnection = function(info) {
        infos.push(info);
    };

    endpoint.on('connection', onConnection);

    var onEpiConnection;

    var createEndpointInfoPromise = function() {
        var deferred = Q.defer();

        if (onEpiConnection) {
            endpoint.removeListener('connection', onEpiConnection);
        }

        onEpiConnection = function(info) {
            onEpiConnection = null;

            deferred.resolve(info);
        };

        endpoint.once('connection', onEpiConnection);

        return deferred.promise;
    };

    var connection = new TcpConnection({
        host: '127.0.0.1',
    });

    Q.fcall(function() {
        return endpoint.start();
    }).then(function() {
        connection.port = endpoint.port;

        expect(connection.connectionState).to.equal(TcpConnection.STATE_DISCONNECTED);

        return callback(connection, endpoint, createEndpointInfoPromise);
    }).finally(function() {
        connection.disconnect();
        endpoint.stop();

        _.forEach(infos, function(info) {
            info.socket.end();
        });

        if (onEpiConnection) {
            endpoint.removeListener('connection', onEpiConnection);
        }

        endpoint.removeListener('connection', onConnection);
    }).done(function() {
        done();
    }, function(err) {
        done(err);
    });
};



describe('TcpConnection', function() {

    describe('constructor', function() {

        it('should be a constructor function', function() {
            expect(TcpConnection).to.be.a('function');
            expect(TcpConnection.extend).to.be.a('function');
        });

        it('should have reasonable defaults', function() {
            var connection = new TcpConnection();

            expect(connection.host).to.equal(null);
            expect(connection.port).to.equal(7053);
            expect(connection.viaTag).to.equal(null);
            expect(connection.password).to.equal(null);
            expect(connection.rawVBusDataOnly).to.equal(false);
        });

        it('should copy selected options', function() {
            var options = {
                host: 'HOST',
                port: 12345,
                viaTag: 'VIATAG',
                password: 'PASSWORD',
                rawVBusDataOnly: true,
                junk: 'JUNK',
            };

            var connection = new TcpConnection(options);

            expect(connection.host).to.equal(options.host);
            expect(connection.port).to.equal(options.port);
            expect(connection.viaTag).to.equal(options.viaTag);
            expect(connection.password).to.equal(options.password);
            expect(connection.rawVBusDataOnly).to.equal(options.rawVBusDataOnly);
            expect(connection.junk).to.equal(undefined);
        });

    });

    describe('#connect', function() {

        it('should be a method', function() {
            expect(TcpConnection.prototype).to.have.a.property('connect').that.is.a('function');
        });

        it('should work correctly if disconnected', function(done) {
            testConnection(done, function(connection, endpoint, createEndpointInfoPromise) {
                var onConnectionState = sinon.spy();

                var options = {
                    viaTag: 'VIATAG',
                    password: 'PASSWORD',
                };

                _.extend(connection, options);
                connection.channelListCallback = sinon.spy(function(channels, done) {
                    done(null, '9:Test');
                });

                connection.on('connectionState', onConnectionState);

                var epiPromise = createEndpointInfoPromise();

                return Q.fcall(function() {
                    return connection.connect();
                }).then(function() {
                    return epiPromise;
                }).then(function(epi) {
                    expect(connection.connectionState).to.equal(TcpConnection.STATE_CONNECTED);
                    expect(onConnectionState.callCount).to.equal(2);
                    expect(onConnectionState.firstCall.args [0]).to.equal(TcpConnection.STATE_CONNECTING);
                    expect(onConnectionState.secondCall.args [0]).to.equal(TcpConnection.STATE_CONNECTED);

                    expect(epi.viaTag).to.equal(options.viaTag);
                    expect(epi.password).to.equal(options.password);
                    expect(epi.channel).to.equal('9');

                    expect(connection.channelListCallback.callCount).to.equal(1);
                }).finally(function() {
                    connection.removeListener('connectionState', onConnectionState);
                });
            });
        });

        it('should throw if not disconnected', function(done) {
            testConnection(done, function(connection, endpoint) {
                return Q.fcall(function() {
                    return connection.connect();
                }).then(function() {
                    expect(function() {
                        connection.connect();
                    }).to.throw();
                });
            });
        });

    });

    describe('#disconnect', function() {

        it('should be a method', function() {
            expect(TcpConnection.prototype).to.have.a.property('disconnect').that.is.a('function');
        });

        it('should work correctly if disconnected', function(done) {
            testConnection(done, function(connection) {
                connection.disconnect();

                expect(connection.connectionState).to.equal(TcpConnection.STATE_DISCONNECTED);
            });
        });

        it('should work correctly if connected', function(done) {
            testConnection(done, function(connection) {
                var onConnectionState = sinon.spy();

                connection.on('connectionState', onConnectionState);

                return Q.fcall(function() {
                    return connection.connect();
                }).then(function() {
                    return connection.disconnect();
                }).finally(function() {
                    connection.removeListener('connectionState', onConnectionState);
                });
            });
        });

    });

    describe('Automatic reconnection', function() {

        it('should reconnect when connected', function(done) {
            testConnection(done, function(connection, endpoint, createEndpointInfoPromise) {
                var onConnectionState = sinon.spy();

                connection.on('connectionState', onConnectionState);

                var epiPromise = createEndpointInfoPromise();

                return Q.fcall(function() {
                    return connection.connect();
                }).then(function() {
                    return epiPromise;
                }).then(function(epi) {
                    expect(onConnectionState.callCount).to.equal(2);
                    expect(onConnectionState.firstCall.args [0]).to.equal(TcpConnection.STATE_CONNECTING);
                    expect(onConnectionState.secondCall.args [0]).to.equal(TcpConnection.STATE_CONNECTED);

                    epiPromise = createEndpointInfoPromise();

                    epi.socket.end();
                }).then(function() {
                    return epiPromise;
                }).then(function() {
                    expect(onConnectionState.callCount).to.equal(4);
                    expect(onConnectionState.getCall(2).args [0]).to.equal(TcpConnection.STATE_INTERRUPTED);
                    expect(onConnectionState.getCall(3).args [0]).to.equal(TcpConnection.STATE_RECONNECTING);

                    return connection.disconnect();
                }).finally(function() {
                    connection.removeListener('connectionState', onConnectionState);
                });
            });

        });

    });

});
