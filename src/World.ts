import { CommandQuery, Commands } from "./Commands";
import { SystemRegistry } from "./decorator";
import { EntityComponent } from "./EntityComponent";
import { EntityQueryProxy } from "./EntityQuery";
import { EventReader, EventReaderQueryInfo, EventWriter, EventWriterQueryInfo } from "./Event";
import { IQuery } from "./IQuery";
import { IPlugin } from "./Plugin";
import { ResourceQueryInfo } from "./Resource";
import { BoundFunction } from "./TypeExport";
import { Constructor, SystemType } from "./Types";

interface IQueryResult {
    get value(): any;
    get IsValid(): boolean;
}

type System = BoundFunction;

class EntityQueryPack implements IQueryResult {
    public entities:EntityComponent[] = [];
    constructor(private query:EntityQueryProxy){}
    private CheckEntity(entity:EntityComponent){
        if(!entity.hasAll(...this.query.querys)){
            return false;
        }
        if(this.query.without.length > 0 && entity.hasAll(...this.query.without)){
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

    get value(){
        return this.entities;
    }

    get IsValid(){
        return this.entities.length > 0;
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

    get value(){
        return this.resource;
    }

    get IsValid(){
        return this.resource !== undefined || this.nullable;
    }
}

class WorldPack implements IQueryResult {
    public constructor(private world:World){}
    get value(): World {
        return this.world;
    }
    get IsValid(): boolean {
        return true;
    }
}

class CommandPack implements IQueryResult {
    public constructor(private world:World){}
    get value(): Commands {
        return this.world.commands;
    }
    get IsValid(): boolean {
        return true;
    }
}

class EventReaderPack implements IQueryResult {
    public bindWriter:EventWriter<any>;
    private eventReader:EventReader<any>;
    public constructor(eventReader:EventReaderQueryInfo, private world:World){
        const writer = this.world.events.get(eventReader.event);
        if(writer == undefined)
            throw new Error('EventWriter not found');
        this.bindWriter = writer;
        this.eventReader = new EventReader(writer);
    }

    public OnEventChange():boolean{
        return true;
    }

    get value(): any {
        return this.eventReader;
    }
    
    get IsValid(): boolean {
        return this.eventReader.Events.length > 0;
    }
}

class EventWriterPack implements IQueryResult {
    private eventWriter:EventWriter<any>;
    public constructor(eventWriter:EventWriterQueryInfo, private world:World){
        const writer = this.world.events.get(eventWriter.writer);
        if(writer == undefined)
            throw new Error('EventWriter not found');
        this.eventWriter = writer;
    }
    get value(): any {
        return this.eventWriter;
    }
    get IsValid(): boolean {
        return true;
    }
}

class SystemPack {
    private queryPacks:IQueryResult[] = [];
    private entityPack:EntityQueryPack[] = [];
    private resourcePack:ResourceQueryPack[] = [];
    private eventReaderPack:Map<EventWriter<any>,EventReaderPack> = new Map();
    private args:any[] = [];
    private IsValid:boolean = false;
    private NeedRefresh:boolean = true;
    public constructor (private system:System, queries:IQuery[], private world:World){
        for(const query of queries){
            if(query instanceof EntityQueryProxy){
                const pack = new EntityQueryPack(query);
                this.queryPacks.push(pack);
                this.entityPack.push(pack);
            }
            else if(query instanceof ResourceQueryInfo) {
                const pack = new ResourceQueryPack(query.resource, query.IsNullable, this.world);
                this.queryPacks.push(pack);
                this.resourcePack.push(pack);
            }
            else if(query instanceof EventWriterQueryInfo){
                const pack = new EventWriterPack(query, this.world);
                this.queryPacks.push(pack);
            }
            else if(query instanceof EventReaderQueryInfo){
                const pack = new EventReaderPack(query, this.world);
                this.queryPacks.push(pack);
                this.eventReaderPack.set(pack.bindWriter, pack);
            }
            else if(query === CommandQuery){
                const pack = new CommandPack(this.world);
                this.queryPacks.push(pack);
            }
            else if(query === WorldQuery){
                const pack = new WorldPack(this.world);
                this.queryPacks.push(pack);
            }
        }
    }

    private RefreshArgs(){
        this.args.length = 0;
        for(const pack of this.queryPacks){
            if(pack.IsValid){
                this.args.push(pack.value);
            }else{
                this.IsValid = false;
                this.args.length = 0;
                return;
            }
        }
        this.IsValid = true;
    }

    public OnEventChange(event:EventWriter<any>){
        const pack = this.eventReaderPack.get(event);
        if(pack){
            if(pack.OnEventChange()){
                this.NeedRefresh = true;
            }
        }
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

    public OnResourceChange(){
        let changed = false;
        this.resourcePack.forEach(pack=>{
            if(pack.OnResourceChange())
                changed = true;
        });
        if(changed)
            this.NeedRefresh = true;
    }

    public ClearEvent(writer:EventWriter<any>){
        if(this.eventReaderPack.has(writer))
            this.NeedRefresh = true;
    }

    public Execute(){
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

export class World{
    private _entityIdIndex:number = 0;
    private _startUpSystems:SystemPack[] = [];
    private _updateSystems:SystemPack[] = [];
    private _lateUpdateSystems:SystemPack[] = [];
    private _entities:Map<number,EntityComponent> = new Map();
    private _resources:Map<Constructor,any> = new Map();

    public events:Map<Constructor,EventWriter<any>> = new Map();

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
        this.events.set(e, new EventWriter(this));
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
                    break;
                case ChangeType.Change:
                    switch(change.extra?.type){
                        case ChangeType.Add:
                            change.entity.set(change.extra.component);
                            break;
                        case ChangeType.Remove:
                            change.entity.remove(change.extra.component);
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
        if(this._waitResourceQueue.length > 0){
            this._doSystemUpdate(system=>{
                system.OnResourceChange();
            });
        }
        this._waitResourceQueue.length = 0;
    }

    public GetResource<T>(type:Constructor<T>):T{
        return this._resources.get(type);
    }

    public HasResource(type:Constructor):boolean{
        return this._resources.has(type);
    }

    public dirtyEvents:Set<EventWriter<any>> = new Set();
    public DirtyEvent(event?:EventWriter<any>){
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

    private UpdateEvents(){
        this.dirtyEvents.forEach(e=>{
            this._doSystemUpdate(s=>{
                s.OnEventChange(e);
            });
        });
    }

    private ClearEvents(){
        this._waitClearEvents.forEach(e=>{
            e.Clear();
            this._doSystemUpdate(s=>{
                s.ClearEvent(e);
            });
        });
    }

    private _waitClearEvents:Set<EventWriter<any>> = new Set();
    UpdatePerFrame(){
        this.UpdateEvents();
        [this.dirtyEvents, this._waitClearEvents] = [this._waitClearEvents, this.dirtyEvents];
        this.dirtyEvents.clear();
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

    public Build(){
        this.plugins.forEach(plugin=>{
            plugin.Build(this);
        });
        return this;
    }
}

export const WorldQuery = <IQuery>{};
