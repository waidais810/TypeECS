import { CommandQuery, Commands } from "./Commands";
import { SystemRegistry } from "./decorator";
import { EntityComponent } from "./EntityComponent";
import { EntityQueryProxy } from "./EntityQuery";
import { IEventReader, EventReaderQueryInfo, IEventWriter, EventWriterQueryInfo } from "./Event";
import { IQuery } from "./IQuery";
import { IPlugin } from "./Plugin";
import { ResourceQueryInfo } from "./Resource";
import { BoundFunction } from "./TypeExport";
import { Constructor, SystemType } from "./Types";

interface IQueryResult {
    get Value(): any;
    get IsValid(): boolean;
    Update?():boolean;
}

type System = BoundFunction;

class EntityQueryPack implements IQueryResult {
    public entities:EntityComponent[] = [];
    private _filterResults?:EntityComponent[];
    constructor(private query:EntityQueryProxy){
        if(query.EnableFilter)
            this._filterResults = [];
    }
    private CheckEntity(entity:EntityComponent){
        if(!entity.HasAll(...this.query.querys)){
            return false;
        }
        if(this.query.without.length > 0 && entity.HasAll(...this.query.without)){
            return false;
        }
        return true;
    }

    NewEntity(entityId:EntityComponent):boolean{
        if(this.CheckEntity(entityId)){
            this.entities.push(entityId);
            return true;
        }
        return false;
    }

    RemoveEntity(entity:EntityComponent):boolean{
        const index = this.entities.indexOf(entity);
        if(index !== -1){
            this.entities.splice(index,1);
            return true;
        }
        return false;
    }

    OnEntityChange(entity:EntityComponent):boolean{
        const index = this.entities.indexOf(entity);
        if(index !== -1){
            if(!this.CheckEntity(entity)){
                this.entities.splice(index,1);
                return true;
            }
        }else{
            if(this.CheckEntity(entity)){
                this.entities.push(entity);
                return true;
            }
        }
        return false;
    }

    Update(): boolean {
        if(this._filterResults == undefined)
            return false;
        let changed = false;
        this._filterResults.length = 0;
        for(const entity of this.entities){
            if(this.query.filters.every(f=>f(entity))){
                this._filterResults.push(entity);
                changed = true;
            }
        }
        return changed;
    }

    private get Result(){
        return this._filterResults ?? this.entities;
    }

    get Value(){
        return this.Result;
    }

    get IsValid(){
        return this.Result.length > 0;
    }
}

class ResourceQueryPack implements IQueryResult {
    private resource:any;
    public constructor(private resourceType:Constructor, private nullable:boolean, private world:World){}

    public OnResourceChange():boolean{
        let oldResource = this.resource;
        this.resource = this.world.GetResource(this.resourceType);
        if(oldResource !== this.resource){
            return true;
        }
        return false;
    }

    get Value(){
        return this.resource;
    }

    get IsValid(){
        return this.resource !== undefined || this.nullable;
    }
}

class WorldPack implements IQueryResult {
    public constructor(private world:World){}
    get Value(): World {
        return this.world;
    }
    get IsValid(): boolean {
        return true;
    }
}

class CommandPack implements IQueryResult {
    public constructor(private world:World){}
    get Value(): Commands {
        return this.world.commands;
    }
    get IsValid(): boolean {
        return true;
    }
}

class EventReaderPack implements IQueryResult {
    public eventProxy:EventProxy<any>;
    public constructor(eventReader:EventReaderQueryInfo, private world:World){
        const proxy = this.world.events.get(eventReader.event);
        if(proxy == undefined)
            throw new Error('EventProxy not found');
        this.eventProxy = proxy;
    }

    public OnEventChange():boolean{
        return true;
    }

    get Value() {
        return this.eventProxy;
    }
    
    get IsValid(): boolean {
        return this.eventProxy.RdLength > 0;
    }
}

class EventWriterPack implements IQueryResult {
    private eventProxy:EventProxy<any>;
    public constructor(eventWriter:EventWriterQueryInfo, private world:World){
        const proxy = this.world.events.get(eventWriter.writer);
        if(proxy == undefined)
            throw new Error('EventWriter not found');
        this.eventProxy = proxy;
    }
    get Value(): any {
        return this.eventProxy;
    }
    get IsValid(): boolean {
        return true;
    }
}

class SystemPack {
    private queryPacks:IQueryResult[] = [];
    private entityPack:EntityQueryPack[] = [];
    private resourcePack:Map<Constructor, ResourceQueryPack> = new Map();
    private args:any[] = [];
    private IsValid:boolean = false;
    private _updateQuerys?:IQueryResult[];

    private get UpdateQuerys():IQueryResult[]{
        if(this._updateQuerys == undefined)
            this._updateQuerys = [];
        return this._updateQuerys;
    }

