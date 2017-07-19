var host = require('./')
var level = require('level')
var minimist = require('minimist')

var server = host(level('data'), {logLevel: 'trace'})

server.route('GET', '/*', function (req, res, app) {
    app.send(404, 'endpoint does not exist\n')
})

server.listen(8516)
