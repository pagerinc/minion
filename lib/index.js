'use strict'

const jackrabbit = require('@pager/jackrabbit')
const rabbit = jackrabbit(process.env.RABBIT_URL || 'amqp://localhost')

const pluck = (object, keys) => {
    return Object.keys(object).reduce((result, key) => {
        if (keys.includes(key) && object[key]) {
            result[key] = object[key]
        }
        return result
    }, {});
}

const queueOptions = ['name', 'key', 'exclusive', 'durable']
const consumerOptions = ['noAck']

module.exports = (handler, settings = {}) => {

    const defaults = {
        exchangeType: handler.exchangeType || 'topic',
        exchangeName: handler.exchangeName,
        name: handler.queue || handler.name,
        key: handler.key || handler.queue || handler.name,
        exclusive: handler.exclusive || false,
        durable: handler.durable || true,
        noAck: !!handler.noAck
    }

    const options = Object.assign({}, defaults, settings)

    const exchange = rabbit[options.exchangeType](options.exchangeName)
    const queue = exchange.queue(pluck(options, queueOptions))

    const service = (message, ack, nack) => {

        console.log(`Processing ${JSON.stringify(message)} routed with key ${options.key}`)

        const ackTimeOut = !options.noAck && setTimeout(() => {
            console.error(`FATAL message is not being acked: ${ message }`)
            process.exit(1)
        }, handler.timeout || 30000);

        try {
            handler(message, (...args) => {
                if (ackTimeOut) clearTimeout(ackTimeOut);
                ack(...args)
            }, (...args) => {
                if (ackTimeOut) clearTimeout(ackTimeOut);
                nack(...args)
            });
        } catch (error) {
            console.error(`FATAL worker is broken: ${ error }`)
            process.exit(1)
        }

    }

    queue.on('connected', () => {

        console.log(`Ready to process ${queue.name}`)

        queue.consume(service, pluck(options, consumerOptions))
    })

    return service
}