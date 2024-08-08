import { IQuery } from "./IQuery";
import { Constructor } from "./Types";

interface IResourceQuery extends IQuery {
    Nullable(boo?:boolean):IResourceQuery;
}

export class ResourceQueryInfo implements IResourceQuery {
    constructor(public resource:Constructor, public IsNullable:boolean = false) {}
    Nullable(boo:boolean = true){
        this.IsNullable = boo;
        return this;
    }
}

export function ResourceQuery(query: Constructor) {
    return new ResourceQueryInfo(query) as IResourceQuery;
}
