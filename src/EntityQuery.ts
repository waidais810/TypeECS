import { IQuery } from "./IQuery";
import { Constructor } from "./Types";

export class EntityQueryProxy implements IQuery {
    public without: Constructor[] = [];
    constructor(public querys: Constructor[]) {}
    Without(...querys: Constructor[]) {
        this.without = querys;
        return this;
    }
}

export function EntityQuery(...querys: Constructor[]) {
    return new EntityQueryProxy(querys);
}
