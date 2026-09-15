---
title: ManyCourse 教务系统 API 接入与调用指南
published: 2026-09-15
description: 面向 ManyCourse 课程表 Android 应用后端开发者的接口接入指南，涵盖 SchoolApi 契约、WebLoginSchoolApi 骨架、SchoolRegistry 注册、HttpMethod 网络出口，以及加学校/改登录/调业务接口的完整工作流。
tags: [Android, Kotlin, OkHttp, 教务系统, API, 架构, ManyCourse, 登录]
category: 技术教程
image: ""
slug: manycourse-api-integration
---

## 前言

> 面向要**改**这套接口、或要在页面里**调**它的人。
> 读完能做到四件事：**加一所学校** / **改某所学校的登录** / **加一个业务接口** / **把它接到 UI 上**。
>
> 文中标「实测」的数字与路径都来自真机抓包验证；没验证过的地方一律写成 `TODO(接入)`，不要当成已知事实。

---

## 0. 速查表

| 我想做什么 | 动哪里 |
|---|---|
| 加一所学校 | 复制 `gr_api/schools/NhjcxyApi.kt` → 改 4 个值 → 在 `SchoolRegistry.apis` 加一行 |
| 改登录地址 / 表单字段名 | 那所学校的 `loginUrl`、`usernameField`、`passwordField` |
| 密码不是明文提交 | 覆写 `encodePassword()`（例子见 `GzusApi` + `api/RsaCipher.kt`） |
| 登录前要先拿 token / 公钥 | 覆写 `prepare()` |
| "登录成功"判定不对 | 覆写 `judge()` |
| 加「拉课表」这类业务接口 | 在那所学校的 `XxxApi` 里加方法，复用它的 `http` |
| 在页面里调用 | `SchoolRegistry.apiOf(id)?.xxx(...) { 回调 }`，回调在**工作线程**，自己切主线程 |
| 接口还没接好 | `override val configured = false` → 用户看到「接口未接入」而不是"密码错误" |
| 换学校 / 退出登录 | 调 `http.clearCookies()`（见 §4.4） |

---

## 1. 结构总览

```
data/School.kt                 学校纯数据模型（id / 名称 / 根地址 / 系统类型）
data/LoginSettings.kt          「上次选的学校」持久化（SharedPreferences）
      ↑ UI 只依赖这两层，不依赖任何网络实现

gr_api/SchoolApi.kt            ★ 契约：SchoolApi 接口 + LoginResult 三态 + 通用成败判定
gr_api/WebLoginSchoolApi.kt    ★ 「表单登录」型教务系统的通用骨架（新学校抄它）
gr_api/SchoolRegistry.kt       ★★ 学校清单 —— 唯一的「加学校」入口
gr_api/schools/GzusApi.kt      广州软件学院（正方 V9，已接入）
gr_api/schools/NhjcxyApi.kt    南京航空航天大学金城学院（预写占位，待填）

api/HttpMethod.kt              唯一的网络出口：OkHttp + 内存 Cookie 会话 + 异步表单 POST
api/RsaCipher.kt               正方用的「裸 RSA」加密
```

运行时数据流（登录）：

```
SchoolRegistry.schools ─▶ SchoolDropdownAdapter ─▶ 登录页下拉（EditSchool）
                                │ 用户选中
                                ▼
                    selectedSchool + LoginSettings（持久化）
                                │ 点「登录」
                                ▼
        SchoolRegistry.apiOf(id).login(账号, 密码) { LoginResult }
                                │ 回调在 OkHttp 工作线程
                                ▼
        MainActivity.runOnUiThread → 成功进主界面 / 失败显示原因
```

**两条铁律：**

1. **学校 `id` 是持久化主键，定了就不许改**（改了 = 清空老用户"上次选的学校"）。全小写英文短名。
2. **加业务接口不要新建 `HttpMethod`**：登录成功后会话（Cookie）在 `SchoolApi` 实例的 `http` 里，新建实例等于换个空会话，接口必然跳登录页。

---

## 2. 契约速查（签名）

