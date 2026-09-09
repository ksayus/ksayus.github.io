---
title: 决策树
published: 2026-09-09
description: 决策树是一种用于游戏开发的决策模型，它可以帮助游戏开发者根据玩家的行为和游戏状态来做出决策。
tags: [游戏开发, 决策树, AI]
category: 游戏技术
image: ../images/action-tree.avif
slug: action-tree
---

## 什么是决策树

**决策树（Decision Tree）** 是游戏 AI 中最经典、最直观的决策模型之一。它通过一系列「是/否」的条件判断，将游戏状态一步步引导到最终的动作上，就像一棵倒长的树：从根节点出发，沿着分支不断向下，直到抵达一片「叶子」——也就是最终要执行的动作。

> [!NOTE]
> 决策树的核心思想是 **分而治之**：把复杂的决策拆解成若干简单的二元判断，每个判断只回答一个问题，最终收敛到一个明确的行为。

在游戏开发中，决策树常用于 NPC 的行为选择，例如：

- 敌人在战斗中该攻击、逃跑还是回血？
- 角色在巡逻时发现玩家该追击还是警戒？
- AI 队友该治疗队友还是输出敌人？

## 决策树的节点类型

一棵决策树由两类节点构成：

| 节点类型 | 作用 | 是否有子节点 |
|----------|------|-------------|
| **决策节点（DecisionNode）** | 根据条件判断走向 `true` 或 `false` 分支 | 有（true / false 两个子节点）|
| **动作节点（ActionNode）** | 叶子节点，代表最终执行的动作 | 无 |

决策过程从 **根节点** 开始，遇到决策节点就评估条件并选择分支，直到抵达动作节点为止。

## 完整代码实现

下面是一个用 Python 实现的简易决策树，模拟了一个游戏角色在不同状态下的行为选择：

```python
class Node:
    def evaluate():
        raise NotImplementedError

class ActionNode:
    def __init__(self, action_name):
        self.action_name = action_name

    def evaluate(self, context):
        print(f"[evaluate action]: {self.action_name}")
        return self.action_name

class DecisionNode:
    def __init__(self, condition_func: object, true_node: object, false_node: object):
        self.condition = condition_func
        self.true_node = true_node
        self.false_node = false_node

    def evaluate(self, context):
        if self.condition(context):
            return self.true_node.evaluate(context)
        else:
            return self.false_node.evaluate(context)
```

## 核心类详解

### Node 基类

`Node` 是所有节点的抽象基类，定义了统一的 `evaluate` 接口。任何节点都必须实现这个方法，外部调用者无需关心当前节点是决策节点还是动作节点，直接调用 `evaluate` 即可。

> [!TIP]
> 这是典型的 **多态** 设计：决策节点和动作节点对外暴露相同的接口，但内部行为完全不同。

### ActionNode 动作节点

动作节点是树的「叶子」，代表一个具体可执行的行为：

```python
class ActionNode:
    def __init__(self, action_name):
        self.action_name = action_name

    def evaluate(self, context):
        print(f"[evaluate action]: {self.action_name}")
        return self.action_name
```

它不需要再做判断，直接返回动作名称即可。在真实游戏中，这里可以替换为播放动画、触发技能、移动角色等逻辑。

### DecisionNode 决策节点

决策节点是树的「分支」，它持有：

- 一个 **条件函数** `condition_func`
- 条件为真时走的 `true_node`
- 条件为假时走的 `false_node`

```python
class DecisionNode:
    def __init__(self, condition_func, true_node, false_node):
        self.condition = condition_func
        self.true_node = true_node
        self.false_node = false_node

    def evaluate(self, context):
        if self.condition(context):
            return self.true_node.evaluate(context)
        else:
            return self.false_node.evaluate(context)
```

`evaluate` 方法会调用条件函数，根据返回值递归地进入对应子节点，直到碰到动作节点。

### GameContext 游戏上下文

`GameContext` 封装了决策所需的全部状态数据，作为 `evaluate` 的入参在节点间传递：

```python
class GameContext:
    def __init__(self, hp, enemy_dist, has_potion):
        self.hp = hp              # 生命值
        self.enemy_dist = enemy_dist  # 与敌人的距离
        self.has_potion = has_potion  # 是否有药水
```

> [!NOTE]
> 将状态集中在一个 `context` 对象中，可以避免条件函数需要一长串参数，也方便后续扩展新的状态字段。

## 构建决策树

我们来构建一棵角色战斗决策树，逻辑如下：

```
                    ┌──────────────────┐
                    │  HP < 20 ?       │
                    └────────┬─────────┘
                       True  │  False
                  ┌──────────┴──────────┐
                  ▼                     ▼
            ┌──────────┐      ┌─────────────────────┐
            │ 逃跑撤退  │      │ HP<50 且 有药水 ?   │
            └──────────┘      └──────────┬──────────┘
                                    True  │  False
                              ┌──────────┴──────────┐
                              ▼                     ▼
                        ┌──────────┐      ┌──────────────────┐
                        │ 使用药水  │      │ 敌人距离 < 5 ?   │
                        └──────────┘      └────────┬─────────┘
                                               True  │  False
                                         ┌──────────┴──────────┐
                                         ▼                     ▼
                                   ┌──────────┐          ┌──────────┐
                                   │ 近战攻击  │          │ 原地巡逻  │
                                   └──────────┘          └──────────┘
```

