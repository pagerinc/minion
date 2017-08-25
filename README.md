![Minion](https://68.media.tumblr.com/avatar_c972768606a9_128.png)

**Minion**  —  _Microservice Framework for RabbitMQ Workers_

## Features

 - Easy and Minimalistic setup
 - Simple to use and configure
 - Designed to use with sync functions aswell as promises or async/await ones

## Usage

install `minion`:

```bash
npm install --save minion
```

### Single handler

Create an index.js and export a function like this:

```javascript
module.exports = (message) => {
   return 'Hello World'
}
```

Ensure that the `main` property inside `package.json` points to your microservice (which is inside `index.js` in this example case) and add a `start` script:

```json
{
  "main": "index.js",
  "scripts": {
    "start": "minion"
  }
}
```


### Multiple handlers

Instead of pointing to a single file on the package.json `main` property, set it to a directory, and create a file for each service you want:

```json
{
  "main": "lib",
  "scripts": {
    "start": "minion"
  }
}
```


### Running Options


Once the project is done, start the worker:

```bash
npm start
```

Optionally you can configure a default exchange name or exchange type when launching
minion, if not set the exchange name will be the same of the service, and the type of
the exchange will be `topic`

**Exchange Type**

```json
{
  "main": "lib",
  "scripts": {
    "start": "minion -t fanout"
  }
}
```

**Exchange Name**

```json
{
  "main": "lib",
  "scripts": {
    "start": "minion -x myExchange"
  }
}
```

### Debug Mode

Minion provides a debug mode to test services via node repl

```json
{
  "main": "myService.js",
  "scripts": {
    "debug": "minion -i"
  }
}
```

```bash
npm run debug
```

This will launch an interactive console where you can debug existing services or use minion itself

```bash
▶ npm run debug
> Ready to process myService
> services.myService.publish({ test: 'message'})
```

Within the console you have acces to `services` thats a list of existing services, each service have
a publish method that you can use to test the service, you can also access minion itself to test new services

```
> const hello = (message) => { console.log(`Hello ${message}`) }
> const service = minion(hello)
> service.publish('World')
> Processing "World" routed with key hello
Hello World
```

### Configuration

You can change default worker configuration by adding a setting property as an object with configuration values like this:

```javascript
const handler = (message) => {
  return 'Hello World'
}

handler.settings = {
  key: 'message.example.key',
  name: 'message.queue'
}

module.exports = handler
```

Check below for supported options and default values.

#### Options
- `name`- Queue name. Defaults to handler function or file name
- `exchangeType` - Defaults to 'topic'
- `exchangeName` - Defautls to the name of the handler function.
- `key` - Key to bind the queue to. Defaults to service file name or queue name.
- `exclusive` - Defaults to false.
- `durable` - Defaults to true.
- `deadLetterExchange` - By default all queues are created with a dead letter exchange. The name defaults to the name of the exchange following the `.dead` suffix. If you want to disable the dead letter exchange , set it as `false`.

### Programmatic use

You can use Minion programmatically by requiring it directly, and passing options as the second argument:

```js
const minion = require('minion')

minion((message) => {
  return 'Hello World'
}, {
  noAck: true
})
```

With async / await support

```js
const minion = require('minion')

minion(async (message) => {
  return await request('https://foo.bar.zz')
})
```

### Validation

We recommend using [minion-joi](https://github.com/pagerinc/minion-joi) or writing your own validation following that as an example.

## Environment Configuration

The RabbitMQ connection URL is read from a `RABBIT_URL` env var, if not present it will default to: `amqp://localhost`

## Error Handling

If the handler throws an error the message will be nacked and not requeued (`{ requeue: false }`), if you want to requeue on failure
minion provider a custom error to do so

Your service:
```js
const minion = require('../lib')
const Requeue = minion.Requeue

const handler = async (message) => {
    throw new Requeue('My message')
};
```

Also errors will be logged to `stderr` when thrown

## Testing

When calling Minion programatically you receive an instance of a function you can use to inject messages directly.
Assuming you're using [ava](https://github.com/sindresorhus/ava) for testing (as we do), you can test like this:

Your service:
```javascript
const handler = (message) => {
    return true
}
```

Your test:
```javascript
test('acks message with true', async t => {
    const service = minion(handler)
    const message = {hello: 'world'}

    const res = await service(message)
    t.true(res)
})
```
