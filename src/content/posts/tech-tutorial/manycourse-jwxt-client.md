---
title: ManyCourse 教务系统后端接入：南航金城学院 API 逆向与 Kotlin 实现
published: 2026-09-15
description: 以南京航空航天大学金城学院教务系统为例，详解基于 OkHttp + Jsoup 的登录认证与课表查询全流程，附完整 Kotlin 客户端实现代码。
tags: [教务系统, API, 逆向, Kotlin, OkHttp, Jsoup, 课表查询, ManyCourse]
category: 技术教程
image: ""
slug: manycourse-jwxt-client
---

## 前言

[ManyCourse 课程表应用](./manycourse-backend-integration) 的课表数据来源于学校教务系统。与[之前分析的正方教务系统](./jiaowu-login-api)不同，南航金城学院采用的是基于 ASP.NET WebForms 的老牌教务平台。这套系统的接口调用方式非常"复古"——需要手动管理 `__VIEWSTATE`、使用 `multipart/form-data` 提交表单，且登录时账号密码经过前端加密。

本文将完整拆解从登录到课表查询的全部接口细节，并提供一份可直接使用的 Kotlin 客户端实现（OkHttp + Jsoup，Android / JVM 通用）。

> [!NOTE]
> 本文基于**南京航空航天大学金城学院教务系统**（`jcjx.nhjcxy.edu.cn`）真实抓包数据编写，仅供学习研究使用。不同院校的实际接口可能略有差异。

---

## 1. 接口使用流程

### 1.1 登录接口

登录分为两步：先 GET 登录页获取会话凭证，再 POST 提交加密后的登录表单。

| 项目 | 值 |
|---|---|
| URL | `https://jcjx.nhjcxy.edu.cn/Mvc/Base/Login` |
| 方法 | POST |
| Content-Type | `application/x-www-form-urlencoded; charset=UTF-8` |
| Referer | `https://jcjx.nhjcxy.edu.cn/Mvc/Base/Login/` |
| Origin | `https://jcjx.nhjcxy.edu.cn` |
| X-Requested-With | `XMLHttpRequest` |

**第一步：GET 登录页**

必须先访问一次 `https://jcjx.nhjcxy.edu.cn/Mvc/Base/Login/`，服务器会通过 `Set-Cookie` 下发三个 Cookie：

| Cookie | 说明 |
|---|---|
| `ASP.NET_SessionId` | ASP.NET 会话标识 |
| `__RequestVerificationToken_L012Yw2` | 防伪令牌 |
| `UserLanguage` | 固定为 `zh-CN` |

**第二步：POST 登录表单**

表单字段如下：

```
U_Account     = 0443a072...（加密后的账号）
U_Password    = 044a92bf...（加密后的密码）
U_WeChat      =
U_LoginType   =
TqPlatform    =
U_Remark      = false
U_Licence     =
U_MobileNo    =
U_Sex         = Man
ValidCode     =          （验证码，有则填）
```

登录成功后，服务器通过 `Set-Cookie` 下发 `.Yyw.Base=...`，这就是后续所有接口的身份凭证。使用 OkHttp 的 `CookieJar` 自动管理即可，无需手动处理。

> [!WARNING]
> `U_Account` 和 `U_Password` 明显不是明文（长十六进制字符串），是前端 JS 加密后的结果。如果要做无人值守登录，需要逆向登录页的加密逻辑；本文代码将这两个字段留作参数传入。

---

### 1.2 课表查询接口

课表查询是典型的 ASP.NET WebForms 回发（PostBack）流程，必须"两段式"调用。

| 项目 | 值 |
|---|---|
| URL | `https://jcjx.nhjcxy.edu.cn/Mvc/Manager/Module/NetEa/Schedule/Query/Default.aspx` |
| 方法 | POST |
| Content-Type | `multipart/form-data` |
| Referer | 同 URL |

**第一步：GET 页面，提取 `__VIEWSTATE`**

从返回 HTML 中提取两个隐藏域：

| 字段 | 值 |
|---|---|
| `input[name=__VIEWSTATE]` | 每次请求都会变，不能缓存 |
| `input[name=__VIEWSTATEGENERATOR]` | 本页固定为 `39FBE882` |

**第二步：POST multipart/form-data**

字段中的 `$` 是 ASP.NET 的 `UniqueID` 分隔符，必须原样保留：

