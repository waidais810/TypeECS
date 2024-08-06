import { CommandQuery } from './Commands';
import * as decorator from './decorator';
import { EntityQuery } from './EntityQuery';
import { EventReaderQuery, EventWriterQuery } from './Event';
import { ResourceQuery } from './Resource';
import { WorldQuery } from './World';
export const system = decorator.system;
export {Commands} from './Commands';

export { World } from './World';

export {IPlugin} from './Plugin'

export * from './EntityComponent'

export {IEventWriter, IEventReader} from './Event'

export {SystemType} from './Types'

export {Resource} from './Resource'

export const query = {
    WorldQuery,
    ResourceQuery,
    EntityQuery,
    EventReaderQuery,
    EventWriterQuery,
    CommandQuery,
}

export type BoundFunction = Function & { originalFunction?: Function };

export function BindWithOriginal<T extends Function>(fn: T, thisArg: any, ...args: any[]): T & { originalFunction: T } {
  const boundFunction: BoundFunction = fn.bind(thisArg, ...args);
  boundFunction.originalFunction = fn;
  return boundFunction as T & { originalFunction: T };
}