对应的代码：

```python
# 动作节点（叶子）
action_attack = ActionNode("近战攻击")
action_run = ActionNode("逃跑撤退")
action_heal = ActionNode("使用药水")
action_patrol = ActionNode("原地巡逻")

# 决策节点
decision_low_hp = DecisionNode(
    condition_func=lambda ctx: ctx.hp < 20,
    true_node=action_run,
    false_node=None  # 稍后连接
)
decision_need_heal = DecisionNode(
    condition_func=lambda ctx: ctx.hp < 50 and ctx.has_potion,
    true_node=action_heal,
    false_node=None
)
decision_melee_range = DecisionNode(
    condition_func=lambda ctx: ctx.enemy_dist < 5,
    true_node=action_attack,
    false_node=action_patrol
)

# 连接节点，形成树状结构
decision_low_hp.false_node = decision_need_heal
decision_need_heal.false_node = decision_melee_range

root_node = decision_low_hp
```

注意这里先用 `None` 占位，再通过属性赋值把节点串起来——这是一种灵活的「先创建后连接」的构建方式，适合节点之间存在循环引用或需要动态调整结构的场景。

## 测试场景

准备四个典型场景来验证决策树的行为：

```python
test_scenarios = [
    GameContext(hp=15, enemy_dist=2, has_potion=True),   # 残血 + 近身 + 有药
    GameContext(hp=40, enemy_dist=3, has_potion=True),   # 半血 + 近身 + 有药
    GameContext(hp=70, enemy_dist=8, has_potion=False),  # 健康 + 远距 + 无药
    GameContext(hp=80, enemy_dist=2, has_potion=True),   # 健康 + 近身 + 有药
]

print("===== 决策结果 =====")
for i, ctx in enumerate(test_scenarios, 1):
    print(f"\n--- 场景 {i} (HP={ctx.hp}, 距离={ctx.enemy_dist}m, 有药={ctx.has_potion}) ---")
    root_node.evaluate(ctx)
```

运行结果：

```text
===== 决策结果 =====

--- 场景 1 (HP=15, 距离=2m, 有药=True) ---
[evaluate action]: 逃跑撤退

--- 场景 2 (HP=40, 距离=3m, 有药=True) ---
[evaluate action]: 使用药水

--- 场景 3 (HP=70, 距离=8m, 有药=False) ---
[evaluate action]: 原地巡逻

--- 场景 4 (HP=80, 距离=2m, 有药=True) ---
[evaluate action]: 近战攻击
```

我们来逐个分析决策路径：

| 场景 | HP | 距离 | 有药 | 决策路径 | 最终动作 |
|------|----|------|------|----------|----------|
| 1 | 15 | 2m | ✅ | HP<20 → True | 逃跑撤退 |
| 2 | 40 | 3m | ✅ | HP<20 → False → HP<50 且有药 → True | 使用药水 |
| 3 | 70 | 8m | ❌ | HP<20 → False → HP<50且有药 → False → 距离<5 → False | 原地巡逻 |
| 4 | 80 | 2m | ✅ | HP<20 → False → HP<50且有药 → False → 距离<5 → True | 近战攻击 |

## 决策树的优缺点

### 优点

- **直观易懂**：结构清晰，逻辑一目了然，便于调试和维护
- **性能高效**：每次决策只需遍历从根到叶子的一条路径，时间复杂度为 `O(树高)`
- **易于扩展**：新增行为只需添加新的动作节点和对应的条件分支

### 缺点

- **状态爆炸**：当条件数量增多时，分支会呈指数级增长，树变得臃肿难以维护
- **条件顺序敏感**：条件判断的先后顺序直接影响结果，容易出现「某个分支永远走不到」的逻辑漏洞
- **缺乏记忆**：纯决策树是无状态的，无法表达「上一帧做了什么」这类时序逻辑

> [!WARNING]
> 当决策逻辑变得非常复杂时，建议改用 **行为树（Behavior Tree）** 或 **有限状态机（FSM）**，它们在可维护性和表达力上更有优势。

## 可以改进的地方

上面的示例代码保留了最简结构，实际项目中还可以做以下优化：

1. **统一基类继承**：让 `ActionNode` 和 `DecisionNode` 都继承自 `Node`，并把 `evaluate` 声明为抽象方法
2. **条件函数类型注解**：用 `Callable[[GameContext], bool]` 替代 `object`，获得更好的类型检查
3. **动作执行逻辑**：把 `print` 替换为真正的游戏逻辑，例如调用角色组件的方法
4. **可视化调试**：记录决策路径，方便排查 AI 行为异常
5. **数据驱动**：用 JSON / YAML 配置决策树结构，运行时动态构建，无需改代码

## 小结

决策树是游戏 AI 的入门级方案，它的价值不在于功能多么强大，而在于 **用最少的概念搭建出可运行的决策系统**。理解了决策树的「条件 → 分支 → 动作」模型后，再去学习行为树、效用系统等更复杂的 AI 技术会顺畅很多。

下一步可以尝试：

- 为决策树添加 **权重随机**，让相同状态下 NPC 行为不完全一样，增加真实感
- 把条件判断从硬编码的 `lambda` 改为可配置的策略对象
- 引入 **黑板（Blackboard）** 模式，让多个决策树共享状态