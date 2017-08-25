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
const otherOptions = ['queue', 'schema', 'exchangeName', 'exchangeType']

module.exports = (handler, settingsOverride = {}) => {

    const settings = Object.assign(
        pluck(handler, queueOptions.concat(consumerOptions).concat(otherOptions)),
        settingsOverride
    )

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

    const service = (payload) => {

        console.log(`Processing ${JSON.stringify(payload)} routed with key ${options.key}`)

        return new Promise((resolve, reject) => {

            const schema = options.schema ? joi.object(options.schema) : joi.any()
            const {error, value: message} = joi.validate(payload, schema)

            if (error) {
                console.error('Validation error', error.details)
                return reject(error)
            }

            const ackTimeOut = !options.noAck && setTimeout(() => {
                reject(new Error('Ack timeout'))
            }, handler.timeout || 30000);

            resolve(handler(message))

        })
    }

    service.publish = (message) => {
        exchange.publish(message, { key: options.key })
    }

    rabbit.on('error', (error) => {
        console.error('Connection error', error)
        throw error
    })

    queue.on('connected', () => {

        console.log(`Ready to process ${queue.name}`)

        queue.consume((payload, ack, nack) => service(payload).then(ack).catch((error) => {

            console.error('Handler Error:', error);
            nack({ requeue: !!error.requeue })
        }), pluck(options, consumerOptions))
    })

    return service
}

function Requeue (message = 'Requeue Error') {
    Error.call(this);
    Error.captureStackTrace(this, Requeue);
    this.name = 'Requeue';
    this.message = message;
    this.requeue = true;
};

require('util').inherits(Requeue, Error);

module.exports.Requeue = Requeue;
