'use strict';

const Crypto = require('crypto');

const Code = require('@hapi/code');
const Lab = require('@hapi/lab');
const Sinon = require('sinon');
const { faker: Faker } = require('@faker-js/faker');

const { addDefaultLoggingEventHandlers, createLoggerContext, injectFieldFromMessageAs } = require('../lib/loggingUtils');

const lab = exports.lab = Lab.script();
const { expect } = Code;
const { beforeEach, afterEach, describe, it } = lab;

describe('loggingUtils', () => {

    describe('createLoggerContext', () => {

        beforeEach(({ context }) => {

            context.logger = {
                child: Sinon.stub(),
                info: Sinon.stub(),
                error: Sinon.stub()
            };

            context.randomUUIdStub = Sinon.stub(Crypto, 'randomUUID');
        });

        afterEach(({ context }) => {

            context.randomUUIdStub.restore();
        });

        it('creates logger', ({ context }) => {

            const message = Sinon.stub();
            const metadata = Sinon.stub();

            const childLogger = Sinon.stub();
            context.logger.child.returns(childLogger);

            const eventId = Faker.string.uuid();

            context.randomUUIdStub.returns(eventId);

            const loggerContext = createLoggerContext(context.logger, message, metadata);
            expect(loggerContext).to.equal({ logger: childLogger });
            Sinon.assert.callCount(context.logger.child, 1);
            Sinon.assert.calledWith(context.logger.child, { minion: { eventId, routingKey: undefined, messageId: undefined } });
        });

        it('creates logger from the already existing logger', ({ context }) => {

            const message = Sinon.stub();
            const metadata = Sinon.stub();

            const childLogger = Sinon.stub();

            const eventId = Faker.string.uuid();

            context.randomUUIdStub.returns(eventId);

            const existingLogger = {
                child: Sinon.stub()
            };
            existingLogger.child.returns(childLogger);

            const loggerContext = createLoggerContext(context.logger, message, metadata, { logger: existingLogger });
            expect(loggerContext).to.equal({ logger: childLogger });
            Sinon.assert.callCount(context.logger.child, 0);
            Sinon.assert.callCount(existingLogger.child, 1);
            Sinon.assert.calledWith(existingLogger.child, { minion: { eventId, routingKey: undefined, messageId: undefined } });
        });


        it('creates logger with routingKey', ({ context }) => {

            const routingKey = Faker.string.uuid();
            const message = Sinon.stub();
            const metadata = {
                fields: {
                    routingKey
                }
            };

            const childLogger = Sinon.stub();
            context.logger.child.returns(childLogger);

            const eventId = Faker.string.uuid();

            context.randomUUIdStub.returns(eventId);

            const loggerContext = createLoggerContext(context.logger, message, metadata);
            expect(loggerContext).to.equal({ logger: childLogger });
            Sinon.assert.callCount(context.logger.child, 1);
            Sinon.assert.calledWith(context.logger.child, { minion: { eventId, routingKey, messageId: undefined } });
        });

        it('creates logger with messageId', ({ context }) => {

            const messageId = Faker.string.uuid();
            const message = Sinon.stub();
            const metadata = {
                properties: {
                    messageId
                }
            };

            const childLogger = Sinon.stub();
            context.logger.child.returns(childLogger);

            const eventId = Faker.string.uuid();

            context.randomUUIdStub.returns(eventId);

            const loggerContext = createLoggerContext(context.logger, message, metadata);
            expect(loggerContext).to.equal({ logger: childLogger });
            Sinon.assert.callCount(context.logger.child, 1);
            Sinon.assert.calledWith(context.logger.child, { minion: { eventId, routingKey: undefined, messageId } });
        });

        it('creates logger with eventId', ({ context }) => {

            const messageId = Faker.string.uuid();
            const eventId = Faker.string.uuid();
            const message = Sinon.stub();
            const metadata = {
                properties: {
                    messageId,
                    headers: {
                        eventId
                    }
                }
            };

            const childLogger = Sinon.stub();
            context.logger.child.returns(childLogger);

            const loggerContext = createLoggerContext(context.logger, message, metadata);
            expect(loggerContext).to.equal({ logger: childLogger });
            Sinon.assert.callCount(context.logger.child, 1);
            Sinon.assert.calledWith(context.logger.child, { minion: { eventId, routingKey: undefined, messageId } });
        });

        it('does not break if logger.child throws', ({ context }) => {

            const message = Sinon.stub();
            const metadata = Sinon.stub();

            context.logger.child.throws(new Error('something went wrong'));

            const eventId = Faker.string.uuid();

            context.randomUUIdStub.returns(eventId);

            const loggerContext = createLoggerContext(context.logger, message, metadata);
            expect(loggerContext).to.equal({});
            Sinon.assert.callCount(context.logger.child, 1);
            Sinon.assert.calledWith(context.logger.child, { minion: { eventId, routingKey: undefined, messageId: undefined } });
        });
    });

    describe('addDefaultLoggingEventHandlers', () => {

        beforeEach(({ context }) => {

            context.service = {
                on: Sinon.stub()
            };

            context.logger = {
                info: Sinon.stub(),
                error: Sinon.stub()
            };
        });

        it('throws if minion is incorrect argument', () => {

            expect(() => addDefaultLoggingEventHandlers(null, { messageKey: Faker.string.alpha(8), responseKey: Faker.string.alpha(8) })).to.throw('minion is a mandatory argument to addDefaultLoggingEventHandlers');
            expect(() => addDefaultLoggingEventHandlers(undefined, { messageKey: Faker.string.alpha(8), responseKey: Faker.string.alpha(8) })).to.throw('minion is a mandatory argument to addDefaultLoggingEventHandlers');
            expect(() => addDefaultLoggingEventHandlers({}, { messageKey: Faker.string.alpha(8), responseKey: Faker.string.alpha(8) })).to.throw('minion is a mandatory argument to addDefaultLoggingEventHandlers');
            expect(() => addDefaultLoggingEventHandlers({ on: 1 }, { messageKey: Faker.string.alpha(8), responseKey: Faker.string.alpha(8) })).to.throw('minion is a mandatory argument to addDefaultLoggingEventHandlers');
        });

        it('validates the messageKey argument', ({ context }) => {

            expect(() => addDefaultLoggingEventHandlers(context.service, { messageKey: {}, responseKey: Faker.string.alpha(8) })).to.throw('messageKey is a string argument to addDefaultLoggingEventHandlers');
            addDefaultLoggingEventHandlers(context.service, { messageKey: null, responseKey: Faker.string.alpha(8) });
            addDefaultLoggingEventHandlers(context.service, { messageKey: undefined, responseKey: Faker.string.alpha(8) });
        });

        it('validates the responseKey argument', ({ context }) => {

            expect(() => addDefaultLoggingEventHandlers(context.service, { messageKey: Faker.string.alpha(8), responseKey: {} })).to.throw('responseKey is a string argument to addDefaultLoggingEventHandlers');
            addDefaultLoggingEventHandlers(context.service, { messageKey: Faker.string.alpha(8), responseKey: null });
            addDefaultLoggingEventHandlers(context.service, { messageKey: Faker.string.alpha(8), responseKey: undefined });
        });

        it('adds listeners', ({ context }) => {

            const { defaultErrorLoggerHandler, defaultMessageLoggerHandler, defaultReadyLoggerHandler, defaultResponseLoggerHandler } = addDefaultLoggingEventHandlers(context.service, { messageKey: Faker.string.alpha(8), responseKey: Faker.string.alpha(8) });

            Sinon.assert.callCount(context.service.on, 4);
            Sinon.assert.calledWith(context.service.on, 'error', defaultErrorLoggerHandler);
            Sinon.assert.calledWith(context.service.on, 'message', defaultMessageLoggerHandler);
            Sinon.assert.calledWith(context.service.on, 'ready', defaultReadyLoggerHandler);
            Sinon.assert.calledWith(context.service.on, 'response', defaultResponseLoggerHandler);
        });

        it('logs an error on error', ({ context }) => {

            const { defaultErrorLoggerHandler } = addDefaultLoggingEventHandlers(context.service, { messageKey: Faker.string.alpha(8), responseKey: Faker.string.alpha(8) });

            const error = Sinon.stub();
            defaultErrorLoggerHandler(error, { logger: context.logger });

            Sinon.assert.callCount(context.logger.error, 1);
            Sinon.assert.callCount(context.logger.info, 0);

            Sinon.assert.calledWith(context.logger.error, { error }, 'Minion handler error');
        });

        it('logs an info on message', ({ context }) => {

            const messageKey = Faker.string.alpha(8);

            const { defaultMessageLoggerHandler } = addDefaultLoggingEventHandlers(context.service, { messageKey, responseKey: Faker.string.alpha(8) });

            const message = Sinon.stub();
            const metadata = {};

            defaultMessageLoggerHandler(message, metadata, { logger: context.logger });

            Sinon.assert.callCount(context.logger.error, 0);
            Sinon.assert.callCount(context.logger.info, 1);

            Sinon.assert.calledWith(context.logger.info, { metadata, [messageKey]: message }, 'Minion got message');
        });

        it('logs an info on message with metadata', ({ context }) => {

            const messageKey = Faker.string.alpha(8);

            const { defaultMessageLoggerHandler } = addDefaultLoggingEventHandlers(context.service, { messageKey, responseKey: Faker.string.alpha(8) });

            const message = Sinon.stub();
            const properties = Sinon.stub();
            const fields = Sinon.stub();
            const metadata = {
                properties,
                fields,
                content: Sinon.stub()
            };

            defaultMessageLoggerHandler(message, metadata, { logger: context.logger });

            Sinon.assert.callCount(context.logger.error, 0);
            Sinon.assert.callCount(context.logger.info, 1);

            Sinon.assert.calledWith(context.logger.info, { metadata: { properties, fields }, [messageKey]: message }, 'Minion got message');
        });

        it('logs an info on message without messageKey', ({ context }) => {

            const { defaultMessageLoggerHandler } = addDefaultLoggingEventHandlers(context.service, { responseKey: Faker.string.alpha(8) });

            const message = Sinon.stub();
            const metadata = {};

            defaultMessageLoggerHandler(message, metadata, { logger: context.logger });

            Sinon.assert.callCount(context.logger.error, 0);
            Sinon.assert.callCount(context.logger.info, 1);

            Sinon.assert.calledWith(context.logger.info, { metadata }, 'Minion got message');
        });

        it('logs an info on ready', ({ context }) => {

            const { defaultReadyLoggerHandler } = addDefaultLoggingEventHandlers(context.service, { responseKey: Faker.string.alpha(8) });

            const queue = Sinon.stub();

            defaultReadyLoggerHandler(queue, { logger: context.logger });

            Sinon.assert.callCount(context.logger.error, 0);
            Sinon.assert.callCount(context.logger.info, 1);

            Sinon.assert.calledWith(context.logger.info, { queue }, 'Minion is ready to consume');
        });

        it('logs an info on response', ({ context }) => {

            const responseKey = Faker.string.alpha(8);
            const { defaultResponseLoggerHandler } = addDefaultLoggingEventHandlers(context.service, { responseKey });

            const response = Sinon.stub();

            defaultResponseLoggerHandler(response, { logger: context.logger });

            Sinon.assert.callCount(context.logger.error, 0);
            Sinon.assert.callCount(context.logger.info, 1);

            Sinon.assert.calledWith(context.logger.info, { [responseKey]: response }, 'Minion received response');
        });

        it('logs an info on response without responseKey', ({ context }) => {

            const { defaultResponseLoggerHandler } = addDefaultLoggingEventHandlers(context.service);

            const response = Sinon.stub();

            defaultResponseLoggerHandler(response, { logger: context.logger });

            Sinon.assert.callCount(context.logger.error, 0);
            Sinon.assert.callCount(context.logger.info, 1);

            Sinon.assert.calledWith(context.logger.info, { }, 'Minion received response');
        });
    });

    describe('injectFieldFromMessageAs', () => {

        beforeEach(({ context }) => {

            context.logger = {
                child: Sinon.stub(),
                info: Sinon.stub(),
                error: Sinon.stub()
            };
        });

        it('fails without logger', () => {

            expect(() => injectFieldFromMessageAs(Faker.string.alpha(8), Faker.string.alpha(8))).to.throw('logger is mandatory argument to injectFieldFromMessageAs');
        });

        it('fails without loggedFieldName', ({ context }) => {

            expect(() => injectFieldFromMessageAs(null, Faker.string.alpha(8), context.logger)).to.throw('loggedFieldName is mandatory argument to injectFieldFromMessageAs');
        });

        it('fails without eventFieldName', ({ context }) => {

            expect(() => injectFieldFromMessageAs(Faker.string.alpha(8), null, context.logger)).to.throw('eventFieldName is mandatory argument to injectFieldFromMessageAs');
        });

        it('creates a wrapper', ({ context }) => {

            const wrapper = injectFieldFromMessageAs(Faker.string.alpha(8), Faker.string.alpha(8), context.logger);
            expect(typeof wrapper).to.equal('function');
        });

        it('calls the main logger.child', ({ context }) => {

            const loggedFieldName = Faker.string.alpha(8);

            const wrapper = injectFieldFromMessageAs(loggedFieldName, Faker.string.alpha(8), context.logger);

            const handler = Sinon.stub();

            const message = Sinon.stub();
            const metadata = Sinon.stub();

            const childLogger = Sinon.stub();
            context.logger.child.returns(childLogger);

            wrapper(handler)(message, metadata);

            Sinon.assert.callCount(context.logger.child, 1);
            Sinon.assert.calledWith(context.logger.child, { [loggedFieldName]: undefined });

            Sinon.assert.callCount(handler, 1);
            Sinon.assert.calledWith(handler, message, metadata, { logger: childLogger });

        });

        it('calls the context.logger.child', ({ context }) => {

            const loggedFieldName = Faker.string.alpha(8);
            const wrapper = injectFieldFromMessageAs(loggedFieldName, Faker.string.alpha(8), context.logger);

            const handler = Sinon.stub();

            const message = Sinon.stub();
            const metadata = Sinon.stub();

            const childLogger = Sinon.stub();
            const loggerInTheContext = {
                child: Sinon.stub()
            };
            loggerInTheContext.child.returns(childLogger);

            wrapper(handler)(message, metadata, { logger: loggerInTheContext });

            Sinon.assert.callCount(context.logger.child, 0);

            Sinon.assert.callCount(loggerInTheContext.child, 1);
            Sinon.assert.calledWith(loggerInTheContext.child, { [loggedFieldName]: undefined });

            Sinon.assert.callCount(handler, 1);
            Sinon.assert.calledWith(handler, message, metadata, { logger: childLogger });

        });

        it('puts the field in the basket', ({ context }) => {

            const loggedFieldName = Faker.string.alpha(8);
            const eventFieldName = Faker.string.alpha(8);
            const wrapper = injectFieldFromMessageAs(loggedFieldName, eventFieldName, context.logger);

            const handler = Sinon.stub();

            const value = Faker.lorem.word();
            const message = {
                [eventFieldName]: value
            };
            const metadata = Sinon.stub();

            const childLogger = Sinon.stub();
            const loggerInTheContext = {
                child: Sinon.stub()
            };
            loggerInTheContext.child.returns(childLogger);

            wrapper(handler)(message, metadata, { logger: loggerInTheContext });

            Sinon.assert.callCount(context.logger.child, 0);

            Sinon.assert.callCount(loggerInTheContext.child, 1);
            Sinon.assert.calledWith(loggerInTheContext.child, { [loggedFieldName]: value });

            Sinon.assert.callCount(handler, 1);
            Sinon.assert.calledWith(handler, message, metadata, { logger: childLogger });

        });
    });
});
