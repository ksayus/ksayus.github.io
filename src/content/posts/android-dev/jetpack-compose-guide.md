---
title: Jetpack Compose 声明式 UI 入门指南
published: 2026-09-11
description: 从零开始学习 Android 现代 UI 框架 Jetpack Compose，涵盖 Composable 函数、布局、状态管理、Modifier、列表、主题等核心概念，快速上手声明式 UI 开发。
tags: [Android, Jetpack Compose, Kotlin, 声明式UI, UI]
category: Android
image: ""
slug: jetpack-compose-guide
---

## 前言

Jetpack Compose 是 Google 推出的**现代化声明式 UI 工具包**，用纯 Kotlin 代码描述界面，彻底告别 XML。

相比传统的 XML + View 方式，Compose 带来了几个革命性变化：

- **声明式**：UI 是状态的函数，状态变了 UI 自动更新
- **零 XML**：全部用 Kotlin 写，享受完整的编程语言能力（循环、条件、重构）
- **组合优于继承**：Composable 函数可以任意组合，不再需要复杂的 View 层级
- **实时预览**：Android Studio 中编写 Composable 可即时预览效果

> [!NOTE]
> 本文假设你已有基本的 Kotlin 和 Android 开发知识。如未接触过，建议先阅读 [Android App UI 开发基础入门](/posts/android-ui-basics/)。

---

## 1. 环境搭建

### 1.1 创建 Compose 项目

在 Android Studio 中新建项目时，选择 **Empty Activity (Compose)** 模板，IDE 会自动配置好一切。

### 1.2 关键依赖

```kotlin
// app/build.gradle.kts
android {
    buildFeatures {
        compose = true  // 启用 Compose
    }
    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.8"  // 与 Kotlin 版本匹配
    }
}

dependencies {
    // Compose BOM：统一管理 Compose 库的版本
    val composeBom = platform("androidx.compose:compose-bom:2024.01.00")
    implementation(composeBom)

    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.foundation:foundation")

    // Activity 集成
    implementation("androidx.activity:activity-compose:1.8.2")

    // 调试预览
    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}
```

### 1.3 Activity 入口

```kotlin
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            // 所有 UI 都在这里
            MyAppTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    Greeting("Android")
                }
            }
        }
    }
}
```

---

## 2. Composable 函数

Composable 函数是 Compose 的基本构建块，用 `@Composable` 注解标记。

### 2.1 第一个 Composable

```kotlin
@Composable
fun Greeting(name: String) {
    Text(text = "Hello, $name!")
}
```

关键规则：

- 函数必须用 `@Composable` 注解
- 可以调用其他 `@Composable` 函数
- **没有返回值**（返回 `Unit`）
- 可以接受任意参数作为"配置"
- 同一参数输入，输出相同的 UI（幂等性）

### 2.2 预览

在 Android Studio 中可以直接预览 Composable：

```kotlin
@Preview(showBackground = true, showSystemUi = true)
@Composable
fun GreetingPreview() {
    MyAppTheme {
        Greeting("World")
    }
}
```

`@Preview` 常用参数：

| 参数 | 说明 |
|------|------|
| `showBackground` | 是否显示背景 |
| `showSystemUi` | 是否显示状态栏 |
| `widthDp` / `heightDp` | 指定预览尺寸 |
| `apiLevel` | 指定 API 等级 |

> [!NOTE]
> `@Preview` 函数不应包含耗时操作（如网络请求），否则拖慢 IDE 响应。

---

## 3. 核心布局组件

Compose 不再有 `LinearLayout`、`ConstraintLayout`，而是用几个简单的 Composable 组合出复杂界面。

### 3.1 Column（垂直排列）

```kotlin
@Composable
fun ColumnExample() {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("第一行")
        Text("第二行")
        Text("第三行")
    }
}
```

### 3.2 Row（水平排列）

```kotlin
@Composable
fun RowExample() {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceEvenly,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text("左")
        Text("中")
        Text("右")
    }
}
```

### 3.3 Box（层叠布局）

```kotlin
@Composable
fun BoxExample() {
    Box(
        modifier = Modifier.size(200.dp),
        contentAlignment = Alignment.Center
    ) {
        // 背景
        Image(
            painter = painterResource(R.drawable.bg),
            contentDescription = null,
            modifier = Modifier.fillMaxSize()
        )
        // 居中文字
        Text("叠加文字", color = Color.White, fontSize = 20.sp)
    }
}
```

### 3.4 Arrangement（排列方式）

