---
title: PaperCoin 核心代码导读（上）：领域模型、持久化与主题
published: 2026-10-03
description: 逐文件精读 PaperCoin 的 Core 层（领域模型、常量）和 Service 层（持久化、配置读写、主题管理、安装位置），深入理解无数据库 JSON 文件存储、内存索引构建、主题三模式解析等核心设计。
tags: [WPF, C#, .NET, PaperCoin, 源码导读, Core, Service, 持久化, 主题]
category: 技术教程
image: ""
slug: papercoin-code-walkthrough-1
---

## 前言

上一篇讲了架构全貌，这一篇我们**打开源码，逐行精读** Core 层和 Service 层。

建议配合 [项目架构详解](/posts/papercoin-project-architecture/) 一起看，先有全局心智地图再看细节，不容易迷失。

---

## 1. Core 层：领域模型与常量

Core 层是整个项目的最底层，目标框架是 `net10.0`（不带 `-windows`），不依赖 WPF，理论上可跨平台编译。

---

### 1.1 `Constants.cs` —— 版本的唯一真相

```csharp
public static class Constants
{
    public const string AppName = "PaperCoin";

    public static readonly string AppVersion =
        typeof(Constants).Assembly.GetName().Version?.ToString(3) ?? "0.0.0";
```

`AppVersion` 从程序集版本读取，而不是写字面量。程序集版本来自 `Directory.Build.props` 的 `<Version>` 标签——那是整个解决方案的**版本单一来源**。

为什么要这样做？MSI 安装包覆盖文件时比较的是文件版本，新版本必须严格大于已安装版本，相等就跳过更新。如果版本写死为字面量而程序集版本没同步改，就会出现"配置说升级了但 MSI 不更新文件"的情况。历史上 Core 和 Service 没设版本（都是 `1.0.0.0`），升级后旧的 `Service.dll` 留在安装目录，新主程序调用它不存在的方法，一按 + 号就崩溃。

`ToString(3)` 取前三位（主版本.次版本.修订版本），忽略第 4 位。

```csharp
    public static readonly string AppDataFolder =
        Path.Combine(Environment.CurrentDirectory, "PaperCoin");
    public static readonly string ConfigFolder =
        Path.Combine(AppDataFolder, "Config");
    public static readonly string LogsFolder =
        Path.Combine(AppDataFolder, "Logs");
    public static readonly string BillFolder =
        Path.Combine(AppDataFolder, "Bills");
```

所有运行时数据放在进程当前工作目录下的 `PaperCoin/` 子目录里。数据目录跟着程序目录走，所以安装路径必须锁住（后面会讲 `InstallLocation` 如何实现）。

目录结构：`Config/`（配置）、`Logs/`（日志）、`Bills/`（账单，按年/月/日分层）。

---

### 1.2 `Models/AppConfig.cs` —— 配置 POCO

```csharp
public class AppConfig
{
    public AppSection App { get; set; } = new();
    public LoggingSection Logging { get; set; } = new();
}

public class AppSection
{
    public bool AutoUpdate { get; set; }
    public string AutoUpdateSource { get; set; } = "Github";
    public bool AutoStart { get; set; } = true;
    public string Theme { get; set; } = "Dark";     // Dark / Bright / System
}

public class LoggingSection
{
    public string Level { get; set; } = "Infomation";  // 注意：拼错了但未使用
    public int RetainDays { get; set; } = 7;
}
```

简单的 POCO，配置 JSON 直接反序列化为此类型。`LoggingSection` 目前在代码中未被实际使用——Serilog 配置写死在 `App.OnStartup` 里。

---

### 1.3 `Models/BillInfo.cs` —— 核心领域模型

#### `BillEntry` —— 一条账单流水

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
```

`BillEntry` 继承 `ObservableObject`（CommunityToolkit.Mvvm），用 `[ObservableProperty]` 源生成器自动生成 `Description`/`Amount`/`Category`/`Date` 属性及变更通知。

`Id` 是业务主键——更新与删除一律按 Id 定位，不依赖对象引用相等。每条的 `Id` 用 `Guid.NewGuid()` 生成，全局唯一。

金额约定：**正数为收入，负数为支出**。

#### 派生属性

```csharp
    public string DateText => Date.ToString("MM-dd");

    public string AmountText => Amount >= 0
        ? $"+{Amount:N2}"
        : $"-{Math.Abs(Amount):N2}";
```

`DateText`、`AmountText` 是只读派生属性，供界面直接绑定显示。`AmountText` 手动补正负号——**不用 `N2` 格式串**，因为 `N2` 对负数的输出受系统区域设置影响（某些区域会用括号替代负号）。

#### 变更钩子

```csharp
    partial void OnAmountChanged(decimal value) => OnPropertyChanged(nameof(AmountText));
    partial void OnDateChanged(DateOnly value) => OnPropertyChanged(nameof(DateText));
```

源生成器声明的部分方法钩子。当 `Amount` 或 `Date` 变化时，连带通知派生属性 `AmountText`/`DateText` 也变了，这样绑定到它们的 UI 会自动刷新。

#### 预留类

`BillDayFile`、`TermsFile`、`Term`、`BillBool`、`BillSummary`、`BillItem` 是早期设计或为未来功能预留的领域类，当前 UI 未使用。读代码时看到它们知道是"历史遗留"就好，不影响理解主线。

---

## 2. Service 层：持久化与配置

Service 层同样是 `net10.0`，但在程序集级声明了 `[assembly: SupportedOSPlatform("windows")]`——因为要读注册表（安装位置、系统主题探测），这些 API 只存在于 Windows。

---

### 2.1 `BillJsonManager.cs` —— JSON 序列化辅助

```csharp
public class BillJsonManager
{
    private static readonly JsonSerializerOptions Options = new()
    {
        WriteIndented = true,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping, // 不转义中文
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };
```

三个关键配置：
- `WriteIndented = true`：格式化输出，方便用户手工编辑账单 JSON。
- `UnsafeRelaxedJsonEscaping`：不把中文转成 `\uXXXX`，保持可读性。
- `CamelCase`：属性名首字母小写，与 JSON 惯例一致。

提供了 `ToJSON`/`FromJSON`/`SaveToFileAsync`/`LoadFromFileAsync` 四个静态方法，简单的序列化封装。

---

### 2.2 `BillRepository.cs` —— 账单持久化与查询（最核心）

这是整个数据层最重要的类。磁盘布局为 `Bills/yyyy/M/d/bills.json`，年/月/日本身就是路径，因此**没有独立索引文件**，查询直接枚举目录。

#### 内部状态

```csharp
public class BillRepository
{
    private const string IndexFileName = "bills.json";

    private readonly SemaphoreSlim _gate = new(1, 1);       // 保护索引构建
    private readonly SemaphoreSlim _writeGate = new(1, 1);  // 串行化写入与删除
    private readonly Dictionary<DateOnly, List<BillEntry>> _index = [];
    private bool _indexStale = true;
```

两把信号量各司其职：
- `_gate`：保护内存索引的构建和替换。首次访问时遍历磁盘构建一次，之后常驻。双重检查锁定模式。
- `_writeGate`：串行化所有写操作。因为保存是即发即忘的，两个写句柄落在同一个文件会让后一个抛 `IOException`；删除与写入撞在一起时，写可能把删掉的记录写回来。

`_indexStale` 标记索引是否需要重建（当前实现中索引一旦构建就不再标记为 stale，因为所有写入都同步更新索引）。

#### 查询方法

```csharp
public async Task<IReadOnlyList<BillEntry>> LoadDayAsync(DateOnly date, ...)
{
    await EnsureIndexAsync(ct);
    lock (_index)
    {
        return _index.TryGetValue(date, out var list)
            ? list.ToList()          // 复制一份，不暴露内部集合
            : [];
    }
}
```

`LoadDayAsync`/`LoadMonthAsync`/`LoadYearAsync`/`LoadAllAsync` 模式相同：先确保索引已构建，然后在 `lock(_index)` 内查询，**返回副本**避免外部修改内部集合。

月/年查询通过 LINQ `Where` 过滤日期 → `SelectMany` 扁平化。

#### 分类提取

```csharp
public async Task<IReadOnlyList<string>> GetCategoriesAsync(...)
{
    return _index.Values
        .SelectMany(list => list)
        .Select(e => e.Category)
        .Where(c => !string.IsNullOrWhiteSpace(c))
        .Select(c => c!.Trim())
        .GroupBy(c => c, StringComparer.OrdinalIgnoreCase)
        .OrderByDescending(g => g.Count())
        .ThenBy(g => g.Key, StringComparer.OrdinalIgnoreCase)
        .Select(g => g.Key)
        .ToList();
}
```

从全部流水中提取分类，按**使用次数从多到少**排序，次数相同按名称排。用 `StringComparer.OrdinalIgnoreCase` 分组，所以"餐饮"和" 餐饮 "视为同一分类（候选只保留首次出现的写法）。

#### 写入方法

```csharp
public async Task SaveAsync(IEnumerable<BillEntry> entries, ...)
{
    var byDate = entries.GroupBy(e => e.Date)
        .ToDictionary(g => g.Key, g => g.ToList());

    await _writeGate.WaitAsync(ct);
    try
    {
        foreach (var (date, list) in byDate)
            await WriteDayAsync(date, list, ct);

        lock (_index)
        {
            foreach (var (date, list) in byDate)
                _index[date] = list;
        }
    }
    finally { _writeGate.Release(); }
}
```

按每条记录的 `Date` 分组，**整日覆盖写**。单日文件是该日期的全部内容，覆盖是安全且幂等的。写入完成后同步更新内存索引。

#### Upsert（新增或编辑一条）

```csharp
public async Task<bool> UpsertEntryAsync(BillEntry entry, DateOnly? previousDate, ...)
{
    await _writeGate.WaitAsync(ct);
    try
    {
        if (previousDate is { } old && old != entry.Date)
            await RemoveEntryFromDayAsync(old, entry.Id, ct);

        await MergeEntryIntoDayAsync(entry, ct);
        return true;
    }
    catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
    {
        Log.Warning(ex, "保存账单失败: {Date}", entry.Date);
        return false;
    }
    finally { _writeGate.Release(); }
}
```

如果编辑时改了日期（`previousDate != entry.Date`），先从原日期摘掉这一条，再合并进新日期。两次磁盘操作在**同一次写锁**内完成，保证原子性。

`MergeEntryIntoDayAsync` 实现 Upsert 语义的核心：

```csharp
private async Task MergeEntryIntoDayAsync(BillEntry entry, ...)
{
    var list = File.Exists(file) ? await ReadDayFileAsync(file, ct) : [];
    int existing = list.FindIndex(e => e.Id == entry.Id);
    if (existing >= 0) list[existing] = entry;   // 同 Id 覆盖
    else list.Add(entry);                         // 新 Id 追加
    await WriteDayAsync(entry.Date, list, ct);
    lock (_index) _index[entry.Date] = list;
}
```

#### 删除

```csharp
public async Task<bool> DeleteDayAsync(DateOnly date, ...)
{
    await _writeGate.WaitAsync(ct);
    try
    {
        var file = Path.Combine(DayDirectory(date), IndexFileName);
        if (File.Exists(file)) File.Delete(file);
        PruneEmptyFolders(dir);
        lock (_index) _index.Remove(date);
        return true;
    }
    finally { _writeGate.Release(); }
}
```

`DeleteDayAsync` 删除某一天的全部流水（删 `bills.json` + 收掉空目录）。空集合无法表达"这一天应该是空"，所以这个语义必须由调用方显式调用。

`PruneEmptyFolders` 自下而上收掉空的日/月/年目录，循环上限 3 层，保证不会动到 `Bills/` 本身。`recursive: false` 是因为非空时直接抛异常——我们要的就是这个行为来判断"这个目录到底空不空"。

#### 索引构建

```csharp
private async Task EnsureIndexAsync(CancellationToken ct)
{
    if (!_indexStale) return;
    await _gate.WaitAsync(ct);
    try
    {
        if (!_indexStale) return;  // 双重检查：等锁期间可能已建好
        var built = await BuildIndexAsync(ct);
        lock (_index)
        {
            _index.Clear();
            foreach (var (date, list) in built) _index[date] = list;
        }
        _indexStale = false;
    }
    finally { _gate.Release(); }
}
```

双重检查锁定模式。磁盘遍历在锁外完成（`BuildIndexAsync`），不阻塞查询。

`BuildIndexAsync` 遍历 `Bills/` 目录的所有日文件夹。目录名解析不出合法日期的直接跳过——用户放的备份文件夹不会让日历打不开。

`ReadDayFileAsync` 对坏文件（手工编辑出错、写入被中断）记日志并跳过，而不是抛出——避免一个坏文件让整月账单都看不见。

---

### 2.3 `ConfigService.cs` —— 配置读写

```csharp
public class ConfigService
{
    public ConfigService()
    {
        Directory.CreateDirectory(Constants.ConfigFolder);
        _configFilePath = Path.Combine(Constants.ConfigFolder, Constants.AppSettingsFile);

        if (!File.Exists(_configFilePath))
        {
            var defaultConfig = new AppConfig();
            File.WriteAllText(_configFilePath, JsonSerializer.Serialize(defaultConfig, ...));
        }

        _configuration = new ConfigurationBuilder()
            .AddJsonFile(_configFilePath, optional: false, reloadOnChange: true)
            .Build();
    }
```

构造时确保配置目录和文件存在。用 `Microsoft.Extensions.Configuration` 的 `AddJsonFile` 加载，`reloadOnChange: true` 让文件变化时自动重新加载。

提供 `GetAppConfig`（绑定到强类型）、`SaveAppConfig`（序列化写回）、`Reload`（强制重载）三个方法。

---

### 2.4 `ThemeManager.cs` —— 主题状态

主题管理器**不含渲染代码**——替换资源字典由 UI 层的 `ThemeRenderer` 完成。这里只负责"用户选了什么模式、这个模式对应哪个实际主题"。

```csharp
public class ThemeManager
{
    public string Mode { get; private set; } = Dark;
    public string Resolved { get; private set; } = Dark;

    public ThemeManager(ConfigService configService)
    {
        Mode = Normalize(configService.GetAppConfig().App.Theme);
        Resolved = Resolve(Mode);
    }
```

用户选择的是**模式**（System/Dark/Bright），实际渲染用的是**主题**（Dark/Bright）。System 模式下，`Resolve` 读注册表探测当前系统主题。

```csharp
public static string GetSystemTheme()
{
    using var key = Registry.CurrentUser.OpenSubKey(
        @"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize");
    // AppsUseLightTheme: 0 = 深色, 1 = 浅色
    return key?.GetValue("AppsUseLightTheme") is int light && light == 0 ? Dark : Bright;
}
```

读的是 `AppsUseLightTheme`（应用模式），不是任务栏的 `SystemUsesLightTheme`。取不到按暗色兜底。

`ApplyMode` 方法：先写配置，成功后才改内存状态——避免配置写失败但界面已切换的不一致。如果解析后的实际主题变化了（比如从 Bright 切到 System 但系统当前是 Bright，实际主题不变），只触发 `ResolvedThemeChanged` 事件；如果没变化，不触发。

---

### 2.5 `InstallLocation.cs` —— 安装位置记录

```csharp
public static class InstallLocation
{
    public const string KeyPath = @"Software\Ksayus\PaperCoin";
    public const string ValueName = "InstallDir";

    public static void Record()
    {
        using var key = Registry.CurrentUser.CreateSubKey(KeyPath);
        key?.SetValue(ValueName, AppContext.BaseDirectory.TrimEnd('\\'));
    }
}
```

把当前安装位置写进 `HKCU\Software\Ksayus\PaperCoin\InstallDir`。安装程序升级时会搜这个键来决定装到哪里：搜到沿用旧路径，搜不到用默认值。这样升级不会把文件装到第二个目录。

`KeyPath` 和 `ValueName` 是与安装包 `.vdproj` 的 "Locator" 节点约定好的，改一处必须同步改另一处。

---

### 2.6 `ShortcutRepair.cs` —— 快捷方式图标修正

这是为了绕开 VS 安装项目工具链缺陷的补丁。

**问题背景**：MSI 规定与快捷方式关联的图标必须是 PE 格式且扩展名与快捷方式目标一致。VS 安装项目把 `.ico` 字节原样塞进 MSI 的 `Icon` 表，条目名却带 `.exe` 后缀。安装时 Windows Installer 写出一个假 `.exe`，Shell 按 PE 加载失败，快捷方式就没有图标。

**解决方案**：运行期修正，通过 COM 互操作（`IShellLinkW` + `IPersistFile`）读写 `.lnk` 快捷方式文件，把 `IconLocation` 指向真实的 `.ico` 文件。

一个踩坑记录：对从磁盘 `Load` 的 `IShellLink` 调 `SetIconLocation` 再 `Save`，写盘后快捷方式的目标会变成图标文件的路径。所以用**全新的链对象**重写目标、起始目录、图标三项。

```csharp
var shellLink = (IShellLinkW)new ShellLinkObject();
shellLink.SetPath(exePath);
shellLink.SetWorkingDirectory(AppContext.BaseDirectory);
shellLink.SetIconLocation(iconPath, 0);
((IPersistFile)shellLink).Save(shortcutPath, true);
```

图标文件位置：优先用程序目录里的 `.ico`（安装包装出来的）；没有就从内嵌资源 `PaperCoin.Icon.papercoin-icon.ico` 落盘到 `%LOCALAPPDATA%\PaperCoin\`。两个位置都在用户配置下，不需要提权。

---

## 接下来

Core 层和 Service 层的核心代码已经读完了。下一篇聚焦 UI 层：

- **[核心代码导读（下）](/posts/papercoin-code-walkthrough-2/)** —— 启动流程、主窗口导航与指示器动画、主题渲染器、自定义开关控件、ViewModel、Views 交互动画、冒烟测试。