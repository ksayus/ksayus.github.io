---
title: Android 开发中的 API 调用全攻略
published: 2026-09-13
description: 全面梳理 Android 开发中 HTTP API 调用的各种方式，涵盖 HttpURLConnection、OkHttp、Retrofit、Ktor Client 等主流方案，包含最佳实践与完整代码示例。
tags: [Android, API, HTTP, Retrofit, OkHttp, Ktor, 网络请求]
category: Android
image: ""
slug: android-api-calls
---

## 前言

在现代 Android 开发中，**网络 API 调用**几乎是每个 App 都绕不开的核心需求——登录注册需要调接口、获取列表数据需要调接口、上传文件需要调接口。Android 生态中做网络请求的方案非常多，从最底层的 `HttpURLConnection` 到如今主流的 Retrofit + OkHttp 组合，各有优劣。

本文将系统性地介绍 Android 中 API 调用的各种方式，帮你建立完整的技术选型认知。

> [!NOTE]
> 本文所有示例均使用 **Kotlin** 编写，网络请求属于耗时操作，默认运行在协程中。关于协程的基础知识可参阅 Kotlin 协程官方文档。

---

## 1. 方案总览

| 方案 | 层级 | 特点 | 适用场景 |
|------|------|------|----------|
| HttpURLConnection | 底层 | JDK 内置，无依赖，代码量多 | 极简需求、教学演示 |
| OkHttp | 中间层 | 高性能，拦截器链，连接池 | 大中型项目底层引擎 |
| Retrofit | 上层 | 注解式声明，自动序列化/反序列化 | 主流 RESTful API 项目 |
| Ktor Client | 上层 | 纯 Kotlin，跨平台，协程原生 | KMP / Compose Multiplatform |

> 实际项目中，**Retrofit + OkHttp + Kotlin Coroutines** 是绝大多数团队的标配。

---

## 2. HttpURLConnection：最底层的方式

`HttpURLConnection` 是 JDK 内置的 HTTP 客户端，Android 也能用，但代码较为繁琐。

### 2.1 GET 请求

```kotlin
import java.net.HttpURLConnection
import java.net.URL

fun httpGet(url: String): String {
    val connection = URL(url).openConnection() as HttpURLConnection

    connection.apply {
        requestMethod = "GET"
        connectTimeout = 10_000
        readTimeout = 10_000
        setRequestProperty("Accept", "application/json")
    }

    return try {
        val responseCode = connection.responseCode
        if (responseCode == HttpURLConnection.HTTP_OK) {
            connection.inputStream.bufferedReader().readText()
        } else {
            throw Exception("请求失败: $responseCode")
        }
    } finally {
        connection.disconnect()
    }
}
```

### 2.2 POST 请求

```kotlin
import java.io.OutputStream
import org.json.JSONObject

fun httpPost(url: String, body: JSONObject): String {
    val connection = URL(url).openConnection() as HttpURLConnection

    connection.apply {
        requestMethod = "POST"
        connectTimeout = 10_000
        readTimeout = 10_000
        doOutput = true
        setRequestProperty("Content-Type", "application/json")
        setRequestProperty("Accept", "application/json")
    }

    // 写入请求体
    connection.outputStream.use { outputStream: OutputStream ->
        outputStream.write(body.toString().toByteArray(Charsets.UTF_8))
    }

    return try {
        val responseCode = connection.responseCode
        if (responseCode == HttpURLConnection.HTTP_OK) {
            connection.inputStream.bufferedReader().readText()
        } else {
            throw Exception("请求失败: $responseCode")
        }
    } finally {
        connection.disconnect()
    }
}
```

### 2.3 优缺点

| 优点 | 缺点 |
|------|------|
| 无需任何第三方依赖 | 代码冗长，每次都要手写连接管理 |
| JDK 内置，兼容性好 | 没有拦截器、连接池等高级特性 |
| 适合理解底层原理 | 不直接支持并发、取消操作 |

> **结论**：几乎没有人会在生产项目中使用 `HttpURLConnection`，但它对于理解网络请求的底层机制很有帮助。

---

## 3. OkHttp：市场占有率最高的 HTTP 引擎

