'use strict'

const jackrabbit = require('@pager/jackrabbit')
const rabbit = jackrabbit(process.env.RABBIT_URL || 'amqp://localhost')
const { EventEmitter } = require('events')
const util = require('util')
const defaultLogger = require('bunyan').createLogger({ name: 'minion' })

const pluck = (object, keys) => {
    return Object.keys(object).reduce((result, key) => {
        if (keys.includes(key) && object[key] !== undefined) {
            result[key] = object[key]
        }
        return result
    }, {})
}

const queueOptions = ['name', 'key', 'exclusive', 'durable', 'autoDelete', 'deadLetterExchange']

module.exports = (handler = { name: 'minion' }, settingsOverride = {}) => {

    const isService = typeof handler === 'function'

    const handlerSettings = isService ? handler.settings : handler

    const settings = Object.assign(
        { logger: defaultLogger },
        handlerSettings,
        settingsOverride
    )

    const logger = settings.logger

    const defaults = {
        exchangeType: 'topic',
        exchangeName: handler.name,
        name: handler.name,
        key: settings.name || handler.name,
        exclusive: false,
        durable: true,
        autoDelete: false,
        requeue: false,
        deadLetterExchange: `${settings.exchangeName || handler.name}.dead`
    }

    const options = Object.assign({}, defaults, settings)
    options.deadLetterExchange = options.deadLetterExchange || undefined

    const exchange = rabbit[options.exchangeType](options.exchangeName)

    const publish = (message, key) => {

        logger.info(`Publishing to ${key || options.key}: ${message}`)
        exchange.publish(message, { key: key || options.key })
    }

    /* istanbul ignore next */
    rabbit.on('error', (error) => {
        logger.error('Connection error', error)
        throw error
    })

    if (isService) {

        const serviceEmitter = new EventEmitter()

        const service = (message) => {

            logger.info(`Processing ${JSON.stringify(message)} routed with key ${options.key}`)

            return new Promise((resolve, reject) => {

                /* istanbul ignore next */
                const ackTimeOut = setTimeout(() => {
                    reject(new Error('Ack timeout'))
                }, options.timeout || 30000)

                resolve(handler(message))

            })
        }

        service.publish = publish

        service.on = (event, cb) => serviceEmitter.on(event, cb)

        const queue = exchange.queue(pluck(options, queueOptions))
        queue.on('connected', () => {

            logger.info(`Ready to process ${queue.name}`)

            queue.consume((payload, ack, nack) => service(payload).then(ack).catch(/* istanbul ignore next */(error) => {
                logger.error('Handler Error:', error)
                nack({ requeue: options.requeue })
            }))

            serviceEmitter.emit('ready')
        })

        service.logger = logger
        return service
    }

    publish.logger = logger
    return publish
}