### 2.1 `School` —— 学校的纯数据（`data/School.kt`）

```kotlin
data class School(
    val id: String,        // 稳定标识，持久化主键，全小写英文，如 "gzus"
    val name: String,      // 下拉里显示的中文全称
    val baseUrl: String,   // 根地址，必须 https、不带结尾斜杠
    val system: String = "", // 教务系统类型备注，只用于排查
) {
    val host: String       // 下拉副标题用，如 "jwxt.gzus.edu.cn"
}
```

### 2.2 `SchoolApi` —— 一所学校要提供什么（`gr_api/SchoolApi.kt`）

```kotlin
interface SchoolApi {
    val school: School

    /** 登录参数是否已填好；预写的空壳返回 false */
    val configured: Boolean get() = true

    /** 异步登录；回调在工作线程，保证只回调一次 */
    fun login(account: String, password: String, callback: (LoginResult) -> Unit)
}
```

`LoginResult` 是**三态**，不要退化成 Boolean：

| 取值 | 含义 | 登录页表现 |
|---|---|---|
| `LoginResult.Success(message)` | 账号密码通过 | 绿字 + 进主界面 |
| `LoginResult.Failure(message)` | 明确失败（密码错 / 网络不通 / 服务端异常） | 红字显示 message |
| `LoginResult.Pending(message)` | 这所学校的接口还没接入 | 红字提示去补哪个文件 |

> `Pending` 存在的意义：预写的学校点登录时，用户看到的是"接口未接入"，
> 而不是被误导成"我密码打错了"。

### 2.3 `WebLoginSchoolApi` —— 表单登录骨架（`gr_api/WebLoginSchoolApi.kt`）

子类只要填 3 个抽象值，可选覆写 3 个钩子：

| 成员 | 必须/可选 | 作用 |
|---|---|---|
| `school` | 必须 | 这所学校（含根地址） |
| `loginUrl` | 必须 | 登录表单提交的**完整 URL** |
| `usernameField` | 必须 | 表单里用户名的 key，如 `yhm` |
| `passwordField` | 必须 | 表单里密码的 key，如 `mm` |
| `http` | 继承 | 该校专属的 HTTP 会话（独立 Cookie） |
| `encodePassword(pwd)` | 可选覆写 | 密码字段填什么值；默认原样 |
| `prepare(callback)` | 可选覆写 | 登录前先 GET 登录页/公钥，返回**要合并进表单的额外字段** |
| `judge(response)` | 可选覆写 | 判定成功/失败；默认关键字启发式 |

默认执行顺序：

```
prepare()  ──▶  表单 POST { usernameField=账号, passwordField=encodePassword(密码), ...额外字段 }  ──▶  judge()
```

### 2.4 `HttpMethod` —— 唯一的网络出口（`api/HttpMethod.kt`）

**异步（推荐，登录/业务都用这套）** —— 回调在 OkHttp 工作线程：

```kotlin
fun getAsync(url: String, headers: Map<String,String> = emptyMap(),
             callback: (Result<HttpResponse>) -> Unit)

fun postFormAsync(url: String, form: Map<String,String>, headers: Map<String,String> = emptyMap(),
                  callback: (Result<HttpResponse>) -> Unit)
```

**同步（只能在子线程调，主线程会抛 NetworkOnMainThreadException）**：

```kotlin
fun getResponse(url: String, headers: Map<String,String> = emptyMap()): HttpResponse
fun postForm(url: String, form: Map<String,String>, headers: Map<String,String> = emptyMap()): HttpResponse
```

**旧接口（保留未删，返回裸 String）**：`get(url)`、`post(url, json: JSONObject)`。

**会话与工具**：

```kotlin
fun cookieValue(url: String, name: String): String?  // 取某个 Cookie 值（回填 csrftoken 时用）
fun cookiesFor(url: String): List<Cookie>
fun clearCookies()                                    // 换学校 / 退出登录
```

`HttpResponse` 是响应快照（body 只能读一次，所以先落成不可变对象再交给业务）：

