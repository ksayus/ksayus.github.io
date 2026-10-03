---
title: PaperCoin 项目架构详解：从启动到存盘的三层设计
published: 2026-10-03
description: 深入解析 PaperCoin WPF 记账应用的三层架构设计，包括 Core（领域模型）/Service（持久化与配置）/WPF UI 各层职责、一次启动的完整流程、DI 容器配置，以及数据从界面到磁盘的完整路径。
tags: [WPF, C#, .NET, 架构, PaperCoin, 分层设计, MVVM, DI]
category: 技术教程
image: ""
slug: papercoin-project-architecture
---

## 前言

看一个项目，最怕的就是"打开代码不知道该从哪看起"。本文的目标就是帮你建立 PaperCoin 项目的**全局心智地图**——看懂它分了几层、每层干什么、一次启动经历了什么、用户记一笔账数据怎么到磁盘。

读完这一篇，你打开代码就不会迷路。

> [!NOTE]
> 如果你不熟悉 WPF 或 MVVM 的基本概念，建议先了解 View/ViewModel/Model 三者关系、数据绑定和命令（ICommand）。本文会解释项目特有的设计决策，但不会从零讲 WPF 基础。

---

## 1. 三层架构速览

整个解决方案包含 5 个项目，但真正需要关注的是 3 个核心项目，从「离磁盘最近」到「离用户最近」：

```
┌──────────────────────────────────────────────────────┐
│ PaperCoin (WPF 界面层)                                │
│ —— Views（XAML + 代码后置）、ViewModels、自定义控件     │
│ —— 主题渲染器、动画引擎、绑定与命令                     │
├──────────────────────────────────────────────────────┤
│ PaperCoin.Service（服务层）                           │
│ —— 账单持久化（BillRepository）                       │
│ —— 配置读写（ConfigService）                          │
│ —— 主题状态（ThemeManager）                           │
│ —— 安装位置、快捷方式修复                              │
├──────────────────────────────────────────────────────┤
│ PaperCoin.Core（领域模型层）                          │
│ —— BillEntry / BillDayFile / AppConfig（纯 POCO）     │
│ —— Constants（版本、路径常量）                         │
│ —— 不依赖 WPF，可跨平台编译（net10.0，不带 -windows）  │
└──────────────────────────────────────────────────────┘
```

**依赖方向是单向的**：`PaperCoin → Service → Core`。底层永远不认识上层。Core 层甚至是 `net10.0`（不带 `-windows`），理论上可以跨平台编译——因为领域模型不依赖任何 WPF 类型。

> 一句话记忆：**Core 管"数据长什么样"，Service 管"数据怎么存、配置怎么读"，PaperCoin 管"画出来 + 让用户操作"。**

---

## 2. 解决方案全景

| 项目 | 目标框架 | 作用 |
|------|----------|------|
| `PaperCoin.Core` | `net10.0` | 领域模型 + 常量。纯 C#，不依赖 WPF |
| `PaperCoin.Service` | `net10.0`（声明 `SupportedOSPlatform("windows")`） | 持久化、配置、主题、安装信息。读注册表，所以限 Windows |
| `PaperCoin` | `net10.0-windows` | WPF 主程序。界面、ViewModel、控件、动画 |
| `LivelyAnimationEngine` | — | 外部依赖：轻量动画引擎 |
| `PaperCoin.Setup` | — | VS 安装项目，生成 MSI 安装包。`dotnet build` 会跳过它 |

另外还有一个 `tools/UiSmokeTest` 冒烟测试项目，不在解决方案主构建中，但会通过 `InternalsVisibleTo` 访问 `MainWindow` 的内部成员做验证。

---

## 3. 目录地图（源码位置对照）

```
PaperCoin.Core/
├── Constants.cs              # 版本号、数据路径常量
├── Models/
│   ├── AppConfig.cs          # 配置 POCO
│   ├── BillInfo.cs           # BillEntry（核心领域模型）+ 预留类

PaperCoin.Service/
├── BillJsonManager.cs        # JSON 序列化辅助
├── BillRepository.cs         # 账单持久化与查询（最核心）
├── ConfigService.cs          # 配置读写
├── ThemeManager.cs           # 主题状态管理
├── InstallLocation.cs        # 安装位置注册表记录
├── ShortcutRepair.cs         # 快捷方式图标修正

PaperCoin/
├── App.xaml / App.xaml.cs    # 启动流程、DI 容器、单实例守卫
├── MainWindow.xaml / .cs     # 主窗口布局 + 导航 + 指示器动画
├── ThemeRenderer.cs          # 运行时主题颜色原地替换
├── Controls/
│   └── SwitchToggle.xaml / .cs  # 自定义开关控件
├── Converters/
│   ├── BoolToVisibility.cs   # 布尔 ↔ 可见性
│   └── HoverSlackConverter.cs # 悬浮留白计算
├── ViewModels/
│   ├── UiThread.cs           # UI 线程编组
│   ├── BillEditorViewModel.cs # 新增/编辑面板（共享）
│   ├── TodayBillViewModel.cs  # 今日账单
│   ├── CalenderBillViewModel.cs # 日历账单
│   └── SettingsViewModel.cs   # 设置页
├── Views/
│   ├── TodayBill.xaml / .cs   # 今日页 + 删除回流动画
│   ├── CalenderBill.xaml / .cs # 日历页
│   ├── BillEditorOverlay.xaml / .cs # 浮层编辑面板
│   └── Settings.xaml / .cs     # 设置页
├── Themes/
│   ├── Dark.xaml              # 暗色主题颜色字典
│   ├── Bright.xaml            # 亮色主题颜色字典
│   └── Controls.xaml          # 控件样式
└── Icon/                      # 图标资源（iconfont + XAML 几何）
```

---

## 4. 一次启动的完整流程

这是整个项目最重要的图，先看图再读代码：

```
用户双击 PaperCoin.exe
        │
        ▼
App.OnStartup 开始
        │
        ├─① TryAcquireSingleInstance()
        │     └─ 已有一个实例在跑 → 把旧窗口拉到前台 → Shutdown()
        │     └─ 第一个实例 → 继续
        │
        ├─② base.OnStartup(e) → 创建 MainWindow
        │     （此时 DynamicResource 开始解析，用的是默认 Dark.xaml）
        │
        ├─③ 配置 Serilog（控制台 + 滚动文件）
        │
        ├─④ InstallLocation.Record()
        │     └─ 写入 HKCU\Software\Ksayus\PaperCoin\InstallDir
        │
        ├─⑤ ShortcutRepair.RepairDesktopShortcut()
        │     └─ 修正快捷方式图标（MSI 工具链缺陷的补丁）
        │
        ├─⑥ 创建 ConfigService → 读 papercoin-settings.json
        │     └─ 不存在则用默认 AppConfig 生成一份
        │
        ├─⑦ 创建 ThemeManager → 从配置读主题模式
        │     └─ 解析为 Dark/Bright → ApplyTheme()
        │     └─ 替换 MergedDictionaries 中的颜色字典
        │
        ├─⑧ HookSystemTheme()
        │     └─ 监听 SystemEvents.UserPreferenceChanged（系统主题变更）
        │     └─ 监听 ThemeManager.ResolvedThemeChanged（应用内切换触发颜色过渡）
        │
        └─⑨ 构建 DI 容器
              ├─ ConfigService（单例）
              ├─ ThemeManager（单例）
              ├─ BillRepository（单例，避免重复构建索引）
              ├─ TodayBillViewModel（瞬时，每次导航新建）
              ├─ CalenderBillViewModel（瞬时）
              └─ SettingsViewModel（瞬时）
```

**两个关键时序问题**：

1. 单实例检查**必须在 `base.OnStartup` 之前**——因为 `base.OnStartup` 会创建 `StartupUri` 指定的 `MainWindow`，窗口创建后再退出会闪一下。
2. 主题**必须在 MainWindow 创建之前应用**——MainWindow 的 XAML 里到处都是 `{DynamicResource ...}`，如果不先替换颜色字典，这些资源会解析成默认的 Dark.xaml，之后再切主题会闪一下。

---

## 5. 一次"记一笔账"的完整数据流

```
用户在 TodayBill 页点击 + 号
        │
        ▼
AddCommand (RelayCommand)
        │   ① TodayBillViewModel 创建 BillEditorViewModel 实例
        ▼
BillEditorViewModel.OpenForCreate(date)
        │   ② 重置草稿字段、打开浮层面板（BillEditorOverlay）
        ▼
BillEditorOverlay 播放滑入动画 + 遮罩淡入
        │   ③ 面板出现、描述框获得焦点
        ▼
用户填写描述/金额/分类/日期，按 Ctrl+Enter
        │
        ▼
BillEditorViewModel.Commit()
        │   ④ Validate() 校验 → 构造 BillEntry
        │   ⑤ BillRepository.UpsertEntryAsync(entry)
        ▼
BillRepository（_writeGate 内）
        │   ⑥ MergeEntryIntoDayAsync：同 Id 覆盖、新 Id 追加
        │   ⑦ WriteDayAsync：整日 JSON 覆盖写
        │   ⑧ 更新内存索引 _index[date] = list
        ▼
BillEditorViewModel.Saved 回调
        │   ⑨ TodayBillViewModel.OnEntrySaved → ReloadTodayAsync
        ▼
TodayBillViewModel.SyncEntries()
        │   ⑩ 增量同步（对比 Id，逆序删、正序插/移），避免 Reset 闪烁
        ▼
ObservableCollection 通知 → ItemsControl 重排 → CardListEntrance 播放入场动画
```

**每个环节落在哪个文件**：

| 环节 | 文件 |
|------|------|
| ① 命令触发 | `TodayBillViewModel.cs` 的 `AddCommand` |
| ② 打开编辑面板 | `BillEditorViewModel.cs` 的 `OpenForCreate` |
| ③ 面板动画 | `BillEditorOverlay.xaml.cs` 的 `PlayOpen` |
| ④ 校验 | `BillEditorViewModel.cs` 的 `Validate` |
| ⑤ 持久化 | `BillRepository.cs` 的 `UpsertEntryAsync` |
| ⑥ 合并写入 | `BillRepository.cs` 的 `MergeEntryIntoDayAsync` |
| ⑦ JSON 写盘 | `BillRepository.cs` 的 `WriteDayAsync` |
| ⑧ 索引更新 | `BillRepository.cs` 的 `_index[date] = list` |
| ⑨ 回调刷新 | `TodayBillViewModel.cs` 的 `OnEntrySaved` |
| ⑩ 增量同步 | `TodayBillViewModel.cs` 的 `SyncEntries` |

---

## 6. 三个最核心的概念

### 6.1 `BillEntry` + `[ObservableProperty]` —— 既是数据，也是绑定源

```csharp
public partial class BillEntry : ObservableObject
{
    public Guid Id { get; set; } = Guid.NewGuid();

    [ObservableProperty]
    private string _description = "";

    [ObservableProperty]
    private decimal _amount;

    [ObservableProperty]
    private string? _category;

    [ObservableProperty]
    private DateOnly _date = DateOnly.FromDateTime(DateTime.Today);

    // 派生属性：界面直接绑定，amount/date 变化时自动通知
    public string DateText => Date.ToString("MM-dd");
    public string AmountText => Amount >= 0
        ? $"+{Amount:N2}"
        : $"-{Math.Abs(Amount):N2}";

    partial void OnAmountChanged(decimal value) => OnPropertyChanged(nameof(AmountText));
    partial void OnDateChanged(DateOnly value) => OnPropertyChanged(nameof(DateText));
}
```

关键设计点：
- `[ObservableProperty]` 源生成器自动生成 `Description`/`Amount`/`Category`/`Date` 属性和 `INotifyPropertyChanged` 通知。
- `Id` 是业务主键——更新与删除一律按 Id 定位，不依赖对象引用相等。
- `AmountText` 手动补正负号，不用 `N2` 格式串——因为 `N2` 对负数的输出受系统区域设置影响（某些区域会用括号替代负号）。
- `partial void OnXxxChanged` 钩子：当 `Amount`/`Date` 变化时，连带通知派生属性也变了。

### 6.2 `BillRepository` —— 无数据库的持久化方案

磁盘布局为 `Bills/yyyy/M/d/bills.json`。年/月/日本身就是路径，因此**没有独立索引文件**。

核心设计：

- **两把信号量**：`_gate` 保护内存索引构建（双重检查锁定），`_writeGate` 串行化所有写操作。
- **内存索引**：`Dictionary<DateOnly, List<BillEntry>>`，首次访问时遍历磁盘构建一次，之后常驻内存。
- **整日覆盖写**：单日文件是该日期的全部内容，覆盖是安全且幂等的。
- **Upsert 语义**：同 Id 覆盖、新 Id 追加，其余记录不动。
- **坏文件容错**：手工编辑出错、写入被中断——记日志并跳过，不抛出，避免一个坏文件让整月账单都看不见。

### 6.3 `ThemeRenderer` —— 运行时主题过渡

WPF 的 `DynamicResource` 会把解析结果缓存到依赖属性上，只认原 `ResourceDictionary` 实例。因此**运行时不能替换字典实例，必须改写原实例的内容**。

```csharp
public static void Apply(string theme)
{
    var target = merged[index];      // 原字典实例
    var incoming = LoadTheme(theme); // 新主题字典

    foreach (var key in incoming.Keys)
        target[key] = Transitional(target, key, incoming[key]);
    // ↑ 为每个颜色 key 创建过渡版本（带 ColorAnimation），原地替换
}
```

关键技巧：`ResourceDictionary` 会冻结装进去的 `Freezable`。这里**造一个新画刷**（带活动动画），在放进字典之前挂好动画。带活动动画的 Freezable 不可冻结，字典的冻结尝试会静默失败，画刷因此保持可变——DynamicResource 消费者拿到的就是这些实例，整片界面跟着一起过渡。

---

## 7. 依赖注入：谁来管 ViewModel 的命

DI 容器在 `App.OnStartup` 末尾构建：

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

**为什么 ViewModel 是 Transient 而不是 Singleton？**

每次用户点击侧边栏导航回到某个页面（比如从日历切回今日），`MainWindow.NavigateTo` 会从 DI 取**新的 ViewModel**：

```csharp
private void UpdatePageDataContext(UserControl page, string pageName)
{
    page.DataContext = pageName switch
    {
        "TodayBill" => App.Services.GetRequiredService<TodayBillViewModel>(),
        // ...
    };
}
```

这样每次导航都拿到干净的状态——不保留上次的选中项、滚动位置等。页面实例本身有缓存（`_pageCache`），但数据上下文是新的。

> `App.Services` 是全局服务定位器。注释明确说明它只在 MainWindow 页面切换中使用（那里没有构造注入入口），新代码优先用构造函数注入。

---

## 8. 两条铁律（改代码前先背下来）

1. **金额约定：正数为收入，负数为支出**。`AmountText` 手动补正负号，不用 `N2` 格式串。涉及金额的地方都遵循这一约定。
2. **写操作都在 `_writeGate` 信号量内串行**。`SaveAsync` 按日期分组 → 逐一写文件 → 更新索引，这个过程内不能有另一个写操作同时落在同一个文件上。删除与写入撞在一起时，写可能把刚删掉的记录写回来。

---

## 9. 接下来看什么

架构全貌已经有了。下一篇开始逐行精读源码：

- **[核心代码导读（上）](/posts/papercoin-code-walkthrough-1/)** —— Core 层的领域模型与常量 + Service 层的持久化、配置、主题管理。
- **[核心代码导读（下）](/posts/papercoin-code-walkthrough-2/)** —— UI 层的启动流程、主窗口、自定义控件、ViewModel、Views 交互动画、冒烟测试。