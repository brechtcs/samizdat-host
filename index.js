var merry = require('merry')
var samizdat = require('samizdat-db')

module.exports = function (db, opts) {
    if (!opts) {
        opts = {}
    }
    if (!opts.logLevel) {
        opts.logLevel = 'fatal'
    }

    var db = samizdat(db)
    var host = merry(opts)

    host.route('GET', '/docs', function (req, res, app) {
        db.docs(function (err, docs) {
            if (err) {
                app.send(500, 'server error\n')
                return app.log.error(err)
            }

            app.send(200, docs.join('\n') + '\n')
        })
    })

    host.route('GET', '/docs/:id', function (req, res, app) {
        db.versions(app.params.id, function (err, versions) {
            if (err) {
                app.send(500, 'server error\n')
                return app.log.error(err)
            }

            app.send(200, versions.join('\n') + '\n')
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
                    if (err.docExists) app.send(400, 'document already exists\n')
                    else app.send(500, 'server error\n')
                    return app.log.error(err)
                }

                app.send(204, data.key)
            })
        })
    })

    host.route('GET', '/versions/:version', function (req, res, app) {
        db.read(app.params.version, function (err, value) {
            if (err)  {
                if (err.notFound) app.send(404, 'not found\n')
                else app.send(500, 'server error\n')
                return app.log.error(err)
            }

            app.send(200, value)
        })
    })

    host.route('DELETE', '/versions/:version', function (req, res, app) {
        db.del(app.params.version, function (err) {
            if (err) {
                app.send(500, 'server error\n')
                return app.log.error(err)
            }

            app.send(204, app.params.version)
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
                    app.send(500, 'server error\n')
                    return app.log.error(err)
                }

                app.send(204, data.key)
            })
        })
    })

    return host
}