```
__EVENTTARGET                              =
__EVENTARGUMENT                            =
__LASTFOCUS                                =
__VIEWSTATE                                = <第一步抓到的>
__VIEWSTATEGENERATOR                       = 39FBE882
__VIEWSTATEENCRYPTED                       =
ctl00$PageBody$XnXq$DropDownListXnXq       = 2026-2027,1     // 学年学期
ctl00$PageBody$RbtlType                    = 班级            // 班级/教师/教室/课程
ctl00$PageBody$TxbInput                    = 02680403        // 关键字
ctl00$PageBody$BtnShowTable                = 查看课表
ctl00$PageBody$TxbDate                     = 2026-9-16       // yyyy-M-d（月份不补零）
ctl00$PageBody$DrpZc                       =                 // 周次，可空
ctl00$PageBody$RbtlCourseType              =                 // 文化素质课等
ctl00$DoPostBack_LiuManRang                =
```

**第三步：解析响应**

响应是 `text/html`，包含两张表：

| 表 ID | 说明 |
|---|---|
| `TabSchedule` | 渲染好的可视课表（按星期 × 节次展示，单元格可能合并，解析困难） |
| `GrwCourseTablePrint` | **结构化数据表（推荐用它解析）**，每门课占一行，字段清晰 |

`GrwCourseTablePrint` 的列顺序（共 21 列）：

```
id, kkh, kkxsh, kch, xn, xq, week, unit, lsjs, roomid, weekly,
kcm, xs, jsh, jsm, bhlist, bhlist1, xkrs, gcsjhj, Campus, xsm, showweekly
```

各字段含义：

| 字段 | 含义 | 示例 |
|---|---|---|
| `id` | 行号 | `1` |
| `kkh` | 课序号 | — |
| `kch` | 课程号 | — |
| `xn` | 学年 | `2026-2027` |
| `xq` | 学期 | `1` |
| `week` | 星期几（1~7） | `3` |
| `unit` | 起始节次 | `3` |
| `lsjs` | 连排节数 | `2` |
| `roomid` | 教室 | `明理楼北401` |
| `weekly` | 上课周次串 | `3-5,8-20` |
| `kcm` | 课程名 | `综合英语` |
| `jsh` / `jsm` | 教师编号 / 教师名 | — |
| `bhlist` | 上课班级 | `02680403` |

---

## 2. Kotlin 实现

### 2.1 依赖

```kotlin
implementation("com.squareup.okhttp3:okhttp:4.12.0")
implementation("org.jsoup:jsoup:1.17.2")
```

### 2.2 Cookie 管理

OkHttp 内置的 `CookieJar.NO_COOKIES` 不会自动存储，我们需要实现一个内存级 CookieJar：

```kotlin
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull

class MemoryCookieJar : CookieJar {
    private val store = LinkedHashMap<String, MutableList<Cookie>>()

    @Synchronized
    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        val list = store.getOrPut(url.host) { mutableListOf() }
        cookies.forEach { c ->
            list.removeAll { it.name == c.name && it.path == c.path }
            list.add(c)
        }
    }

    @Synchronized
    override fun loadForRequest(url: HttpUrl): List<Cookie> {
        val list = store[url.host] ?: return emptyList()
        val now = System.currentTimeMillis()
        list.removeAll { it.expiresAt < now }
        return list.filter { it.matches(url) }
    }

    @Synchronized
    fun valueOf(url: String, name: String): String? {
        val u = url.toHttpUrlOrNull() ?: return null
        return loadForRequest(u).firstOrNull { it.name == name }?.value
    }
}
```

### 2.3 数据模型

```kotlin
data class CourseItem(
    val id: Int,
    val kkh: String,        // 课序号
    val kch: String,        // 课程号
    val xn: String,         // 学年
    val xq: Int,            // 学期
    val weekDay: Int,       // 星期几 1=周一 ... 7=周日
    val startUnit: Int,     // 起始节次
    val unitCount: Int,     // 连排节数
    val room: String,       // 教室
    val courseName: String, // 课程名
    val teacher: String,    // 教师
    val classNos: String,   // 上课班级
    val campus: String,     // 校区
    val weeks: String,      // 周次串 "3-5,8-20"
    val students: Int       // 选课人数
)
```

### 2.4 客户端主体

