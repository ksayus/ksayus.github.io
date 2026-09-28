---
title: ManyCourse 项目架构详解：四层设计从 UI 到网络
published: 2026-09-28
description: 深入解析 ManyCourse（课多多）Android 课表应用的四层架构设计，包括 ui/data/gr_api/api 各层职责、一次登录的完整数据流、以及三个最核心的概念（SchoolApi 接口、SchoolRegistry 清单、CourseRepository 仓库）。
tags: [Android, Kotlin, 架构, ManyCourse, 分层设计, Compose, OkHttp]
category: 技术教程
image: ""
slug: manycourse-project-architecture
---

## 前言

看一个项目，最怕的就是"打开代码不知道该从哪看起"。本文的目标就是帮你建立 ManyCourse（课多多）项目的**全局心智地图**——看懂它分了几层、每层干什么、一次登录后数据怎么流。

读完这一篇，你打开代码就不会迷路。

> [!NOTE]
> 建议配合 [Kotlin 语法速成](/posts/manycourse-kotlin-crash-course/) 一起看。如果你已经熟悉 Kotlin 语法，可以直接从本文开始。

---

## 1. 四层架构速览

代码里所有 `package` 都在 `com.tof.manycourse` 下，按职责分成 4 大块，从「离用户最近」到「离网络最近」：

```
┌────────────────────────────────────────────────────────┐
│ ui/        Compose 界面（课表/日历/地图/我的/设置/玻璃组件）   │
│            —— 只负责「画出来 + 响应用户」                   │
├────────────────────────────────────────────────────────┤
│ data/      本地仓库与纯数据（Course/School/SchoolCourse…）  │
│            —— 只负责「存数据 + 算规则」，不碰网络、不碰 UI    │
├────────────────────────────────────────────────────────┤
│ gr_api/    学校接口层（一所学校一个文件）                    │
│            —— 负责「登录/拉课表/拉姓名」，把结果翻译成 data 层 │
├────────────────────────────────────────────────────────┤
│ api/       网络与密码学底座（OkHttp/Cookie/RSA/SM2/AES）   │
│            —— 与「具体学校」无关的可复用件                   │
└────────────────────────────────────────────────────────┘
```

**依赖方向是单向的**：`ui → data`，`ui → gr_api`，`gr_api → api`，`gr_api → data`。底层永远不认识上层。

> 一句话记忆：**ui 负责画，data 负责存，gr_api 负责"和学校打交道"，api 负责"和网络/密码打交道"。**

---

## 2. 它到底在解决什么问题

大学生每学期都要对着教务系统网站看课表、截屏存手机。这个 App 做的事：

1. **登录**：把各校教务系统的登录接口一个个接进来（现有 3 所：广软 `gzus`、金城学院 `nhjcxy`、广工 `gdut`）。
2. **同步**：登录成功后，自动把「姓名 + 课表 + 教学周」拉到本地。
3. **展示**：周视图课表 + 月历 + 校园地图，本地缓存还能离线看。

核心卖点是 `SchoolApi` 接口——加新学校 = 实现这个接口 + 注册一行，别的地方都不动。

---

## 3. 目录地图（源码位置对照）

| 目录 | 作用 | 代表文件 |
|------|------|----------|
| `api/` | 网络 + 密码学底座 | `HttpMethod.kt`、`RsaCipher.kt`、`Sm2Cipher.kt`、`AuthserverAesCipher.kt` |
| `data/` | 本地仓库 + 纯数据 | `Course.kt`、`School.kt`、`Timetable.kt`、`HolidayCalendar.kt` |
| `gr_api/` | 学校接口层 | `SchoolApi.kt`、`SchoolRegistry.kt`、`schools/`（三所学校各一个文件） |
| `ui/` | Compose 界面 | `ScheduleScreen.kt`、`CalendarScreen.kt`、`MapScreen.kt`、`ProfileScreen.kt`、`components/`（玻璃组件）、`theme/`（颜色/字体） |
| 根包 | 页面骨架 | `MainActivity.kt`（登录页）、`ManyCourseMain.kt`（主界面 4 个 Tab 切换） |

入口文件：
- `MainActivity.kt` —— 登录页（学校下拉 / 账号 / 密码 / 验证码）
- `ManyCourseMain.kt` —— 登录后的主界面，管 4 个 Tab 的挂载与切换
- 4 个 `XxxFragment.kt` —— 课表 / 日历 / 地图 / 我的，各自是 Compose 的容器

---

## 4. 一次「登录 → 同步」的完整数据流

这是整个项目最重要的图，先看图再读代码：

```
用户在登录页填学号密码，点登录
        │
        ▼
SchoolRegistry.apiOf(schoolId).login(账号, 密码) { result -> }
        │   ① 按学校 id 分发到对应实现（gzus / nhjcxy / gdut）
        ▼
[gr_api 层] 某某 Api 发起 HTTP（api 层的 HttpMethod 帮它发）
        │   ② 可能多步：GET 登录页拿 token/公钥 → POST 表单 → 判定
        ▼
login 回调 LoginResult（sealed：Success / Failure / NeedCaptcha / Pending）
        │   ③ Success → SessionStore 存会话（Keystore 加密 Cookie），跳主界面
        ▼
ManyCourseMain.onCreate
        │   ④ CourseSync.sync(schoolId, account)
        ▼
api.fetchProfile(account) { profile ->      // 拉姓名
    api.fetchSchedule(account) { schedule -> // 拉课表
        CourseRepository.replaceAll(list)     // 写进本地仓库
        state = Ready(...)                    // 供课表页显示
    }
}
        │   ⑤ 两个回调都来自 OkHttp 工作线程 → main{} 切回主线程改数据
        ▼
Compose 自动重组 → 课表页/日历页显示出刚同步的数据
```

