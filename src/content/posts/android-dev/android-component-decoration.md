---
title: Android 组件装饰：自定义 Drawable、Shape、Selector 与高级美化技巧
published: 2026-09-13
description: 全面讲解 Android 中装饰和美化 UI 组件的各种方法，涵盖 Shape Drawable、Layer List、Selector、Ripple 效果、自定义 View 背景、圆角与阴影、渐变色等实用技巧。
tags: [Android, UI, Drawable, Shape, Selector, 自定义View, 美化, 组件装饰]
category: Android
image: ""
slug: android-component-decoration
---

## 前言

原生 Android 的默认组件说好听叫"简洁"，说难听叫"朴素"。在产品设计中，一个好看的界面往往不依赖替换原生组件，而是靠**装饰**——给现有组件添加圆角、阴影、渐变、选中效果、水波纹等视觉细节。

Android 的 Drawable 体系为我们提供了极其强大的装饰能力：**无需引入任何图片资源**，纯 XML 就能绘制出丰富多彩的视觉效果。

本文将系统梳理 Android 组件装饰的各种技巧，让 UI 从"能用"进化为"好看"。

> [!NOTE]
> 本文同时涵盖传统 View 系统和 Jetpack Compose 的装饰方法，以适应不同技术栈的读者。

---

## 1. Drawable 体系速览

Android 的 Drawable 就像一个图形工具箱，不同子类负责不同的绘制：

| Drawable 类型 | XML 根标签 | 用途 |
|---|---|---|
| ColorDrawable | — | 纯色填充 |
| ShapeDrawable | `<shape>` | 几何形状（矩形、椭圆、线、环形） |
| GradientDrawable | `<shape>` + `<gradient>` | 渐变色 |
| StateListDrawable | `<selector>` | 根据按压/选中等状态切换外观 |
| LayerDrawable | `<layer-list>` | 多个 Drawable 叠加 |
| RippleDrawable | `<ripple>` | Material Design 水波纹 |
| InsetDrawable | `<inset>` | 内容内边距 |
| ClipDrawable | `<clip>` | 裁剪 |
| ScaleDrawable | `<scale>` | 缩放 |

---

## 2. Shape Drawable：最常用的形状绘制

### 2.1 基础形状

```xml
<!-- res/drawable/bg_round_blue.xml -->
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="rectangle">

    <!-- 填充色 -->
    <solid android:color="#2196F3" />

    <!-- 圆角（全部 12dp） -->
    <corners android:radius="12dp" />

    <!-- 边框 -->
    <stroke
        android:width="2dp"
        android:color="#1976D2" />

    <!-- 内边距 -->
    <padding
        android:left="16dp"
        android:right="16dp"
        android:top="12dp"
        android:bottom="12dp" />

    <!-- 尺寸 -->
    <size
        android:width="200dp"
        android:height="48dp" />

</shape>
```

### 2.2 单独控制每个圆角

```xml
<!-- res/drawable/bg_top_rounded.xml -->
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="rectangle">

    <solid android:color="#FFFFFF" />

    <corners
        android:topLeftRadius="16dp"
        android:topRightRadius="16dp"
        android:bottomLeftRadius="0dp"
        android:bottomRightRadius="0dp" />

</shape>
```

### 2.3 椭圆形与环形

```xml
<!-- 椭圆形 -->
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="oval">
    <solid android:color="#E91E63" />
    <size android:width="64dp" android:height="64dp" />
</shape>

<!-- 环形（进度条背景） -->
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="ring"
    android:innerRadiusRatio="3"
    android:thicknessRatio="8"
    android:useLevel="false">
    <solid android:color="#E0E0E0" />
</shape>

<!-- 分隔线 -->
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="line">
    <stroke
        android:width="0.5dp"
        android:color="#E0E0E0" />
    <size android:height="0.5dp" />
</shape>
```

---

## 3. 渐变（Gradient）：告别纯色

