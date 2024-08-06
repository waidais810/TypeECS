import {World, IPlugin, SystemType, query, system, Commands, IEventWriter, IEventReader, Resource, EntityComponent, BindWithOriginal } from "./index"
const {CommandQuery, EntityQuery, EventWriterQuery, ResourceQuery, EventReaderQuery, WorldQuery} = query;

class ComponentA{}

class ComponentB{}

class ComponentC{}

class ResourceA{
    constructor(public resource:string){}
}

class EventA{
    constructor(public v:number){}
}

class DespawnEvent{
    constructor(public entity:EntityComponent){}
}

class Test2Plugin implements IPlugin{
    Build(world: World): void {
        world.AddSystems(SystemType.StartUp, BindWithOriginal(this.StartUpSystem, this));
    }

    @system(CommandQuery)
    StartUpSystem(commands:Commands){
        commands.spawn(new ComponentA(), new ComponentC());
        commands.resource(new ResourceA("hahaha"))
    }
}

class TestPlugin implements IPlugin{
    Build(world: World): void {
        world.RegistEvent(EventA)
            .RegistEvent(DespawnEvent)
            .AddSystems(SystemType.StartUp, TestPlugin.StartUpSystem)
            .AddSystems(SystemType.Update, TestPlugin.TestEventSystem, TestPlugin.TestEventSystem2)
            .AddSystems(SystemType.LateUpdate, TestPlugin.TestSystem, TestPlugin.DespawnSystem)
            .AddPlugin(new Test2Plugin());
    }

    @system(CommandQuery, EventWriterQuery(EventA))
    static StartUpSystem(commands:Commands, eventWriter:IEventWriter<EventA>){
        commands.spawn(new ComponentA(), new ComponentC());
        commands.resource(new ResourceA("hahaha"))
    }

    @system(EntityQuery(ComponentA, ComponentC).Without(ComponentB), ResourceQuery(ResourceA).Nullable(true), EntityQuery(ComponentC))
    static TestSystem(entities:EntityComponent[], resource:Resource<ResourceA>, entities2:EntityComponent[]){
        entities.forEach(entity=>{
            const [comA, comC] = entity.gets(ComponentA, ComponentC);
            console.log(comA, comC, resource);
        })
    }

    @system(EventWriterQuery(EventA), WorldQuery)
    static TestEventSystem(eventReader:IEventWriter<EventA>, world:World){
        eventReader.Write(new EventA(world.Frame));  
    }

    @system(EventReaderQuery(EventA), CommandQuery, EntityQuery(ComponentA), EventWriterQuery(DespawnEvent))
    static TestEventSystem2(eventReader:IEventReader<EventA>, commands:Commands, entities:EntityComponent[], eventWriter:IEventWriter<DespawnEvent>){
        const events = eventReader.Read();
        const event = events[0]?.v ?? 0;
        console.log(event);
        commands.resource(new ResourceA(event.toString()));
        if(event >= 100){
            entities.forEach(entity=>{
                eventWriter.Write(new DespawnEvent(entity));
                commands.despawn(entity);
            });
        }
    }

    @system(EventReaderQuery(DespawnEvent))
    static DespawnSystem(eventReader:IEventReader<DespawnEvent>){
        const events = eventReader.Read();
        events.forEach(event=>{
            console.log("Despawn", event.entity.entityID);
        });
    }

}

const world = new World(new TestPlugin());
world.StartUp();
while(true){
    world.UpdatePerFrame();
}