```kotlin
data class HttpResponse(
    val code: Int,
    val body: String,
    val location: String?,   // 重定向目标：登录成功的典型信号
    val finalUrl: String,    // 跟随重定向后的最终地址
) { val isRedirect: Boolean }
```

### 2.5 `RsaCipher`（`api/RsaCipher.kt`）

```kotlin
/** 裸 RSA（无填充）加密，返回小写十六进制 */
RsaCipher.encryptToHex(plain: String, modulusBase64: String, exponentBase64: String): String
```

用的是 `java.util.Base64` + `BigInteger.modPow`，纯 JVM 逻辑，单测覆盖在 `RsaCipherTest`。

---

## 3. 改动：加一所学校 / 改一所学校

### 3.1 加一所新学校（3 步）

**第 1 步：抓包拿到登录请求**（方法见 §5.1），得到三个值：Request URL、用户名 key、密码 key。

**第 2 步：复制模板。** 把 `gr_api/schools/NhjcxyApi.kt` 复制成 `XxxApi.kt`：

```kotlin
package com.tof.manycourse.gr_api.schools

import com.tof.manycourse.data.School
import com.tof.manycourse.gr_api.WebLoginSchoolApi

class XxxApi : WebLoginSchoolApi() {

    override val school = School(
        id = "xxx",                          // ★ 全小写英文短名，定了别再改
        name = "XX 大学",
        baseUrl = "https://jwxt.xx.edu.cn",  // 不带结尾斜杠
        system = "正方教务系统 V-9.0",         // 仅备注
    )

    override val loginUrl = "${school.baseUrl}/jwglxt/xtgl/login_slogin.html"
    override val usernameField = "yhm"
    override val passwordField = "mm"
}
```

**第 3 步：注册。** 在 `gr_api/SchoolRegistry.kt` 的 `apis` 里加一行（顺序 = 登录页下拉顺序）：

```kotlin
private val apis: List<SchoolApi> = listOf(
    GzusApi(),
    NhjcxyApi(),
    XxxApi(),        // ← 加这里
)
```

**验证**：`gradlew :app:testDebugUnitTest`（`SchoolRegistryTest` 会自动校验 id 唯一 / 必须 https / 不能带结尾斜杠 / 清单与实现一一对应），然后真机登录一次看 Logcat（§5.2）。

> 到此为止 UI 一行都不用改：下拉、持久化、登录分发都是自动的。

### 3.2 改一所学校的登录

#### 3.2.1 表单字段名不对

改 `usernameField` / `passwordField` 即可。字段名以抓包里的 **Form Data key** 为准。

#### 3.2.2 密码不是明文（RSA / MD5 / 其他）

覆写 `encodePassword`。RSA 的完整例子见 `GzusApi`：

```kotlin
override fun encodePassword(password: String): String {
    val modulus = publicKeyModulus ?: return password
    val exponent = publicKeyExponent ?: return password
    return RsaCipher.encryptToHex(password, modulus, exponent)
}
```

> [!WARNING]
> **易错点**：正方用的是**裸 RSA（无填充）**，即 `c = m^e mod n`。
> 用 `RSA/ECB/PKCS1Padding` 会填随机数，服务端解出来带垃圾字节 ——
> 表现和"密码错了"一模一样，极难排查。`RsaCipherTest` 专门守着这条。

MD5 之类直接：

```kotlin
override fun encodePassword(password: String): String =
    java.security.MessageDigest.getInstance("MD5")
        .digest(password.toByteArray()).joinToString("") { "%02x".format(it) }
```

#### 3.2.3 登录前要先拿 token（CSRF）

覆写 `prepare`，把要回填的字段返回去。`GzusApi` 的真实写法（实测有效）：

```kotlin
override fun prepare(callback: (Result<Map<String, String>>) -> Unit) {
    // 1) GET 登录页：为了让服务端下发 CSRFTOKEN Cookie
    http.getAsync(loginUrl) { page ->
        page.fold(
            onSuccess = { loadPublicKey(callback) },   // 2) 再取公钥
            onFailure = { callback(Result.failure(it)) },
        )
    }
}
// 返回的 map 会被合并进登录表单：
linkedMapOf<String, String>().apply {
    http.cookieValue(loginUrl, "CSRFTOKEN")?.let { put("csrftoken", it) }
    put("language", "zh_CN")
}
```

