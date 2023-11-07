import { EventEmitter } from 'events';

import { HandlerFn, Context, MessageType, MetadataType } from '@pager/minion';

export declare function injectFieldFromMessageAs(loggedFieldName: string, eventFieldName: string): ((handler: HandlerFn) => HandlerFn);

export type AddDefaultLoggingEventHandlersOptions = {
    messageKey?: string
    responseKey?: string
}

export type DefaultLoggingEventHandlers = {
    defaultErrorLoggerHandler: (error: unknown, context: Context) => void
    defaultMessageLoggerHandler: (message: MessageType, metadata: MetadataType, context: Context) => void
    defaultReadyLoggerHandler: (queue: unknown, context: Context) => void
    defaultResponseLoggerHandler: (response: MessageType, context: Context) => void
}

export declare function addDefaultLoggingEventHandlers(minion: EventEmitter, options?: AddDefaultLoggingEventHandlersOptions): DefaultLoggingEventHandlers;
