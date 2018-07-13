const test = require('ava')
const minion = require('../lib')
const Requeue = minion.Requeue

test('acks simple handler', async t => {
    const handler = (message) => {
      return true
    }

    const service = minion(handler)
    const message = { hola: 'mundo' }

    const res = await service(message)
    t.true(res)
})


test('acks async handler', async t => {
    const handler = async (message) => {
        return Promise.resolve(true)
    }

    const service = minion(handler)
    const message = { hola: 'mundo' }

    const res = await service(message)
    t.true(res)
})

test('nack without requeue', async t => {
    const handler = async (message) => {
        throw new Error('My message')
    }

    const service = minion(handler)
    const message = { hola: 'mundo' }

    t.plan(1)

    try {
        await service(message)
        t.fail('should not ack when error occur')
    } catch (error) {
        t.is(error.message, 'My message')
    }
})

test('nack with requeue', async t => {
    const handler = async (message) => {
        throw new Error('My message')
    }

    const service = minion(handler, { requeue: true })
    const message = { hola: 'mundo' }

    t.plan(1)

    try {
        await service(message)
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

    const service = minion(myHandler, { key: 'test.minion' })

    service.on('ready', () => {

        const publish = minion({ name: 'myHandler' })
        publish(myMessage, 'test.minion')
    })
})


test.cb('publisher with default Key', t => {

    const myMessage = 'test message'

    const myHandler = async (message) => {
        t.is(message, myMessage)
        t.pass()
        t.end()
    }

    const service = minion(myHandler)

    service.on('ready', () => {

        const publish = minion({ name: 'myHandler' })
        publish(myMessage)
    })
})
