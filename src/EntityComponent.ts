import { Constructor } from "./Types";

export class EntityComponent {
    private map = new Map<Constructor, any>();
    private _isVaild = true;
    
    public get isVaild() {
        return this._isVaild;
    }

    Destroy() {
        this._isVaild = false;
    }

    constructor(public entityID: number, components?:any[]) {
        components?.forEach(component => this.Set(component));
    }
    
    Get<T>(query: Constructor<T>): T|undefined {
        return this.map.get(query);
    }
    
    Set(value: any): void {
        // 获取value的构造函数
        const constructor = value.constructor;
        if (!constructor) {
            throw new Error("The provided value does not have a constructor");
        }
        this.map.set(constructor, value);
    }

    Remove(query: any): void {
        this.map.delete(query.constructor);
    }

    Gets<T extends Constructor[]>(...ctors:T): { [K in keyof T]: T[K] extends Constructor<infer U> ? U|undefined : never } {
        return ctors.map(ctor => this.Get(ctor)) as any;
    }

    Has<T>(query: new () => T): boolean {
        return this.map.has(query);
    }

    HasAll<T extends Constructor[]>(...ctors:T): boolean {
        return ctors.every(ctor => this.map.has(ctor));
    }
}