**每个环节落在哪个文件**：

| 环节 | 文件 |
|------|------|
| ① 学校分发 | `SchoolRegistry.kt` |
| ② HTTP 与判定 | `HttpMethod.kt` + 各 `schools/XxxApi.kt` |
| ③ 会话存储 | `SessionStore.kt` + `SessionVault.kt` |
| ④ 同步编排 | `CourseSync.kt` |
| ⑤ 写仓库 | `Course.kt` 里的 `CourseRepository.replaceAll` |

---

## 5. 三个最核心的概念

### 5.1 `SchoolApi` 接口 —— 整个项目的"心脏"

`SchoolApi.kt` 定义了一所学校必须提供的几样东西：

```kotlin
interface SchoolApi {
    val school: School                    // 学校本身（id/名称/地址/节次表）
    val configured: Boolean               // 接没接好（没接好=提示"未接入"）
    fun login(account, password, captcha?, callback)   // 登录
    fun fetchSchedule(account, callback)  // 拉课表（有默认实现）
    fun fetchProfile(account, callback)   // 拉姓名（有默认实现）
    fun exportSession() / importSession() / clearSession()  // 会话持久化
}
```

关键设计点：

- `login` 的返回不是 `Boolean`，而是 `sealed interface LoginResult`（4 种状态），登录页才能给准确提示——登录成功、密码错误、需要验证码、接口未接入，各有不同的 UI 表现。
- `fetchSchedule`/`fetchProfile` 有**默认实现**，所以"只接了登录、没接课表"的新学校也能编译通过，不会影响其他功能。

### 5.2 学校清单 —— `SchoolRegistry`

`SchoolRegistry.kt` 是整个应用**唯一的"加学校"入口**：

```kotlin
private val apis: List<SchoolApi> = listOf(
    GzusApi(),
    NhjcxyApi(),
    GdutApi(),
)
```

登录页下拉、持久化、登录分发、姓名/课表同步——**全都由这段清单驱动**。加学校 = 加一个 `XxxApi()` 到列表里，就这么简单。

### 5.3 仓库 —— `CourseRepository`（一个单例 object）

`Course.kt` 用 `object` 做了个全局课程仓库：

```kotlin
object CourseRepository {
    val courses = mutableStateListOf<Course>()   // Compose 可观察列表
    fun add(...): Course { ... }
    fun replaceAll(remote: List<SchoolCourse>) { ... }
    fun coursesOn(weekday: Int): List<Course> = ...
}
```

`mutableStateListOf` 是 Compose 的"可观察列表"：**一旦里面数据变了，所有用到它的界面会自动重画**——这就是为什么网络回调里改完仓库，界面自己就更新了，不需要手动调用任何刷新方法。

> `replaceAll` 是整体替换而不是合并——因为教务系统才是权威数据源，合并会让已退的课赖着不走。

---

## 6. 页面是怎么组织的

4 个 Tab = 4 个 Fragment，每个 Fragment 里装一个 ComposeView 渲染 Compose 界面：

```
ManyCourseMain (AppCompatActivity)
 ├─ ClassScheduleFragment   → 课表页（周视图）
 ├─ CalenderFragment        → 日历页（月历）
 ├─ MapFragment             → 地图页（校园平面图）
 └─ SelfFragment            → 我的页（资料/设置/统计）
```

底栏（玻璃底栏）在 `ui/components/` 里，切换逻辑在 `ManyCourseMain.kt` 的 `selectTab()`。

> 为什么用 Fragment + Compose 混搭，而不是纯 Compose？这是历史演进的结果，读代码时知道"这 4 个是入口、具体界面在 `ui/` 里"就够了。

---

## 7. 两条铁律（改代码前先背下来）

项目 README 里强调过，零基础最容易踩：

1. **学校 `id` 是持久化主键，定了不许改**——它存在本地 SharedPreferences 里，"上次选的学校"靠它恢复。改了就等于清空老用户的选择。全小写英文短名。
2. **加接口不要新建 `HttpMethod`**——Cookie 会话挂在 `SchoolApi` 实例的 `http` 里，新建实例等于开了个空会话，接口必然被认为"没登录"。

---

## 8. 一句话总结每层边界

- **要加一所学校** → 只动 `gr_api/schools/`（新文件）+ `SchoolRegistry.kt`（一行）。
- **要改课表怎么算/怎么存** → 动 `data/`。
- **要改界面长什么样** → 动 `ui/`。
- **要接入新的加密/网络能力** → 动 `api/`。

分层清晰的定义就是：**改一层，别层几乎不用动**。这就是好的架构。

---

## 后续阅读

架构看完了，下一步建议阅读 [核心代码导读](/posts/manycourse-code-walkthrough/)，逐文件逐行理解最关键的源码实现。