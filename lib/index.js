'use strict'

const jackrabbit = require('@pager/jackrabbit')
const { EventEmitter } = require('events')
const debug = require('debug')('minion')

const pluck = (object, keys) => {
    return Object.keys(object).reduce((result, key) => {
        if (keys.includes(key) && object[key] !== undefined) {
            result[key] = object[key]
        }
        return result
    }, {})
}

const queueOptions = ['name', 'key', 'keys', 'exclusive', 'durable', 'autoDelete', 'deadLetterExchange', 'prefetch']

const createPublisher = (rabbit, options) => {

    const exchange = rabbit[options.exchangeType](options.exchangeName)

    return (message, key) => {

        debug(`publishing to ${key || options.key}`, message)
        exchange.publish(message, { key: key || options.key })
    }
}

const createService = (rabbit, handler, options) => {

    const eventEmitter = new EventEmitter()

    const handle = (message, metadata) => {

        eventEmitter.emit('message', message, metadata)

        return new Promise((resolve, reject) => {

            const ackTimeOut = setTimeout(() => {
                reject(new Error('Ack timeout'))
            }, options.timeout || 30000)

            resolve(handler(message, metadata))
        })
    }

    const start = () => {

        const exchange = rabbit[options.exchangeType](options.exchangeName)
        const queue = exchange.queue(pluck(options, queueOptions))
        queue.on('connected', () => {

            queue.consume((payload, ack, nack, metadata) => {
                handle(payload, metadata).then((response) => {
                    ack(response)
                    eventEmitter.emit('response', response)
                }).catch((error) => {
                    nack({ requeue: options.requeue })
                    eventEmitter.emit('error', error)
                })
            })

            eventEmitter.emit('ready', queue)
        })
    }

    const publish = createPublisher(rabbit, options)

    return Object.assign(eventEmitter, {
        handle,
        options,
        publish,
        start,
    })
}

module.exports = (handler = { name: 'minion' }, settingsOverride = {}) => {

    const isService = typeof handler === 'function'

    const handlerSettings = isService ? handler.settings : handler

    const settings = Object.assign(
        {},
        handlerSettings,
        settingsOverride
    )

    const defaults = {
        exchangeType: 'topic',
        exchangeName: handler.name,
        name: handler.name,
        key: settings.name || handler.name,
        exclusive: false,
        durable: true,
        autoDelete: false,
        requeue: false,
        deadLetterExchange: `${settings.exchangeName || handler.name}.dead`,
        autoStart: true,
        debug: false
    }

    const options = Object.assign({}, defaults, settings)
    options.deadLetterExchange = options.deadLetterExchange || undefined

    const rabbit = options.rabbit || jackrabbit(options.rabbitUrl || 'amqp://localhost')
    if (isService) {
        const service = createService(rabbit, handler, options)
        if (options.autoStart) {
            service.start()
        }

        service.on('ready', (queue) => {
            debug(`ready to process ${queue.name}`)
        })
        service.on('message', (message) => {
            debug(`processing ${JSON.stringify(message)} routed with key ${options.key}`)
        })
        service.on('error', (error) => {
            debug('handler Error:', error)
        })

        service.connection = rabbit
        return service
    }

    return createPublisher(rabbit, options)
}
