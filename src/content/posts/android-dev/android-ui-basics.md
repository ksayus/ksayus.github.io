---
title: Android App UI 开发基础入门
published: 2026-09-11
description: 从零开始学习 Android 界面开发，涵盖 XML 布局、常用控件（TextView、Button、EditText、ImageView、RecyclerView）、四大布局管理器以及事件处理，帮助你迈出 Android UI 开发的第一步。
tags: [Android, UI, XML, 布局, 控件, RecyclerView]
category: Android
image: ""
slug: android-ui-basics
---

## 前言

Android 应用开发中，**UI（用户界面）** 是最直观、也是初学者最先接触的部分。无论你是想做一个记账 App、聊天工具还是个人博客客户端，都需要先学会如何"画"出界面。

Android UI 开发主要有两种方式：

- **传统方式**：XML 布局 + View 系统（本文重点）
- **现代方式**：Jetpack Compose 声明式 UI（文末简介）

本文将从零开始，带你掌握 Android UI 开发的核心知识：

- Android 项目的 UI 文件结构
- 常用布局（LinearLayout、RelativeLayout、ConstraintLayout、FrameLayout）
- 常用控件（TextView、Button、EditText、ImageView、RecyclerView）
- 事件处理（点击、长按）
- 单位与资源适配

> [!NOTE]
> 本文使用 **Kotlin** 作为示例代码语言，XML 布局部分与 Java 通用。推荐使用 **Android Studio** 作为开发工具。

---

## 1. UI 文件在哪里？

一个典型的 Android 项目结构如下：

```
app/
├── src/
│   └── main/
│       ├── java/                    # Kotlin/Java 代码
│       │   └── com/example/app/
│       │       └── MainActivity.kt
│       └── res/                     # 资源文件夹
│           ├── layout/              # 📁 布局文件（XML）
│           │   └── activity_main.xml
│           ├── drawable/            # 📁 图片、形状
│           ├── mipmap/              # 📁 应用图标
│           ├── values/              # 📁 字符串、颜色、尺寸
│           │   ├── strings.xml
│           │   ├── colors.xml
│           │   └── dimens.xml
│           └── themes/              # 📁 主题
│               └── themes.xml
```

**关键文件**：
- `res/layout/activity_main.xml` —— 界面布局，定义控件的位置和样式
- `MainActivity.kt` —— Activity 代码，负责逻辑和事件处理

---

## 2. 你的第一个界面

### 2.1 XML 布局

```xml
<!-- res/layout/activity_main.xml -->
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:padding="16dp"
    android:gravity="center">

    <TextView
        android:id="@+id/tv_greeting"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Hello, Android!"
        android:textSize="24sp"
        android:textColor="#333333" />

    <Button
        android:id="@+id/btn_click"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_marginTop="16dp"
        android:text="点我" />

</LinearLayout>
```

### 2.2 Activity 代码

```kotlin
// MainActivity.kt
package com.example.app

import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)  // 加载布局

        val tvGreeting = findViewById<TextView>(R.id.tv_greeting)
        val btnClick = findViewById<Button>(R.id.btn_click)

        btnClick.setOnClickListener {
            tvGreeting.text = "你点了我！"
        }
    }
}
```

> [!NOTE]
> `R.layout.activity_main` 对应 `res/layout/activity_main.xml`，`R.id.tv_greeting` 对应 XML 中的 `android:id="@+id/tv_greeting"`。Android 构建时自动为所有资源生成 `R` 类，方便在代码中引用。

---

## 3. 四大常用布局

布局决定了子控件如何排列。以下是开发中最常用的四种。

### 3.1 LinearLayout（线性布局）

子控件按**水平**或**垂直**方向依次排列。

```xml
<LinearLayout
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:orientation="vertical">

    <TextView android:text="第一行" />
    <TextView android:text="第二行" />
    <TextView android:text="第三行" />

</LinearLayout>
```

关键属性：