| 值 | 效果 |
|----|------|
| `Start` | 靠左/靠上 |
| `Center` | 居中 |
| `End` | 靠右/靠下 |
| `SpaceBetween` | 两端对齐，中间等分 |
| `SpaceEvenly` | 均匀分布（含两端） |
| `SpaceAround` | 均匀分布（两端一半间距） |
| `spacedBy(8.dp)` | 固定间距 |

### 3.5 布局对比表

| 传统 XML | Compose |
|----------|---------|
| `LinearLayout(vertical)` | `Column` |
| `LinearLayout(horizontal)` | `Row` |
| `FrameLayout` | `Box` |
| `RelativeLayout` / `ConstraintLayout` | `Box` + `Modifier.align()` |
| `ScrollView` | `Column(Modifier.verticalScroll())` |

---

## 4. Modifier（修饰符）

`Modifier` 是 Compose 中最重要的概念之一，控制控件的外观和行为。

### 4.1 常用 Modifier

```kotlin
@Composable
fun ModifierDemo() {
    Text(
        text = "Hello",
        modifier = Modifier
            // 尺寸
            .size(100.dp)            // 固定 100dp
            .fillMaxWidth()          // 宽度填满
            .widthIn(min = 50.dp)    // 最小宽度

            // 间距
            .padding(16.dp)          // 内边距
            .padding(horizontal = 8.dp, vertical = 4.dp)

            // 背景与边框
            .background(Color.Blue, shape = RoundedCornerShape(8.dp))
            .border(2.dp, Color.Gray, RoundedCornerShape(8.dp))
            .clip(RoundedCornerShape(8.dp))

            // 点击
            .clickable { /* 点击处理 */ }

            // 滚动
            .verticalScroll(rememberScrollState())

            // 透明度
            .alpha(0.5f)
    )
}
```

> [!IMPORTANT]
> **Modifier 的顺序很重要！** 它们是链式叠加的，前面的先应用：
> ```kotlin
> // padding 在 background 之前 → padding 区域也有背景色
> Modifier.padding(16.dp).background(Color.Blue)
> 
> // background 在 padding 之前 → padding 区域是外层颜色
> Modifier.background(Color.Blue).padding(16.dp)
> ```

---

## 5. Button 和输入控件

### 5.1 Button

```kotlin
@Composable
fun ButtonExample(onClick: () -> Unit) {
    Button(
        onClick = onClick,
        enabled = true,
        shape = RoundedCornerShape(8.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.primary
        )
    ) {
        Icon(Icons.Default.Favorite, contentDescription = null)
        Spacer(Modifier.width(8.dp))
        Text("提交")
    }
}
```

### 5.2 带样式的文字点击（TextButton）

```kotlin
TextButton(onClick = { /* 点击 */ }) {
    Text("取消")
}

OutlinedButton(onClick = { /* 点击 */ }) {
    Text("次要操作")
}
```

### 5.3 TextField（输入框）

```kotlin
@Composable
fun TextFieldExample() {
    var text by remember { mutableStateOf("") }

    OutlinedTextField(
        value = text,
        onValueChange = { text = it },
        label = { Text("用户名") },
        placeholder = { Text("请输入用户名") },
        singleLine = true,
        leadingIcon = { Icon(Icons.Default.Person, contentDescription = null) },
        trailingIcon = {
            if (text.isNotEmpty()) {
                IconButton(onClick = { text = "" }) {
                    Icon(Icons.Default.Close, contentDescription = "清除")
                }
            }
        },
        isError = text.length > 20,
        supportingText = {
            if (text.length > 20) Text("最多输入 20 个字符")
        },
        modifier = Modifier.fillMaxWidth()
    )
}
```

---

## 6. 状态管理（State）

这是 Compose 最核心的概念：**UI = f(state)**。状态变了，UI 自动重组。

### 6.1 remember 和 mutableStateOf

```kotlin
@Composable
fun Counter() {
    // count 是响应式状态，变化时自动重组界面
    var count by remember { mutableStateOf(0) }

    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(text = "计数: $count", fontSize = 24.sp)
        Button(onClick = { count++ }) {
            Text("+1")
        }
    }
}
```

**`remember` 的作用**：在重组时保留值，没有 `remember` 每次重组都会重置为 0。

### 6.2 rememberSaveable（横竖屏切换保持）

```kotlin
@Composable
fun PersistentCounter() {
    // 横竖屏切换后值仍然保留
    var count by rememberSaveable { mutableStateOf(0) }
    // ...
}
```

### 6.3 状态提升（State Hoisting）

把状态移到调用方，组件变成**无状态的**（推荐模式）：

