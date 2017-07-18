#!/usr/bin/node

var host = require('./')
var level = require('level')
var minimist = require('minimist')

var opts = minimist(process.argv.slice(2))
var server = host(level('data'), {
    logLevel: opts.silent || opts.s ? 'fatal' : 'info'
})

server.route('GET', '/*', function (req, res, app) {
    app.send(404, 'endpoint does not exist\n')
})

server.listen(opts.port || opts.p || 8516)