```xml
<!-- res/drawable/bg_gradient_horizontal.xml -->
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="rectangle">

    <gradient
        android:type="linear"
        android:angle="0"
        android:startColor="#FF6B6B"
        android:centerColor="#FF8E53"
        android:endColor="#FFC371" />

    <corners android:radius="12dp" />

</shape>

<!-- 径向渐变 -->
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="rectangle">

    <gradient
        android:type="radial"
        android:gradientRadius="200dp"
        android:centerX="0.5"
        android:centerY="0.5"
        android:startColor="#667eea"
        android:endColor="#764ba2" />

</shape>

<!-- 扫描渐变 -->
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="rectangle">

    <gradient
        android:type="sweep"
        android:centerX="0.5"
        android:centerY="0.5"
        android:startColor="#FF0080"
        android:centerColor="#7928CA"
        android:endColor="#FF0080" />

</shape>
```

三种渐变类型对比：

| 类型 | `android:type` | 方向控制 | 视觉效果 |
|------|:---:|------|------|
| 线性渐变 | `linear` | `android:angle`（0/90/180/270） | 直线方向过渡 |
| 径向渐变 | `radial` | `centerX` + `centerY` + `gradientRadius` | 从中心向外扩散 |
| 扫描渐变 | `sweep` | `centerX` + `centerY` | 围绕中心旋转 |

---

## 4. Selector：让按钮"活"起来

Selector（StateListDrawable）是让静态 UI 变得有交互感的利器。

### 4.1 按压反馈

```xml
<!-- res/drawable/btn_primary_selector.xml -->
<selector xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- 按下状态 -->
    <item android:state_pressed="true">
        <shape android:shape="rectangle">
            <solid android:color="#1565C0" />
            <corners android:radius="8dp" />
        </shape>
    </item>

    <!-- 禁用状态 -->
    <item android:state_enabled="false">
        <shape android:shape="rectangle">
            <solid android:color="#BDBDBD" />
            <corners android:radius="8dp" />
        </shape>
    </item>

    <!-- 默认状态 -->
    <item>
        <shape android:shape="rectangle">
            <solid android:color="#1976D2" />
            <corners android:radius="8dp" />
        </shape>
    </item>

</selector>
```

### 4.2 选中高亮

```xml
<!-- res/drawable/tab_item_selector.xml -->
<selector xmlns:android="http://schemas.android.com/apk/res/android">

    <item android:state_selected="true">
        <shape android:shape="rectangle">
            <solid android:color="#E3F2FD" />
            <stroke
                android:width="0dp"
                android:color="#2196F3" />
        </shape>
    </item>

    <item>
        <shape android:shape="rectangle">
            <solid android:color="@android:color/transparent" />
        </shape>
    </item>

</selector>
```

### 4.3 结合 CheckBox / Switch

```xml
<!-- res/drawable/custom_checkbox_selector.xml -->
<selector xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:state_checked="true" android:drawable="@drawable/ic_check_filled" />
    <item android:state_checked="false" android:drawable="@drawable/ic_check_unfilled" />
</selector>
```

### 4.4 可用状态一览

Selector 支持的状态检查：

| XML 属性 | 说明 |
|------|------|
| `state_pressed` | 手指按下 |
| `state_focused` | 获取焦点 |
| `state_selected` | 被选中 |
| `state_checked` | 勾选状态（CheckBox/Switch） |
| `state_enabled` | 是否可用 |
| `state_activated` | 激活状态（列表项） |
| `state_hovered` | 鼠标悬停（TV/平板） |

---

## 5. Layer List：叠出来的效果

Layer List 可以将多个 Drawable 叠加在一起，实现阴影、描边、遮罩等效果。

### 5.1 卡片阴影

```xml
<!-- res/drawable/bg_card_with_shadow.xml -->
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- 底层：阴影（偏移 + 模糊感） -->
    <item
        android:left="2dp"
        android:top="4dp"
        android:right="2dp"
        android:bottom="0dp">
        <shape android:shape="rectangle">
            <solid android:color="#1A000000" />
            <corners android:radius="12dp" />
        </shape>
    </item>

    <!-- 上层：卡片主体 -->
    <item
        android:left="0dp"
        android:top="0dp"
        android:right="4dp"
        android:bottom="4dp">
        <shape android:shape="rectangle">
            <solid android:color="#FFFFFF" />
            <corners android:radius="12dp" />
        </shape>
    </item>

</layer-list>
```

> [!WARNING]
> Layer List 模拟的阴影是"假阴影"——它是通过偏移一个半透明矩形来实现的，`elevation` 才是真正的 Material Design 阴影。在 Android 5.0+ 上推荐使用 `elevation`。

