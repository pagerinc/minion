'use strict';

const { EventEmitter } = require('events');

const Jackrabbit = require('@pager/jackrabbit');
const Debug = require('debug')('minion');

const { createLoggerContext } = require('./loggingUtils');

const pluck = (object, keys) => {

    return Object.keys(object).reduce((result, key) => {

        if (keys.includes(key) && object[key]) {
            result[key] = object[key];
        }

        return result;
    }, {});
};

const queueOptions = ['arguments', 'name', 'key', 'keys', 'exclusive', 'durable', 'autoDelete', 'deadLetterExchange', 'prefetch', 'queueMode'];

const createPublisher = (exchange, options) => {

    return (message, key, properties = {}) => {

        const publishOptions = Object.assign({}, properties, { key: key || options.key });
        Debug('publishing to %s %o %o', publishOptions.key, message, publishOptions);
        exchange.publish(message, publishOptions);
    };
};

const createService = (exchange, handler, options) => {

    const eventEmitter = new EventEmitter();

    const handle = (message, metadata, context) => {

        eventEmitter.emit('message', message, metadata);

        return new Promise((resolve, reject) => {

            try {
                resolve(handler(message, metadata, context));
            }
            catch (e) {
                reject(e);
            }
        });
    };

    const start = () => {

        const queue = exchange.queue(pluck(options, queueOptions));
        queue.on('bound', () => {

            queue.consume((payload, ack, nack, metadata) => {

                let context;
                if (options.logger) {
                    context = createLoggerContext(options.logger, payload, metadata);
                }

                handle(payload, metadata, context).then((response) => {

                    ack(response);
                    eventEmitter.emit('response', response, context);
                }).catch((error) => {

                    nack({ requeue: options.requeue });

                    if (!(error instanceof Error)) {
                        error = new Error(error);
                    }

                    error.message_payload = payload;
                    error.message_metadata = metadata;
                    eventEmitter.emit('error', error, context);
                });
            });

            eventEmitter.emit('ready', queue, { logger: options.logger });
        });
    };

    const publish = createPublisher(exchange, options);

    return Object.assign(eventEmitter, {
        handle,
        options,
        publish,
        start
    });
};

const createJackrabbit = (options) => {
    /* $lab:coverage:off$ */
    const rabbitUrl = options.rabbitUrl || process.env.RABBIT_URL || 'amqp://127.0.0.1';
    /* $lab:coverage:on$ */
    Debug('creating Jackrabbit instance with url %s', rabbitUrl);
    return Jackrabbit(rabbitUrl);
};

const createRabbitExchange = (options) => {

    const rabbit = options.rabbit || createJackrabbit(options);

    if (options.exchange) {
        return { rabbit, exchange: options.exchange };
    }

    return { rabbit, exchange: rabbit[options.exchangeType](options.exchangeName) };
};

module.exports = (handler = { name: 'minion' }, settingsOverride = {}) => {

    const isService = typeof handler === 'function';
    const handlerSettings = isService ? handler.settings : handler;
    const settings = Object.assign({}, handlerSettings, settingsOverride);
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
    };
    const options = Object.assign({}, defaults, settings);
    const { exchange, rabbit } = createRabbitExchange(options);

    if (isService) {
        const service = createService(exchange, handler, options);

        if (options.autoStart) {
            service.start();
        }

        service.on('ready', (queue) => {

            Debug('ready to process queue %s', queue.name);
        });
        service.on('message', (message) => {

            Debug('processing %o routed with key %s', message, options.key);
        });
        service.on('error', (error) => {

            Debug('handler Error: %o', error);
        });

        service.connection = rabbit;
        return service;
    }

    return createPublisher(exchange, options);
};
