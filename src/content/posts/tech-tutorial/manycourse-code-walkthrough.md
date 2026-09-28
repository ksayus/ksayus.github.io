---
title: ManyCourse 核心代码导读：逐文件精读 Kotlin 课表应用
published: 2026-09-28
description: 逐文件逐行精读 ManyCourse（课多多）最关键的源码，包括 School 模型、SchoolCourse 网络模型、SchoolApi 接口契约、CourseRepository 仓库、CourseSync 异步同步编排，深入理解 Kotlin 项目的最佳实践。
tags: [Android, Kotlin, 源码导读, ManyCourse, 代码精读, sealed, data class]
category: 技术教程
image: ""
slug: manycourse-code-walkthrough
---

## 前言

前三篇分别讲了 Kotlin 语法和项目架构，这一篇我们**打开源码，逐行精读**最关键的几个文件。

建议配合 [Kotlin 语法速成](/posts/manycourse-kotlin-crash-course/) 和 [项目架构详解](/posts/manycourse-project-architecture/) 一起看，遇到不认识的语法往回翻。

---

## 1. `data/School.kt` —— 什么是"学校"

```kotlin
data class School(
    val id: String,
    val name: String,
    val baseUrl: String,
    val system: String = "",
    val timetable: Timetable = Timetables.default,
) {
    val host: String
        get() = baseUrl.substringAfter("://").trimEnd('/')
}
```

逐行看：

| 行 | 说明 |
|----|------|
| `data class School(...)` | 数据类，表示"一所学校"。所有字段都在构造参数里。 |
| `id: String` | 稳定标识，全小写英文，如 `gzus`。持久化主键，**定了不许改**。 |
| `name: String` | 登录页下拉里显示的中文全称。 |
| `baseUrl: String` | 教务系统根地址，必须 `https://`、不带结尾斜杠。 |
| `system = ""` | 有默认值 → 可选字段。教务系统类型备注，只用于排查。 |
| `timetable = Timetables.default` | 有默认值 → 可选字段。学校作息时间表。 |
| `val host` | **计算属性**：不是存的字段，每次访问时从 `baseUrl` 现算。 |

**设计要点**：这个类**只放数据，没有任何网络逻辑**。UI（登录页下拉）只认这个模型，所以加学校时不用改任何界面代码——这就是"模型与视图分离"的价值。

---

## 2. `data/SchoolCourse.kt` 和 `StudentProfile` —— 网络层返回的"中立模型"

```kotlin
data class SchoolCourse(
    val name: String,
    val teacher: String,
    val room: String,
    val weekday: Int,       // 1=周一 … 7=周日
    val startPeriod: Int,   // 开始节次
    val periodCount: Int,   // 连上几节
    val weeks: String = "",  // 原始周次串，如 "3-5,8-20周"
    val campus: String = "",
) {
    val periodLabel: String
        get() = if (periodCount <= 1) "第${startPeriod}节"
                else "第${startPeriod}-${startPeriod + periodCount - 1}节"
}
```

关键点：**`SchoolCourse`（网络层）和 `Course`（本地仓库）是分开的两个类**。网络层只负责把教务系统字段翻译成这个中立结构，写库交给 `CourseRepository.replaceAll`。这样：

- 网络层不碰 UI；
- 本地模型也不依赖某所学校的字段格式；
- 换了教务系统厂商，只改网络层翻译逻辑，UI 和仓库纹丝不动。

`StudentProfile` 里的 `name` 就是"学校系统里显示的姓名"——登录后自动同步到「我的」页靠的就是它：

```kotlin
data class StudentProfile(
    val name: String,
    val account: String = "",
    val className: String = "",
    val major: String = "",
    val college: String = "",
)
```

---

## 3. `gr_api/SchoolApi.kt` —— 整个项目的"契约"（最值得精读）

这个文件定义了三个东西，一个比一个重要。

### 3.1 `sealed interface LoginResult` —— 登录结果四态

```kotlin
sealed interface LoginResult {
    data class Success(val message: String) : LoginResult
    data class Failure(val message: String) : LoginResult
    data class Pending(val message: String) : LoginResult
    data class NeedCaptcha(val message: String, val captcha: LoginCaptcha) : LoginResult
}
```