```kotlin
// 无状态组件：只负责展示和回调
@Composable
fun CounterDisplay(
    count: Int,
    onIncrement: () -> Unit,
    onDecrement: () -> Unit
) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Button(onClick = onDecrement) { Text("-") }
        Text(text = "$count", fontSize = 20.sp, modifier = Modifier.padding(horizontal = 16.dp))
        Button(onClick = onIncrement) { Text("+") }
    }
}

// 调用方管理状态
@Composable
fun CounterScreen() {
    var count by remember { mutableStateOf(0) }
    CounterDisplay(
        count = count,
        onIncrement = { count++ },
        onDecrement = { count-- }
    )
}
```

> [!NOTE]
> 状态提升的好处：组件可复用、易测试、状态来源单一（Single Source of Truth）。

### 6.4 remember + key（列表优化）

当列表项可能重新排序时，用 `key` 来精确控制：

```kotlin
@Composable
fun TodoList(todos: List<Todo>) {
    Column {
        todos.forEach { todo ->
            key(todo.id) {  // 确保重组时定位准确的 item
                TodoItem(todo)
            }
        }
    }
}
```

---

## 7. LazyColumn / LazyRow（高性能列表）

替代 `RecyclerView`，用法简单得多：

```kotlin
@Composable
fun LazyColumnExample(items: List<String>) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // 固定头部
        item {
            Text("列表标题", fontSize = 20.sp, fontWeight = FontWeight.Bold)
        }

        // 列表项
        items(items) { item ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Text(
                    text = item,
                    modifier = Modifier.padding(16.dp)
                )
            }
        }

        // 按索引
        itemsIndexed(items) { index, item ->
            Text("$index: $item")
        }

        // 固定尾部
        item {
            Text("共 ${items.size} 项", color = Color.Gray)
        }
    }
}
```

**LazyColumn vs RecyclerView：**

| RecyclerView | LazyColumn |
|-------------|------------|
| 需要 Adapter + ViewHolder | 直接写 Composable |
| `notifyDataSetChanged()` | 状态自动触发重组 |
| 多种 LayoutManager | 默认就是线性，横向用 LazyRow |
| DiffUtil 做增量更新 | `key()` 参数自动 diff |

---

## 8. 导航（Navigation Compose）

```kotlin
// build.gradle.kts
implementation("androidx.navigation:navigation-compose:2.7.6")
```

```kotlin
@Composable
fun AppNavigation() {
    val navController = rememberNavController()

    NavHost(
        navController = navController,
        startDestination = "home"
    ) {
        composable("home") {
            HomeScreen(
                onNavigateToDetail = { id ->
                    navController.navigate("detail/$id")
                }
            )
        }
        composable(
            route = "detail/{id}",
            arguments = listOf(navArgument("id") { type = NavType.IntType })
        ) { backStackEntry ->
            val id = backStackEntry.arguments?.getInt("id") ?: 0
            DetailScreen(id = id, onBack = { navController.popBackStack() })
        }
    }
}
```

---

## 9. 主题系统

### 9.1 MaterialTheme

```kotlin
@Composable
fun MyAppTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = lightColorScheme(
            primary = Color(0xFF6200EE),
            secondary = Color(0xFF03DAC6),
            background = Color(0xFFFFFFFF),
            surface = Color(0xFFFFFFFF),
            error = Color(0xFFB00020),
            onPrimary = Color.White,
            onSecondary = Color.Black,
            onBackground = Color.Black,
            onSurface = Color.Black,
        ),
        typography = Typography(
            headlineLarge = TextStyle(fontSize = 28.sp, fontWeight = FontWeight.Bold),
            bodyLarge = TextStyle(fontSize = 16.sp),
        ),
        content = content
    )
}
```

**使用主题中的颜色和字体：**

```kotlin
Text(
    text = "标题",
    color = MaterialTheme.colorScheme.primary,
    style = MaterialTheme.typography.headlineLarge
)
```

---

## 10. 实战：一个完整的 Todo List

