import { World } from "./World";

export interface IPlugin{
    Build(world: World): void;
}