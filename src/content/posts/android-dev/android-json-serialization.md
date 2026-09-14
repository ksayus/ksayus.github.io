---
title: Android 数据转 JSON 完全指南：JSONObject、Gson、kotlinx.serialization 与 Moshi
published: 2026-09-13
description: 手把手教你用代码将 int、String、List、Map、自定义对象等各类数据转换为 JSON 字符串，涵盖 org.json、Gson、kotlinx.serialization、Moshi 四种主流方案，附完整对比与选型建议。
tags: [Android, JSON, Gson, kotlinx.serialization, Moshi, 序列化, 数据转换]
category: Android
image: ""
slug: android-json-serialization
---

## 前言

在 Android 开发中，JSON 是数据交换的绝对主角——接口请求要发 JSON、本地存储要存 JSON、组件间通信可能也要传 JSON。一个高频的需求就是：**如何把 Kotlin/Java 中的各种数据（int、String、List、对象）转成 JSON 字符串？**

本文将带你逐一掌握 Android 生态中四种主流 JSON 序列化方案，从原生的 `org.json` 到现代的 `kotlinx.serialization`，帮你彻底吃透「数据转 JSON」这件事。

> [!NOTE]
> 本文所有示例使用 **Kotlin** 编写。JSON 解析（反序列化）虽不在本文范围，但每种方案的解析也同样简单，文中会简要提及。

---

## 1. 四种方案速览

| 方案 | 来源 | 原理 | 依赖量 |
|------|------|------|:---:|
| `org.json` | Android SDK 内置 | 手动逐字段拼装 | 0 |
| Gson | Google 出品 | 反射自动映射 | 1 个库 |
| kotlinx.serialization | JetBrains 出品 | 编译期生成序列化器 | 2 个库（核心 + 插件） |
| Moshi | Square 出品 | 注解 + 代码生成 | 2 个库（核心 + 代码生成） |

---

## 2. org.json：Android 内置方案

Android SDK 自带了 `org.json` 包，零依赖，适合简单场景。

### 2.1 基本类型转 JSON

```kotlin
import org.json.JSONArray
import org.json.JSONObject

// int → JSON
val intValue = 42
val jsonInt = JSONObject().apply {
    put("age", intValue)
}
// 输出: {"age":42}

// String → JSON
val name = "张三"
val jsonString = JSONObject().apply {
    put("name", name)
}
// 输出: {"name":"张三"}

// Boolean → JSON
val isVip = true
val jsonBoolean = JSONObject().apply {
    put("isVip", isVip)
}
// 输出: {"isVip":true}

// Double → JSON
val price = 19.99
val jsonDouble = JSONObject().apply {
    put("price", price)
}
// 输出: {"price":19.99}

// null → JSON（会变成 JSONObject.NULL）
val nullable: String? = null
val jsonNull = JSONObject().apply {
    put("nickname", nullable ?: JSONObject.NULL)
}
// 输出: {"nickname":null}
```

### 2.2 复合类型转 JSON

```kotlin
// List → JSONArray
val tags = listOf("Android", "Kotlin", "JSON")
val jsonArray = JSONArray(tags)
// 输出: ["Android","Kotlin","JSON"]

// Map → JSONObject
val config = mapOf(
    "timeout" to 30,
    "retry" to 3,
    "baseUrl" to "https://api.example.com"
)
val jsonMap = JSONObject(config)
// 输出: {"timeout":30,"retry":3,"baseUrl":"https://api.example.com"}

// 嵌套 JSON
val address = JSONObject().apply {
    put("province", "广东省")
    put("city", "广州市")
    put("district", "天河区")
}

val userJson = JSONObject().apply {
    put("id", 1001)
    put("name", "张三")
    put("age", 28)
    put("address", address)
    put("hobbies", JSONArray(listOf("篮球", "阅读", "编程")))
}
// 输出（格式化后）:
// {
//   "id": 1001,
//   "name": "张三",
//   "age": 28,
//   "address": {"province":"广东省","city":"广州市","district":"天河区"},
//   "hobbies": ["篮球","阅读","编程"]
// }
```