| 属性 | 说明 |
|------|------|
| `android:orientation` | `vertical`（垂直）/ `horizontal`（水平） |
| `android:layout_weight` | 按权重分配剩余空间 |
| `android:gravity` | 子控件在本控件内的对齐方式 |

### 3.2 RelativeLayout（相对布局）

子控件**相对于父容器或兄弟控件**定位。

```xml
<RelativeLayout
    android:layout_width="match_parent"
    android:layout_height="match_parent">

    <Button
        android:id="@+id/btn_center"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_centerInParent="true"
        android:text="居中" />

    <Button
        android:id="@+id/btn_below"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_below="@id/btn_center"
        android:layout_centerHorizontal="true"
        android:layout_marginTop="8dp"
        android:text="在下面" />

</RelativeLayout>
```

常用定位属性：

| 相对于父容器 | 相对于兄弟控件 |
|-------------|---------------|
| `layout_centerInParent` | `layout_below` / `layout_above` |
| `layout_centerHorizontal` | `layout_toLeftOf` / `layout_toRightOf` |
| `layout_alignParentBottom` | `layout_alignTop` / `layout_alignBottom` |

### 3.3 FrameLayout（帧布局）

子控件**层叠**放置，后添加的覆盖前面的。

```xml
<FrameLayout
    android:layout_width="200dp"
    android:layout_height="200dp">

    <ImageView
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:src="@drawable/background" />

    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_gravity="center"
        android:text="居中文字"
        android:textColor="#FFFFFF"
        android:textSize="20sp" />

</FrameLayout>
```

> [!NOTE]
> FrameLayout 很简单，常用作**占位容器**（Fragment 容器）或**层叠效果**（图片上叠文字）。

### 3.4 ConstraintLayout（约束布局）⭐ 推荐

Google 官方推荐的**默认布局**，通过约束关系定义控件位置，性能好、灵活度高。

```xml
<androidx.constraintlayout.widget.ConstraintLayout
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="match_parent">

    <TextView
        android:id="@+id/tv_title"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="标题"
        android:textSize="20sp"
        app:layout_constraintTop_toTopOf="parent"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintEnd_toEndOf="parent"
        android:layout_marginTop="32dp" />

    <Button
        android:id="@+id/btn_action"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="操作"
        app:layout_constraintTop_toBottomOf="@id/tv_title"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintEnd_toEndOf="parent"
        android:layout_marginTop="16dp" />

</androidx.constraintlayout.widget.ConstraintLayout>
```

约束格式：`app:layout_constraint[方向]_to[目标方向]Of="目标id或parent"`

| 约束 | 含义 |
|------|------|
| `Top_toTopOf="parent"` | 顶上边对齐父容器上边 |
| `Top_toBottomOf="@id/btn"` | 顶上边对齐 btn 的下边 |
| `Start_toEndOf="@id/btn"` | 左边对齐 btn 的右边 |

---

## 5. 常用控件

### 5.1 TextView（文本）

```xml
<TextView
    android:id="@+id/tv_info"
    android:layout_width="wrap_content"
    android:layout_height="wrap_content"
    android:text="这是一段文本"
    android:textSize="16sp"
    android:textColor="#333333"
    android:textStyle="bold"
    android:maxLines="2"
    android:ellipsize="end"
    android:gravity="center" />
```

关键属性：
- `maxLines` + `ellipsize="end"` → 超出两行显示 `...`
- `textStyle` → `normal` / `bold` / `italic`
- `gravity` → 文字在控件内的对齐方式

### 5.2 Button（按钮）

```xml
<Button
    android:id="@+id/btn_submit"
    android:layout_width="wrap_content"
    android:layout_height="wrap_content"
    android:text="提交"
    android:enabled="true" />
```

Kotlin 点击事件：

```kotlin
// 方式一：setOnClickListener
btnSubmit.setOnClickListener {
    // 点击处理
}

// 方式二：XML 中定义 onClick（不推荐）
// android:onClick="onSubmitClick"
// 然后在 Activity 中定义 fun onSubmitClick(view: View) {}
```

### 5.3 EditText（输入框）