> `callback` **必须且只能调用一次**：成功/失败两条分支都要覆盖，否则登录页会一直转圈。
> 另外 `prepare` 里缓存的公钥是**每次登录都会重新取**的 —— 学校换密钥也不用管。

#### 3.2.4 有验证码

当前骨架没有验证码位。做法：在 `prepare` 里把验证码图片的 URL 一并取回，
然后在 `SchoolApi` 上开一个"两步登录"（先返回 `LoginResult.Failure("需要验证码")` + 图片，
再由 UI 带验证码重新调）。这是接口形状的改动，先想清楚 UI 怎么问用户，再动代码。

#### 3.2.5 判定规则不对

默认 `judge` 是关键字启发式（`LoginJudge.byKeywords`）：命中"用户名或密码错误"等文案即失败，
**其余 200/302 一律按成功处理**。这是"够用就好"的策略，误判就覆写：

```kotlin
override fun judge(response: HttpResponse): LoginResult {
    val result = LoginJudge.byKeywords(response)
    // 兜底：正方失败时是「200 + 重新渲染登录页」，用"页面里还带着登录表单"再判一次
    if (result is LoginResult.Success && response.body.contains("login_slogin")) {
        return LoginResult.Failure("用户名或密码错误")
    }
    return result
}
```

### 3.3 下架 / 暂不开放某所学校

- **暂不开放（参数没填全）**：`override val configured = false`。用户点登录会看到明确提示。
- **彻底下架**：从 `SchoolRegistry.apis` 里删掉那一行。老用户持久化里的旧 id 会被
  `SchoolRegistry.find()` 解析成 `null`，登录页自动回落到"未选择"（这条有测试守着）。
  注意：**别删了还留着 id 复用**，会串到别的学校。

### 3.4 改显示名 / 根地址

`name`、`baseUrl`、`system` 随便改。**`id` 不能改**（见 §1 铁律 1）。

---

## 4. 调用：怎么用

### 4.1 登录现在是怎么被调用的

登录页（`MainActivity`）里的真实调用：

```kotlin
private fun doLogin() {
    val school = selectedSchool ?: return showLoginError(getString(R.string.login_page_error_school))
    // ... 账号密码校验、本地调试账号 ...

    val api = SchoolRegistry.apiOf(school.id) ?: return showLoginError(...)
    setLoading(true)

    // login() 的回调在 OkHttp 工作线程上，必须切回主线程再动 View
    api.login(account, pwd) { result ->
        runOnUiThread {
            if (isFinishing || isDestroyed) return@runOnUiThread   // ★ 别在销毁后动 View
            setLoading(false)
            when (result) {
                is LoginResult.Success -> onLoginSuccess(result.message)
                is LoginResult.Failure -> showLoginError(result.message)
                is LoginResult.Pending -> showLoginError(result.message)
            }
        }
    }
}
```

三个要点：**按 id 取实现 → 异步调 → 回主线程三态分支**。

### 4.2 加一个业务接口（以"拉课表"为例）

业务接口写在**具体学校类**里，复用它的 `http` —— 会话是现成的，不要再 new 一个 `HttpMethod`。

```kotlin
class GzusApi : WebLoginSchoolApi() {

    private val root = "${school.baseUrl}/jwglxt"

    // TODO(接入): 路径与参数以抓包为准（登录后进课表页，F12 里找那条返回课表的请求）
    private val scheduleUrl get() = "$root/xskb/xskb_list.do?gnmkdm=N253508"

    /** 拉课表原始响应。调用前必须已经登录成功（会话在 http 里） */
    fun fetchScheduleRaw(callback: (Result<String>) -> Unit) {
        http.getAsync(scheduleUrl) { result ->
            callback(result.map { it.body })
        }
    }
}
```

