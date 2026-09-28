---
title: Kotlin 语言速成：用 ManyCourse 真实代码学语法
published: 2026-09-28
description: 不系统地学完 Kotlin，而是认识 ManyCourse 项目代码里出现过的每一个 Kotlin 语法。每一条都配项目真实代码，学完就能读懂这个 Android 课表应用。
tags: [Kotlin, Android, 语法, ManyCourse, 编程入门, 零基础]
category: 技术教程
image: ""
slug: manycourse-kotlin-crash-course
---

## 前言

Kotlin 是 Google 官方推荐的 Android 开发语言，运行在 JVM 上（和 Java 同平台，能互相调用）。它比 Java 更简洁，主要靠两点：

- **类型大多可以省略**（编译器自动推断）；
- **可空类型写进类型系统**（从语法上防止空指针崩溃）。

本文的目标不是系统地学完 Kotlin，而是**认识 ManyCourse 项目代码里出现过的每一个 Kotlin 语法**。每一条都配项目真实代码，学完你就读得动这个项目了。

> [!NOTE]
> ManyCourse（课多多）是一个纯 Kotlin 写的 Android App。本文所有代码示例均取自该项目源码，不是凭空编造的例子。

---

## 1. 变量：`val` 和 `var`

```kotlin
val name = "李同学"       // val：只读，赋值后不能再改（类似"常量"）
var activeIndex = 0       // var：可变，能重新赋值
```

- `val` 优先。能用 `val` 就别用 `var`——读代码的人就少一份担心。
- **类型推断**：`name` 没写类型，但编译器知道它是 `String`；`activeIndex` 知道是 `Int`。

项目实例（`ManyCourseMain.kt`）：

```kotlin
private lateinit var tabFragments: List<Fragment>
private var activeIndex = 0
```

> `lateinit` 读作"迟点再初始化"：告诉编译器"这个 `var` 我现在不赋值，但用之前一定会赋"。第一次看到它不用慌。

---

## 2. 基本类型与字符串模板

```kotlin
val n: Int = 14            // 整数
val name: String = "课多多"  // 字符串
val ok: Boolean = true     // 布尔
```

**字符串模板**：用 `$` 把变量塞进字符串，`${}` 塞表达式。这是项目里最常见的语法之一。

```kotlin
"第${startPeriod}节"                       // → "第1节"
"这所学校（$schoolId）不在学校清单里了"       // → 直接拼变量
```

项目实例（`SchoolCourse.kt`）：

```kotlin
val periodLabel: String
    get() = if (periodCount <= 1) "第${startPeriod}节"
            else "第${startPeriod}-${startPeriod + periodCount - 1}节"
```

---

## 3. 可空类型：`?` `?.` `?:` `!!` `?.let`

这是 Kotlin 和 Java 最大的区别，**必须吃透**。

```kotlin
val a: String = "一定有值"   // 非空类型
val b: String? = null        // 可空类型：结尾带 `?`
```

对可空类型，不能直接调方法，必须"安全处理"：

```kotlin
val s: String? = maybeNull()

// ① 安全调用 ?. —— 为空就整体返回 null，不抛异常
s?.length          // s 为空 → null；不为空 → 字符串长度

// ② Elvis 操作符 ?: —— 为空时给个默认值（"否则"的意思）
s?.length ?: 0     // 为空 → 0

// ③ !! —— 我保证它不为空（空了你崩）；尽量别用
s!!.length

// ④ ?.let { } —— 不为空才执行一段代码
s?.let { println("内容：$it") }
```

项目实例（`CourseSync.kt`）：

```kotlin
val name = profile.getOrNull()?.name.orEmpty()
//                       ↑ 安全调用    ↑ 为空给 ""
```

实例（`ManyCourseMain.kt`）：

```kotlin
schoolId = SessionStore.schoolId.value ?: LoginSettings.selectedSchoolId.value
//            ↑ 前者为空时，取后者（Elvis 兜底）
```

> `.orEmpty()`：可空字符串变非空，为空时给 `""`。`.orNull()` 相反，是 `Result`/集合取不到时给 `null`。

---

## 4. 函数

```kotlin
fun add(a: Int, b: Int): Int {   // 返回类型 : Int
    return a + b
}

// 单表达式函数：函数体只有一个表达式，可以简写（项目里极常见）
fun double(x: Int) = x * 2
```

**默认参数**：调用时可以不传，用默认值。

