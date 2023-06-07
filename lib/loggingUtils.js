'use strict';

const Crypto = require('crypto');

const Lodash = require('lodash');

exports.createLoggerContext = (logger, message, metadata, context = {}) => {

    let eventId;
    try {
        eventId = metadata?.properties?.headers?.eventId || Crypto.randomUUID();
        const messageId = metadata?.properties?.messageId;
        const routingKey = metadata?.fields?.routingKey;

        context.logger = (context.logger || logger).child({ minion: { eventId, routingKey, messageId } });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.log('There was an error while creating a child logger for eventId(%s): %o', eventId, error);
    }

    return context;
};

/**
 * This utility crteates a wrapper that adds a field from the event into the logger.
 *
 * Usage:
 *
 * const Logger = require('@pager/logger');
 * const Army = require('@pager/minion-army');
 *
 * const injectEncounterIdFromEvent = injectFieldFromEventAs(Logger, 'encounterId', 'triageId');
 *
 * const handler = (message, metadata, context) {
 *     context.logger.info('handling message');
 * }
 *
 * const army = Army({
 *   workers: [
 *    {
 *      handler: injectEncounterIdFromEvent(handler),
 *      config: {
 *        name: `events.foo.encounter.state.updated`,
 *        key: '#.encounter.state.updated'
 *      },
 *      validate: Schemas.states
 *    },
 * });
 *
 * @param {*} logger a Pino style logger
 * @param {*} loggedFieldName what is the name of the field in the log line
 * @param {*} eventFieldName what is the name of the field in the event payload
 * @returns
 */
exports.injectFieldFromMessageAs = (loggedFieldName, eventFieldName, logger) => {

    if (!logger) {
        throw new Error('logger is mandatory argument to injectFieldFromMessageAs');
    }

    if (typeof loggedFieldName !== 'string') {
        throw new Error('loggedFieldName is mandatory argument to injectFieldFromMessageAs');
    }

    if (typeof eventFieldName !== 'string') {
        throw new Error('eventFieldName is mandatory argument to injectFieldFromMessageAs');
    }

    return (handler) => {

        return (message, metadata, context = {}) => {

            context.logger = (context.logger || logger).child({ [loggedFieldName]: message[eventFieldName] });

            return handler(message, metadata, context);
        };
    };
};

exports.addDefaultLoggingEventHandlers = (minion, { messageKey, responseKey } = {}) => {

    if (!(minion && typeof minion.on === 'function')) {
        throw new Error('minion is a mandatory argument to addDefaultLoggingEventHandlers');
    }

    if (messageKey && typeof messageKey !== 'string') {
        throw new Error('messageKey is a string argument to addDefaultLoggingEventHandlers');
    }

    if (responseKey && typeof responseKey !== 'string') {
        throw new Error('responseKey is a string argument to addDefaultLoggingEventHandlers');
    }

    const defaultErrorLoggerHandler = (error, context) => {

        context?.logger.error({ error }, 'Minion handler error');
    };

    minion.on('error', defaultErrorLoggerHandler);

    const defaultMessageLoggerHandler = (message, metadata, context) => {

        const pickedMetadata = Lodash.pick(metadata, ['properties', 'fields']);

        const mergingObject = {
            metadata: pickedMetadata
        };

        if (messageKey) {
            mergingObject[messageKey] = message;
        }

        context?.logger.info(mergingObject, 'Minion got message');
    };

    minion.on('message', defaultMessageLoggerHandler);

    const defaultReadyLoggerHandler = (queue, context) => {

        context?.logger.info({ queue }, 'Minion is ready to consume');
    };

    minion.on('ready', defaultReadyLoggerHandler);

    const defaultResponseLoggerHandler = (response, context) => {

        const mergingObject = {};
        if (responseKey) {
            mergingObject[responseKey] = response;
        }

        context?.logger.info(mergingObject, 'Minion received response');
    };

    minion.on('response', defaultResponseLoggerHandler);

    return {
        defaultErrorLoggerHandler,
        defaultMessageLoggerHandler,
        defaultReadyLoggerHandler,
        defaultResponseLoggerHandler
    };
};