调用（注意要先登录、再调）：

```kotlin
val api = SchoolRegistry.apiOf(LoginSettings.selectedSchoolId.value) as? GzusApi

api?.fetchScheduleRaw { result ->
    // 回调在工作线程 → 切主线程再动 CourseRepository / View（见 §4.4）
    Handler(Looper.getMainLooper()).post {
        result.fold(
            onSuccess = { html -> /* 解析后写进 CourseRepository，见 §4.3 */ },
            onFailure = { showError(it.readableMessage()) },
        )
    }
}
```

**两种放法的取舍**：

| 场景 | 做法 |
|---|---|
| 只有某所学校有（或各校返回格式完全不同） | 放在具体类里，调用方 `as? XxxApi` |
| 跨学校通用、UI 要统一调用 | 把方法提到 `SchoolApi` 接口，并给**默认实现**，这样新学校不加也能编译： |

```kotlin
interface SchoolApi {
    // ...
    /** 拉课表。默认未接入 —— 新学校不写这个方法也能编译 */
    fun fetchCourses(callback: (Result<List<Course>>) -> Unit) {
        callback(Result.failure(UnsupportedOperationException("${school.name} 尚未接入课表接口")))
    }
}
```

> [!TIP]
> **解析 HTML 的提醒**：正方等系统的课表接口返回的是 HTML 表格，不是 JSON。
> 项目目前没有 HTML 解析库；要么加 `org.jsoup:jsoup`（推荐，正则抠表格很快就会失控），
> 要么先只取自己确认稳定的那一小段。同理，`HttpResponse.body` 是完整字符串，
> 大页面注意别在日志里整份打出来。

### 4.3 把网络数据喂给 UI

**网络层只负责填 `CourseRepository`，UI 保持只读仓库、自动重组**
（字段口径见 `docs/UI使用文档.md` 第 2 章：`weekday` 1=周一…7=周日，`startPeriod` 1~10，`periodCount` 连上几节）：

```kotlin
fun applyCourses(list: List<Course>) {
    CourseRepository.courses.clear()
    list.forEach {
        CourseRepository.add(
            name = it.name,
            teacher = it.teacher,
            room = it.room,
            weekday = it.weekday,
            startPeriod = it.startPeriod,
            periodCount = it.periodCount,
        )
    }
}
```

- `CourseRepository.courses` 是 `SnapshotStateList`，改完所有页面自动刷新，**不需要通知谁**。
- `add()` 会分配**本地自增 id**。要保留服务端 id 的话，按 `docs/UI使用文档.md` §2 的建议扩展 `Course` 加 `remoteId`。
- 已知限制：课表目前按"每周循环"计算（见 `UI使用文档.md` §4）。

### 4.4 线程与生命周期（最容易出错的地方）

| 规则 | 原因 |
|---|---|
| `login` / `getAsync` / `postFormAsync` 的回调在**工作线程** | OkHttp `enqueue` 的回调跑在 dispatcher 线程 |
| 动 View、动 Compose 状态**必须切主线程** | 否则 `CalledFromWrongThreadException` / Compose 快照崩溃 |
| `getResponse` / `postForm` / `get` / `post` 是**同步**的 | 主线程调用直接 `NetworkOnMainThreadException`；要就放子线程 |
| Activity 销毁后回调可能仍然到达 | 先判 `isFinishing || isDestroyed` 再动 View（`MainActivity` 就是这么做的） |
| 一个 `HttpMethod` = 一个独立 Cookie 会话 | 不同学校天然隔离；**换学校/退出登录要 `clearCookies()`** |
| `SchoolRegistry` 持有的是**单例** | 会话在 App 生命周期内一直有效，登录一次后业务接口直接用 |

切主线程的三种写法，按场景选：

```kotlin
runOnUiThread { ... }                       // Activity 里最省事
view.post { ... }                           // 只有 View 引用时
Handler(Looper.getMainLooper()).post { }    // 非 Activity 上下文（仓库/工具类）
```

### 4.5 错误文案

