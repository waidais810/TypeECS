import { IQuery } from "./IQuery";
import { Constructor } from "./Types";
import { World } from "./World";

export class EventWriterQueryInfo implements IQuery {
    constructor(public writer:Constructor) {}
}

export function EventWriterQuery(query: Constructor) {
    return new EventWriterQueryInfo(query);
}

export class EventWriter<T> {
    private events:T[] = [];
    constructor(private world:World){}
    public Write(obj:T){
        this.events.push(obj);
        this.world.DirtyEvent(this);
    }

    public get Events(){
        return this.events;
    }
    
    public Clear(){
        this.events.length = 0;
    }
}

export class EventReaderQueryInfo implements IQuery {
    constructor(public event:Constructor) {}
}

export class EventReader<T> {
    private events:T[];
    
    public constructor(writer:EventWriter<T>){
        this.events = writer.Events;
    }

    public get Events(){
        return this.events;
    }

    public get Peek(){
        return this.events[0];
    }

    public get Last(){
        return this.events[this.events.length - 1];
    }
}

export function EventReaderQuery(query: Constructor) {
    return new EventReaderQueryInfo(query);
}