```kotlin
fun sync(schoolId: String?, account: String, force: Boolean = false) { ... }
// 调用：sync(id, account)            → force 用默认 false
//       sync(id, account, force = true)
```

**命名参数**：调用时写参数名，防止记错顺序（参数多时特别有用）。

```kotlin
Course(name="高数", teacher="王建国", weekday=1, startPeriod=1, periodCount=2)
```

项目实例：`Course.kt` 里的 `add()` 和 `CourseSync.kt` 里的 `sync()`。

---

## 5. 类与属性

```kotlin
class Person(val name: String, var age: Int) {
    // name 是只读属性，age 是可变属性，都能直接 对象.name 访问
    fun greet() = "我是 $name"
}
```

- Kotlin 没有 Java 的 `getXxx()/setXxx()`，属性直接 `.name` 访问。
- 类体里还能定义**计算属性**（没有幕后字段，每次算）：用 `val xxx get() = ...`。

项目实例（`School.kt`）：

```kotlin
data class School(
    val id: String,
    val name: String,
    val baseUrl: String,
    val system: String = "",
    val timetable: Timetable = Timetables.default,
) {
    val host: String          // ← 计算属性，每次取都算一次
        get() = baseUrl.substringAfter("://").trimEnd('/')
}
```

---

## 6. `data class`：数据类

普通类前面加 `data`，编译器自动帮你生成 `equals()` / `hashCode()` / `toString()` / `copy()`。专门用来**承载数据**。

项目里几乎所有模型都是 data class：

```kotlin
data class StudentProfile(
    val name: String,
    val account: String = "",
    val className: String = "",
    val major: String = "",
    val college: String = "",
)
```

> 看到 `val X = ""` 这种**带默认值的属性**就是「可选字段」：不传就是空串。

---

## 7. `object` 和 `companion object`

```kotlin
// object：单例。整个程序只有一个实例，用「对象名.成员」访问
object CourseRepository {
    val courses = mutableStateListOf<Course>()
    fun clear() = courses.clear()
}
// 用法：CourseRepository.clear()
```

项目里用 `object` 做**全局唯一的仓库/编排器/工具类**，非常普遍：

- `CourseRepository`（课程仓库）
- `SessionStore`（会话存储）
- `SchoolRegistry`（学校清单）

```kotlin
// companion object：挂在类上的静态成员（类似 Java 的 static）
class Course {
    companion object {
        const val MAX_PERIOD = 14
    }
}
// 用法：Course.MAX_PERIOD
```

---

## 8. 条件表达式：`if` 和 `when`

```kotlin
// if 是表达式，有返回值（类似 Java 的三元运算符 ?:）
val label = if (periodCount <= 1) "第${startPeriod}节"
            else "第${startPeriod}-${startPeriod + periodCount - 1}节"

// when：加强版 switch，不写判断对象就是 if-else 链
when {
    response.isRedirect -> LoginResult.Success("登录成功")
    response.body.contains("密码错误") -> LoginResult.Failure("密码错误")
    else -> LoginResult.Failure("登录失败")
}
```

项目里 `when` 有两个经典用法：

**带判断对象**（`CourseRepository` 的 `coursesOn`）：

```kotlin
fun coursesOn(weekday: Int): List<Course> =
    courses.filter { it.weekday == weekday }.sortedBy { it.startPeriod }
```

**不带判断对象**（`SchoolApi.kt` 的 `readableMessage`）：

```kotlin
fun readableMessage(e: Throwable): String = when {
    e is SessionExpiredException -> "登录已过期，请重新登录"
    e is UnknownHostException -> "网络不通，请检查网络连接"
    e is SocketTimeoutException -> "连接超时，请重试"
    else -> e.message ?: "未知错误"
}
```

---

## 9. `sealed class` / `sealed interface`：密封类型

用来表示"有限的几种情况"。编译器会检查 `when` 是否覆盖了所有分支——漏一个就编译不过。

```kotlin
sealed interface LoginResult {
    data class Success(val message: String) : LoginResult
    data class Failure(val message: String) : LoginResult
    data class Pending(val message: String) : LoginResult
    data class NeedCaptcha(val message: String, val captcha: LoginCaptcha) : LoginResult
}
```

使用时的 `when`：

```kotlin
when (val result = loginResult) {
    is LoginResult.Success -> enterMain()
    is LoginResult.Failure -> showError(result.message)
    is LoginResult.Pending -> showPending(result.message)
    is LoginResult.NeedCaptcha -> showCaptcha(result.captcha)
}
// 如果漏掉任何一种，IDE 会标红："'when' expression must be exhaustive"
```