```kotlin
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.jsoup.Jsoup
import java.io.IOException
import java.util.concurrent.TimeUnit

class JwxtClient(private val baseUrl: String = "https://jcjx.nhjcxy.edu.cn") {

    private companion object {
        const val UA =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36 Edg/152.0.0.0"
        const val LOGIN_PAGE = "/Mvc/Base/Login/"
        const val LOGIN_API  = "/Mvc/Base/Login"
        const val SCHEDULE   = "/Mvc/Manager/Module/NetEa/Schedule/Query/Default.aspx"
    }

    private val cookies = MemoryCookieJar()
    private val client = OkHttpClient.Builder()
        .cookieJar(cookies)
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .followRedirects(true)
        .build()

    // ---------------- 登录 ----------------

    /**
     * @param account  加密后的账号（对应 U_Account）
     * @param password 加密后的密码（对应 U_Password）
     * @param validCode 验证码，可为空
     * @return true 表示拿到了 .Yyw.Base 会话 cookie
     */
    fun login(account: String, password: String, validCode: String = ""): Boolean {
        // 1) GET 登录页，取 SessionId / __RequestVerificationToken
        client.newCall(
            Request.Builder()
                .url(baseUrl + LOGIN_PAGE)
                .header("User-Agent", UA)
                .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                .build()
        ).execute().use { resp ->
            if (!resp.isSuccessful) throw IOException("打开登录页失败: ${resp.code}")
            resp.body?.string()   // 触发 cookie 落盘
        }

        // 2) POST 登录
        val form = FormBody.Builder()
            .add("U_Account", account)
            .add("U_Password", password)
            .add("U_WeChat", "")
            .add("U_LoginType", "")
            .add("TqPlatform", "")
            .add("U_Remark", "false")
            .add("U_Licence", "")
            .add("U_MobileNo", "")
            .add("U_Sex", "Man")
            .add("ValidCode", validCode)
            .build()

        val req = Request.Builder()
            .url(baseUrl + LOGIN_API)
            .header("User-Agent", UA)
            .header("Accept", "*/*")
            .header("X-Requested-With", "XMLHttpRequest")
            .header("Origin", baseUrl)
            .header("Referer", baseUrl + LOGIN_PAGE)
            .post(form)
            .build()

        client.newCall(req).execute().use { resp ->
            if (!resp.isSuccessful) return false
            resp.body?.string()
        }

        // 3) 判定成功：出现 .Yyw.Base
        return cookies.valueOf(baseUrl, ".Yyw.Base") != null
    }

    // ---------------- 课表查询 ----------------

    /**
     * @param xnXq    学年学期，例如 "2026-2027,1"
     * @param type    "班级" / "教师" / "教室" / "课程"
     * @param keyword 对应关键字，例如班号 "02680403"
     * @param date    日期 "yyyy-M-d"，如 "2026-9-16"
     * @param week    周次，可空
     */
    fun queryScheduleHtml(
        xnXq: String,
        type: String,
        keyword: String,
        date: String = "",
        week: String = ""
    ): String {
        // 1) GET 页面拿 __VIEWSTATE
        val pageReq = Request.Builder()
            .url(baseUrl + SCHEDULE)
            .header("User-Agent", UA)
            .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
            .build()

        val pageHtml = client.newCall(pageReq).execute().use { resp ->
            if (!resp.isSuccessful) throw IOException("打开课表页失败: ${resp.code}")
            resp.body!!.string()
        }

        val doc = Jsoup.parse(pageHtml)
        val viewState = doc.selectFirst("input[name=__VIEWSTATE]")?.attr("value").orEmpty()
        val viewStateGen = doc.selectFirst("input[name=__VIEWSTATEGENERATOR]")
            ?.attr("value").orEmpty().ifEmpty { "39FBE882" }

        // 2) 构造 multipart/form-data
        val multipart = MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .addFormDataPart("__EVENTTARGET", "")
            .addFormDataPart("__EVENTARGUMENT", "")
            .addFormDataPart("__LASTFOCUS", "")
            .addFormDataPart("__VIEWSTATE", viewState)
            .addFormDataPart("__VIEWSTATEGENERATOR", viewStateGen)
            .addFormDataPart("__VIEWSTATEENCRYPTED", "")
            .addFormDataPart("ctl00\$PageBody\$XnXq\$DropDownListXnXq", xnXq)
            .addFormDataPart("ctl00\$PageBody\$RbtlType", type)
            .addFormDataPart("ctl00\$PageBody\$TxbInput", keyword)
            .addFormDataPart("ctl00\$PageBody\$BtnShowTable", "查看课表")
            .addFormDataPart("ctl00\$PageBody\$TxbDate", date)
            .addFormDataPart("ctl00\$PageBody\$DrpZc", week)
            .addFormDataPart("ctl00\$PageBody\$RbtlCourseType", "")
            .addFormDataPart("ctl00\$DoPostBack_LiuManRang", "")
            .build()

        val req = Request.Builder()
            .url(baseUrl + SCHEDULE)
            .header("User-Agent", UA)
            .header(
                "Accept",
                "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
            )
            .header("Origin", baseUrl)
            .header("Referer", baseUrl + SCHEDULE)
            .post(multipart)
            .build()

        return client.newCall(req).execute().use { resp ->
            if (!resp.isSuccessful) throw IOException("查询课表失败: ${resp.code}")
            resp.body!!.string()
        }
    }
}
```