```xml
<EditText
    android:id="@+id/et_input"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:hint="请输入内容"
    android:inputType="text"
    android:maxLength="100"
    android:padding="12dp" />
```

常用 `inputType`：

| 值 | 用途 |
|----|------|
| `text` | 普通文本 |
| `textPassword` | 密码 |
| `number` | 数字 |
| `phone` | 电话号码 |
| `textEmailAddress` | 邮箱 |
| `textMultiLine` | 多行文本 |

```kotlin
// 获取输入内容
val text = etInput.text.toString()
```

### 5.4 ImageView（图片）

```xml
<ImageView
    android:id="@+id/iv_photo"
    android:layout_width="100dp"
    android:layout_height="100dp"
    android:src="@drawable/ic_launcher"
    android:scaleType="centerCrop"
    android:contentDescription="描述图片内容" />
```

常用 `scaleType`：

| 值 | 效果 |
|----|------|
| `centerCrop` | 等比缩放填满，裁剪多余 |
| `fitCenter` | 等比缩放完整显示，居中 |
| `fitXY` | 拉伸填满，不保持比例 |

### 5.5 RecyclerView（列表）⭐ 重要

`RecyclerView` 是 Android 最强大的列表控件，替代了旧的 `ListView`。

**三步使用 RecyclerView：**

**① 添加依赖**（`build.gradle.kts`）：

```kotlin
dependencies {
    implementation("androidx.recyclerview:recyclerview:1.3.2")
}
```

**② XML 布局：**

```xml
<androidx.recyclerview.widget.RecyclerView
    android:id="@+id/rv_list"
    android:layout_width="match_parent"
    android:layout_height="match_parent" />
```

**③ 编写 Adapter：**

```kotlin
// 数据类
data class Item(val name: String, val desc: String)

// Adapter
class MyAdapter(
    private val items: List<Item>,
    private val onItemClick: (Item) -> Unit
) : RecyclerView.Adapter<MyAdapter.ViewHolder>() {

    // ViewHolder 持有每个 item 的控件引用
    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val tvName: TextView = view.findViewById(R.id.tv_name)
        val tvDesc: TextView = view.findViewById(R.id.tv_desc)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_layout, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val item = items[position]
        holder.tvName.text = item.name
        holder.tvDesc.text = item.desc
        holder.itemView.setOnClickListener { onItemClick(item) }
    }

    override fun getItemCount() = items.size
}
```

**④ 在 Activity 中使用：**

```kotlin
val recyclerView = findViewById<RecyclerView>(R.id.rv_list)
recyclerView.layoutManager = LinearLayoutManager(this)
recyclerView.adapter = MyAdapter(items) { item ->
    Toast.makeText(this, "点击了: ${item.name}", Toast.LENGTH_SHORT).show()
}
```

---

## 6. 尺寸单位详解

| 单位 | 含义 | 使用场景 |
|------|------|----------|
| **dp** | 密度无关像素 | 控件宽高、边距（推荐） |
| **sp** | 缩放无关像素 | 文字大小（推荐） |
| px | 物理像素 | 极少使用 |
| pt | 磅 | 极少使用 |

> [!IMPORTANT]
> 始终用 `dp` 定义控件尺寸、用 `sp` 定义文字大小。这样在不同屏幕密度的设备上显示效果一致，且会响应用户的字体大小设置。

```xml
<!-- ✅ 正确 -->
<TextView
    android:layout_width="200dp"
    android:textSize="16sp" />

<!-- ❌ 错误 -->
<TextView
    android:layout_width="200px"
    android:textSize="16pt" />
```

---

## 7. 常用属性速查

### 7.1 通用属性（所有 View 都有）

| 属性 | 说明 |
|------|------|
| `android:id="@+id/xxx"` | 唯一标识 |
| `android:layout_width` | `match_parent` / `wrap_content` / 具体值 |
| `android:layout_height` | 同上 |
| `android:layout_margin` | 外边距 |
| `android:padding` | 内边距 |
| `android:background` | 背景色或背景图 |
| `android:visibility` | `visible` / `invisible` / `gone` |
| `android:alpha` | 透明度（0.0 ~ 1.0） |

