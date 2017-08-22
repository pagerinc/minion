'use strict'

const jackrabbit = require('@pager/jackrabbit')
const rabbit = jackrabbit(process.env.RABBIT_URL || 'amqp://localhost')
const joi = require('joi')

const pluck = (object, keys) => {
    return Object.keys(object).reduce((result, key) => {
        if (keys.includes(key) && object[key] !== undefined) {
            result[key] = object[key]
        }
        return result
    }, {});
}

const queueOptions = ['name', 'key', 'exclusive', 'durable', 'deadLetterExchange']
const consumerOptions = ['noAck']
const otherOptions = ['queue', 'schema']

module.exports = (handler, settingsOverride = {}) => {

    const settings = Object.assign(
        pluck(handler, queueOptions.concat(consumerOptions).concat(otherOptions),
        settingsOverride
    ))

    const defaults = {
        exchangeType: 'topic',
        exchangeName: handler.name,
        name: handler.name,
        key: handler.queue || handler.name,
        exclusive: false,
        durable: true,
        noAck: false,
        deadLetterExchange: `${settings.exchangeName || handler.name}.dead`
    }

    const options = Object.assign({}, defaults, settings)
    options.deadLetterExchange = options.deadLetterExchange || undefined

    const exchange = rabbit[options.exchangeType](options.exchangeName)
    const queue = exchange.queue(pluck(options, queueOptions))

    const service = (payload, ack, nack) => {

        console.log(`Processing ${JSON.stringify(payload)} routed with key ${options.key}`)

        const schema = options.schema ? joi.object(options.schema) : joi.any()
        const {error, value: message} = joi.validate(payload, schema)
        if (error) {
            console.error('Validation error', error.details)
            return nack({requeue: false})
        }

        const ackTimeOut = !options.noAck && setTimeout(() => {
            console.error(`FATAL message is not being acked: ${ message }`)
            throw new Error('Ack timeout')
        }, handler.timeout || 30000);

        handler(message, (...args) => {
            if (ackTimeOut) clearTimeout(ackTimeOut);
            ack(...args)
        }, (...args) => {
            if (ackTimeOut) clearTimeout(ackTimeOut);
            nack(...args)
        });
    }

    rabbit.on('error', (error) => {
        console.error('Connection error', error)
        throw error
    })

    queue.on('connected', () => {

        console.log(`Ready to process ${queue.name}`)

        queue.consume(service, pluck(options, consumerOptions))
    })

    return service
}