```kotlin
// 数据模型
data class Todo(
    val id: Int = 0,
    val text: String,
    val isDone: Boolean = false
)

// 主界面
@Composable
fun TodoScreen() {
    var todos by remember { mutableStateOf(listOf<Todo>()) }
    var inputText by remember { mutableStateOf("") }
    var nextId by remember { mutableStateOf(1) }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        // 标题
        Text(
            text = "待办事项",
            style = MaterialTheme.typography.headlineMedium,
            modifier = Modifier.padding(bottom = 16.dp)
        )

        // 输入区域
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            OutlinedTextField(
                value = inputText,
                onValueChange = { inputText = it },
                label = { Text("新任务") },
                modifier = Modifier.weight(1f),
                singleLine = true
            )
            Spacer(Modifier.width(8.dp))
            Button(
                onClick = {
                    if (inputText.isNotBlank()) {
                        todos = todos + Todo(id = nextId++, text = inputText)
                        inputText = ""
                    }
                }
            ) {
                Text("添加")
            }
        }

        Spacer(Modifier.height(16.dp))

        // 列表
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(todos, key = { it.id }) { todo ->
                TodoItem(
                    todo = todo,
                    onToggle = {
                        todos = todos.map {
                            if (it.id == todo.id) it.copy(isDone = !it.isDone) else it
                        }
                    },
                    onDelete = {
                        todos = todos.filter { it.id != todo.id }
                    }
                )
            }
        }
    }
}

// 单条任务
@Composable
fun TodoItem(
    todo: Todo,
    onToggle: () -> Unit,
    onDelete: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Checkbox(checked = todo.isDone, onCheckedChange = { onToggle() })
            Text(
                text = todo.text,
                modifier = Modifier
                    .weight(1f)
                    .padding(horizontal = 8.dp),
                style = MaterialTheme.typography.bodyLarge,
                textDecoration = if (todo.isDone) TextDecoration.LineThrough else null
            )
            IconButton(onClick = onDelete) {
                Icon(Icons.Default.Delete, contentDescription = "删除", tint = Color.Red)
            }
        }
    }
}
```

---

## 11. 性能优化

### 11.1 避免不必要的重组

```kotlin
// ❌ 坏味道：lambda 每次重组都创建新实例
Button(onClick = { doSomething() }) { Text("OK") }

// ✅ 好：用 remember 缓存 lambda
val onClick = remember { { doSomething() } }
Button(onClick = onClick) { Text("OK") }
```

### 11.2 derivedStateOf

当状态派生自其他状态时，避免频繁触发重组：

```kotlin
@Composable
fun FilteredList(items: List<String>, query: String) {
    // 只在 query 变化时重新计算
    val filtered by remember {
        derivedStateOf {
            items.filter { it.contains(query, ignoreCase = true) }
        }
    }
    LazyColumn {
        items(filtered) { Text(it) }
    }
}
```

### 11.3 使用 Stability 注解

```kotlin
@Stable
data class User(val id: Int, val name: String)

@Immutable
data class Config(val theme: String, val language: String)
```

- `@Stable`：Compose 编译器认为类型是稳定的，字段可能变化但类型不变
- `@Immutable`：创建后永不变化，编译器做更激进的优化

---

## 12. 渐变和动画入门

### 12.1 简单动画

```kotlin
@Composable
fun AnimatedVisibilityDemo() {
    var visible by remember { mutableStateOf(true) }

    Column {
        Button(onClick = { visible = !visible }) {
            Text(if (visible) "隐藏" else "显示")
        }

        AnimatedVisibility(visible = visible) {
            Text("Hello, World!", fontSize = 24.sp)
        }
    }
}
```

### 12.2 值动画

```kotlin
@Composable
fun ScaleAnimationDemo() {
    var big by remember { mutableStateOf(false) }
    val scale by animateFloatAsState(
        targetValue = if (big) 1.5f else 1f,
        animationSpec = spring(dampingRatio = 0.5f)
    )

    Column {
        Button(onClick = { big = !big }) { Text("缩放") }
        Text("Hello", modifier = Modifier.graphicsLayer(scaleX = scale, scaleY = scale))
    }
}
```

---

## 13. Compose vs XML 总结

| | XML + View | Jetpack Compose |
|--|-----------|-----------------|
| 语言 | XML + Kotlin/Java | 纯 Kotlin |
| UI 更新方式 | 命令式（手动更新） | 声明式（状态驱动） |
| 列表 | RecyclerView + Adapter | LazyColumn |
| 动画 | 复杂 | 简洁 |
| 预览 | Design 视图 | `@Preview` |
| 学习曲线 | 需学 XML 属性 | 需学 Kotlin DSL |
| 成熟度 | 非常成熟 | 快速成长，生产可用 |
| 未来趋势 | 维护模式 | **推荐** |

---

## 14. 总结

Jetpack Compose 代表了 Android UI 开发的未来方向。核心要点：

1. **一切都是 Composable 函数**，UI = f(state)
2. **Column / Row / Box** 替代传统布局
3. **Modifier** 控制外观和行为，顺序很重要
4. **remember + mutableStateOf** 管理本地状态
5. **状态提升**让组件可复用、可测试
6. **LazyColumn** 是 RecyclerView 的完美替代

建议新建项目直接使用 Compose，老项目渐进式迁移。

---

## 参考资料

- [Jetpack Compose 官方文档](https://developer.android.com/develop/ui/compose)
- [Compose 性能最佳实践](https://developer.android.com/topic/performance)
- [Compose 示例代码](https://github.com/android/compose-samples)
- [Material 3 设计指南](https://m3.material.io/)