### 7.2 layout_width / layout_height 值

| 值 | 含义 |
|----|------|
| `match_parent` | 填满父容器 |
| `wrap_content` | 包裹内容 |
| `0dp` | 在 ConstraintLayout 中表示"按约束决定" |

---

## 8. 事件处理

### 8.1 点击事件

```kotlin
btn.setOnClickListener {
    Toast.makeText(this, "点击了", Toast.LENGTH_SHORT).show()
}
```

### 8.2 长按事件

```kotlin
btn.setOnLongClickListener {
    Toast.makeText(this, "长按了", Toast.LENGTH_SHORT).show()
    true  // 返回 true 表示已处理，不再传递
}
```

### 8.3 触摸事件

```kotlin
view.setOnTouchListener { _, event ->
    when (event.action) {
        MotionEvent.ACTION_DOWN -> { /* 按下 */ }
        MotionEvent.ACTION_MOVE -> { /* 移动 */ }
        MotionEvent.ACTION_UP -> { /* 抬起 */ }
    }
    true
}
```

---

## 9. ViewBinding（告别 findViewById）

`findViewById` 繁琐且类型不安全。推荐使用 **ViewBinding**：

**启用 ViewBinding**（`build.gradle.kts`）：

```kotlin
android {
    buildFeatures {
        viewBinding = true
    }
}
```

**使用**：

```kotlin
class MainActivity : AppCompatActivity() {
    private lateinit var binding: ActivityMainBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // 直接通过 binding 访问控件，无需 findViewById
        binding.btnClick.setOnClickListener {
            binding.tvGreeting.text = "你点了我！"
        }
    }
}
```

`activity_main.xml` 自动生成 `ActivityMainBinding` 类，XML 中的 `@+id/btn_click` 对应 `binding.btnClick`。

---

## 10. Jetpack Compose 简介（展望）

Jetpack Compose 是 Google 推出的**现代声明式 UI 框架**，用 Kotlin 代码直接写 UI，不再需要 XML：

```kotlin
@Composable
fun Greeting(name: String) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = "Hello, $name!",
            fontSize = 24.sp,
            color = Color(0xFF333333)
        )
        Button(onClick = { /* 处理点击 */ }) {
            Text("点我")
        }
    }
}
```

> [!NOTE]
> Compose 是新项目的**推荐选择**，但传统 XML + View 系统仍然大量存在于现有项目中。建议两者都学：XML 方式帮助理解 Android 的 View 体系，Compose 则面向未来。

---

## 11. 总结

| 内容 | 要点 |
|------|------|
| 布局文件 | `res/layout/*.xml` |
| 代码 | `Activity` 中 `setContentView` + 事件绑定 |
| 推荐布局 | `ConstraintLayout`（灵活高效） |
| 必修控件 | TextView、Button、EditText、ImageView、RecyclerView |
| 尺寸单位 | 宽高用 `dp`，文字用 `sp` |
| 推荐 IDE | Android Studio |
| 推荐语言 | Kotlin |
| 未来方向 | Jetpack Compose 声明式 UI |

**学习路线建议：**

1. 先手写几个 XML 布局，理解布局嵌套关系
2. 掌握 `LinearLayout` 和 `ConstraintLayout`
3. 学习 `RecyclerView`（列表是 App 的灵魂）
4. 尝试做一个简单的小 App（比如：记事本、计数器）
5. 进阶学习 Jetpack Compose

---

## 参考资料

- [Android 官方文档 - 布局](https://developer.android.com/develop/ui/views/layout/declaring-layout)
- [Android 官方文档 - RecyclerView](https://developer.android.com/develop/ui/views/layout/recyclerview)
- [Android 官方文档 - ViewBinding](https://developer.android.com/topic/libraries/view-binding)
- [Jetpack Compose 官方文档](https://developer.android.com/develop/ui/compose)