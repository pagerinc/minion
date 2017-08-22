const test = require('ava')
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
