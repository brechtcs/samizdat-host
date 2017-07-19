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
                res.writeHead(500)
                res.end('server error\n')
                return app.log.error(err)
            }

            res.writeHead(200)
            res.end(docs.join('\n') + '\n')
        })
    })

    host.route('GET', '/docs/:id', function (req, res, app) {
        db.versions(app.params.id, function (err, versions) {
            if (err) {
                res.writeHead(500)
                res.end('server error\n')
                return app.log.error(err)
            }

            res.writeHead(200)
            res.end(versions.join('\n') + '\n')
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
                    if (err.docExists) {
                        res.writeHead(400)
                        res.end('document already exists\n')
                    }
                    else {
                        res.writeHead(500)
                        res.end('server error\n')
                    }
                    return app.log.error(err)
                }

                res.writeHead(204)
                res.end(data.key)
            })
        })
    })

    host.route('GET', '/versions/:version', function (req, res, app) {
        db.read(app.params.version, function (err, value) {
            if (err)  {
                if (err.notFound) {
                    res.writeHead(404)
                    res.end('not found\n')
                }
                else {
                    res.writeHead(500)
                    res.end('server error\n')
                }
                return app.log.error(err)
            }

            res.writeHead(200)
            res.end(value)
        })
    })

    host.route('DELETE', '/versions/:version', function (req, res, app) {
        db.del(app.params.version, function (err) {
            if (err) {
                res.writeHead(500)
                res.end('server error\n')
                return app.log.error(err)
            }

            res.writeHead(204)
            res.end(app.params.version)
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
                    res.writeHead(500)
                    res.end('server error\n')
                    return app.log.error(err)
                }

                res.writeHead(204)
                res.end(data.key)
            })
        })
    })

    return host
}
