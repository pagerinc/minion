'use strict'

const jackrabbit = require('@pager/jackrabbit')
const rabbit = jackrabbit(process.env.RABBIT_URL || 'amqp://localhost')
const { EventEmitter } = require('events');
const util = require('util');

const pluck = (object, keys) => {
    return Object.keys(object).reduce((result, key) => {
        if (keys.includes(key) && object[key] !== undefined) {
            result[key] = object[key]
        }
        return result
    }, {});
}

const queueOptions = ['name', 'key', 'exclusive', 'durable', 'deadLetterExchange']

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
        deadLetterExchange: `${settings.exchangeName || handler.name}.dead`
    }

    const options = Object.assign({}, defaults, settings)
    options.deadLetterExchange = options.deadLetterExchange || undefined

    const exchange = rabbit[options.exchangeType](options.exchangeName)

    const publish = (message, key) => {

        console.log(`Publishing to ${key || options.key}: ${message}`)
        exchange.publish(message, { key: key || options.key })
    }

    rabbit.on('error', (error) => {
        console.error('Connection error', error)
        throw error
    })

    if (isService) {

        const serviceEmitter = new EventEmitter()

        const service = (message) => {

            console.log(`Processing ${JSON.stringify(message)} routed with key ${options.key}`)

            return new Promise((resolve, reject) => {

                const ackTimeOut = setTimeout(() => {
                    reject(new Error('Ack timeout'))
                }, options.timeout || 30000);

                resolve(handler(message))

            })
        }

        service.publish = publish;

        service.on = (event, cb) => serviceEmitter.on(event, cb)

        const queue = exchange.queue(pluck(options, queueOptions))
        queue.on('connected', () => {

            console.log(`Ready to process ${queue.name}`)

            queue.consume((payload, ack, nack) => service(payload).then(ack).catch((error) => {

                console.error('Handler Error:', error);
                nack({ requeue: !!error.requeue })
            }))

            serviceEmitter.emit('ready')
        })

        return service
    }

    return publish
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