    public NeedRefresh:boolean = true;
    public constructor (private system:System, queries:IQuery[], private world:World){
        for(const query of queries){
            let pack: IQueryResult|undefined;
            if(query instanceof EntityQueryProxy){
                pack = new EntityQueryPack(query);
                this.entityPack.push(pack as EntityQueryPack);
            }
            else if(query instanceof ResourceQueryInfo) {
                pack = new ResourceQueryPack(query.resource, query.IsNullable, this.world);
                this.resourcePack.set(query.resource, pack as ResourceQueryPack);
            }
            else if(query instanceof EventWriterQueryInfo){
                pack = new EventWriterPack(query, this.world);
            }
            else if(query instanceof EventReaderQueryInfo){
                pack = new EventReaderPack(query, this.world);
                (pack as EventReaderPack).eventProxy.BindReadSystem(this);
            }
            else if(query === CommandQuery){
                pack = new CommandPack(this.world);
            }
            else if(query === WorldQuery){
                pack = new WorldPack(this.world);
            }
            if(pack){
                this.queryPacks.push(pack);
                if(pack.Update){
                    this.UpdateQuerys.push(pack);
                }
            }
        }
    }

    private RefreshArgs(){
        this.args.length = 0;
        for(const pack of this.queryPacks){
            if(pack.IsValid){
                this.args.push(pack.Value);
            }else{
                this.IsValid = false;
                this.args.length = 0;
                return;
            }
        }
        this.IsValid = true;
    }

    public NewEntity(entity:EntityComponent){
        let changed = false;
        this.entityPack.forEach(pack=>{
            if(pack.NewEntity(entity))
                changed = true;
        });
        if(changed)
            this.NeedRefresh = true;
    }

    public RemoveEntity(entity:EntityComponent){
        let changed = false;
        this.entityPack.forEach(pack=>{
            if(pack.RemoveEntity(entity))
                changed = true;
        });
        if(changed)
            this.NeedRefresh = true;
    }

    public OnEntityChange(entity:EntityComponent){
        let changed = false;
        this.entityPack.forEach(pack=>{
            if(pack.OnEntityChange(entity))
                changed = true;
        });
        if(changed)
            this.NeedRefresh = true;
    }

    public OnResourceChange(type:Constructor){
        let pack = this.resourcePack.get(type);
        if(pack?.OnResourceChange())
            this.NeedRefresh = true;
    }

    private UpdateSystems(){
        this._updateQuerys?.forEach(q=>{
            this.NeedRefresh = q.Update?.() || this.NeedRefresh;
        })
    };

    public Execute(){
        this.UpdateSystems();
        if(this.NeedRefresh){
            this.RefreshArgs();
            this.NeedRefresh = false;
        }
        if(!this.IsValid){
            return;
        }
        this.system(...this.args);
    }
}

enum ChangeType {
    Add,
    Remove,
    Change
}

type EntityChange = {
    type:ChangeType,
    entity:EntityComponent,
    extra?:{
        type:ChangeType,
        component:any
    }
}

type ResourceChange = {
    type:ChangeType,
    resource:any,
    extra?:any
}

class EventProxy<T> implements IEventReader<T>, IEventWriter<T> {
    private events:T[] = [];
    private readEvents:T[] = [];
    private bindReaderSystem:Set<SystemPack> = new Set();
    constructor(private world:World){}
    Read(): T[] {
        return this.readEvents;
    }

    Peek(): T {
        return this.readEvents[0];
    }

    get RdEmpty(): boolean {
        return this.readEvents.length === 0;
    }

    BindReadSystem(system:SystemPack){
        this.bindReaderSystem.add(system);
    }

    UnBindReadSystem(system:SystemPack){
        this.bindReaderSystem.delete(system);
    }

    get RdLength(){
        return this.readEvents.length;
    }

    Write(event: T): void {
        this.events.push(event);
        this.world.DirtyEvent(this);
    }

    private RefreshSystem(){
        this.bindReaderSystem.forEach(s=>{
            s.NeedRefresh = true;
        });
    }

    //将写入的事件转移到读取事件中，同时清空写入事件，当存在新事件时会通知绑定的系统
    Flush(){
        [this.events, this.readEvents] = [this.readEvents, this.events];
        this.events.length = 0;
        if(this.readEvents.length > 0){
            this.RefreshSystem();
        }
    }

    ClearReadEvents(){
        const needRefresh = this.readEvents.length > 0;
        this.readEvents.length = 0;
        if(needRefresh){
            this.RefreshSystem();
        }
    }
}

export class World{
    private _entityIdIndex:number = 0;
    private _startUpSystems:SystemPack[] = [];
    private _updateSystems:SystemPack[] = [];
    private _lateUpdateSystems:SystemPack[] = [];
    private _entities:Map<number,EntityComponent> = new Map();
    private _resources:Map<Constructor,any> = new Map();

    public events:Map<Constructor,EventProxy<any>> = new Map();

    private _waitEntityQueue:EntityChange[] = [];
    private _waitResourceQueue:ResourceChange[] = [];

    public commands:Commands = new Commands();
    private plugins:IPlugin[] = [];
    private frame:number = 0;
    public get Frame(){
        return this.frame;
    }

    constructor(...plugin:IPlugin[]){
        this.AddPlugin(...plugin);
    }

    public newEntityId(){
        return this._entityIdIndex++;
    }

    RegistEvent(e:Constructor){
        this.events.set(e, new EventProxy(this));
        return this;
    }

