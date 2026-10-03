---
title: PaperCoin 核心代码导读（下）：UI 层、动画与冒烟测试
published: 2026-10-03
description: 逐文件精读 PaperCoin 的 WPF UI 层，包括启动流程、主窗口导航与指示器动画、主题颜色运行时过渡、自定义开关控件、ViewModel 数据绑定、Views 交互动画，以及不依赖测试框架的 UI 冒烟测试方案。
tags: [WPF, C#, .NET, PaperCoin, 源码导读, UI, 动画, ViewModel, 测试]
category: 技术教程
image: ""
slug: papercoin-code-walkthrough-2
---

## 前言

上篇读完了 Core 层和 Service 层，这一篇聚焦 WPF UI 层——从 `App.OnStartup` 的启动流程，到 MainWindow 的导航与指示器动画，到自定义控件、ViewModel、Views 交互动画，最后到冒烟测试。

建议配合 [核心代码导读（上）](/posts/papercoin-code-walkthrough-1/) 一起看，上篇是"数据怎么存"，这篇是"数据怎么画"。

---

## 1. 启动流程详解

### 1.1 `App.xaml` —— 应用资源

```xml
<Application x:Class="PaperCoin.App" StartupUri="MainWindow.xaml">
    <Application.Resources>
        <ResourceDictionary>
            <ResourceDictionary.MergedDictionaries>
                <ResourceDictionary Source="/Themes/Dark.xaml"/>
                <ResourceDictionary Source="/Themes/Controls.xaml"/>
                <ResourceDictionary Source="/icon/TitleIcon.xaml"/>
                <!-- ... 更多图标字典 -->
            </ResourceDictionary.MergedDictionaries>
            <FontFamily x:Key="Iconfont">
                /PaperCoin;component/Icon/iconfont.ttf#iconfont
            </FontFamily>
        </ResourceDictionary>
    </Application.Resources>
</Application>
```

注意：`Dark.xaml` 只是编译期默认值。运行时按配置替换（`App.OnStartup` 里 `ApplyTheme`）。图标字体通过 pack URI 加载嵌入的 TTF。

合并字典顺序很重要：颜色字典（会被替换）→ 控件样式 → 图标资源。

---

### 1.2 `App.xaml.cs` —— 启动编排

#### 单实例守卫

```csharp
private static bool TryAcquireSingleInstance()
{
    var name = $"{Constants.AppName}-{Environment.UserName}";
    _singleInstance = new Mutex(initiallyOwned: true, name, out var createdNew);
    if (createdNew) return true;

    _singleInstance.Dispose();  // 释放自己这份句柄
    _singleInstance = null;
    return false;
}
```

互斥体名带用户名：同一台机器的多个会话（远程桌面）可以各开一份。注意 `_singleInstance` **必须是字段**而不是局部变量——Mutex 被 GC 回收时会一并释放，守卫随之失效。

非首个实例的行为：

```csharp
private static void ActivateExistingInstance()
{
    var other = Process.GetProcessesByName(Constants.AppName)
        .FirstOrDefault(p => p.Id != current);
    var handle = other?.MainWindowHandle ?? IntPtr.Zero;
    if (handle == IntPtr.Zero) return;

    ShowWindow(handle, SW_RESTORE);    // 先还原（最小化时 SetForegroundWindow 不生效）
    SetForegroundWindow(handle);       // 再拉到前台
}
```

两点关键：
1. 单实例检查**必须在 `base.OnStartup` 之前**——因为 `base.OnStartup` 会创建 `StartupUri` 指定的 `MainWindow`，窗口创建后再退出会闪一下。
2. 最小化状态下 `SetForegroundWindow` 不会还原窗口，必须先 `ShowWindow(handle, SW_RESTORE)`。

#### Serilog 配置

```csharp
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Debug()
    .WriteTo.Console()
    .WriteTo.File(
        Path.Combine(Constants.LogsFolder, Constants.LogFile),
        rollingInterval: RollingInterval.Day,
        retainedFileCountLimit: 7)
    .CreateLogger();
```

控制台 + 按天滚动文件，保留 7 份。

#### 启动顺序

```csharp
InstallLocation.Record();              // ① 记下安装位置，供升级识别
ShortcutRepair.RepairDesktopShortcut(); // ② 修正快捷方式图标

var configService = new ConfigService();        // ③ 读配置
var themeManager = new ThemeManager(configService); // ④ 解析主题
ApplyTheme(themeManager.Resolved);             // ⑤ 替换颜色字典

HookSystemTheme(themeManager);                 // ⑥ 挂系统主题监听
```

主题**必须在 MainWindow 创建之前**应用（MainWindow 由 `base.OnStartup` 的 `StartupUri` 创建，在 `ApplyTheme` 之前窗口已存在但尚未渲染）。`HookSystemTheme` 监听两方面：应用内切换触发颜色过渡、系统主题变更触发重新解析。

#### DI 容器

```csharp
var services = new ServiceCollection();
services.AddSingleton(configService);
services.AddSingleton(themeManager);
services.AddSingleton<BillRepository>();       // 单例，避免重复构建索引
services.AddTransient<TodayBillViewModel>();    // 瞬时，每次导航新建
services.AddTransient<CalenderBillViewModel>();
services.AddTransient<SettingsViewModel>();
Services = services.BuildServiceProvider();
```

`BillRepository` 单例——因为内存索引很重，每个实例都去遍历磁盘构建一遍浪费性能。三个 ViewModel 瞬时——每次导航拿新实例，不保留上次状态。

---

## 2. MainWindow —— 主窗口与导航

### 2.1 布局结构

```xml
<Window WindowStyle="None" AllowsTransparency="True"
        ResizeMode="CanResize" Background="Transparent">
    <shell:WindowChrome.WindowChrome>
        <shell:WindowChrome GlassFrameThickness="0" ResizeBorderThickness="5"
                            CaptionHeight="0" UseAeroCaptionButtons="False"
                            CornerRadius="5"/>
    </shell:WindowChrome.WindowChrome>
```

无边框窗口（`WindowStyle="None"` + `AllowsTransparency="True"`），自绘标题栏。`WindowChrome` 保留系统功能（拖拽、缩放、阴影）。`GlassFrameThickness="0"` 禁用玻璃框，`CornerRadius="5"` 圆角。

外层 Grid 留 6px 外边距给阴影：

```
┌──────────────────────────────────────┐
│ 标题栏 32px (ColorTitleTop)           │
├────────┬─────────────────────────────┤
│ 侧边栏  │ 主内容区                      │
│ 50px   │ (页面切换区)                  │
│        │                             │
└────────┴─────────────────────────────┘
```

### 2.2 侧边栏指示器动画

指示器是一个 `Border`（`SideBarActiveShape`），放在导航按钮的下层（`Panel.ZIndex="0"`）。位置通过 `TranslateTransform.Y` 控制（相对底端的负向偏移）。

定位公式：

```csharp
double target = buttonCenter - navHeight + indicatorHeight / 2 + 4;
```

用按钮自身布局计算，不硬编码像素——窗口缩放时自动适应。

过渡动画：

```csharp
LA.Builder(IndicatorAnimationName)
    .Ease(Easing.InOutCubic)
    .Move(SideBarActiveShapeTranslateTransform, 0, target, 240)  // 移动 240ms
    .Scale(SideBarActiveShapeScaleTransform, 0.92, 80)            // 先压缩
    .Then()
    .Scale(SideBarActiveShapeScaleTransform, 1.05, 80)            // 再膨胀
    .Then()
    .Scale(SideBarActiveShapeScaleTransform, 1.0, 40)             // 最后归位
    .Play();
```

用绝对目标而非相对位移，重复调用不累积误差。先 `LAEngine.Stop` 停掉旧动画，避免两条动画同时写同一个 Y。

### 2.3 页面导航

```csharp
private void NavigateTo(string pageName)
{
    UserControl? page = pageName switch
    {
        "TodayBill" => GetOrCreatePage("TodayBill", () => new TodayBill()),
        "CalenderBill" => GetOrCreatePage("CalenderBill", () => new CalenderBill()),
        "Settings" => GetOrCreatePage("Settings", () => new Settings()),
        _ => null
    };
    if (page is null) return;
    UpdatePageDataContext(page, pageName);
    MainContentArea.Child = page;
}
```

页面实例缓存（`_pageCache`），切换不重建。但每次导航都从 DI 取**新的 ViewModel**（`UpdatePageDataContext`），所以页面状态不跨导航保留——切走再回来是全新的。

---

## 3. `ThemeRenderer.cs` —— 运行时主题过渡

这是整个主题系统最精妙的地方。

**核心难点**：WPF 的 `DynamicResource` 会把解析结果缓存到依赖属性上，只有原 `ResourceDictionary` 实例发出内容变更通知时才重新解析。因此**运行时不能替换字典实例，必须改写原实例的内容**。

```csharp
public static void Apply(string theme)
{
    var target = merged[index];      // 原字典实例（不动它）
    var incoming = LoadTheme(theme); // 新主题临时字典

    foreach (var key in incoming.Keys)
        target[key] = Transitional(target, key, incoming[key]);

    // 新主题删掉的 key 必须一并移除
    foreach (var stale in target.Keys.Cast<object>()
        .Where(k => !incoming.Contains(k)).ToList())
        target.Remove(stale);
}
```

#### 颜色过渡动画

```csharp
private static object Transitional(ResourceDictionary current, object key, object incoming)
{
    if (incoming is not SolidColorBrush to) return incoming;
    if (current[key] is not SolidColorBrush from) return incoming;

    // 基准值必须是目标值：动画用 FillBehavior.Stop，跑完会落回基准值
    var brush = new SolidColorBrush(to.Color) { Opacity = to.Opacity };

    if (from.Color != to.Color)
        brush.BeginAnimation(SolidColorBrush.ColorProperty,
            Animate(from.Color, to.Color));
    if (from.Opacity != to.Opacity)
        brush.BeginAnimation(SolidColorBrush.OpacityProperty,
            Animate(from.Opacity, to.Opacity));

    return brush;
}
```

关键技巧：`ResourceDictionary` 会冻结装进去的 `Freezable`，所以没法原地改已有画刷的颜色。这里**造一个新画刷**，在放进字典之前挂好动画。带活动动画的 Freezable 不可冻结，字典的冻结尝试会静默失败，画刷因此保持可变。DynamicResource 消费者拿到的就是这些实例，整片界面跟着一起过渡。

过渡时长 300ms，比页面内交互动效（100~200ms）稍长——主题切换是全局变化，太快会读成"闪一下"。

---

## 4. 自定义控件与值转换器

### 4.1 `SwitchToggle` —— 自定义开关控件

这是一个带补间动画的开关，用于设置页的"开机自启"和"自动更新"。

#### 样式设计

两层滑轨叠加：
- 底层：`ColorCardActionBackground`（关态颜色）
- 上层 `OnLayer`：`ColorAddNewBillBtn`（开态颜色，`Opacity="0"`）

切换时只动画上层 Opacity。为什么不对 `Background.Color` 做 `ColorAnimation`？属性一旦跑过 `ColorAnimation` 就进入本地动画值优先级，DynamicResource 无法再更新该属性——主题切换后控件颜色永远不变。

#### 受控开关

```csharp
private void Toggle()
{
    var command = Command;
    if (command?.CanExecute(CommandParameter) == true)
        command.Execute(CommandParameter);
}
```

**只发出命令，不自己改 `IsOn`**。开关是受控的，状态属于 ViewModel。控件先行翻转会在命令执行失败时留下错误的视觉状态。

```csharp
private static void OnIsOnChanged(DependencyObject d, ...)
{
    if (d is SwitchToggle toggle)
        toggle.ApplyState(animate: toggle.IsLoaded);
}
```

`animate: toggle.IsLoaded`——初次加载不播动画，否则界面打开时所有开关都会滑动一次。

#### 动画细节

滑块位移带 `OutBack` 轻微回弹，滑轨高亮用 `OutCubic` 淡入。两者独立播放，不互相等待。

### 4.2 `HoverSlackConverter.cs` —— 悬浮留白计算

**作用**：列表卡片悬浮放大（1.02x）时，溢出部分会被外层 `ScrollViewer` 裁掉。因此需要按视口宽度预留左右留白。

公式：单边留白 = `W × (s − 1) / 2`，其中 W 为视口宽、s 为放大倍数。

`value` 是 `ScrollViewer.ActualWidth`（通过绑定传入），`parameter` 是悬浮缩放峰值。固定像素在窗口缩放后会失效，所以必须按宽度现算。

---

## 5. ViewModels

### 5.1 `UiThread.cs` —— UI 线程编组

```csharp
internal static class UiThread
{
    public static Task RunAsync(Func<Task> operation)
    {
        var dispatcher = Application.Current?.Dispatcher;
        if (dispatcher is null || dispatcher.CheckAccess())
            return operation();  // 已在 UI 线程或无 Application（单测），直接执行
        return dispatcher.InvokeAsync(operation).Task.Unwrap();
    }
}
```

把异步操作编组回 UI 线程。没有 `Application` 时（纯单测场景）直接执行。

### 5.2 `BillEditorViewModel.cs` —— 新增/编辑浮层面板

今日页和日历页各持有一个实例，面板外观与开合动画由 `BillEditorOverlay` 提供。

#### 草稿字段设计

```csharp
private string _draftAmountText = "";   // 用户输入量（字符串）
private DateTime? _draftDate = DateTime.Today;  // DateTime?，对接 DatePicker
```

金额用字符串而非 `decimal`：用户输入 `-`、`12.` 中间态时，`decimal` 绑定转换会失败。用字符串 + `Validate()` 统一判定。

日期用 `DateTime?` 而非 `DateOnly?`：WPF `DatePicker.SelectedDate` 是 `DateTime?`，省掉值转换器。

#### 保存逻辑

```csharp
private async void Commit()
{
    if (HasError) return;

    var entry = _editingEntry;
    if (entry is null)
        entry = new BillEntry { ... };  // 新增模式
    else
    {
        // 就地改字段：替换集合元素会重建行容器并丢掉选中/焦点状态
        entry.Description = description;
        entry.Amount = amount;
        entry.Category = category;
        entry.Date = date;
    }
    // ...
}
```

编辑时**就地改字段**，不替换 `ObservableCollection` 中的元素——替换会导致 ItemsControl 重建行容器，丢失选中状态和焦点。

### 5.3 `TodayBillViewModel.cs` —— 今日账单页

#### 增量同步

```csharp
private void SyncEntries(IReadOnlyList<BillEntry> target)
{
    // 逆序删除：正序删会因下标位移漏掉元素
    for (int i = Entries.Count - 1; i >= 0; i--)
        if (!target.Any(t => t.Id == Entries[i].Id)) Entries.RemoveAt(i);

    // 正序插入/移动
    for (int i = 0; i < target.Count; i++)
    {
        var wanted = target[i];
        int existing = IndexOfId(wanted.Id);
        if (existing < 0) Entries.Insert(Math.Min(i, Entries.Count), wanted);
        else if (existing != i && existing > i) Entries.Move(existing, i);
    }
}
```

对比 Id 做增量更新，避免 `Clear()` + 重新 `Add()` 的 `Reset` 闪烁。逆序删除是因为正序删会导致下标位移漏掉元素。

#### 删除空日

```csharp
if (Entries.Count == 0)
{
    // SaveAsync(空集合) 不产生分组写入，磁盘文件不会被删
    if (!await _repository.DeleteDayAsync(Today))
        Notice = "删除失败，请检查磁盘权限或空间";
    return;
}
await _repository.SaveAsync(Entries);
```

删到零条时，调用方必须显式 `DeleteDayAsync`——`SaveAsync` 接收空集合时不产生分组写入（按日期分组得到空字典），磁盘文件不会被删。

### 5.4 `CalenderBillViewModel.cs` —— 日历页

日/月/年三种粒度共用同一套翻页逻辑：

```csharp
private void Shift(int direction)
{
    _anchor = Mode switch
    {
        CalendarViewMode.Day => _anchor.AddDays(direction),
        CalendarViewMode.Month => _anchor.AddMonths(direction),
        _ => _anchor.AddYears(direction)
    };
}
```

月视图固定 6×7=42 格，不随月份实际天数变化——否则翻月时整页高度会跳动。非本月格子不显示金额，只有空白或灰色。

---

## 6. Views —— 界面与交互动画

### 6.1 `CardListEntrance.cs` —— 列表卡片入场动效

```csharp
LA.Builder().Ease(Easing.OutCubic)
    .Delay(delay).Move(shift, 0, 0, DurationMs)   // 从下往上浮 14px，360ms
    .Delay(delay).Opacity(row, 1, DurationMs)      // 同时淡入
    .Play();
```

每张卡片上浮 + 淡入，相邻两张错开 70ms，最多错开 8 档。`Delay` 只作用于紧接着的下一个动作。

### 6.2 `TodayBill.xaml.cs` —— 删除回流（FLIP 动画）

删除一条记录后，下面所有卡片会往上"回流"。实现的是一种简化的 FLIP（First, Last, Invert, Play）：

1. 删除前记下每张卡片的位置（`_slotsBeforeRemoval`）
2. `ObservableCollection` 移除元素 → 布局更新
3. `LayoutUpdated` 触发（新布局完成、但本帧还没渲染）
4. 把每张卡片通过 `TranslateTransform.Y` 摆回旧位置（跳变不可见）
5. 动画归零 → 卡片平滑滑到新位置

### 6.3 卡片悬浮交互

```csharp
// 悬浮放大到 1.02
LA.Builder().Ease(Easing.OutCubic).Scale(scale, 1.02, 100).Play();

// 按下压缩到 0.97
LA.Builder().Ease(Easing.InOutCubic)
    .Scale(scale, 0.97, 80)
    .Move(offset, 0, 1, 80).Play();

// 抬起回弹到 1.04 再落回 1.0
PlayQElastic(scale, 1.04, 300);
```

整个卡片都是编辑热区——点击触发编辑命令。但如果点的是卡片内部的删除按钮（通过原始源 `e.OriginalSource` 判断），不触发行按下动画。

### 6.4 `BillEditorOverlay.xaml.cs` —— 浮层编辑面板

```csharp
// 面板从下方 24px 滑入 + OutBack 回弹
LA.Builder().Ease(Easing.OutBack(1.4))
    .Move(EditorTranslate, 0, 0, PanelAnimationMs).Play();

// 遮罩淡入到 0.35，完成后焦点给描述框
LA.Builder().Ease(Easing.OutCubic)
    .Opacity(EditorScrim, 0.35, PanelAnimationMs)
    .OnComplete(() => { DescriptionBox.Focus(); }).Play();
```

快捷键：`Esc` 取消，`Ctrl+Enter` 保存。

### 6.5 `Settings.xaml.cs` —— 主题事件订阅

```csharp
private void OnLoaded(object sender, RoutedEventArgs e)
{
    _themeManager.ResolvedThemeChanged += OnThemeResolved;
    _themeManager.SystemThemeChanged += OnSystemThemeChanged;
}

private void OnUnloaded(object sender, RoutedEventArgs e)
{
    _themeManager.ResolvedThemeChanged -= OnThemeResolved;
    _themeManager.SystemThemeChanged -= OnSystemThemeChanged;
}
```

`ThemeManager` 事件是强引用，订阅/退订放在 `Loaded`/`Unloaded`，避免 Transient ViewModel 被长期持有而无法 GC。

---

## 7. `tools/UiSmokeTest` —— UI 冒烟测试

这个测试项目的设计理念值得细说：**不引入测试框架，直接 `new` 出 View、量它的尺寸、驱动它的命令与事件**。需要验证的是真实布局、真实绑定和真实交互——这些是编译期看不出来的问题。

### 覆盖的 19 项检查

| # | 检查项 | 说明 |
|---|--------|------|
| 1 | 主题字典 key 对齐 | Dark.xaml 和 Bright.xaml 的 key 集合完全一致 |
| 2 | 图标码位校验 | 直接解析 TTF cmap 表，确认 XAML 引用的每个码位都存在 |
| 3 | 侧边栏指示器 | 随窗口尺寸正确重算 |
| 4 | TodayBill 布局 | + 号、编辑面板、遮罩、分类框、日期框存在且类型正确 |
| 5 | 保存链路 | 空草稿校验、跨日期、同日不覆盖、分类去重 |
| 6 | CalenderBill 布局 | 卡片悬浮动画已注册到容器 |
| 7 | Settings 布局 | 开关动画、下拉框存在 |
| 8 | 主题三模式 | System/Dark/Bright 解析正确 |
| 9 | 滚动条样式 | 纵向滚动条装饰样式存在 |
| 10 | 空状态动效 | 空状态提示有入场动效 |
| 11 | 连续保存串行 | 快速连续点保存不乱 |
| 12 | 卡片入场与删除回流 | 卡片列表有入场 + FLIP 删除动画 |
| 13 | 日历明细入场 | 日历明细卡片有入场动画 |
| 14 | 日期选择器主题 | 跟着主题走 |
| 15 | 主题切换过渡 | 颜色有过渡动画 |
| 16 | 版本号 | 自有程序集版本与 `Directory.Build.props` 一致 |
| 17 | 安装位置记录 | 注册表写入正确 |
| 18 | 图标资源完整性 | View 引用的图标资源 key 都已定义 |
| 19 | 快捷方式修正 | 图标和目标都改对、操作幂等 |

### 关键测试技巧

- **LAE 动画验证**：本进程没有渲染循环，LAE 逐帧插值不推进。改用 `LAEngine.ActiveGroupCount` 计数——`Play()` 同步注册动画组，与渲染无关。
- **图标码位验证**：直接解析 TTF 的 cmap 表（Format 4/12），不经过 WPF 字体加载（测试环境会被挡掉）。
- **快捷方式修正测试**：特意把目标设成非本程序值，修完后验证目标必须是 `PaperCoin.exe`，绝不能变成图标文件路径（实测踩过的坑）。

---

## 总结

PaperCoin 是一个架构清晰、注释详尽的 WPF 桌面记账应用。核心设计亮点回顾：

1. **分层架构**：Core（领域模型）→ Service（持久化/配置/主题）→ PaperCoin（WPF UI），单向依赖。
2. **无数据库**：JSON 文件分日期目录存储，目录结构本身就是索引。
3. **MVVM + DI**：CommunityToolkit.Mvvm 提供源生成器，`Microsoft.Extensions.DependencyInjection` 管理服务生命周期。
4. **动画引擎 LAE**：所有过渡统一交给 LAE——侧边栏指示器、卡片悬浮/按下/入场、面板开合、主题颜色过渡。
5. **主题系统**：Dark/Bright 两本颜色字典 + `ThemeRenderer` 运行时原地替换（带 300ms 颜色过渡），支持跟随系统。
6. **工程细节**：单实例互斥体、安装位置注册表记录、快捷方式图标运行期修正、版本号单一来源。
7. **冒烟测试**：无框架，手工驱动真实 View，暴露编译期看不出来的问题。

> **回到导航页**：[PaperCoin 学习指南](/posts/papercoin-learning-guide/)