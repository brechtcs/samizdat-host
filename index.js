var collect = require('collect-stream')
var merry = require('merry')
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
                return serverError(req, res, app)
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
                return serverError(req, res, app)
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
                    res.writeHead(404)
                    res.end('not found\n')
                    return app.log.error(err)
                }
                else {
                    return serverError(req, res, app)
                }
            }

            if (query.output === 'json') {
                return app.send(200, {key: key, value: value})
            }
            res.writeHead(200)
            res.end(value)
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

    return host
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
