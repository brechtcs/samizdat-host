var merry = require('merry')
var samizdat = require('samizdat')
var util = require('samizdat/key')

module.exports = function (db, opts) {
    if (!opts) {
        opts = {}
    }
    if (!opts.logLevel) {
        opts.logLevel = 'fatal'
    }

    var db = samizdat(db)
    var host = merry(opts)

    host.route('GET', '/docs/:id', function (req, res, app) {
        var found = false

        db._level.createKeyStream().on('data', function (key) {
            if (util.getId(key) === app.params.id) {
                if (!found) {
                    found = true
                    res.writeHead(200)
                }
                res.write(key)
                res.write('\n')
            }
        }).on('end', function () {
            if (!found) {
                res.writeHead(404)
                res.end('document not found\n')
            }
            else {
                res.end()
            }
        })
    })

    host.route('POST', '/docs/:id', function (req, res, app) {
        var body = ''

        req.on('data', function (data) {
            body += data
        })

        req.on('end', function () {
            db.create(app.params.id, body, function (err, data) {
                if (err) {
                    if (err.idExists) app.send(400, 'document already exists\n')
                    else app.send(500, 'host error\n')
                    return app.log.error(err)
                }

                app.send(204, data.key)
            })
        })
    })

    host.route('GET', '/versions/:version', function (req, res, app) {
        if (!util.validateKey(app.params.version)) {
            app.send(400, 'not a valid version key\n')
            return app.log.error(app.params.version)
        }

        db.read(app.params.version, function (err, data) {
            if (err)  {
                if (err.notFound) app.send(404, 'not found\n')
                else app.send(500, 'host error \n')
                return app.log.error(err)
            }

            app.send(200, data.value)
        })
    })

    host.route('POST', '/versions/:version', function (req, res, app) {
        var body = ''

        req.on('data', function (data) {
            body += data
        })

        req.on('end', function () {
            db.update(app.params.version, body, function (err, data) {
                if (err) {
                    app.send(500, 'host error\n')
                    return app.log.error(err)
                }

                app.send(204, data.key)
            })
        })
    })

    return host
}
