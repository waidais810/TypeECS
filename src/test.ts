import {World, IPlugin, SystemType, query, system, Commands, IEventWriter, IEventReader, EntityComponent } from "./index"
const {CommandQuery, EntityQuery, EventWriterQuery, ResourceQuery, EventReaderQuery, WorldQuery} = query;

class Position {
    constructor(public x: number, public y: number) {}
}

class Velocity {
    constructor(public dx: number, public dy: number) {}
}

class Renderable {
    constructor(public sprite: string) {}
}

class Collider {
    constructor(public radius: number) {}
}

class Score {
    constructor(public value: number) {}
}

class GameConfig {
    constructor(public width: number, public height: number) {}
}

class CollisionEvent {
    constructor(public entityA: EntityComponent, public entityB: EntityComponent) {}
}

class GamePlugin implements IPlugin {
    Build(world: World): void {
        world.RegistEvent(CollisionEvent)
            .AddSystems(SystemType.StartUp, GamePlugin.StartUpSystem)
            .AddSystems(SystemType.Update, GamePlugin.MovementSystem, GamePlugin.CollisionSystem, GamePlugin.OnCollision)
            .AddSystems(SystemType.LateUpdate, GamePlugin.RenderSystem);
    }

    @system(CommandQuery)
    static StartUpSystem(commands: Commands) {
        commands.spawn(new Position(0, 0), new Velocity(1, 1), new Renderable('player.png'), new Collider(10));
        commands.spawn(new Position(100, 100), new Renderable('enemy.png'), new Collider(10));
        commands.resource(new GameConfig(800, 600));
        commands.resource(new Score(0));
    }

    @system(EntityQuery(Position, Velocity).Filter(entity=>{const posx = entity.Get(Position)?.x; return posx == undefined || posx < 100 }))
    static MovementSystem(entities: EntityComponent[]) {
        entities.forEach(entity => {
            const [position, velocity] = entity.Gets(Position, Velocity);
            if(position && velocity) {
                position.x += velocity.dx;
                position.y += velocity.dy;
            }
        });
    }

    @system(EntityQuery(Position, Collider), EventWriterQuery(CollisionEvent))
    static CollisionSystem(entities: EntityComponent[], eventWriter: IEventWriter<CollisionEvent>) {
        for (let i = 0; i < entities.length; i++) {
            for (let j = i + 1; j < entities.length; j++) {
                const [posA, colA] = entities[i].Gets(Position, Collider);
                const [posB, colB] = entities[j].Gets(Position, Collider);
                if(posA && posB && colA && colB) {
                    const dx = posA.x - posB.x;
                    const dy = posA.y - posB.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance < colA.radius + colB.radius) {
                        eventWriter.Write(new CollisionEvent(entities[i], entities[j]));
                    }
                }
            }
        }
    }

    @system(EventReaderQuery(CollisionEvent), CommandQuery)
    static OnCollision(event:IEventReader<CollisionEvent>, commands:Commands){
        for(const collision of event.Read()){
            console.log(`Collision between entity ${collision.entityA.entityID} and entity ${collision.entityB.entityID}`);
            commands.despawn(collision.entityA);
            commands.despawn(collision.entityB);
        }
    }

    @system(EntityQuery(Position, Renderable), ResourceQuery(GameConfig))
    static RenderSystem(entities: EntityComponent[], gameConfig:GameConfig) {
        entities.forEach(entity => {
            const [position, renderable] = entity.Gets(Position, Renderable);
            if(position && renderable)
                console.log(`Rendering ${renderable.sprite} at (${position.x}, ${position.y}) in a ${gameConfig.width}x${gameConfig.height} window`);
        });
    }
}

//这里将会打印两次碰状事件，因为事件的更新是延后一帧的，所以在第一帧碰撞事件发生后，第二帧才会执行碰撞事件的处理，而第二帧又发生了碰撞事件，所以会打印两次
//如果需要在碰撞事件发生后立即处理，可以将碰撞事件的处理放在碰撞事件的系统中，而不是放在碰撞事件的系统中
const world = new World(new GamePlugin());
world.StartUp();
while(true){
    world.BeginFrame();
    world.Update();
    world.LateUpdate();
    world.EndFrame();
}