### 2.5 解析课表

推荐直接解析 `GrwCourseTablePrint` 表，因为字段清晰、每门课占一行，不用处理 `TabSchedule` 的合并单元格问题。

```kotlin
object ScheduleParser {

    private fun String.clean(): String = replace('\u00a0', ' ').trim()

    /** 解析 "3-5,8-20" 这类周次串 */
    fun parseWeeks(spec: String): Set<Int> {
        val result = mutableSetOf<Int>()
        spec.split(',', '，')
            .map { it.trim() }
            .filter { it.isNotEmpty() }
            .forEach { seg ->
                if ('-' in seg) {
                    val parts = seg.split('-')
                    val a = parts.getOrNull(0)?.trim()?.toIntOrNull()
                    val b = parts.getOrNull(1)?.trim()?.toIntOrNull()
                    if (a != null && b != null && a <= b) for (w in a..b) result += w
                } else {
                    seg.toIntOrNull()?.let { result += it }
                }
            }
        return result
    }

    /** 从课表 HTML 中抽出所有课程 */
    fun parseCourses(html: String): List<CourseItem> {
        val doc = Jsoup.parse(html)
        val table = doc.getElementById("GrwCourseTablePrint") ?: return emptyList()
        val rows = table.select("tr")
        if (rows.size <= 1) return emptyList()   // 第一行是表头

        return rows.drop(1).mapNotNull { tr ->
            val tds = tr.select("td")
            if (tds.size < 22) return@mapNotNull null

            fun cell(i: Int): String = tds[i].text().clean()

            val id = cell(0).toIntOrNull() ?: return@mapNotNull null

            CourseItem(
                id         = id,
                kkh        = cell(1),
                kch        = cell(3),
                xn         = cell(4),
                xq         = cell(5).toIntOrNull() ?: 0,
                weekDay    = cell(6).toIntOrNull() ?: 0,
                startUnit  = cell(7).toIntOrNull() ?: 0,
                unitCount  = cell(8).toIntOrNull() ?: 1,
                room       = cell(9),
                weeks      = cell(10),
                courseName = cell(11),
                teacher    = cell(14),
                classNos   = cell(15),
                students   = cell(17).toIntOrNull() ?: 0,
                campus     = cell(19)
            )
        }
    }

    /** 按星期几分组，方便渲染课表 */
    fun groupByWeekDay(courses: List<CourseItem>): Map<Int, List<CourseItem>> =
        courses.groupBy { it.weekDay }

    /** 提取某周实际要上的课 */
    fun filterByWeek(courses: List<CourseItem>, week: Int): List<CourseItem> =
        courses.filter { week in parseWeeks(it.weeks) }
}
```

### 2.6 调用示例

```kotlin
fun main() {
    val client = JwxtClient()

    // 1) 登录（账号密码需为前端加密后的值）
    val ok = client.login(
        account  = "0443a0720688480932304db3dfa5202b...",
        password = "044a92bf9c8e7d193cb1f7b8624ce64b..."
    )
    println("login = $ok")
    if (!ok) return

    // 2) 查询课表 HTML
    val html = client.queryScheduleHtml(
        xnXq    = "2026-2027,1",
        type    = "班级",
        keyword = "02680403",
        date    = "2026-9-16"
    )

    // 3) 解析
    val courses = ScheduleParser.parseCourses(html)
    courses.forEach { println(it) }

    // 4) 按星期几分组输出
    ScheduleParser.groupByWeekDay(courses).toSortedMap().forEach { (day, list) ->
        println("星期$day:")
        list.sortedBy { it.startUnit }.forEach {
            println("  ${it.startUnit}-${it.startUnit + it.unitCount - 1}节 " +
                    "${it.courseName} @${it.room} ${it.teacher} [${it.weeks}周]")
        }
    }

    // 5) 只看第 10 周
    println("== 第10周 ==")
    ScheduleParser.filterByWeek(courses, 10).forEach { println(it) }
}
```

