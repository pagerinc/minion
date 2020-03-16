const test = require('ava')
const jackrabbit = require('@pager/jackrabbit')
const minion = require('../lib')
const { EventEmitter } = require('events')

const internals = {
    mockRabbit: !!process.env.MOCK_RABBIT,
    settings: {}
};

test.beforeEach(t => {

    if (internals.mockRabbit) {
        const eventEmitter = new EventEmitter();
        const exchange = {
            internalHandler: () => {}
        };

        exchange.publish = (message) => {
            exchange.internalHandler(message, () => {}, () => {})
        }

        const consume = (handler) => {
            exchange.internalHandler = handler
        }

        const queue = Object.assign(eventEmitter, { consume })

        exchange.queue = () => queue
        internals.settings.rabbit = { topic: () => exchange }
        internals.settings.connect = () => {
            queue.emit('bound')
        }
    }
});

test('acks simple handler', async t => {
    const handler = (message) => {
      return true
    }

    const service = minion(handler, internals.settings)
    const message = { hola: 'mundo' }

    const res = await service.handle(message)
    t.true(res)
})

test('uses injected exchange', async t => {

    // TODO: remove me once rabbit integration testing is setup
    //  since this test relies on confirming internal aspects of jackrabbit/amqp setup
    if (internals.mockRabbit) {
        t.pass();
        return;
    }

    const rabbit = jackrabbit(process.env.RABBIT_URL || 'amqp://127.0.0.1');
    const exchange = rabbit['topic']('test');

    const service = minion(() => true, { ...internals.settings, rabbit, exchange })

    await new Promise((resolve) => {
        service.on('ready', resolve);
    })

    const message = { hola: 'mundo' }
    const res = await service.handle(message)
    t.true(res)
    t.is(rabbit, service.connection)

    // 3 channels: default heartbeat, exchange, and service queue
    t.is(service.connection.getInternals().connection.connection.channels.length, 3)
})

test('acks simple handler with metadata', async t => {
    const handler = (message, meta) => {
      return meta
    }

    const service = minion(handler, internals.settings)
    const message = { hola: 'mundo' }

    const res = await service.handle(message, 'i am meta')
    t.is(res, 'i am meta')
})

test('emmitter emits message', async t => {
    const handler = () => true

    const service = minion(handler, internals.settings)
    
    service.on('message', (message, meta) => {
        t.is(message, 'i am message')
        t.is(meta, 'i am meta')
    })

    await service.handle('i am message', 'i am meta')

    t.plan(2)
})

test('acks async handler', async t => {
    const handler = async (message) => {
        return Promise.resolve(true)
    }

    const service = minion(handler, internals.settings)
    const message = { hola: 'mundo' }

    const res = await service.handle(message)
    t.true(res)
})

test('nack without requeue', async t => {
    const handler = async (message) => {
        throw new Error('My message')
    }

    const service = minion(handler, internals.settings)
    const message = { hola: 'mundo' }

    t.plan(1)

    try {
        await service.handle(message)
        t.fail('should not ack when error occur')
    } catch (error) {
        t.is(error.message, 'My message')
    }
})

test('nack with requeue', async t => {
    const handler = async (message) => {
        throw new Error('My message')
    }

    const service = minion(handler, { ...internals.settings, requeue: true })
    const message = { hola: 'mundo' }

    t.plan(1)

    try {
        await service.handle(message)
        t.fail('should not ack when error occur')
    } catch (error) {
        t.is(error.message, 'My message')
    }
})

test.cb('publisher only', t => {

    const myMessage = 'test message'

    const myHandler = async (message) => {
        t.is(message, myMessage)
        t.pass()
		t.end()
    }

    const service = minion(myHandler, { ...internals.settings, key: 'test.minion' })

    service.on('ready', () => {

        const publish = minion({ name: 'myHandler' }, internals.settings);
        publish(myMessage, 'test.minion')
    })

    if (internals.mockRabbit) {
        internals.settings.connect();
    }
})


test.cb('publisher with default Key', t => {

    const myMessage = 'test message'

    const myHandler = async (message) => {
        t.is(message, myMessage)
        t.pass()
        t.end()
    }

    const service = minion(myHandler, internals.settings)

    service.on('ready', () => {

        const publish = minion({ name: 'myHandler' }, internals.settings)
        publish(myMessage)
    })

    if (internals.mockRabbit) {
        internals.settings.connect();
    }
})
