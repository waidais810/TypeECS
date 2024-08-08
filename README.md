
# TypeECS框架

## 概览
TypeECS（实体-组件-系统）框架提供了一种高效的方法来管理游戏开发中的实体、组件和系统。

## 安装
使用以下命令安装TypeECS框架：
```bash
npm run install
```
确保将框架包含在你的项目目录中。

## 使用方法
要使用这个框架，你需要定义组件、系统和一个插件，以在`World`中绑定这些元素。下面是设置方法：

### 定义组件
组件是简单的类，用于存储实体的数据。例如：
```javascript
class Position {
    constructor(public x: number, public y: number) {}
}
class Velocity {
    constructor(public dx: number, public dy: number) {}
}
```

### 定义系统
系统对具有特定组件的实体执行操作。使用`@system`装饰器来定义系统：
```javascript
@system(EntityQuery(Position, Velocity))
static MovementSystem(entities: EntityComponent[]) {
    // 这里编写移动逻辑
}
```

### 创建插件
实现`IPlugin`接口来配置并向世界添加系统：
```javascript
class GamePlugin implements IPlugin {
    Build(world: World): void {
        // 在这里注册系统和事件
    }
}
```

### 初始化世界
创建一个`World`实例，传入你的插件，并启动游戏循环：
```javascript
const world = new World(new GamePlugin());
world.StartUp();
while(true){
    world.BeginFrame();
    world.Update();
    world.LateUpdate();
    world.EndFrame();
}
```

## 运行测试
要运行测试，包括你预定义的系统和组件，请使用以下命令：
```bash
npm run test
```

确保你的`package.json`包含正确的脚本设置，以使用TypeECS框架执行测试或模拟。
