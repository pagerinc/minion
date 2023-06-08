declare module '@pager/minion' {

    import { EventEmitter } from 'events';

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
    }


    // As documented in the amqp module:
    // https://amqp-node.github.io/amqplib/channel_api.html#channel_consume
    export type AmqpMessage = {
        content: Buffer
        fields: Object
        properties: Object
    }

    export type HandlerFn = (message: string | any, metadata: AmqpMessage) => Promise<unknown>;

    export type Publisher = (message: unknown, key: unknown, properties: unknown) => void;

    export type Service = EventEmitter & {
        connection: unknown
        handle: (message: unknown, metadata: unknown) => Promise<unknown>
        options: unknown
        publish: Publisher
        start: () => void
    }

    function createMinion(settings?: Settings, settingsOverride?: Settings): Publisher;

    function createMinion(handler: HandlerFn, settingsOverride?: Settings): Service;

    export default createMinion;
}