`Throwable.readableMessage()`（`gr_api/SchoolApi.kt`，`internal`）把常见异常翻成人话，
`WebLoginSchoolApi` 已经用它拼好了「无法连接教务系统 / 网络异常」两类文案。
自定义接口直接复用：

```kotlin
onFailure = { showError(it.readableMessage()) }
```

想加新的异常类型 → 在 `readableMessage()` 的 `when` 里加一条分支即可。

---

## 5. 调试

### 5.1 抓包找接口（三步）

1. 电脑浏览器打开教务系统，等它跳转完停在登录页；
2. `F12` → **Network** → 勾上 **Preserve log**（一定要勾：登录成功会跳转，不勾记录会被清掉）；
3. 输账号密码登录一次，找那条 **POST** 且 `Content-Type: application/x-www-form-urlencoded` 的记录：
   - **Request URL** → `loginUrl`
   - **Form Data** 里的用户名 key → `usernameField`
   - **Form Data** 里的密码 key → `passwordField`
   - 表单里还有 `csrftoken` / `lt` / `execution` 这类**每次登录都变**的字段 → 覆写 `prepare()`
   - 密码值是一长串十六进制 = RSA；32 位定长串 = MD5；和明文一样 = 直接提交

业务接口同理：登录后进目标页面，找那条返回数据的请求（课表通常是 HTML，成绩/课程列表有的返回 JSON）。

### 5.2 Logcat

```bash
adb logcat -s OkHttp:D    # HttpLoggingInterceptor 打的完整请求/响应（级别 BODY）
adb logcat -s Login:D     # 登录页自己的日志（登录时的学校/账号、校名自适应）
```

`HttpLoggingInterceptor` 是 **BODY 级别**，请求头、表单内容、响应体全都有 ——
排查字段名/加密问题基本靠它。**注意别把密码打进去**：登录页的日志刻意只打学校和账号。

### 5.3 失败对照表

| 现象 | 大概率原因 | 处理 |
|---|---|---|
| 「用户名或密码错误」，但密码没错 | 密码没加密 / 加密方式不对（用了 PKCS1Padding） | 覆写 `encodePassword`，参考 `RsaCipher` |
| 「无法连接教务系统」 | 域名写错、学校仅限内网、`INTERNET` 权限缺失 | 核对 `baseUrl` 与 `AndroidManifest.xml` |
| 登录提示成功，但后续接口跳登录页 | 没复用会话（新建了 `HttpMethod`）| 用同一个 `SchoolApi` 实例的 `http` |
| 抓包看是 302，App 说失败 | `judge` 判定与真实响应不匹配 | 覆写 `judge`，用 Logcat 看真实响应体 |
| 返回 200 但内容是登录页 | 缺 `CSRFTOKEN` / 会话过期 | 覆写 `prepare` 先 GET 登录页 |
| 提示「xxx 的登录接口还没接入」 | `configured = false` | 填好参数后改成 `true` |
| 主线程崩 `NetworkOnMainThreadException` | 调了同步方法 | 换异步接口，或自己放子线程 |

---

## 6. 现状

| id | 学校 | 根地址 | 状态 |
|---|---|---|---|
| `gzus` | 广州软件学院 | `https://jwxt.gzus.edu.cn` | ✅ 已接入（正方 V9，登录页 + 公钥接口实测确认） |
| `nhjcxy` | 南京航空航天大学金城学院 | `https://jcjx.nhjcxy.edu.cn` | ⚠️ 预写占位（`configured = false`，登录入口待确认） |

### 广州软件学院：实测记录

| 请求 | 实测结果 |
|---|---|
| `GET /jwglxt/xtgl/login_slogin.html` | 200，标题「教学管理信息服务平台」，页脚「广州软件学院  版本V-9.0」 |
| `GET /jwglxt/xtgl/login_getPublicKey.html` | 200，`{"modulus":"AJmZ…","exponent":"AQAB"}` |