登录结果**不是"对/错"的布尔值，而是 4 种状态**。为什么？因为登录页需要对每种状态给出**准确**提示：

| 状态 | 含义 | 登录页表现 |
|------|------|-----------|
| `Success` | 账号密码通过 | 绿字提示 + 跳转主界面 |
| `Failure` | 明确失败（密码错/网络不通） | 红字显示 `message` |
| `NeedCaptcha` | 需要验证码 | 显示验证码图片，等用户填写 |
| `Pending` | 学校接口还没接入 | 提示"接口未接入"，**不退化成 Failure** |

> `Pending` 存在的意义：预写的学校点登录时，用户看到的是"接口未接入"，而不是被误导成"我密码打错了"。

### 3.2 `interface SchoolApi` —— 一所学校的完整契约

```kotlin
interface SchoolApi {
    val school: School

    /** 登录参数是否已填好；预写的空壳返回 false */
    val configured: Boolean get() = true

    /** 异步登录；回调在工作线程，保证只回调一次 */
    fun login(
        account: String,
        password: String,
        captcha: LoginCaptcha? = null,          // 可空 + 默认 null
        callback: (LoginResult) -> Unit,         // 尾随 lambda
    )
}
```

- `captcha` 可空且默认 null：首次登录不传，只有收到 `NeedCaptcha` 后重试时才传。
- `callback` 是函数参数：登录完成后被调用，把 `LoginResult` 传回来。
- 参数顺序是**刻意设计的**（`captcha` 排在 `callback` 前），这样两种调用场景都顺滑。

默认实现——没接课表的学校也能编译：

```kotlin
fun fetchSchedule(account: String, callback: (Result<List<SchoolCourse>>) -> Unit) {
    callback(Result.failure(UnsupportedOperationException("「${school.name}」还没接入课表接口")))
}
```

### 3.3 `SessionExpiredException` —— 区分"该重新登录"和"网络出问题"

```kotlin
class SessionExpiredException(
    message: String = "登录已过期，请重新登录",
) : java.io.IOException(message)
```

单独开一个异常类型，是为了让上层能区分：

- `SessionExpiredException` → 清登录态，送回登录页；
- 其他 `IOException` → 提示用户重试。

如果混在一起用同一个异常，上层就没法做差异化处理了。

### 3.4 `when` 版错误翻译

```kotlin
fun readableMessage(e: Throwable): String = when {
    e is SessionExpiredException -> "登录已过期，请重新登录"
    e is UnknownHostException -> "网络不通，请检查网络连接"
    e is SocketTimeoutException -> "连接超时，请重试"
    e.message != null -> e.message!!
    else -> "未知错误"
}
```

这是 Kotlin 里把 `if-else` 链写清爽的典型例子：`when` 不带判断对象，逐个条件匹配。

---

## 4. `data/Course.kt` —— 课程仓库（单例 object）

### 4.1 `Course` 数据类

和 `SchoolCourse` 很像，但多了几个关键字段：

```kotlin
data class Course(
    val id: Long,                    // 本地自增主键
    val name: String,
    val teacher: String,
    val room: String,
    val weekday: Int,
    val startPeriod: Int,
    val periodCount: Int,
    val weeks: String = "",
    val fromSchool: Boolean = false, // 是否从教务系统同步来的
) {
    val startTime: String            // 按节次现算时间
        get() = /* 走当前学校作息表计算 */
}
```

- `id: Long` —— 本地自增主键，区分每条课程记录。
- `fromSchool` —— 区分"同步来的"和"用户手加的"，编辑/删除时有不同逻辑。
- `startTime` 是计算属性，按节次和学校作息表**实时计算**。

### 4.2 `object CourseRepository`

```kotlin
object CourseRepository {
    val courses = mutableStateListOf<Course>()    // 可观察列表

    fun add(...): Course {
        val course = Course(nextId++, ...)         // id 自增
        courses.add(course)
        return course
    }

    fun replaceAll(remote: List<SchoolCourse>) {
        courses.clear()
        remote.forEach { /* SchoolCourse → Course 转换后 add */ }
    }

    fun coursesOn(weekday: Int): List<Course> =
        courses.filter { it.weekday == weekday }.sortedBy { it.startPeriod }
}
```

