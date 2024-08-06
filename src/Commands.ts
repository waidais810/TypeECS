import { EntityComponent } from "./EntityComponent";
import { IQuery } from "./IQuery";
import { World } from "./World";

export type Command = (world: World) => void;

export class Commands {
    private commands: Command[] = [];
    
    add(command: Command) {
        this.commands.push(command);
    }
    
    execute(world: World) {
        this.commands.forEach(command => command(world));
        this.commands = [];
    }

    spawn(...components:any) {
        this.add(world => world.spawn(...components));
    }

    despawn(entity:EntityComponent) {
        this.add(world => world.remove(entity));
    }

    resource(resource:any) {
        this.add(world=>{
            world.insertResource(resource);
        });
    }
}

export const CommandQuery = <IQuery>{};
