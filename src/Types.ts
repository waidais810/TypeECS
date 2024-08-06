export enum SystemType {
    StartUp,
    Update,
    LateUpdate
}

export type Constructor<T = any> = new (...args: any[]) => T;
