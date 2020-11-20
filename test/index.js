'use strict';

const Code = require('@hapi/code');
const Lab = require('@hapi/lab');
const Jackrabbit = require('@pager/jackrabbit');

const Minion = require('../lib');

const lab = exports.lab = Lab.script();
const { expect, fail } = Code;
const { afterEach, beforeEach, describe, it } = lab;

const waitForEvent = (eventEmitter, eventName) => {

    return new Promise((resolve, reject) => {

        setTimeout(() => {

            reject(new Error(`timed out waiting for ${eventName} event`));
        }, 10000);
        eventEmitter.once(eventName, resolve);
    });
};

describe('Minion', () => {

    beforeEach(async ({ context }) => {

        context.rabbit = Jackrabbit(process.env.RABBIT_URL || 'amqp://127.0.0.1');
        await waitForEvent(context.rabbit, 'connected');
    });

    afterEach(async ({ context }) => {

        await context.rabbit.close();
    });


    it('should wait for start command', async () => {

        const handler = () => true;
        const service = Minion(handler, { autoStart: false });
        const ready = new Promise((resolve) => service.once('ready', resolve));
        const message = { hola: 'mundo' };

        service.start();

        await ready;

        const res = await service.handle(message);
        expect(res).to.be.true();
    });

    it('acks simple handler without rabbit setting', async () => {

        const handler = () => true;
        const service = Minion(handler);
        const ready = new Promise((resolve) => service.once('ready', resolve));
        const message = { hola: 'mundo' };

        await ready;

        const res = await service.handle(message);
        expect(res).to.be.true();
    });

    it('acks simple handler without rabbit setting', async () => {

        const handler = () => true;
        const service = Minion(handler, { rabbitUrl: 'amqp://127.0.0.1' });
        const ready = new Promise((resolve) => service.once('ready', resolve));
        const message = { hola: 'mundo' };

        await ready;

        const res = await service.handle(message);
        expect(res).to.be.true();
    });

    it('acks simple handler', async ({ context }) => {

        const handler = () => true;
        const service = Minion(handler, context);
        const ready = new Promise((resolve) => service.once('ready', resolve));
        const message = { hola: 'mundo' };

        await ready;

        const res = await service.handle(message);
        expect(res).to.be.true();
    });

    it('acks simple handler with metadata', async ({ context }) => {

        const handler = (message, meta) => meta;
        const service = Minion(handler, context);
        const ready = new Promise((resolve) => service.once('ready', resolve));
        const message = { hola: 'mundo' };

        await ready;

        const res = await service.handle(message, 'i am meta');
        expect(res).to.be.equal('i am meta');
    });

    it('uses injected exchange name', async ({ context }) => {

        const handler = () => true;
        const service = Minion(handler, {
            ...context,
            exchangeName: 'test',
            name: 'test',
            key: 'test'
        });
        const ready = new Promise((resolve) => service.once('ready', resolve));
        const message = { hola: 'mundo' };

        await ready;

        expect(context.rabbit).to.be.equal(service.connection);

        const res = await service.handle(message);
        expect(res).to.be.true();

        // 3 channels: default heartbeat, exchange, and service queue
        expect(service.connection.getInternals().connection.connection.channels.length).to.be.equal(3);
    });

    it('uses injected exchange', async ({ context }) => {

        const handler = () => true;
        const service = Minion(handler, {
            ...context,
            exchange: context.rabbit.topic('test')
        });
        const ready = new Promise((resolve) => service.once('ready', resolve));
        const message = { hola: 'mundo' };

        await ready;

        const res = await service.handle(message);
        expect(res).to.be.true();
        expect(context.rabbit).to.be.equal(service.connection);

        // 3 channels: default heartbeat, exchange, and service queue
        expect(service.connection.getInternals().connection.connection.channels.length).to.be.equal(3);
    });

    it('emmitter emits message', async ({ context }) => {

        const handler = () => true;

        const service = Minion(handler, context);

        service.once('message', (message, meta) => {

            expect(message).to.be.equal('i am message');
            expect(meta).to.be.equal('i am meta');
        });

        await service.handle('i am message', 'i am meta');
    });

    it('acks async handler', async ({ context }) => {

        const handler = async (message) => Promise.resolve(true);

        const service = Minion(handler, context);
        const message = { hola: 'mundo' };

        const res = await service.handle(message);
        expect(res).to.be.true();
    });

    it('nack without requeue', async ({ context }) => {

        const handler = async (message) => {

            throw new Error('My message');
        };

        const service = Minion(handler, context);
        const message = { hola: 'mundo' };

        try {
            await service.handle(message);
            fail('should not ack when error occur');
        }
        catch (error) {
            expect(error.message).to.be.equal('My message');
        }
    });

    it('nack with requeue', async ({ context }) => {

        const handler = async (message) => {

            throw new Error('My message');
        };

        const service = Minion(handler, { ...context, requeue: true });
        const message = { hola: 'mundo' };

        try {
            await service.handle(message);
            fail('should not ack when error occur');
        }
        catch (error) {
            expect(error.message).to.be.equal('My message');
        }
    });

    it('publisher only', async ({ context }) => {

        const myMessage = 'test message';
        const myHandler = (message) => `Processed: ${message}`;
        const service = Minion(myHandler, { ...context, key: 'test.minion' });
        const ready = new Promise((resolve) => service.once('ready', resolve));
        const responsePromise = new Promise((resolve) => service.once('response', resolve));

        await ready;

        const publish = Minion({ name: 'myHandler' }, context);
        publish(myMessage, 'test.minion');

        const response = await responsePromise;
        expect(response).to.be.equal(myHandler(myMessage));
    });

    it('publisher with default key', async ({ context }) => {

        const myMessage = 'test message';
        const myHandler = (message) => `Processed: ${message}`;
        const service = Minion(myHandler, context);
        const ready = new Promise((resolve) => service.once('ready', resolve));
        const responsePromise = new Promise((resolve) => service.once('response', resolve));

        await ready;

        const publish = Minion({ name: 'myHandler' }, context);
        publish(myMessage);

        const response = await responsePromise;
        expect(response).to.be.equal(myHandler(myMessage));
    });

    it('publisher only with properties', async ({ context }) => {

        const myMessage = 'test message';
        const myHandler = (message) => `Processed: ${message}`;
        const service = Minion(myHandler, { ...context, key: 'test.minion' });
        const ready = new Promise((resolve) => service.once('ready', resolve));
        const responsePromise = new Promise((resolve) => service.once('response', resolve));

        await ready;

        const publish = Minion({ name: 'myHandler' }, context);
        publish(myMessage, 'test.minion', { expiration: 60000 });

        const response = await responsePromise;
        expect(response).to.be.equal(myHandler(myMessage));
    });

    it('publisher with default key and properties', async ({ context }) => {

        const myMessage = 'test message';
        const myHandler = (message) => `Processed: ${message}`;
        const service = Minion(myHandler, context);
        const ready = new Promise((resolve) => service.once('ready', resolve));
        const responsePromise = new Promise((resolve) => service.once('response', resolve));

        await ready;

        const publish = Minion({ name: 'myHandler' }, context);
        publish(myMessage, null, { expiration: 60000 });

        const response = await responsePromise;
        expect(response).to.be.equal(myHandler(myMessage));
    });

    it('handles rejections', async ({ context }) => {

        const myMessage = 'event';
        const rejectHandler = (message) => Promise.reject(`Error processing ${message}`);
        const service = Minion(rejectHandler, context);
        const ready = new Promise((resolve) => service.once('ready', resolve));
        const errorPromise = new Promise((resolve) => service.once('error', resolve));

        await ready;

        const publish = Minion({ name: 'rejectHandler' }, context);
        publish(myMessage);

        const error = await errorPromise;
        expect(error).to.be.error(`Error processing ${myMessage}`);
    });

    it('handles exceptions', async ({ context }) => {

        const myMessage = 'event';
        const exceptionHandler = (message) => {

            throw new Error(`Error processing ${message}`);
        };

        const service = Minion(exceptionHandler, context);
        const ready = new Promise((resolve) => service.once('ready', resolve));
        const errorPromise = new Promise((resolve) => service.once('error', resolve));

        await ready;

        const publish = Minion({ name: 'exceptionHandler' }, context);
        publish(myMessage);

        const error = await errorPromise;
        expect(error).to.be.error(`Error processing ${myMessage}`);
    });
});