> `sealed` 的核心价值：**把"运行时可能漏掉的情况"变成"编译时就能发现的错误"**。

---

## 10. 集合操作

Kotlin 的集合操作符非常丰富，项目里最常见的几个：

```kotlin
val list = listOf(1, 2, 3, 4, 5)

// filter：过滤
list.filter { it > 2 }              // → [3, 4, 5]

// map：映射
list.map { it * 2 }                 // → [2, 4, 6, 8, 10]

// sortedBy：排序
list.sortedBy { it }                // 升序
list.sortedByDescending { it }      // 降序

// fold：折叠（处理 Result 的经典模式）
schedule.fold(
    onSuccess = { list -> CourseRepository.replaceAll(list) },
    onFailure = { error -> state.value = State.Failed(readableMessage(error)) },
)

// getOrNull：取不到就 null
profile.getOrNull()?.name.orEmpty()
```

---

## 11. Lambda 表达式

Kotlin 的 lambda 语法是项目异步回调的基础：

```kotlin
// 完整 lambda
{ x: Int, y: Int -> x + y }

// 如果最后一个参数是 lambda，可以移到括号外（尾随 lambda）
api.login(account, password) { result ->
    // 处理登录结果
}

// 单参数 lambda 默认叫 it
list.filter { it > 2 }    // it 就是每个元素
```

项目实例（`CourseSync.kt` 的嵌套回调——这是全文最值得琢磨的异步写法）：

```kotlin
api.fetchProfile(account) { profile ->          // 第一层回调：拉姓名
    main {                                       // 切回主线程
        api.fetchSchedule(account) { schedule -> // 第二层回调：拉课表
            main {                               // 再切回主线程
                schedule.fold(
                    onSuccess = { list -> CourseRepository.replaceAll(list) },
                    onFailure = { error -> state.value = State.Failed(...) },
                )
            }
        }
    }
}
```

读懂这个嵌套就懂了项目的异步：

1. **回调是异步的**：`fetchProfile {}` 的大括号不是立刻执行，是网络返回后才执行。
2. **回调跑在工作线程**：所以 `main { }` 负责把里面的代码切回主线程（Compose 状态只能在主线程改）。

---

## 12. `Result` 类型

Kotlin 标准库的 `Result<T>` 用来表示"可能成功、也可能失败"的操作结果：

```kotlin
fun fetchSchedule(account: String, callback: (Result<List<SchoolCourse>>) -> Unit)

// 成功时
callback(Result.success(listOf(course1, course2)))

// 失败时
callback(Result.failure(IOException("网络不通")))
```

消费端用 `fold`：

```kotlin
result.fold(
    onSuccess = { courses -> /* 用数据 */ },
    onFailure = { error -> /* 显示错误 */ },
)
```

---

## 13. 协程中的 `main {}`（项目特有工具函数）

项目定义了一个工具函数 `main {}`，实际上是 `Handler(Looper.getMainLooper()).post { ... }` 的简写。作用是把一段代码切到 Android 主线程执行。

```kotlin
// 为什么需要它？
// OkHttp 的回调跑在工作线程，Compose 状态只能在主线程改。
// 所以网络回调里改 UI 状态前，都要 main { } 切线程。

api.fetchProfile(account) { profile ->
    main {
        // 这里的代码在主线程跑，可以安全地改 Compose 状态
        state.value = State.Ready(...)
    }
}
```

> [!WARNING]
> 如果你在非主线程直接修改 `mutableStateOf` 或 `mutableStateListOf` 的值，Compose 会崩溃。`main {}` 就是项目里的保险丝。

---

## 总结

本文覆盖了 ManyCourse 项目源码中出现过的所有 Kotlin 语法点。如果你把这些都眼熟了，这个项目的代码就读得通了。

记忆口诀：

| 场景 | 语法 |
|------|------|
| 不变量 | `val` |
| 可变量 | `var` |
| 可能为空 | 类型后加 `?` |
| 安全取值 | `?.` |
| 为空给默认值 | `?:` |
| 单例 | `object` |
| 数据载体 | `data class` |
| 多分支 | `when` |
| 有限子类型 | `sealed class/interface` |
| 回调函数 | lambda（尾随） |
| 可能失败 | `Result<T>` + `fold` |

> 不用一开始就把 Kotlin 全学完，边读项目边查语法，是最快的路。