[OkHttp](https://square.github.io/okhttp/) 是 Square 公司出品的 HTTP 客户端，也是 Retrofit 的默认底层引擎。它以**拦截器链**和**连接池**两大特性著称。

### 3.1 添加依赖

```kotlin
// app/build.gradle.kts
dependencies {
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
}
```

### 3.2 基本用法

```kotlin
val client = OkHttpClient.Builder()
    .connectTimeout(30, TimeUnit.SECONDS)
    .readTimeout(30, TimeUnit.SECONDS)
    .addInterceptor(HttpLoggingInterceptor().apply {
        level = HttpLoggingInterceptor.Level.BODY
    })
    .build()

// GET 请求
fun get(url: String): String {
    val request = Request.Builder()
        .url(url)
        .header("Accept", "application/json")
        .get()
        .build()

    client.newCall(request).execute().use { response ->
        if (!response.isSuccessful) {
            throw IOException("Unexpected code $response")
        }
        return response.body?.string() ?: ""
    }
}

// POST 请求（JSON）
fun post(url: String, json: String): String {
    val requestBody = json.toRequestBody("application/json".toMediaTypeOrNull())
    val request = Request.Builder()
        .url(url)
        .post(requestBody)
        .build()

    client.newCall(request).execute().use { response ->
        return response.body?.string() ?: ""
    }
}
```

### 3.3 拦截器（Interceptor）—— OkHttp 的灵魂

拦截器是 OkHttp 最强大的特性，可以在请求发送前和响应返回后做统一处理。

```kotlin
// 日志拦截器：打印请求和响应
class LoggingInterceptor : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        Log.d("OkHttp", "--> ${request.method} ${request.url}")
        val startTime = System.nanoTime()
        val response = chain.proceed(request)
        val duration = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startTime)
        Log.d("OkHttp", "<-- ${response.code} ${request.url} (${duration}ms)")
        return response
    }
}

// Token 拦截器：自动添加认证头
class AuthInterceptor(private val tokenProvider: () -> String?) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()
        val token = tokenProvider()
        val request = if (token != null) {
            original.newBuilder()
                .header("Authorization", "Bearer $token")
                .build()
        } else {
            original
        }
        return chain.proceed(request)
    }
}

// 重试拦截器：网络异常时自动重试
class RetryInterceptor(private val maxRetries: Int = 3) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        var retryCount = 0
        var lastException: IOException? = null
        while (retryCount < maxRetries) {
            try {
                return chain.proceed(chain.request())
            } catch (e: IOException) {
                lastException = e
                retryCount++
                if (retryCount >= maxRetries) throw e
            }
        }
        throw lastException ?: IOException("Max retries exceeded")
    }
}
```

### 3.4 文件上传（Multipart）

```kotlin
fun uploadFile(url: String, file: File, fieldName: String): String {
    val requestBody = MultipartBody.Builder()
        .setType(MultipartBody.FORM)
        .addFormDataPart(fieldName, file.name, file.asRequestBody("image/*".toMediaTypeOrNull()))
        .addFormDataPart("description", "这是文件描述")
        .build()

    val request = Request.Builder()
        .url(url)
        .post(requestBody)
        .build()

    client.newCall(request).execute().use { response ->
        return response.body?.string() ?: ""
    }
}
```

### 3.5 与协程结合

OkHttp 从 4.x 开始原生支持 Kotlin 协程的 `suspend` 函数，但需要引入扩展库或者直接桥接。更常见的做法是用 Retrofit 来包装。

---

## 4. Retrofit：注解式 HTTP 客户端

[Retrofit](https://square.github.io/retrofit/) 同样是 Square 出品，它将 HTTP API 声明为 Kotlin 接口，通过注解描述请求细节，是 Android 社区的事实标准。

### 4.1 添加依赖

```kotlin
// app/build.gradle.kts
dependencies {
    implementation("com.squareup.retrofit2:retrofit:2.9.0")
    implementation("com.squareup.retrofit2:converter-gson:2.9.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
}
```

### 4.2 定义 API 接口

```kotlin
// ApiService.kt
interface ApiService {

    @GET("users/{id}")
    suspend fun getUser(@Path("id") userId: Long): Response<User>

    @GET("users")
    suspend fun getUsers(
        @Query("page") page: Int = 1,
        @Query("per_page") perPage: Int = 20
    ): Response<List<User>>

    @POST("users")
    suspend fun createUser(@Body user: User): Response<User>

    @PUT("users/{id}")
    suspend fun updateUser(
        @Path("id") userId: Long,
        @Body user: User
    ): Response<User>

    @DELETE("users/{id}")
    suspend fun deleteUser(@Path("id") userId: Long): Response<Unit>

    @Multipart
    @POST("upload")
    suspend fun uploadFile(
        @Part file: MultipartBody.Part,
        @Part("description") description: RequestBody
    ): Response<UploadResult>

    @FormUrlEncoded
    @POST("auth/login")
    suspend fun login(
        @Field("username") username: String,
        @Field("password") password: String
    ): Response<LoginResult>

    @Headers("Cache-Control: max-age=3600")
    @GET("config")
    suspend fun getConfig(): Response<Config>
}
```

### 4.3 数据模型

```kotlin
data class User(
    val id: Long,
    val name: String,
    val email: String,
    val avatar: String?
)

data class ApiResponse<T>(
    val code: Int,
    val message: String,
    val data: T?
)

data class LoginResult(
    val token: String,
    val userId: Long
)

data class Config(
    val apiVersion: String,
    val features: List<String>
)

data class UploadResult(
    val url: String,
    val fileId: String
)
```

### 4.4 构建 Retrofit 实例

```kotlin
object ApiClient {

    private const val BASE_URL = "https://api.example.com/"

    private val okHttpClient: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .addInterceptor(AuthInterceptor { TokenManager.token })
            .addInterceptor(HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BODY
            })
            .build()
    }

    private val retrofit: Retrofit by lazy {
        Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    val apiService: ApiService by lazy {
        retrofit.create(ApiService::class.java)
    }
}
```

### 4.5 在 ViewModel 中调用

```kotlin
class UserViewModel : ViewModel() {

    private val _users = MutableStateFlow<List<User>>(emptyList())
    val users: StateFlow<List<User>> = _users.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    fun fetchUsers(page: Int = 1) {
        viewModelScope.launch {
            _loading.value = true
            try {
                val response = ApiClient.apiService.getUsers(page = page)
                if (response.isSuccessful) {
                    _users.value = response.body() ?: emptyList()
                } else {
                    _error.value = "请求失败: ${response.code()}"
                }
            } catch (e: IOException) {
                _error.value = "网络异常: ${e.message}"
            } catch (e: Exception) {
                _error.value = "未知错误: ${e.message}"
            } finally {
                _loading.value = false
            }
        }
    }
}
```

### 4.6 封装统一响应处理

很多人会封装一个工具类来处理统一的 API 响应格式：

```kotlin
sealed class NetworkResult<out T> {
    data class Success<T>(val data: T) : NetworkResult<T>()
    data class Error(val code: Int, val message: String) : NetworkResult<Nothing>()
    data class Exception(val e: Throwable) : NetworkResult<Nothing>()
}

suspend fun <T> safeApiCall(call: suspend () -> Response<T>): NetworkResult<T> {
    return try {
        val response = call()
        if (response.isSuccessful) {
            val body = response.body()
            if (body != null) {
                NetworkResult.Success(body)
            } else {
                NetworkResult.Error(response.code(), "响应体为空")
            }
        } else {
            val errorBody = response.errorBody()?.string() ?: "未知错误"
            NetworkResult.Error(response.code(), errorBody)
        }
    } catch (e: IOException) {
        NetworkResult.Exception(e)
    } catch (e: Exception) {
        NetworkResult.Exception(e)
    }
}

// 使用
class UserViewModel : ViewModel() {
    fun fetchUsers() {
        viewModelScope.launch {
            when (val result = safeApiCall { ApiClient.apiService.getUsers() }) {
                is NetworkResult.Success -> _users.value = result.data
                is NetworkResult.Error -> _error.value = result.message
                is NetworkResult.Exception -> _error.value = result.e.message
            }
        }
    }
}
```

---

## 5. Ktor Client：跨平台新势力

[Ktor Client](https://ktor.io/docs/client.html) 是 JetBrains 出品，原生 Kotlin 编写，特别适合 **Kotlin Multiplatform（KMP）** 项目。

### 5.1 添加依赖

```kotlin
// libs.versions.toml 或 build.gradle.kts
dependencies {
    implementation("io.ktor:ktor-client-core:2.3.7")
    implementation("io.ktor:ktor-client-android:2.3.7")
    implementation("io.ktor:ktor-client-content-negotiation:2.3.7")
    implementation("io.ktor:ktor-serialization-kotlinx-json:2.3.7")
    implementation("io.ktor:ktor-client-logging:2.3.7")
    implementation("io.ktor:ktor-client-auth:2.3.7")
}
```

### 5.2 基本配置

```kotlin
import io.ktor.client.*
import io.ktor.client.plugins.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.plugins.logging.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.serialization.kotlinx.json.*

val ktorClient = HttpClient {
    // 超时配置
    install(HttpTimeout) {
        connectTimeoutMillis = 30_000
        requestTimeoutMillis = 30_000
    }

    // JSON 序列化
    install(ContentNegotiation) {
        json(kotlinx.serialization.json.Json {
            ignoreUnknownKeys = true
            isLenient = true
        })
    }

    // 日志
    install(Logging) {
        level = LogLevel.BODY
    }

    // 默认请求配置
    defaultRequest {
        url("https://api.example.com/")
        contentType(ContentType.Application.Json)
    }
}
```

### 5.3 发起请求

```kotlin
@Serializable
data class KtorUser(val id: Long, val name: String, val email: String)

class KtorApiService(private val client: HttpClient) {

    suspend fun getUsers(): List<KtorUser> {
        return client.get("users").body()
    }

    suspend fun getUser(id: Long): KtorUser {
        return client.get("users/$id").body()
    }

    suspend fun createUser(user: KtorUser): KtorUser {
        return client.post("users") {
            setBody(user)
        }.body()
    }

    suspend fun deleteUser(id: Long): Boolean {
        val response = client.delete("users/$id")
        return response.status.value == 204
    }
}
```

---

## 6. 进阶实践

### 6.1 动态 Base URL（多环境切换）

```kotlin
object DynamicRetrofitClient {

    var currentBaseUrl: String = "https://api.example.com/"

    private val okHttpClient = OkHttpClient.Builder()
        .addInterceptor(HttpLoggingInterceptor().setLevel(HttpLoggingInterceptor.Level.BODY))
        .build()

    val apiService: ApiService
        get() = Retrofit.Builder()
            .baseUrl(currentBaseUrl)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(ApiService::class.java)
}
```

### 6.2 SSL 证书固定（Certificate Pinning）

```kotlin
// 只信任指定的证书哈希
val certificatePinner = CertificatePinner.Builder()
    .add("api.example.com", "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")
    .build()

val client = OkHttpClient.Builder()
    .certificatePinner(certificatePinner)
    .build()
```

### 6.3 缓存策略

```kotlin
val cacheDir = context.cacheDir
val cacheSize = 10 * 1024 * 1024L // 10MB

val cache = Cache(cacheDir, cacheSize)

val client = OkHttpClient.Builder()
    .cache(cache)
    .addInterceptor { chain ->
        val request = chain.request()
        // 有网络时，缓存有效期 60 秒
        val response = chain.proceed(request)
        response.newBuilder()
            .header("Cache-Control", "public, max-age=60")
            .build()
    }
    .addNetworkInterceptor { chain ->
        // 离线时使用缓存（有效期 24 小时）
        val request = chain.request().newBuilder()
            .header("Cache-Control", "public, only-if-cached, max-stale=${60 * 60 * 24}")
            .build()
        chain.proceed(request)
    }
    .build()
```

### 6.4 请求限流与重试（简易版）

```kotlin
class RateLimitInterceptor(
    private val maxRequestsPerSecond: Int = 5
) : Interceptor {
    private val requestTimestamps = ArrayDeque<Long>()

    override fun intercept(chain: Interceptor.Chain): Response {
        val now = System.currentTimeMillis()
        // 移除 1 秒前的时间戳
        while (requestTimestamps.isNotEmpty() && requestTimestamps.first() < now - 1000) {
            requestTimestamps.removeFirst()
        }
        // 等待直到有空位
        if (requestTimestamps.size >= maxRequestsPerSecond) {
            Thread.sleep(requestTimestamps.first() + 1000 - now)
        }
        requestTimestamps.add(System.currentTimeMillis())
        return chain.proceed(chain.request())
    }
}
```

---

## 7. 方案对比总结

| 特性 | HttpURLConnection | OkHttp | Retrofit | Ktor Client |
|------|:---:|:---:|:---:|:---:|
| 依赖量 | 0 | 1个库 | 2个库（含 OkHttp） | 多模块 |
| 代码简洁度 | ⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| 拦截器 | ❌ | ✅ | ✅（通过 OkHttp） | ✅（插件体系） |
| 连接池 | ❌ | ✅ | ✅ | ✅ |
| 协程支持 | 需手动适配 | 需手动适配 | 原生支持 | 原生支持 |
| 多平台 | ❌ | ❌ | ❌ | ✅ |
| 社区成熟度 | — | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| 学习曲线 | 低 | 中 | 低 | 中 |

---

## 8. 选型建议

```
需要 KMP 跨平台？
├── 是 → 用 Ktor Client
└── 否
    └── RESTful API 为主？
        ├── 是 → Retrofit + OkHttp + Coroutines（首选）
        └── 否 → OkHttp 原生（WebSocket、文件下载等特殊场景）
```

> **一句话总结**：如果你做纯 Android 开发，直接用 **Retrofit + OkHttp** 就好，这是社区验证过的黄金组合。如果你的项目涉及 Kotlin Multiplatform，Ktor Client 是无脑首选。

---

## 参考资料

- [OkHttp 官方文档](https://square.github.io/okhttp/)
- [Retrofit 官方文档](https://square.github.io/retrofit/)
- [Ktor Client 官方文档](https://ktor.io/docs/client.html)
- [Android 网络安全配置](https://developer.android.com/training/articles/security-config)