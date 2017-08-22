const test = require('ava')
const joi = require('Joi')
const minion = require('../lib')

test('acks message', async t => {
    const handler = (message, done) => {
      done(true)
    }

    const service = minion(handler)
    const message = {hola: 'mundo'}

    service(message, (res) => {
        t.true(res)
    })
})


test('nack if schema validation does not pass', async t => {
    const handler = (message, done) => {
        done(true)
    }

    handler.schema = {
        aKey: joi.string()
    }

    const service = minion(handler)
    const message = {hola: 'mundo'}

    t.plan(1)
    service(
        message,
        () => t.fail('should not ack when validation fails'),
        (res) => t.deepEqual(res, {requeue: false})
    )
})