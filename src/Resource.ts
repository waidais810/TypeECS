import { IQuery } from "./IQuery";
import { Constructor } from "./Types";

export class ResourceQueryInfo implements IQuery {
    constructor(public resource:Constructor, public IsNullable:boolean = false) {}
    Nullable(boo:boolean = true){
        this.IsNullable = boo;
        return this;
    }
}

export function ResourceQuery(query: Constructor) {
    return new ResourceQueryInfo(query);
}

export class Resource<T> {
    public constructor(public obj:T){}
}
