'use strict';

const Code = require('@hapi/code');
const Lab = require('@hapi/lab');
const Jackrabbit = require('@pager/jackrabbit');
const { EventEmitter } = require('events');

const Minion = require('../lib');

const lab = exports.lab = Lab.script();
const fail = Code.fail;
const expect = Code.expect;
const {
    beforeEach,
    describe,
    it
} = lab;

const internals = {
    mockRabbit: !!process.env.MOCK_RABBIT,
    settings: {}
};

describe('Minion', () => {

    beforeEach(() => {

        if (internals.mockRabbit) {
            const eventEmitter = new EventEmitter();
            const exchange = {
                internalHandler: () => { },
                publish: (message) => {

                    exchange.internalHandler(message, () => { }, () => { });
                }
            };

            const consume = (handler) => {
                exchange.internalHandler = handler;
            };

            const queue = Object.assign(eventEmitter, { consume });

            exchange.queue = () => queue;
            internals.settings.rabbit = { topic: () => exchange };
            internals.settings.connect = () => {

                queue.emit('bound');
            };
        } else {
            internals.settings.rabbit = Jackrabbit(process.env.RABBIT_URL || 'amqp://127.0.0.1');
            internals.settings.exchange = internals.settings.rabbit['topic']('test');
        }
    });

    it('acks simple handler', async () => {

        const handler = (message) => true;

        const service = Minion(handler, internals.settings);
        const message = { hola: 'mundo' };

        const res = await service.handle(message);
        expect(res).to.be.true();
    });

    it('acks simple handler', async () => {

        const handler = (message) => true;

        const service = Minion(handler, internals.settings);
        const message = { hola: 'mundo' };

        const res = await service.handle(message);
        expect(res).to.be.true();
    })

    it('uses injected exchange', async () => {

        // TODO: remove me once rabbit integration testing is setup
        //  since this test relies on confirming internal aspects of jackrabbit/amqp setup
        const service = Minion(() => true, { ...internals.settings });
        const ready = new Promise((resolve) => service.once('ready', resolve));

        if (internals.mockRabbit) {
            internals.settings.connect();
        }

        await ready;

        const message = { hola: 'mundo' };
        const res = await service.handle(message);
        expect(res).to.be.true();
        expect(internals.settings.rabbit).to.be.equal(service.connection);

        // 3 channels: default heartbeat, exchange, and service queue
        // expect(service.connection.getInternals().connection.connection.channels.length).to.be.equal(3);
    });

    it('acks simple handler with metadata', async () => {

        const handler = (message, meta) => meta;

        const service = Minion(handler, internals.settings);
        const message = { hola: 'mundo' };

        const res = await service.handle(message, 'i am meta');
        expect(res).to.be.equal('i am meta');
    });

    it('emmitter emits message', async () => {

        const handler = () => true;

        const service = Minion(handler, internals.settings);

        service.once('message', (message, meta) => {
            expect(message).to.be.equal('i am message');
            expect(meta).to.be.equal('i am meta');
        })

        await service.handle('i am message', 'i am meta');
    });

    it('acks async handler', async () => {

        const handler = async (message) => Promise.resolve(true);

        const service = Minion(handler, internals.settings);
        const message = { hola: 'mundo' };

        const res = await service.handle(message);
        expect(res).to.be.true();
    });

    it('nack without requeue', async () => {

        const handler = async (message) => {

            throw new Error('My message');
        };

        const service = Minion(handler, internals.settings);
        const message = { hola: 'mundo' };

        try {
            await service.handle(message);
            fail('should not ack when error occur');
        } catch (error) {
            expect(error.message).to.be.equal('My message');
        }
    });

    it('nack with requeue', async () => {

        const handler = async (message) => {

            throw new Error('My message');
        };

        const service = Minion(handler, { ...internals.settings, requeue: true });
        const message = { hola: 'mundo' };

        try {
            await service.handle(message);
            fail('should not ack when error occur');
        } catch (error) {
            expect(error.message).to.be.equal('My message');
        }
    });

    it('publisher only', async () => {

        const myMessage = 'test message';
        const myHandler = (message) => `Processed: ${message}`;
        const service = Minion(myHandler, { ...internals.settings, key: 'test.minion' });

        const ready = new Promise((resolve) => service.once('ready', resolve));
        const responsePromise = new Promise((resolve) => service.once('response', resolve));

        if (!internals.mockRabbit) {
            return Promise.resolve();
        }

        internals.settings.connect();
        await ready;

        const publish = Minion({ name: 'myHandler' }, internals.settings);
        publish(myMessage, 'test.minion');

        const response = await responsePromise;

        expect(response).to.be.equal(myHandler(myMessage));
    });

    it('publisher with default Key', async () => {

        const myMessage = 'test message';
        const myHandler = (message) => `Processed: ${message}`;
        const service = Minion(myHandler, internals.settings);
        const ready = new Promise((resolve) => service.once('ready', resolve));
        const responsePromise = new Promise((resolve) => service.once('response', resolve));

        if (!internals.mockRabbit) {
            return Promise.resolve();
        }

        internals.settings.connect();
        await ready;

        const publish = Minion({ name: 'myHandler' }, internals.settings);
        publish(myMessage);

        const response = await responsePromise;

        expect(response).to.be.equal(myHandler(myMessage));
    });

    it('handles rejections', async () => {

        const myMessage = 'event';
        const myHandler = (message) => Promise.reject(`Error processing ${message}`);
        const service = Minion(myHandler, internals.settings);
        const ready = new Promise((resolve) => service.once('ready', resolve));
        const errorPromise = new Promise((resolve) => service.once('error', resolve));

        if (!internals.mockRabbit) {
            return Promise.resolve();
        }

        internals.settings.connect();
        await ready;

        const publish = Minion({ name: 'myHandler' }, internals.settings);
        publish(myMessage);

        const error = await errorPromise;

        expect(error).to.be.equal('Error processing event');
    });

    it('handles exceptions', async () => {

        const myMessage = 'event';
        const myHandler = (message) => {
            throw new Error(`Error processing ${message}`);
        };
        const service = Minion(myHandler, internals.settings);
        const ready = new Promise((resolve) => service.once('ready', resolve));
        const errorPromise = new Promise((resolve) => service.once('error', resolve));

        if (!internals.mockRabbit) {
            return Promise.resolve();
        }

        internals.settings.connect();
        await ready;

        const publish = Minion({ name: 'myHandler' }, internals.settings);
        publish(myMessage);

        const error = await errorPromise;

        expect(error.message).to.be.equal('Error processing event');
    });

    it('it times out', async () => {

        const myMessage = 'test message'
        const myHandler = (message) => {

            return new Promise((resolve) => {

                setTimeout(() => resolve(message), 10);
            });
        }
        const service = Minion(myHandler, { ...internals.settings, timeout: 5 });
        const ready = new Promise((resolve) => service.once('ready', resolve));
        const errorPromise = new Promise((resolve) => service.once('error', resolve));

        if (!internals.mockRabbit) {
            return Promise.resolve();
        }

        internals.settings.connect();
        await ready;

        const publish = Minion({ name: 'myHandler' }, internals.settings);
        publish(myMessage);

        const error = await errorPromise;

        expect(error.message).to.be.equal('Ack timeout')
    });
});
