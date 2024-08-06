import { IQuery } from "./IQuery";

export const SystemRegistry = new Map<Function, IQuery[]>();
export function system(...queries: IQuery[]) {
    return function(target:any) {
        SystemRegistry.set(target, queries);
    };
}
