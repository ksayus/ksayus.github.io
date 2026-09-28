---
title: ManyCourse 动手练习：从跑项目到加学校的实战路线
published: 2026-09-28
description: 一份从零开始的 ManyCourse 实战练习路线图，包含环境搭建、项目运行、以及 7 道由易到难的编程练习——从改一行数据到亲手接入一所新学校。
tags: [Android, Kotlin, 学习路线, ManyCourse, 实战练习, 开源贡献]
category: 技术教程
image: ""
slug: manycourse-hands-on-exercises
---

## 前言

光看不练学不会。前几篇讲了 Kotlin 语法、项目架构、核心代码——这篇给你一条可执行的路线 + 一组由易到难的练习。

从改一行数据到加一所学校，挑几题动手做，比读十遍文档都管用。

---

## 第一步：把项目跑起来

### 环境要求

| 需要 | 版本 |
|------|------|
| JDK | 17 或以上（项目在 JDK 21/25 上验证过） |
| Android SDK | Platform 37 + Build-Tools 36 |
| Android Studio | 最新稳定版 |

### 零基础搭建步骤

1. 装 **Android Studio**（官网下载），首次打开会引导装 SDK。
2. 克隆项目：`git clone https://github.com/ksayus/ManyCourse.git`
3. 用 Android Studio 打开项目**目录**（不是某个文件，是整个 ManyCourse 文件夹）。
4. Android Studio 会自动生成 `local.properties`（里面是本机 SDK 路径），通常自己搞定。
5. 等它同步（Gradle 拉依赖，第一次可能较慢）。
6. 连一台 Android 手机（开 USB 调试）或建一个模拟器，点 **Run ▶**。

### 命令行构建（可选）

```bash
cd ManyCourse
./gradlew :app:testDebugUnitTest :app:assembleDebug
# 产物：app/build/outputs/apk/debug/app-debug.apk
```

> [!TIP]
> 跑不起来多半是：SDK 没装 Platform 37、JDK 太老、`local.properties` 缺 `sdk.dir`。对照项目 README 的排查表逐一检查。

---

## 推荐学习节奏

```
第 1 遍  读 Kotlin 语法速成  → 只求"眼熟每个语法"
第 2 遍  读项目架构详解      → 画出"4 层 + 登录数据流"这张图
第 3 遍  读核心代码导读      → 对着 Android Studio 逐行看那 5 个核心文件
第 4 遍  做下面 1~3 号练习
第 5 遍  做 4~7 号练习（加学校 / 加地图 / 写测试）
```

每遍之间隔一两天，记忆更牢。卡住了就回到项目 README——README 是写给"想加学校的开发者"的，非常详细。

---

## 动手练习（按难度排序）

### 练习 1（最简单）：读懂一个 data class

打开 `School.kt`，回答以下问题：

- `School` 有哪几个字段？哪些有默认值？
- 创建一个"只给 id/name/baseUrl"的 School，`system` 和 `timetable` 会是什么？
- `host` 是存下来的字段，还是现算的？给 `baseUrl = "https://jwxt.xx.edu.cn/"`，`host` 等于多少？

> 目的：理解 `data class`、默认参数、计算属性的基本概念。

---

### 练习 2：改预置课程，验证"改数据 → 界面自动更新"

`Course.kt` 的 `init { }` 里有一堆预置课程。找到它们，改成你自己的课（名字/教室/星期几），重新运行，看课表页变没变。

> 目的：体会 `object` 单例 + `mutableStateListOf` 改了数据后 Compose 自动重画的机制——不需要手动调用任何刷新方法。

---

### 练习 3：给登录结果加一种新状态

在 `SchoolApi.kt` 的 `LoginResult` 里新增一种：

```kotlin
data class NetworkError(val message: String) : LoginResult
```

然后编译项目，观察：哪里报错提示"没处理完 `when`"？

> 目的：体会 `sealed` 的威力——新增一种状态，编译器会**逼你在所有 `when` 分支里处理它**，漏了就编译不过。这是 Kotlin 类型系统防止遗漏的经典设计。

---