### 2.3 自定义对象手动转 JSON

```kotlin
data class User(
    val id: Long,
    val name: String,
    val age: Int,
    val email: String?,
    val tags: List<String>
)

fun User.toJson(): JSONObject {
    return JSONObject().apply {
        put("id", id)
        put("name", name)
        put("age", age)
        put("email", email ?: JSONObject.NULL)
        put("tags", JSONArray(tags))
    }
}

val user = User(
    id = 1001,
    name = "张三",
    age = 28,
    email = "zhangsan@example.com",
    tags = listOf("Android", "Kotlin")
)
val userJson = user.toJson()
println(userJson.toString())
```

### 2.4 格式化输出

```kotlin
val obj = JSONObject().apply {
    put("name", "张三")
    put("age", 28)
}

// 紧凑输出
println(obj.toString())
// {"name":"张三","age":28}

// 格式化输出（缩进 2 空格）
println(obj.toString(2))
// {
//   "name": "张三",
//   "age": 28
// }
```

### 2.5 org.json 优缺点

| 优点 | 缺点 |
|------|------|
| 零依赖，Android SDK 内置 | 每个字段都要手动 `put`，代码冗余 |
| 无编译期开销 | 不支持自动对象映射 |
| 适合简单/动态 JSON | 嵌套对象多时极易出错 |

---

## 3. Gson：Google 的经典之选

