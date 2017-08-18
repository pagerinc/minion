'use strict'

const jackrabbit = require('@pager/jackrabbit')
const rabbit = jackrabbit(process.env.RABBIT_URL || 'amqp://localhost')

module.exports = (handler) => {

    const exchangeType = handler.exchangeType || 'topic';

    const exchange = rabbit[exchangeType](handler.exchangeName)
    const name = handler.queue || handler.name

    const queueOptions = {
        name,
        key: handler.key || name,
        exclusive: handler.exclusive || false,
        durable: handler.durable || true
    }

    const consumerOptions = {
        noAck: !!handler.noAck
    }

    const queue = exchange.queue(queueOptions)

    queue.on('connected', () => {

        console.log(`Ready to process ${queue.name}`)

        queue.consume((message, ack, nack) => {

            console.log(`Processing ${message} at ${queue.name}`)

            const ackTimeOut = !consumerOptions.noAck && setTimeout(() => {
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

        }, consumerOptions)
    })

}