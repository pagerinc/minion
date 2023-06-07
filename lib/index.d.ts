import { EventEmitter } from 'events';
import { Logger } from 'pino';

export { Logger };

export type Settings = {
    arguments?: Record<string, unknown>
    autoDelete?: boolean
    autoStart?: boolean
    deadLetterExchange?: string | boolean
    debug?: boolean
    durable?: boolean
    exchangeName?: string
    exchangeType?: string
    exclusive?: boolean
    key?: string
    keys?: string[]
    name?: string
    prefetch?: number
    queueMode?: string
    rabbit?: unknown
    rabbitUrl?: string
    requeue?: boolean
    logger?: Logger
}


// As documented in the amqp module:
// https://amqp-node.github.io/amqplib/channel_api.html#channel_consume
export type AmqpMessage = {
    content: Buffer
    fields: Object
    properties: Object
}

export type MetadataType = AmqpMessage;

export type Context = {
    logger?: Logger
}

export type MessageType = string | any;

export type HandlerFn = (message: MessageType, metadata: MetadataType, context: Context) => Promise<unknown>;

export type Publisher = (message: unknown, key: unknown, properties: unknown) => void;

export type Service = EventEmitter & {
    connection: unknown
    handle: (message: unknown, metadata: unknown) => Promise<unknown>
    options: unknown
    publish: Publisher
    start: () => void
}

declare function createMinion(settings?: Settings, settingsOverride?: Settings): Publisher;

declare function createMinion(handler: HandlerFn, settingsOverride?: Settings): Service;

export = createMinion;