### 5.2 带底部装饰条的背景

```xml
<!-- res/drawable/bg_with_bottom_stripe.xml -->
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">

    <item>
        <shape android:shape="rectangle">
            <solid android:color="#FFFFFF" />
            <corners
                android:topLeftRadius="12dp"
                android:topRightRadius="12dp" />
        </shape>
    </item>

    <!-- 底部彩色装饰条 -->
    <item
        android:gravity="bottom"
        android:height="4dp">
        <shape android:shape="rectangle">
            <solid android:color="#2196F3" />
        </shape>
    </item>

</layer-list>
```

---

## 6. Elevation 与真正阴影（Android 5.0+）

Material Design 的 `elevation` 属性是系统级的 z 轴高度，比 Layer List 方案更自然。

### 6.1 XML 中使用

```xml
<View
    android:layout_width="200dp"
    android:layout_height="100dp"
    android:background="@drawable/bg_white_rounded"
    android:elevation="8dp" />

<!-- 使用 OutlineProvider 自适应阴影 -->
<TextView
    android:layout_width="wrap_content"
    android:layout_height="wrap_content"
    android:background="@drawable/bg_blue_rounded"
    android:elevation="4dp"
    android:outlineProvider="background" />
```

### 6.2 动态设置

```kotlin
// 动态设置 elevation
view.elevation = 8f.dpToPx(context)

// 让阴影随按压变化
view.setOnTouchListener { v, event ->
    when (event.action) {
        MotionEvent.ACTION_DOWN -> v.elevation = 2f.dpToPx(context)
        MotionEvent.ACTION_UP,
        MotionEvent.ACTION_CANCEL -> v.elevation = 8f.dpToPx(context)
    }
    false
}
```

### 6.3 自定义阴影颜色

```kotlin
// Android P (API 28) 起支持自定义阴影颜色
view.outlineAmbientShadowColor = Color.parseColor("#33000000")
view.outlineSpotShadowColor = Color.parseColor("#66000000")
```

---

## 7. Ripple Drawable：Material 水波纹

Ripple 是 Material Design 的核心触感反馈，Android 5.0+ 原生支持。

### 7.1 基础水波纹

```xml
<!-- res/drawable/ripple_blue.xml -->
<ripple xmlns:android="http://schemas.android.com/apk/res/android"
    android:color="#332196F3">

    <!-- 水波纹下方的默认背景 -->
    <item android:drawable="@color/white" />

</ripple>
```

### 7.2 有边界的水波纹（带圆角）

```xml
<!-- res/drawable/ripple_rounded.xml -->
<ripple xmlns:android="http://schemas.android.com/apk/res/android"
    android:color="#42000000">

    <item>
        <shape android:shape="rectangle">
            <solid android:color="#2196F3" />
            <corners android:radius="8dp" />
        </shape>
    </item>

</ripple>
```

### 7.3 无边界水波纹（从触摸点扩散）

```xml
<!-- res/drawable/ripple_unbounded.xml -->
<ripple xmlns:android="http://schemas.android.com/apk/res/android"
    android:color="#42000000" />
```

### 7.4 Ripple 遮盖层

```xml
<!-- res/drawable/ripple_with_mask.xml -->
<ripple xmlns:android="http://schemas.android.com/apk/res/android"
    android:color="#42000000">

    <!-- 遮盖层（mask）：限制水波纹范围 -->
    <item
        android:id="@android:id/mask"
        android:drawable="@drawable/bg_circle" />

</ripple>
```

---

## 8. 圆形图片与头像

### 8.1 传统 View 方案：CircleImageView

```xml
<!-- 使用第三方库或自定义 View -->
<de.hdodenhof.circleimageview.CircleImageView
    android:layout_width="64dp"
    android:layout_height="64dp"
    android:src="@drawable/avatar"
    app:civ_border_width="3dp"
    app:civ_border_color="#FFFFFF" />
```

### 8.2 使用 ShapeableImageView（Material Components）