三个学习点：

1. **`object` 单例** → 全 App 唯一一份课程数据，任何地方读写都是同一份。
2. **`mutableStateListOf`** → Compose 的可观察列表，改了自动触发界面重画。
3. **`nextId++`** → 先取旧值再自增，实现 id 递增。简洁但不线程安全——在单线程的 Compose 状态管理下这不是问题。

`replaceAll` ——同步时**整体替换**而不是合并。设计原因：教务系统才是权威数据源，合并会让已退的课赖着不走。

---

## 5. `data/CourseSync.kt` —— 回调式异步的典型（略难，重点读）

这是全文**最值得琢磨异步写法**的地方。

### 5.1 状态机 `State`

```kotlin
sealed interface State {
    data object Idle : State
    data object Loading : State
    data class Ready(val courses: Int, val studentName: String) : State
    data class Failed(val message: String) : State
    data object Expired : State
}

val state = mutableStateOf<State>(State.Idle)
```

同步的 5 种状态。`mutableStateOf` 是可观察变量，课表页读它显示"正在同步 / 失败原因 / 该重新登录"。

### 5.2 嵌套回调 + 切线程

骨架（省略细节）：

```kotlin
fun sync(api: SchoolApi, account: String) {
    state.value = State.Loading

    api.fetchProfile(account) { profile ->          // 第一层回调：拉姓名
        main {                                       // 切回主线程
            val name = profile.getOrNull()?.name.orEmpty()

            api.fetchSchedule(account) { schedule -> // 第二层回调：拉课表
                main {                               // 再切回主线程
                    schedule.fold(
                        onSuccess = { list ->
                            CourseRepository.replaceAll(list)
                            state.value = State.Ready(list.size, name)
                        },
                        onFailure = { error ->
                            state.value = State.Failed(readableMessage(error))
                        },
                    )
                }
            }
        }
    }
}
```

读懂这个嵌套就懂了这个项目的异步：

1. **回调是异步的**：`fetchProfile {}` 的大括号不是立刻执行，是网络返回后才执行。
2. **回调跑在工作线程**：所以 `main { }` 负责把里面的代码切回主线程（Compose 状态只能在主线程改）。
3. **`fold` 是 Result 的标准消费方式**：把"成功走这条路、失败走那条路"写得很干净。

> [!WARNING]
> 在 lambda 里用 `return` 会退出整个外层函数，不是只退出 lambda。如果需要在 lambda 里提前返回，要用 `return@lambda名`。

---

## 6. `gr_api/SchoolRegistry.kt` —— 唯一的"加学校"入口

```kotlin
object SchoolRegistry {
    private val apis: List<SchoolApi> = listOf(
        GzusApi(),
        NhjcxyApi(),
        GdutApi(),
    )

    val schools: List<School> get() = apis.map { it.school }

    fun apiOf(schoolId: String): SchoolApi? =
        apis.find { it.school.id == schoolId }
}
```

- 加了 `SchoolRegistry` 这个中间层之后，UI 只依赖 `schools`（`List<School>`），不依赖任何 `SchoolApi` 实现。
- `apiOf()` 按学校 id 查找对应的 `SchoolApi`，登录页用它在用户切换学校后拿到正确的接口实例。

---

## 总结

这五个文件构成了 ManyCourse 的核心骨架：

| 文件 | 角色 | 关键知识点 |
|------|------|-----------|
| `School.kt` | 学校纯数据模型 | `data class`、计算属性、默认参数 |
| `SchoolCourse.kt` | 网络层中立模型 | 网络模型与本地模型的分离设计 |
| `SchoolApi.kt` | 接口契约 | `sealed interface`、默认实现、异常类型设计 |
| `Course.kt` | 课程仓库 | `object` 单例、`mutableStateListOf`、整体替换 |
| `CourseSync.kt` | 同步编排 | 嵌套回调、线程切换、`Result.fold` |

精读完这五个文件，你对 Kotlin 项目的最佳实践和 ManyCourse 的设计思想就有了深刻的理解。下一篇，我们把这些理解付诸实践——动手改代码、加学校。