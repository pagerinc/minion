# minion
Microservice Framework for RabbitMQ Workers

## Features


## Usage

install `minion`:

```bash
npm install --save minion
```

### Single handler

Create an index.js and export a function like this:

```javascript
module.exports = (message, done) => {
   done('Hello World')
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

Once this is done, start the worker:

```bash
npm start
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

### Configuration

You can change default worker configuration by setting properties on your handler like this:

```javascript
const handler = (message, done) => {
  done('Hello World')
}

handler.noAck = true
hadler.queue = 'message.example.key'

module.exports = handler
```

Check below for supported options and default values.

#### Consumer Options
- `noAck` - Wheter acking is required for this worker. Defaults to false.

#### Exchange Options

- `exchangeType` - Defaults to 'topic'
- `exchangeName` - Defautls to 'default'

#### Queue Optios
- `key` - Key to bind the queue to. Defaults to service file name or queue name.
- `exclusive` - Defaults to false.
- `durable` - Defaults to true. 
        
### Programmatic use

You can use Minion programmatically by requiring it directly:

```js
const minion = require('minion')

minon((message, done) => {
  done('Hello World')
})
```

## Environment Configuration

The RabbitMQ connection URL is read from a `RABBIT_URL` env var, if not present it will default to: `amqp://localhost`

## Error Handling


## Testing

