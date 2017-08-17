var host = require('./')
var level = require('level')
var minimist = require('minimist')
var samizdat = require('samizdat-db')

var db = level('data', {valueEncoding: 'binary'})
var server = host(samizdat(db), {logLevel: 'trace'})

server.route('GET', '/*', function (req, res, app) {
    app.send(404, 'endpoint does not exist\n')
})

server.listen(8516)
