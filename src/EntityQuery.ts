import { EntityComponent } from "./EntityComponent";
import { IQuery } from "./IQuery";
import { Constructor } from "./Types";

type EntityFilter = (entity:EntityComponent)=>boolean;

interface IQueryProxy extends IQuery{
    Without(...querys: Constructor[]):IQueryProxy;
    Filter(...filters: EntityFilter[]):IQueryProxy;
}

export class EntityQueryProxy implements IQueryProxy {
    public without: Constructor[] = [];
    constructor(public querys: Constructor[]) {}
    public filters: EntityFilter[] = [];
    Without(...querys: Constructor[]) {
        this.without = querys;
        return this;
    }
    Filter(...filters: EntityFilter[]) {
        this.filters = filters;
        return this;
    }
    public get EnableFilter(){return this.filters.length > 0};
}

export function EntityQuery(...querys: Constructor[]) {
    return new EntityQueryProxy(querys) as IQueryProxy;
}