    spawn(...components:any[]){
        const newEntity = new EntityComponent(this.newEntityId(), components);
        this._waitEntityQueue.push({type:ChangeType.Add, entity:newEntity});
        return newEntity;
    }

    remove(entity:EntityComponent){
        this._waitEntityQueue.push({type:ChangeType.Remove, entity});
    }

    addComponent(entity:EntityComponent, component:any){
        this._waitEntityQueue.push({type:ChangeType.Change, entity, extra:{type:ChangeType.Add, component}});
    }

    removeComponent(entity:EntityComponent, component:any){
        this._waitEntityQueue.push({type:ChangeType.Change, entity, extra:{type:ChangeType.Remove, component}});
    }

    insertResource(resource:any){
        this._waitResourceQueue.push({type:ChangeType.Add, resource});
    }

    removeResource(resource:any){
        this._waitResourceQueue.push({type:ChangeType.Remove, resource});
    }

    private _doSystemUpdate(f:(system:SystemPack)=>void){
        this._updateSystems.forEach(system=>{
            f(system);
        });
        this._startUpSystems.forEach(system=>{
            f(system);
        });
        this._lateUpdateSystems.forEach(system=>{
            f(system);
        });
    }

    private UpdateChange(){
        this._waitEntityQueue.forEach(change=>{
            switch(change.type){
                case ChangeType.Add:
                    this._entities.set(change.entity.entityID, change.entity);
                    this._doSystemUpdate(system=>{
                        system.NewEntity(change.entity);
                    });
                    break;
                case ChangeType.Remove:
                    this._entities.delete(change.entity.entityID);
                    this._doSystemUpdate(system=>{
                        system.RemoveEntity(change.entity);
                    });
                    change.entity.Destroy();
                    break;
                case ChangeType.Change:
                    switch(change.extra?.type){
                        case ChangeType.Add:
                            change.entity.Set(change.extra.component);
                            break;
                        case ChangeType.Remove:
                            change.entity.Remove(change.extra.component);
                            break;
                    }
                    this._doSystemUpdate(system=>{
                        system.OnEntityChange(change.entity);
                    });
                    break;
            }
        });
        this._waitEntityQueue.length = 0;

        this._waitResourceQueue.forEach(change=>{
            switch(change.type){
                case ChangeType.Add:
                    this._resources.set(change.resource.constructor, change.resource);
                    break;
                case ChangeType.Remove:
                    this._resources.delete(change.resource.constructor);
                    break;
            }
        });
        this._waitResourceQueue.forEach(resourceChange=>{
            this._doSystemUpdate(system=>{
                system.OnResourceChange(resourceChange.resource.constructor);
            });
        })
        this._waitResourceQueue.length = 0;
    }

    public GetResource<T>(type:Constructor<T>):T{
        return this._resources.get(type);
    }

    public HasResource(type:Constructor):boolean{
        return this._resources.has(type);
    }

    private dirtyEvents:Set<EventProxy<any>> = new Set();
    public DirtyEvent(event?:EventProxy<any>){
        event && this.dirtyEvents.add(event);
    }

    public AddSystems(type:SystemType,...systems:System[]){
        let systemArr:SystemPack[]|undefined;
        switch(type){
            case SystemType.StartUp:
                systemArr = this._startUpSystems;
                break;
            case SystemType.Update:
                systemArr = this._updateSystems;
                break;
            case SystemType.LateUpdate:
                systemArr = this._lateUpdateSystems;
                break;
            default:
                systemArr = undefined;
                break;
        }
        if(systemArr){
            systems.forEach(s=>{
                const queries = SystemRegistry.get(s.originalFunction ?? s);
                const systemPack = new SystemPack(s, queries ?? [], this);
                systemArr.push(systemPack);
            })
        };
        return this;
    }

    StartUp(){
        this._startUpSystems.forEach(system=>{
            system.Execute();
        });
    }

    private ExecuteCommands(){
        this.commands.execute(this);
    }

    private needClearEvents:Set<EventProxy<any>> = new Set();
    private UpdateEvents(){
        this.dirtyEvents.forEach(e=>e.Flush());
        [this.dirtyEvents, this.needClearEvents] = [this.needClearEvents, this.dirtyEvents];
        this.dirtyEvents.clear();
    }

    private ClearEvents(){
        this.needClearEvents.forEach(e=>e.ClearReadEvents());
        this.needClearEvents.clear();
    }

    UpdatePerFrame(){
        this.UpdateEvents();
        this.ExecuteCommands();
        this.UpdateChange();
        this.Update();
        this.LateUpdate();
        this.ClearEvents();
    }

    private Update(){
        this._updateSystems.forEach(system=>{
            system.Execute();
        });
    }

    private LateUpdate(){
        this.frame++;
        this._lateUpdateSystems.forEach(system=>{
            system.Execute();
        });
    }

    public AddPlugin(...plugin:IPlugin[]){
        plugin.forEach(p=>{
            this.plugins.push(p);
            p.Build(this);
        });
        return this;
    }
}

export const WorldQuery = <IQuery>{};