[Gson](https://github.com/google/gson) 是 Google 出品的 Java JSON 库，通过**反射**自动完成对象与 JSON 的双向转换，是 Android 社区多年来的事实标准。

### 3.1 添加依赖

```kotlin
// app/build.gradle.kts
dependencies {
    implementation("com.google.code.gson:gson:2.10.1")
}
```

### 3.2 基本类型转 JSON

```kotlin
import com.google.gson.Gson
import com.google.gson.GsonBuilder

val gson = Gson()

// int → JSON
val intJson = gson.toJson(42)
// 输出: 42

// String → JSON
val strJson = gson.toJson("Hello World")
// 输出: "Hello World"

// Boolean → JSON
val boolJson = gson.toJson(true)
// 输出: true

// Array → JSON
val arrJson = gson.toJson(arrayOf(1, 2, 3))
// 输出: [1,2,3]

// List → JSON
val listJson = gson.toJson(listOf("A", "B", "C"))
// 输出: ["A","B","C"]

// Map → JSON
val mapJson = gson.toJson(mapOf("key1" to "value1", "key2" to 2))
// 输出: {"key1":"value1","key2":2}
```

### 3.3 自定义对象一键转 JSON

```kotlin
data class User(
    val id: Long,
    val name: String,
    val age: Int,
    val email: String?,
    val tags: List<String>
)

data class Order(
    val orderId: String,
    val user: User,
    val amount: Double,
    val items: List<OrderItem>,
    val paid: Boolean
)

data class OrderItem(
    val productId: Long,
    val productName: String,
    val quantity: Int,
    val price: Double
)

val order = Order(
    orderId = "ORD-2024-001",
    user = User(1001, "张三", 28, null, listOf("VIP")),
    amount = 299.99,
    items = listOf(
        OrderItem(1, "机械键盘", 1, 199.99),
        OrderItem(2, "鼠标垫", 2, 50.00)
    ),
    paid = true
)

val gson = Gson()
val orderJson = gson.toJson(order)
println(orderJson)
```

输出（一个完整嵌套的 JSON 字符串）：

```json
{"orderId":"ORD-2024-001","user":{"id":1001,"name":"张三","age":28,"tags":["VIP"]},"amount":299.99,"items":[{"productId":1,"productName":"机械键盘","quantity":1,"price":199.99},{"productId":2,"productName":"鼠标垫","quantity":2,"price":50.0}],"paid":true}
```

注意：`email` 为 `null` 时 Gson 默认直接**省略该字段**，不会输出 `"email": null`。

### 3.4 Gson 高级配置

```kotlin
val gson = GsonBuilder()
    .setPrettyPrinting()              // 格式化输出
    .serializeNulls()                 // 不忽略 null 字段
    .setDateFormat("yyyy-MM-dd HH:mm:ss") // 日期格式
    .setFieldNamingPolicy(FieldNamingPolicy.LOWER_CASE_WITH_UNDERSCORES) // 字段命名策略
    .excludeFieldsWithoutExposeAnnotation() // 只序列化 @Expose 标记的字段
    .create()

// 使用
val json = gson.toJson(order)
```

### 3.5 自定义字段名

```kotlin
// 用 @SerializedName 注解映射不规则的 JSON key
data class ApiResponse(
    @SerializedName("status_code")
    val statusCode: Int,

    @SerializedName("error_msg")
    val errorMsg: String?
)

val response = ApiResponse(200, null)
val json = gson.toJson(response)
// 输出: {"status_code":200}
```

### 3.6 自定义序列化器

```kotlin
import com.google.gson.JsonElement
import com.google.gson.JsonPrimitive
import com.google.gson.JsonSerializationContext
import com.google.gson.JsonSerializer
import java.lang.reflect.Type

// 自定义枚举序列化
enum class OrderStatus {
    PENDING, PROCESSING, SHIPPED, DELIVERED
}

class OrderStatusSerializer : JsonSerializer<OrderStatus> {
    override fun serialize(
        src: OrderStatus?,
        typeOfSrc: Type?,
        context: JsonSerializationContext?
    ): JsonElement {
        return when (src) {
            OrderStatus.PENDING -> JsonPrimitive("待处理")
            OrderStatus.PROCESSING -> JsonPrimitive("处理中")
            OrderStatus.SHIPPED -> JsonPrimitive("已发货")
            OrderStatus.DELIVERED -> JsonPrimitive("已送达")
            null -> JsonPrimitive("未知")
        }
    }
}

val gson = GsonBuilder()
    .registerTypeAdapter(OrderStatus::class.java, OrderStatusSerializer())
    .create()

val json = gson.toJson(OrderStatus.PROCESSING)
// 输出: "处理中"
```

### 3.7 Gson 优缺点

| 优点 | 缺点 |
|------|------|
| API 极简，`toJson()` 一行搞定 | 依赖反射，性能有轻微损耗 |
| 社区成熟，资料丰富 | 对 Kotlin 默认值、非空类型支持不完美 |
| 配置灵活，可插拔序列化器 | 不做编译期校验，拼写错误运行时才发现 |

---

## 4. kotlinx.serialization：Kotlin 原生方案

[kotlinx.serialization](https://github.com/Kotlin/kotlinx.serialization) 是 JetBrains 出品的 Kotlin 原生序列化库，通过**编译期生成序列化器**消除反射开销，是 Kotlin 生态的推荐方案。

### 4.1 添加依赖

```kotlin
// 项目级 build.gradle.kts
plugins {
    id("org.jetbrains.kotlin.plugin.serialization") version "1.9.22"
}

// 模块级 build.gradle.kts
dependencies {
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.2")
}
```

### 4.2 基本类型转 JSON

```kotlin
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*

val json = Json { prettyPrint = true }

// int → JSON
val intJson = json.encodeToString(JsonPrimitive(42))
// 输出: 42

// String → JSON
val strJson = json.encodeToString(JsonPrimitive("Hello"))
// 输出: "Hello"

// Boolean → JSON
val boolJson = json.encodeToString(JsonPrimitive(true))
// 输出: true

// null → JSON
val nullJson = json.encodeToString(JsonNull)
// 输出: null

// List → JSON
val listJson = json.encodeToString(JsonArray(listOf(
    JsonPrimitive("Android"),
    JsonPrimitive("Kotlin"),
    JsonPrimitive("JSON")
)))
// 输出: ["Android","Kotlin","JSON"]
```

### 4.3 自定义对象转 JSON

```kotlin
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString

@Serializable
data class User(
    val id: Long,
    val name: String,
    val age: Int,
    val email: String? = null,
    val tags: List<String> = emptyList()
)

@Serializable
data class Order(
    val orderId: String,
    val user: User,
    val amount: Double,
    val items: List<OrderItem>,
    val paid: Boolean
)

@Serializable
data class OrderItem(
    val productId: Long,
    val productName: String,
    val quantity: Int,
    val price: Double
)

val order = Order(
    orderId = "ORD-2024-001",
    user = User(1001, "张三", 28, tags = listOf("VIP")),
    amount = 299.99,
    items = listOf(
        OrderItem(1, "机械键盘", 1, 199.99),
        OrderItem(2, "鼠标垫", 2, 50.0)
    ),
    paid = true
)

val json = Json { prettyPrint = true }
val orderJson = json.encodeToString(order)
println(orderJson)
```

输出：

```json
{
    "orderId": "ORD-2024-001",
    "user": {
        "id": 1001,
        "name": "张三",
        "age": 28,
        "tags": [
            "VIP"
        ]
    },
    "amount": 299.99,
    "items": [
        {
            "productId": 1,
            "productName": "机械键盘",
            "quantity": 1,
            "price": 199.99
        },
        {
            "productId": 2,
            "productName": "鼠标垫",
            "quantity": 2,
            "price": 50.0
        }
    ],
    "paid": true
}
```

### 4.4 自定义字段名

```kotlin
@Serializable
data class ApiResponse(
    @SerialName("status_code")
    val statusCode: Int,

    @SerialName("error_msg")
    val errorMsg: String? = null
)
```

### 4.5 自定义序列化器

```kotlin
import kotlinx.serialization.KSerializer
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

// 为 LocalDateTime 编写自定义序列化器
object LocalDateTimeSerializer : KSerializer<LocalDateTime> {
    private val formatter = DateTimeFormatter.ISO_LOCAL_DATE_TIME

    override val descriptor = PrimitiveSerialDescriptor("LocalDateTime", PrimitiveKind.STRING)

    override fun serialize(encoder: Encoder, value: LocalDateTime) {
        encoder.encodeString(value.format(formatter))
    }

    override fun deserialize(decoder: Decoder): LocalDateTime {
        return LocalDateTime.parse(decoder.decodeString(), formatter)
    }
}

@Serializable
data class Event(
    val name: String,
    @Serializable(with = LocalDateTimeSerializer::class)
    val createdAt: LocalDateTime
)

val event = Event("发布新版本", LocalDateTime.now())
val json = Json { prettyPrint = true }
println(json.encodeToString(event))
```

### 4.6 灵活配置

```kotlin
val json = Json {
    prettyPrint = true                     // 格式化输出
    encodeDefaults = true                  // 序列化默认值
    explicitNulls = true                   // 不忽略 null 字段
    ignoreUnknownKeys = true               // 反序列化时忽略未知字段
    coerceInputValues = true               // 输入值自动转换（如 null → 默认值）
    classDiscriminator = "type"            // 多态类型标识字段名
    allowStructuredMapKeys = true          // 允许复合类型做 Map 的 key
}
```

### 4.7 动态构建 JSON（JsonObjectBuilder）

```kotlin
val dynamicJson = buildJsonObject {
    put("name", "张三")
    put("age", 28)
    putJsonArray("hobbies") {
        add("篮球")
        add("阅读")
    }
    putJsonObject("address") {
        put("city", "广州")
        put("district", "天河")
    }
}

println(json.encodeToString(dynamicJson))
```

### 4.8 kotlinx.serialization 优缺点

| 优点 | 缺点 |
|------|------|
| 编译期生成代码，零反射开销 | 需要 Gradle 插件 |
| 完美支持 Kotlin 特性（默认值、非空等） | 对 Java 类的支持需额外适配 |
| 跨平台（JVM/JS/Native 通用） | 社区资料比 Gson 少 |
| 可搭配 Ktor、KMM 无缝使用 | — |

---

## 5. Moshi：Square 的现代方案

[Moshi](https://github.com/square/moshi) 是 Square 出品的现代 JSON 库，专为 Kotlin 优化，通过注解处理器生成适配器。

### 5.1 添加依赖

```kotlin
// app/build.gradle.kts
plugins {
    id("com.google.devtools.ksp") version "1.9.22-1.0.17" // 或 kapt
}

dependencies {
    implementation("com.squareup.moshi:moshi:1.15.1")
    implementation("com.squareup.moshi:moshi-kotlin:1.15.1")
    ksp("com.squareup.moshi:moshi-kotlin-codegen:1.15.1") // 或 kapt
}
```

### 5.2 基本类型转 JSON

```kotlin
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import com.squareup.moshi.adapter

val moshi = Moshi.Builder()
    .addLast(KotlinJsonAdapterFactory())
    .build()

val jsonAdapter = moshi.adapter<Map<String, Any>>()

// int → JSON
val intMap = mapOf("age" to 42)
println(jsonAdapter.toJson(intMap))
// 输出: {"age":42}

// String → JSON
val strMap = mapOf("name" to "张三")
println(jsonAdapter.toJson(strMap))
// 输出: {"name":"张三"}

// List → JSON
val listAdapter = moshi.adapter<List<Any>>()
println(listAdapter.toJson(listOf("A", "B", "C")))
// 输出: ["A","B","C"]
```

### 5.3 自定义对象转 JSON

```kotlin
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class User(
    val id: Long,
    val name: String,
    val age: Int,
    val email: String? = null,
    val tags: List<String> = emptyList()
)

@JsonClass(generateAdapter = true)
data class Order(
    val orderId: String,
    val user: User,
    val amount: Double,
    val items: List<OrderItem>,
    val paid: Boolean
)

@JsonClass(generateAdapter = true)
data class OrderItem(
    val productId: Long,
    val productName: String,
    val quantity: Int,
    val price: Double
)

val order = Order(
    orderId = "ORD-2024-001",
    user = User(1001, "张三", 28, tags = listOf("VIP")),
    amount = 299.99,
    items = listOf(
        OrderItem(1, "机械键盘", 1, 199.99),
        OrderItem(2, "鼠标垫", 2, 50.0)
    ),
    paid = true
)

val adapter = moshi.adapter<Order>()
val orderJson = adapter.toJson(order)
println(orderJson)
```

### 5.4 自定义字段名

```kotlin
@JsonClass(generateAdapter = true)
data class ApiResponse(
    @Json(name = "status_code")
    val statusCode: Int,

    @Json(name = "error_msg")
    val errorMsg: String? = null
)
```

### 5.5 自定义适配器

```kotlin
import com.squareup.moshi.FromJson
import com.squareup.moshi.ToJson
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

class LocalDateTimeAdapter {
    private val formatter = DateTimeFormatter.ISO_LOCAL_DATE_TIME

    @ToJson
    fun toJson(value: LocalDateTime): String {
        return value.format(formatter)
    }

    @FromJson
    fun fromJson(json: String): LocalDateTime {
        return LocalDateTime.parse(json, formatter)
    }
}

val moshi = Moshi.Builder()
    .add(LocalDateTimeAdapter())
    .addLast(KotlinJsonAdapterFactory())
    .build()
```

### 5.6 Moshi 优缺点

| 优点 | 缺点 |
|------|------|
| 对 Kotlin 支持优秀 | 依赖 KSP/KAPT 代码生成 |
| 比 Gson 更轻量、更安全 | 社区规模小于 Gson |
| 无反射，编译期生成适配器 | 需注解标记数据类 |

---

## 6. 实用场景示例

### 6.1 表单数据转 JSON 提交

```kotlin
// 用 Gson 把 EditText 的输入打包成 JSON
fun buildLoginJson(
    username: String,
    password: String,
    rememberMe: Boolean
): String {
    val loginData = mapOf(
        "username" to username,
        "password" to password,
        "remember_me" to rememberMe
    )
    return Gson().toJson(loginData)
}

// 输出: {"username":"admin","password":"123456","remember_me":true}
```

### 6.2 Room 数据库的 TypeConverter

```kotlin
// 把 List<String> 存为 JSON 字符串
class Converters {
    private val gson = Gson()

    @TypeConverter
    fun fromStringList(value: List<String>): String {
        return gson.toJson(value)
    }

    @TypeConverter
    fun toStringList(value: String): List<String> {
        val listType = object : TypeToken<List<String>>() {}.type
        return gson.fromJson(value, listType)
    }
}
```

### 6.3 SharedPreferences 存储对象

```kotlin
fun saveUserToPrefs(context: Context, user: User) {
    val json = Gson().toJson(user)
    context.getSharedPreferences("app_prefs", Context.MODE_PRIVATE)
        .edit()
        .putString("current_user", json)
        .apply()
}

fun getUserFromPrefs(context: Context): User? {
    val json = context.getSharedPreferences("app_prefs", Context.MODE_PRIVATE)
        .getString("current_user", null) ?: return null
    return Gson().fromJson(json, User::class.java)
}
```

### 6.4 用 kotlinx.serialization 处理动态 key

```kotlin
@Serializable
data class Translations(
    val data: Map<String, String>
)

val translations = Translations(
    mapOf(
        "hello" to "你好",
        "world" to "世界",
        "kotlin" to "科特林"
    )
)

val json = Json { prettyPrint = true }
println(json.encodeToString(translations))
// 输出:
// {
//     "data": {
//         "hello": "你好",
//         "world": "世界",
//         "kotlin": "科特林"
//     }
// }
```

---

## 7. 方案对比总结

| 维度 | org.json | Gson | kotlinx.serialization | Moshi |
|------|:---:|:---:|:---:|:---:|
| 依赖量 | 0 | 1 | 2 | 2 |
| 对象自动映射 | ❌ | ✅ | ✅ | ✅ |
| 反射 | — | 是 | 否（编译期生成） | 否（编译期生成） |
| Kotlin 特性支持 | 手动处理 | 一般 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| 学习曲线 | 低 | 低 | 中 | 中 |
| 跨平台 | 仅 Android JVM | JVM | JVM/JS/Native | JVM |
| 性能 | 一般 | 良好 | 优秀 | 优秀 |
| 社区成熟度 | SDK 自带 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |

---

## 8. 选型建议

```
你的项目是什么样的？
│
├── 极简场景 / 只传几个字段
│   └── org.json（零依赖，写完即走）
│
├── 传统 Android 项目（Java + Kotlin 混编）
│   └── Gson（成熟稳定，一行业务代码搞定）
│
├── 纯 Kotlin 新项目
│   └── kotlinx.serialization（原生支持，编译期安全）
│
├── Kotlin Multiplatform / KMM
│   └── kotlinx.serialization（唯一跨平台选择）
│
├── 追求极致性能 + 类型安全
│   └── kotlinx.serialization 或 Moshi
│
└── 与 Retrofit 配合
    └── Gson 或 Moshi（Retrofit 有对应 Converter）
```

> [!TIP]
> **如果你只能记住一个结论**：纯 Kotlin 新项目用 `kotlinx.serialization`，混编或老项目用 `Gson`，简单场景用 `org.json`。

---

## 参考资料

- [Gson GitHub](https://github.com/google/gson)
- [kotlinx.serialization 官方文档](https://github.com/Kotlin/kotlinx.serialization)
- [Moshi GitHub](https://github.com/square/moshi)
- [Android org.json 文档](https://developer.android.com/reference/org/json/package-summary)