```xml
<com.google.android.material.imageview.ShapeableImageView
    android:layout_width="64dp"
    android:layout_height="64dp"
    android:src="@drawable/avatar"
    app:strokeWidth="3dp"
    app:strokeColor="#FFFFFF"
    app:shapeAppearanceOverlay="@style/CircleShapeAppearance" />

<!-- res/values/styles.xml -->
<style name="CircleShapeAppearance">
    <item name="cornerFamily">rounded</item>
    <item name="cornerSize">50%</item>
</style>
```

### 8.3 代码中裁剪为圆形

```kotlin
fun createCircleDrawable(context: Context, color: Int, sizeDp: Int): Drawable {
    val size = TypedValue.applyDimension(
        TypedValue.COMPLEX_UNIT_DIP,
        sizeDp.toFloat(),
        context.resources.displayMetrics
    ).toInt()

    return GradientDrawable().apply {
        setColor(color)
        shape = GradientDrawable.OVAL
        setSize(size, size)
    }
}

// 圆形头像
val avatarDrawable = createCircleDrawable(context, Color.parseColor("#2196F3"), 48)
imageView.setImageDrawable(avatarDrawable)
```

### 8.4 圆角图片

```kotlin
import android.graphics.Outline
import android.view.View
import android.view.ViewOutlineProvider

fun View.clipToRoundedCorners(radiusDp: Float) {
    val radius = radiusDp * resources.displayMetrics.density
    outlineProvider = object : ViewOutlineProvider() {
        override fun getOutline(view: View, outline: Outline) {
            outline.setRoundRect(0, 0, view.width, view.height, radius)
        }
    }
    clipToOutline = true
}

// 使用
imageView.clipToRoundedCorners(12f)
```

---

## 9. 渐变进度条

```xml
<!-- res/drawable/custom_progress_horizontal.xml -->
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- 背景 -->
    <item android:id="@android:id/background">
        <shape android:shape="rectangle">
            <solid android:color="#E0E0E0" />
            <corners android:radius="6dp" />
        </shape>
    </item>

    <!-- 进度 -->
    <item android:id="@android:id/progress">
        <clip>
            <shape android:shape="rectangle">
                <gradient
                    android:type="linear"
                    android:angle="0"
                    android:startColor="#667eea"
                    android:endColor="#764ba2" />
                <corners android:radius="6dp" />
            </shape>
        </clip>
    </item>

</layer-list>
```

```xml
<ProgressBar
    android:id="@+id/progressBar"
    style="@style/Widget.AppCompat.ProgressBar.Horizontal"
    android:layout_width="match_parent"
    android:layout_height="12dp"
    android:progress="75"
    android:progressDrawable="@drawable/custom_progress_horizontal"
    android:max="100" />
```

---

## 10. 虚线边框

```xml
<!-- res/drawable/dashed_border.xml -->
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="rectangle">

    <stroke
        android:width="2dp"
        android:color="#BDBDBD"
        android:dashWidth="8dp"
        android:dashGap="4dp" />

    <solid android:color="@android:color/transparent" />

    <corners android:radius="8dp" />

</shape>
```

---

## 11. 在 Compose 中的装饰

如果你在使用 Jetpack Compose，装饰组件的方式完全不同——一切都在 Composable 的 Modifier 和参数中。

### 11.1 圆角、边框与背景

```kotlin
@Composable
fun DecoratedCard() {
    Box(
        modifier = Modifier
            .size(200.dp, 100.dp)
            .background(
                color = Color.White,
                shape = RoundedCornerShape(16.dp)
            )
            .border(
                width = 2.dp,
                brush = Brush.horizontalGradient(
                    colors = listOf(Color(0xFF667eea), Color(0xFF764ba2))
                ),
                shape = RoundedCornerShape(16.dp)
            )
            .shadow(
                elevation = 8.dp,
                shape = RoundedCornerShape(16.dp),
                clip = false
            ),
        contentAlignment = Alignment.Center
    ) {
        Text("装饰后的组件", fontWeight = FontWeight.Bold)
    }
}
```

### 11.2 渐变文字

```kotlin
@Composable
fun GradientText(text: String) {
    val brush = Brush.horizontalGradient(
        colors = listOf(
            Color(0xFFFF6B6B),
            Color(0xFFFFC371)
        )
    )

    Text(
        text = text,
        style = TextStyle(
            brush = brush,
            fontSize = 24.sp,
            fontWeight = FontWeight.Bold
        )
    )
}
```

