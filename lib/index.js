'use strict'

const jackrabbit = require('@pager/jackrabbit')
const { EventEmitter } = require('events')
const debug = require('debug')('minion')

const pluck = (object, keys) => {
    return Object.keys(object).reduce((result, key) => {

        if (keys.includes(key) && object[key]) {
            result[key] = object[key];
        }

        return result;
    }, {});
}

const queueOptions = ['name', 'key', 'keys', 'exclusive', 'durable', 'autoDelete', 'deadLetterExchange', 'prefetch'];

const createPublisher = (exchange, options) => {

    return (message, key) => {

        debug(`publishing to ${key || options.key}`, message);
        exchange.publish(message, { key: key || options.key });
    };
}

const createService = (exchange, handler, options) => {

    const eventEmitter = new EventEmitter();

    const handle = (message, metadata) => {

        eventEmitter.emit('message', message, metadata);

        try {
            return Promise.race([
                handler(message, metadata),
                new Promise((resolve, reject) => {

                    setTimeout(() => {

                        reject(new Error('Ack timeout'));
                    }, options.timeout || 30000);
                })
            ]);
        }
        catch (e) {
            return Promise.reject(e);
        }
    }

    const start = () => {

        const queue = exchange.queue(pluck(options, queueOptions));
        queue.on('bound', () => {

            queue.consume((payload, ack, nack, metadata) => {

                handle(payload, metadata).then((response) => {

                    ack(response);
                    eventEmitter.emit('response', response);
                }).catch((error) => {

                    const requeue = error.requeue !== undefined ? error.requeue : options.requeue
                    nack({ requeue });

                    if (!(error instanceof Error)) {
                        error = new Error(error);
                    }
                    error.message_payload = payload;
                    error.message_metadata = metadata;

                    if(requeue) eventEmitter.emit('warn', error)
                    else eventEmitter.emit('error', error);
                });
            });

            eventEmitter.emit('ready', queue);
        })
    }

    const publish = createPublisher(exchange, options);

    return Object.assign(eventEmitter, {
        handle,
        options,
        publish,
        start,
    });
}

const createRabbitExchange = (options) => {

    /* $lab:coverage:off$ */
    const rabbit = options.rabbit || jackrabbit(options.rabbitUrl || 'amqp://127.0.0.1');

    if (options.exchange) {
        return { rabbit, exchange: options.exchange };
    }
    /* $lab:coverage:on$ */
    return { rabbit, exchange: rabbit[options.exchangeType](options.exchangeName) };
}

module.exports = (handler = { name: 'minion' }, settingsOverride = {}) => {

    const isService = typeof handler === 'function';

    const handlerSettings = isService ? handler.settings : handler;

    const settings = Object.assign(
        {},
        handlerSettings,
        settingsOverride
    );

    const defaults = {
        exchangeType: 'topic',
        exchangeName: handler.name,
        name: handler.name,
        key: settings.name || handler.name,
        exclusive: false,
        durable: true,
        autoDelete: false,
        requeue: false,
        /* $lab:coverage:off$ */
        deadLetterExchange: `${settings.exchangeName || handler.name}.dead`,
        /* $lab:coverage:on$ */
        autoStart: true,
        debug: false
    };

    const options = Object.assign({}, defaults, settings);
    /* $lab:coverage:off$ */
    options.deadLetterExchange = options.deadLetterExchange || undefined;
    /* $lab:coverage:on$ */

    const { exchange, rabbit } = createRabbitExchange(options);

    if (isService) {
        const service = createService(exchange, handler, options);

        /* $lab:coverage:off$ */
        if (options.autoStart) {
            service.start();
        }
        /* $lab:coverage:on$ */

        service.on('ready', (queue) => {

            debug(`ready to process ${queue.name}`);
        });
        service.on('message', (message) => {

            debug(`processing ${JSON.stringify(message)} routed with key ${options.key}`);
        });
        service.on('error', (error) => {

            debug('handler Error:', error);
        });
        service.on('warn', (error) => {

            debug('handler warning:', error);
        });

        service.connection = rabbit;
        return service;
    }

    return createPublisher(exchange, options);
};
