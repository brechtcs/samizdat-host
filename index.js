var collect = require('collect-stream')
var merry = require('merry')
var mime = require('mime-types')
var parse = require('pull-json-parse')
var pull = require('pull-stream')
var qs = require('querystring')
var request = require('request')
var stream = require('stream-to-pull-stream')
var stringify = require('pull-stringify')
var ts = require('samizdat-ts')
var url = require('url')

module.exports = function (store, opts) {
    if (!opts) {
        opts = {}
    }
    if (!opts.logLevel) {
        opts.logLevel = 'fatal'
    }

    var host = merry(opts)

    host.route('GET', '/_files', function (req, res, app) {
        var query = getQuery(req)

        store.docs(function (err, docs) {
            if (err) {
                if (err.notFound) {
                    return notFound(res)
                }
                else {
                    return serverError(res, app, err)
                }
            }

            if (query.output === 'json') {
                return app.send(200, docs)
            }
            res.writeHead(200)
            res.end(docs.join('\n') + '\n')
        })
    })

    host.route('GET', '/_files/:doc', function (req, res, app) {
        var query = getQuery(req)

        store.history(app.params.doc, function (err, history) {
            if (err) {
                if (err.notFound) {
                    return notFound(res)
                }
                else {
                    return serverError(res, app, err)
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

    host.route('POST', '/_files/:doc', function (req, res, app) {
        var query = getQuery(req)

        collect(req, function (err, body) {
            if (err) {
                return serverError(res, app, err)
            }

            store.create(app.params.doc, body, function (err, data) {
                if (err) {
                    if (err.docExists) {
                        res.writeHead(400)
                        res.end('document already exists\n')
                        return app.log.warn(err)
                    }
                    else {
                        return serverError(res, app, err)
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

    host.route('GET', '/_files/:doc/_latest', function (req, res, app) {
        var query = getQuery(req)

        store.latest(app.params.doc, function (err, data) {
            if (err)  {
                if (err.notFound) {
                    return notFound(res)
                }
                else {
                    return serverError(res, app, err)
                }
            }

            if (query.output === 'json') {
                return app.send(200, data)
            }
            sendValue(res, app.params.doc, data.value)
        })
    })

    host.route('GET', '/_files/:doc/:version', function (req, res, app) {
        var key = getKey(app.params)
        var query = getQuery(req)

        store.read(key, function (err, value) {
            if (err)  {
                if (err.notFound) {
                    return notFound(res)
                }
                else {
                    return serverError(res, app, err)
                }
            }

            if (query.output === 'json') {
                return app.send(200, {key: key, value: value})
            }
            sendValue(res, app.params.doc, value)
        })
    })

    host.route('DELETE', '/_files/:doc/:version', function (req, res, app) {
        var key = getKey(app.params)
        var query = getQuery(req)

        store.del(key, function (err) {
            if (err) {
                return serverError(res, app, err)
            }

            if (query.output === 'json') {
                return app.send(200, {key: key})
            }
            res.writeHead(204)
            res.end()
        })
    })

    host.route('POST', '/_files/:doc/:version', function (req, res, app) {
        var key = getKey(app.params)
        var query = getQuery(req)

        collect(req, function (err, body) {
            if (err) {
                return serverError(res, app, err)
            }

            store.update(key, body, function (err, data) {
                if (err) {
                    return serverError(res, app, err)
                }

                if (query.output === 'json') {
                    return app.send(200, {key: data.key, prev: data.prev})
                }
                res.writeHead(204)
                res.end()
            })
        })
    })

    host.route('GET', '/_sync', function (req, res, app) {
        var jsonOpts = {
            indent: false,
            open: '[\n',
            prefix: ',\n',
            suffix: '',
            close: '\n]\n'
        }

        pull(
            store.source(),
            stringify(jsonOpts),
            stream.sink(res, function (err) {
                if (err) {
                    return serverError(res, app, err)
                }
            })
        )
    })

    host.route('POST', '/_sync', function (req, res, app) {
        collect(req, function (err, url) {
            if (err) {
                return serverError(res, app, err)
            }
            var get = request(url + '/_sync')

            pull(
                stream.source(get),
                parse,
                store.sink(function (err) {
                    if (err) {
                        return serverError(res, app, err)
                    }

                    app.log.info('synchronsation from ' + url + ' completed')
                    res.writeHead(204)
                    res.end()
                })
            )
        })
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

function notFound (res, app, msg) {
    res.writeHead(404)
    res.end('not found\n')
    if (app && msg) {
        app.log.info(msg)
    }
}

function serverError (res, app, err) {
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