---

## 3. 容易踩的坑

以下是实际对接过程中遇到的关键问题，每条都能省你几个小时。

### 3.1 `__VIEWSTATE` 每次都会变

`__VIEWSTATE` 是 ASP.NET 用于维护页面状态的加密字段，每次 GET 页面都会生成新值。**不能缓存复用**——每发起一次课表查询，必须先 GET 页面重新取一次；否则服务器返回的仍是旧页面内容。

### 3.2 字段名里的 `$` 必须保留

`ctl00$PageBody$...` 是 ASP.NET 控件的 `UniqueID`。如果用 `application/x-www-form-urlencoded` 格式提交，服务器无法正确解析控件层级关系，会直接忽略参数。**必须使用 `multipart/form-data`**。

### 3.3 Cookie 共享至关重要

登录后拿到的 `.Yyw.Base` 只对 `jcjx.nhjcxy.edu.cn` 域有效，且带有 `HttpOnly` 标记（JS 拿不到）。自动化场景下使用 `CookieJar` 自动管理最稳妥，不要手动拼 Cookie 头。

### 3.4 账号密码是加密串，不是明文

`U_Account` 和 `U_Password` 是长十六进制字符串，由前端 JS 加密后提交。疑似 RSA 或 AES + Base64/Hex，具体算法需逆向登录页 JS 才能确定。本文实现将这两个字段留作参数传入。

> [!TIP]
> 如果要做无人值守登录，可以先用浏览器 DevTools 抓一次真实的 `U_Account` / `U_Password` 值来验证后端链路是否跑通，再单独攻克加密部分。

### 3.5 解析优先用 `GrwCourseTablePrint`

`TabSchedule` 是给浏览器看的视觉课表，一个 `<td>` 可能塞多门课（例如周三 3-4 节同时有综合英语和大学生心理健康），用字符串切分容易出错。**结构化表 `GrwCourseTablePrint` 每门课独立一行，字段清晰，是解析首选。**

### 3.6 周次串格式不统一

`weekly` 字段的格式可能是 `3-5,8-20`、`12`、`2-4,8-12`，甚至带全角逗号（`，`）。所以 `parseWeeks` 里同时按半角 `,` 和全角 `，` 切分，避免漏解析。

### 3.7 日期格式不补零

`TxbDate` 字段使用 `2026-9-16` 格式（月份不补零），而不是 ISO 标准的 `2026-09-16`。使用 `java.time.LocalDate` 格式化时注意指定 `M` 而非 `MM`。

---

## 4. 架构小结

整个调用链可以概括为下图：

```
┌──────────────────────────────────────────────────────────┐
│  Step 1: GET 登录页                                       │
│  获取 ASP.NET_SessionId + __RequestVerificationToken      │
└──────────────────────┬───────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────────┐
│  Step 2: POST 登录（加密账号密码）                          │
│  获取 .Yyw.Base 会话凭证                                   │
└──────────────────────┬───────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────────┐
│  Step 3: GET 课表页                                       │
│  提取 __VIEWSTATE + __VIEWSTATEGENERATOR                  │
└──────────────────────┬───────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────────┐
│  Step 4: POST 课表查询（multipart/form-data）              │
│  返回完整 HTML 页面                                        │
└──────────────────────┬───────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────────┐
│  Step 5: Jsoup 解析 GrwCourseTablePrint 表                │
│  输出结构化 CourseItem 列表                                │
└──────────────────────────────────────────────────────────┘
```

与[正方教务系统](./jiaowu-schedule-api)相比，这套 ASP.NET WebForms 系统的对接难点不在于加密（正方也有 RSA），而在于 **`__VIEWSTATE` 状态管理**和 **`multipart/form-data` 格式要求**这两个 ASP.NET 特有的机制。一旦理解了这两点，剩下的就是标准的 HTTP 请求和 HTML 解析工作。

本文提供的 `JwxtClient` 和 `ScheduleParser` 可以作为 ManyCourse 应用的数据层基础——只需在 Android 端用 `viewModelScope` 或 Kotlin Coroutines 包装调用，即可对接 UI 层的 `CourseRepository`。