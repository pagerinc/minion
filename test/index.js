const test = require('ava')
const joi = require('Joi')
const minion = require('../lib')
const Requeue = minion.Requeue

test('acks simple handler', async t => {
    const handler = (message) => {
      return true
    }

    const service = minion(handler)
    const message = {hola: 'mundo'}

    const res = await service(message)
    t.true(res)
})


test('acks async handler', async t => {
    const handler = async (message) => {
        return Promise.resolve(true);
    };

    const service = minion(handler)
    const message = {hola: 'mundo'}

    const res = await service(message)
    t.true(res)
})

test('nack without requeue', async t => {
    const handler = async (message) => {
        throw new Error('My message')
    };

    const service = minion(handler)
    const message = {hola: 'mundo'}

    t.plan(2)

    try {
        await service(message)
        t.fail('should not ack when validation fails')
    } catch (error) {
        t.falsy(error.requeue)
        t.is(error.message, 'My message')
    }
})

test('nack with requeue', async t => {
    const handler = async (message) => {
        throw new Requeue('My message')
    };

    const service = minion(handler)
    const message = {hola: 'mundo'}

    t.plan(2)

    try {
        await service(message)
        t.fail('should not ack when validation fails')
    } catch (error) {
        t.true(error.requeue)
        t.is(error.message, 'My message')
    }
})


test('nack if schema validation does not pass', async t => {
    const handler = (message) => {
        return true
    }

    handler.schema = {
        aKey: joi.string()
    }

    const service = minion(handler)
    const message = {hola: 'mundo'}

    t.plan(2)

    try {
        await service(message)
        t.fail('should not ack when validation fails')
    } catch (error) {
        t.true(error.isJoi)
        t.is(error.name, 'ValidationError')
    }
})