### 练习 4（核心挑战）：加一所学校

照项目 README 的「三步接入」流程抄一遍：

**第一步**：复制 `gr_api/schools/NhjcxyApi.kt` 成 `XxxApi.kt`，修改 `school` 的 id/name/baseUrl。

```kotlin
// 模板骨架
class XxxApi : WebLoginSchoolApi() {
    override val school = School(
        id = "xxx",
        name = "某某大学",
        baseUrl = "https://jwxt.xxx.edu.cn",
    )
    override val loginUrl = "$baseUrl/jwglxt/xtgl/login_slogin.html"
    override val usernameField = "yhm"
    override val passwordField = "mm"
}
```

**第二步**：在 `SchoolRegistry.kt` 的 `apis` 列表里加一行：

```kotlin
private val apis: List<SchoolApi> = listOf(
    GzusApi(),
    NhjcxyApi(),
    GdutApi(),
    XxxApi(),   // ← 新增这一行
)
```

**第三步**：跑测试验证：

```bash
./gradlew :app:testDebugUnitTest --tests '*SchoolRegistryTest*'
```

> 目的：真正理解"接口 + 清单驱动"的架构——为什么加学校不用改 UI，只需实现接口 + 注册一行。

---

### 练习 5：加一个节假日年份

在 `HolidayCalendar.kt` 里，照现有年份的写法给新的一年加一组 `rest(...)`/`work(...)` 调用，然后跑 `HolidayCalendarTest`。

注意：要"原文照抄 + 注释写通知原话"，否则测试会拦。

> 目的：理解"内置常量数据 + 用测试钉住事实"的设计——数据对了测试过，数据错了测试拦。

---

### 练习 6：加一个校区地图

照项目 README 第五章的流程：

1. 放一张图到 `drawable-nodpi/`；
2. 在 `SchoolMap.kt` 登记校区（含坐标）；
3. 跑 `SchoolMapTest` 验证。

> 目的：理解 Android 资源目录规则（`-nodpi`、全小写命名）和项目约定的"坐标系/主校区"规范。

---

### 练习 7：给某个解析器写一个单测

挑一个解析器（如 `GdutScheduleParser.kt`），在 `app/src/test/.../` 里仿照现有的 `GdutScheduleParserTest.kt` 加一条断言。

> 目的：理解"把解析逻辑拆成独立 object + 用样本钉住真实页面结构"的价值——解析器失效时不会报错，只会静默表现成"课表空了"，测试能兜住。

---

## 常见坑（提前避雷）

| 坑 | 原因 | 解决 |
|----|------|------|
| 改了代码没反应 | 可能是 `val`/`var` 搞混、忘了重新 Run、改了别处的代码 | 确认改的是 `app/` 里的源码 |
| 回调里改 Compose 状态崩溃 | Compose 状态只能在主线程改 | 网络回调里改状态前要 `main { }` 切线程 |
| `return` 写错位置 | lambda 里 `return` 会退出整个外层函数 | 用 `return@lambda名` 只跳出这个 lambda |
| 把学校 `id` 改了 | id 是持久化主键 | 铁律：id 定了不许改 |
| 新增 `HttpMethod()` | Cookie 会话断了 | 复用 `SchoolApi` 实例上已有的 `http` |

---

## 如果还想系统补 Kotlin

本项目自带的 Kotlin 语法点已经能覆盖日常 80% 场景。想系统补课的话，推荐顺序：

1. Kotlin 官方文档的 **Kotlin by Example**（免费，短小精悍）；
2. 官方中文站 `kotlinlang.org/docs/` 的 Basics + Idioms 两节；
3. Android 官方 **Compose 基础**教程（学 `@Composable` / `Modifier` / 状态管理）。

> 不用一开始就把 Kotlin 全学完，边读项目边查语法，是最快的路。

---

## 收尾

四篇文章覆盖了语言、架构、精读、动手四个维度。建议把它们和项目 README 一起放在手边——每过一遍项目，你就能多看懂一层。

从零到一的过程可能会卡住好几次，但每一次卡住后解决的问题，才是真正学到手的东西。祝你折腾愉快。