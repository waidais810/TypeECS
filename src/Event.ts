import { IQuery } from "./IQuery";
import { Constructor } from "./Types";

export class EventWriterQueryInfo implements IQuery {
    constructor(public writer:Constructor) {}
}

export function EventWriterQuery(query: Constructor) {
    return new EventWriterQueryInfo(query) as IQuery;
}

export interface IEventWriter<T> {
    Write(event:T):void;
}

export class EventReaderQueryInfo implements IQuery {
    constructor(public event:Constructor) {}
}

export interface IEventReader<T> {
    Read():ReadonlyArray<T>;
    Peek():T|undefined;
    get RdLength():number;
    get RdEmpty():boolean;
}

export function EventReaderQuery(query: Constructor) {
    return new EventReaderQueryInfo(query) as IQuery;
}