### 11.3 圆形裁剪图片

```kotlin
@Composable
fun CircularAvatar(
    imageUrl: String,
    modifier: Modifier = Modifier,
    size: Dp = 64.dp,
    borderWidth: Dp = 3.dp
) {
    AsyncImage(
        model = imageUrl,
        contentDescription = "头像",
        modifier = modifier
            .size(size)
            .clip(CircleShape)
            .border(borderWidth, Color.White, CircleShape),
        contentScale = ContentScale.Crop
    )
}
```

### 11.4 水波纹按压效果

```kotlin
@Composable
fun RippleButton(onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(12.dp))
            .background(Color(0xFF2196F3))
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = rememberRipple(
                    bounded = true,
                    color = Color.White.copy(alpha = 0.4f)
                ),
                onClick = onClick
            )
            .padding(horizontal = 24.dp, vertical = 12.dp),
        contentAlignment = Alignment.Center
    ) {
        Text("点击按钮", color = Color.White, fontWeight = FontWeight.Bold)
    }
}
```

### 11.5 Compose 自定义 Modifier

```kotlin
// 自定义修饰符：底部渐变阴影指示器
fun Modifier.bottomGradientIndicator(colors: List<Color>): Modifier = this.then(
    Modifier.drawBehind {
        val gradient = Brush.horizontalGradient(colors)
        drawRoundRect(
            brush = gradient,
            topLeft = Offset(0f, size.height - 4.dp.toPx()),
            size = Size(size.width, 4.dp.toPx()),
            cornerRadius = CornerRadius(4.dp.toPx() / 2, 4.dp.toPx() / 2)
        )
    }
)
```

---

## 12. 装饰的层级决策

面对一个需要装饰的组件，按以下优先级选择方案：

```
需要什么效果？
│
├── 简单圆角/颜色 → Shape Drawable（XML）
│
├── 按压/选中状态反馈 → Selector + Shape
│
├── 多层叠加效果 → Layer List
│
├── 水波纹 → Ripple Drawable
│
├── 阴影/立体感 → elevation（5.0+）
│
├── 渐变/纹理 → <gradient> 或代码绘制
│
├── 图片变形/裁剪 → ShapeableImageView / clipToOutline
│
└── 高度自定义 → 自定义 View + onDraw()
```

---

## 13. 常用 UI 装饰速查表

| 效果 | 实现方式 | 最低 API |
|------|----------|:---:|
| 圆角背景 | `<shape>` + `<corners>` | 1 |
| 边框描边 | `<shape>` + `<stroke>` | 1 |
| 渐变背景 | `<shape>` + `<gradient>` | 1 |
| 按钮按压变暗 | `<selector>` + `<shape>` | 1 |
| Tab 选中高亮 | `<selector>` + `state_selected` | 1 |
| 阴影 | `elevation` | 21 |
| 阴影（兼容低版本） | `<layer-list>` 偏移叠加 | 1 |
| 水波纹 | `<ripple>` | 21 |
| 圆形头像 | CircleImageView / ShapeableImageView | — |
| 圆角图片 | `clipToOutline` + `ViewOutlineProvider` | 21 |
| 虚线边框 | `<stroke>` + `dashWidth` / `dashGap` | 1 |
| 渐变进度条 | `<clip>` + `<gradient>` | 1 |

---

## 结语

Android 的 Drawable 体系是 UI 装饰的瑞士军刀。掌握 Shape、Selector、Ripple、Layer List 这几大工具后，绝大多数 UI 美化需求都不需要引入第三方库，也无需切图——**纯 XML 就能解决**。

如果你已迁移到 Jetpack Compose，装饰则更多地体现为 Modifier 链的组合和 brush/shape 参数的灵活运用，同样的思想，不同的写法。

> 最后一条建议：UI 装饰要克制。过多的阴影、渐变和圆角叠加在一起，反而会让界面显得"油腻"。好的设计是「刚刚好的装饰」。

---

## 参考资料

- [Android Drawable Resources 官方文档](https://developer.android.com/guide/topics/resources/drawable-resource)
- [Material Design Components](https://github.com/material-components/material-components-android)
- [Jetpack Compose Modifier 文档](https://developer.android.com/jetpack/compose/modifiers)