流程：**GET 登录页取 `CSRFTOKEN` Cookie → GET 公钥 → 密码裸 RSA 加密 → POST 表单**（字段 `csrftoken` / `yhm` / `mm` / `language`）。

### 南京航空航天大学金城学院：探测记录（为什么还是占位）

| 请求 | 实测结果 |
|---|---|
| `GET /` | 200，但只是 JS 跳转壳（`loading.gif` +「正在进入系统,请等待......」），真实地址在脚本里 |
| `GET /jsxsd/`（强智） | 404 |
| `GET /jwglxt/`、`/xtgl/login_slogin.html`（正方） | 404 |
| `GET /jwweb/`、`/eams/`、`/login.jsp` | 404 |

⇒ 按 §5.1 抓包一遍，把 `NhjcxyApi` 里三行 `TODO(接入)` 换成真实值，`configured` 改 `true`，
并删掉 `SchoolRegistryTest.nhjcxy_staysPendingUntilItsLoginEntryIsConfirmed` 那条提醒用的断言。

---

## 7. 踩坑清单

### 7.1 接口层（全部真机验证过）

| 坑 | 现象 | 处理 |
|---|---|---|
| OkHttp **默认不存 Cookie** | 第二步请求就掉登录态，登录永远失败 | `HttpMethod` 内置内存 CookieJar；每校一个独立会话 |
| 登录页是 `<form>` 不是 JSON | 用 JSON 提交，服务端拿不到参数 | `postFormAsync` 用 `application/x-www-form-urlencoded`(UTF-8) |
| 缺 `CSRFTOKEN` | 正方直接拒掉 POST | `prepare()` 先 GET 登录页，再把 Cookie 值回填表单 |
| 密码用 `PKCS1Padding` | 永远"用户名或密码错误" | 必须裸 RSA，见 `RsaCipher` |
| 公钥 base64 首字节 `0x00` | 按有符号解析模数变负数，密文服务端解不开 | `BigInteger(1, bytes)` 按无符号解析（`RsaCipherTest` 守着） |
| 部分系统按 UA 判浏览器 | 返回错误页 / 空页 | `HttpMethod` 统一伪装手机 Chrome UA |
| 缺 `INTERNET` 权限 | 点登录毫无反应 | `AndroidManifest.xml` 已补 |
| 明文密码进 Logcat | 有 adb 就能读到 | 登录日志只打学校与账号，**不打密码** |

### 7.2 附：登录页 UI 相关（与接口无关，但同属登录页）

| 坑 | 现象 | 处理 |
|---|---|---|
| 中文校名太长 | 被省略号截成「南京航空航天大学金城学…」 | 卡片 margin 24→16dp、内边距 16→12dp，文本区 574→640px，12 字校名以 16sp 放下；`ui/TextFit.kt` 兜底 |
| 想用 `startIconMinSize` 换宽度 | 图标**左移 33px 紧贴框边**，与相邻字段错位 | Material 把起始图标居中在预留区域里，缩区域图标就跟着挪 → 宽度要从容器上要 |
| 给 EditText 写 `paddingStart/End` | 没任何效果（文本区仍是 574px） | Material 的 `TextInputLayout` 会覆盖 EditText 的左右内边距 |
| 预估可用宽度 | 算出"放得下"、实际仍被截断 | Material 的图标内边距是**布局阶段才**加的（真机两趟 `Layout` 宽度 772→574px）→ 必须读 `Layout.getWidth()` |
| 靠 `maxLines="1"` 保证单行 | `MaterialAutoCompleteTextView`（`inputType="none"`）仍可能排成两行 | 由"实测文本宽度 ≤ 可用宽度"自己保证单行 |

---

## 8. 附：三份相关文档怎么分工

| 文档 | 讲什么 |
|---|---|
| **本文** | `gr_api/` 的接入与调用（改接口、加学校、调业务接口、调试） |
| `docs/UI使用文档.md` | 数据模型与字段口径、UI 侧的对接点（面向"要把本地仓库换成网络实现"的人） |
| `docs/UI架构与实现指南.md` | Compose 侧架构、玻璃令牌、性能清单 |