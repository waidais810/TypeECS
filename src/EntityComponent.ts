import { Constructor } from "./Types";

export class EntityComponent {
    private map = new Map<Constructor, any>();
    constructor(public entityID: number, components?:any[]) {
        components?.forEach(component => this.set(component));
    }
    
    get<T>(query: new () => T): T {
        return this.map.get(query);
    }
    
    set(value: any): void {
        // 获取value的构造函数
        const constructor = value.constructor;
        if (!constructor) {
            throw new Error("The provided value does not have a constructor");
        }
        this.map.set(constructor, value);
    }

    remove(query: any): void {
        this.map.delete(query.constructor);
    }

    gets<T extends Constructor[]>(...ctors:T): { [K in keyof T]: T[K] extends Constructor<infer U> ? U|undefined : never } {
        return ctors.map(ctor => new ctor()) as any;
    }

    has<T>(query: new () => T): boolean {
        return this.map.has(query);
    }

    hasAll<T extends Constructor[]>(...ctors:T): boolean {
        return ctors.every(ctor => this.map.has(ctor));
    }
}