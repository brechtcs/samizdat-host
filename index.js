var collect = require('collect-stream')
var merry = require('merry')
var mime = require('mime-types')
var qs = require('querystring')
var samizdat = require('samizdat-db')
var ts = require('samizdat-ts')
var url = require('url')

module.exports = function (db, opts) {
    if (!opts) {
        opts = {}
    }
    if (!opts.logLevel) {
        opts.logLevel = 'fatal'
    }

    var db = samizdat(db)
    var host = merry(opts)

    host.route('GET', '/_data', function (req, res, app) {
        var query = getQuery(req)

        db.docs(function (err, docs) {
            if (err) {
                if (err.notFound) {
                    return notFound(req, res, app)
                }
                else {
                    return serverError(req, res, app)
                }
            }

            if (query.output === 'json') {
                return app.send(200, docs)
            }
            res.writeHead(200)
            res.end(docs.join('\n') + '\n')
        })
    })

    host.route('GET', '/_data/:doc', function (req, res, app) {
        var query = getQuery(req)

        db.history(app.params.doc, function (err, history) {
            if (err) {
                if (err.notFound) {
                    return notFound(req, res, app)
                }
                else {
                    return serverError(req, res, app)
                }
            }

            var versions = history.map(function (key) {
                return [ts.getCurrent(key), ts.getPrev(key)].join('-')
            })

            if (query.output === 'json') {
                return app.send(200, versions)
            }
            res.writeHead(200)
            res.end(versions.join('\n') + '\n')
        })
    })

    host.route('POST', '/_data/:doc', function (req, res, app) {
        var query = getQuery(req)

        collect(req, function (err, body) {
            if (err) {
                return serverError(req, res, app)
            }

            db.create(app.params.doc, body, function (err, data) {
                if (err) {
                    if (err.docExists) {
                        res.writeHead(400)
                        res.end('document already exists\n')
                        return app.log.warn(err)
                    }
                    else {
                        return serverError(req, res, app)
                    }
                }

                if (query.output === 'json') {
                    return app.send(200, {key: data.key})
                }
                res.writeHead(204)
                res.end()
            })
        })
    })

    host.route('GET', '/_data/:doc/:version', function (req, res, app) {
        var key = getKey(app.params)
        var query = getQuery(req)

        db.read(key, function (err, value) {
            if (err)  {
                if (err.notFound) {
                    return notFound(req, res, app)
                }
                else {
                    return serverError(req, res, app)
                }
            }

            if (query.output === 'json') {
                return app.send(200, {key: key, value: value})
            }
            sendValue(res, app.params.doc, value)
        })
    })

    host.route('DELETE', '/_data/:doc/:version', function (req, res, app) {
        var key = getKey(app.params)
        var query = getQuery(req)

        db.del(key, function (err) {
            if (err) {
                return serverError(req, res, app)
            }

            if (query.output === 'json') {
                return app.send(200, {key: key})
            }
            res.writeHead(204)
            res.end()
        })
    })

    host.route('POST', '/_data/:doc/:version', function (req, res, app) {
        var key = getKey(app.params)
        var query = getQuery(req)

        collect(req, function (err, body) {
            if (err) {
                return serverError(req, res, app)
            }

            db.update(key, body, function (err, data) {
                if (err) {
                    return serverError(req, res, app)
                }

                if (query.output === 'json') {
                    return app.send(200, {key: data.key, prev: data.prev})
                }
                res.writeHead(204)
                res.end()
            })
        })
    })

    host.route('GET', '/_files/:doc', function (req, res, app) {
        var stream = db._level.createKeyStream({reverse: true})

        stream.on('data', function (key) {
            if (ts.getId(key) === app.params.doc) {
                stream.destroy()

                db.read(key, function (err, value) {
                    if (err) {
                        return serverError(req, res, app)
                    }
                    sendValue(res, key, value)
                })
            }
        })

        stream.on('end', function () {
            notFound(req, res, app)
        })

        stream.on('error', app.log.error)
    })

    return host
}

/**
 * Helper functions
 */
function sendValue (res, doc, value) {
    res.setHeader('Content-Type', mime.lookup(doc) || 'application/octet-stream')
    res.writeHead(200)
    res.end(value)
}

function notFound (req, res, app) {
    res.writeHead(404)
    res.end('not found\n')
}

function serverError (req, res, app) {
    res.writeHead(500)
    res.end('server error\n')
    app.log.error(err)
}

function getKey (params) {
    return [params.version, params.doc].join('-')
}

function getQuery (req) {
    return qs.parse(url.parse(req.url).query)
}
