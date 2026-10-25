---
title: CmlLib.Core 完全使用指南：用 .NET 写一个 Minecraft 启动器
published: 2026-10-25
description: 从零开始掌握 CmlLib.Core v4——.NET 生态最成熟的 Minecraft 启动器库。涵盖安装、最简启动、MLaunchOption 全参数详解、版本管理与 Mod 加载器、进度监控、Java 运行时自动处理、微软账户认证、自定义游戏目录，以及一个可直接运行的完整启动器示例。
tags: [C#, .NET, Minecraft, 启动器, CmlLib.Core, NuGet, 教程]
category: 技术教程
image: ""
slug: cmlib-core-guide
---

## 前言

写一个 Minecraft 启动器，听起来像是一个大工程——版本 JSON 解析、依赖文件下载、natives 库解压、JVM 参数拼接、类路径组装、反作弊兼容……随便哪一个环节出问题，游戏就起不来。

[CmlLib.Core](https://github.com/CmlLib/CmlLib.Core) 把这些脏活累活全部封装成了简洁的 C# 异步 API。它是一个专为 .NET 设计的 Minecraft 启动器库，支持**所有原版和 Mod 版本**（Forge、Fabric、Optifine、LiteLoader 等），当前稳定版是 **v4.x**。

本文的目标是：读完就能用 CmlLib.Core 写出一个能跑的 Minecraft 启动器，并且理解每个参数的作用、每种配置的背后逻辑。

> [!NOTE]
> 网上很多中文教程基于 v3.x 甚至更早版本，API 名和入口类都不一样（比如旧的 `MinecraftProcessBuilder`、同步方法等）。本文以 **v4.x** 为准，也就是 `MinecraftLauncher` + `BuildProcessAsync` / `InstallAndBuildProcessAsync` 这套 API。

---

## 三句话认识这个库

1. **它做什么**：自动完成版本 JSON 解析 → 依赖下载 → natives 解压 → JVM 参数组装 → 启动进程，你只需要拿到 `Process` 对象调 `Start()`。
2. **它的定位**：这不是一个"现成启动器"，而是一个**库**——你用它拼出自己的启动器，UI 长什么样、操作逻辑怎么设计，完全由你决定。
3. **它最大的亮点**：Java 运行时自动处理——用户不需要装 Java，库会从 Mojang 服务器自动下载匹配的 Java 版本。这对分发启动器给不懂技术的玩家来说是质的区别。

---

## 环境准备

### .NET 版本

CmlLib.Core v4 支持 .NET 8 / .NET 9 / .NET 10，不依赖任何特定平台。桌面端推荐用 WPF 或 WinForms，当然 Avalonia、MAUI 也可以——库里全是纯 C# 逻辑，没有平台绑定。

### 安装 NuGet 包

```bash
dotnet add package CmlLib.Core                 # 核心启动库（必需）
dotnet add package CmlLib.Core.Auth.Microsoft  # 微软账户登录（可选，需要正版登录才装）
dotnet add package CmlLib.Core.Installer.Forge  # Forge 自动安装器（可选）
```

核心命名空间：

```csharp
using CmlLib.Core;
using CmlLib.Core.ProcessBuilder;
using CmlLib.Core.Auth;
using CmlLib.Core.Version;
```

---

## 1. 最简启动：三行代码跑起 Minecraft

对于离线模式、默认 `.minecraft` 目录的最简场景，启动代码短得离谱：

```csharp
var launcher = new MinecraftLauncher();
var process = await launcher.InstallAndBuildProcessAsync("1.21", new MLaunchOption());
process.Start();
```

就这么三行。发生了什么：

1. `new MinecraftLauncher()` —— 使用默认的 `.minecraft` 目录。你当然可以传自定义路径，后面会讲。
2. `InstallAndBuildProcessAsync("1.21", ...)` —— 这是一个"一条龙"方法。它会**自动检查**指定版本（这里的 `"1.21"`）是否安装完整——缺 JSON 就下载 JSON，缺 jar 就下载 jar，缺 natives 就下载 natives 然后解压。一切就绪后，组装好启动参数，返回一个 `Process` 对象。
3. `process.Start()` —— 启动游戏。

> [!NOTE]
> **`InstallAndBuildProcessAsync` vs `BuildProcessAsync`**：前者 = 安装检查 + 构建进程，后者**跳过安装检查**直接构建。如果你的启动器在「设置页面」已经完成了游戏文件安装，启动时用 `BuildProcessAsync` 可以省掉重复的检查开销。

### 无参数启动的默认行为

当你传一个 `new MLaunchOption()`（什么也不设）时，库的默认行为是：

| 项目 | 默认值 |
|------|--------|
| 玩家名 | `"Player"`（离线会话） |
| 最大内存 | x64 平台 2048 MB，其他 1024 MB |
| Java 路径 | 自动查找，找不到则自动下载 Mojang 官方 Java |
| 窗口大小 | 不指定，由游戏自身决定 |
| 游戏目录 | `%appdata%\.minecraft` |

看起来能跑了，但实际做启动器，你肯定需要自定义。下面进入正题。

---

## 2. `MLaunchOption` 完全指南

`MLaunchOption` 是控制启动行为的核心类。一个做了完整配置的例子：

```csharp
var launchOption = new MLaunchOption
{
    Session = MSession.CreateOfflineSession("Ksayus"),
    MaximumRamMb = 4096,
    MinimumRamMb = 1024,
    JavaPath = "",           // 留空 = 自动处理（推荐）
    ScreenWidth = 1920,
    ScreenHeight = 1080,
    FullScreen = false,
    ServerIp = "mc.hypixel.net",
    ServerPort = 25565,
    VersionType = "MyLauncher",
    GameLauncherName = "MyLauncher",
};
```

下面逐个拆解每个参数的含义和设值时的注意事项。

### 2.1 `Session` —— 游戏会话

```csharp
// 离线模式（最常用）
Session = MSession.CreateOfflineSession("你的玩家名")

// 微软正版登录（需要额外走 OAuth 流程，见第 6 节）
Session = await loginHandler.Authenticate()
```

`MSession` 包含三个关键字段：`Username`（玩家名）、`UUID`（正版玩家的唯一 ID）、`AccessToken`（正版玩家的访问令牌）。离线模式只有 `Username` 有用，UUID 和 Token 会被自动填充为占位值。

> 离线模式和正版模式用的是**同一个 `Session` 属性**。换句话说，离线启动器和正版启动器在 CmlLib.Core 里的代码 95% 是一样的——差别只在于这个 `Session` 怎么来的。

### 2.2 `MaximumRamMb` / `MinimumRamMb` —— JVM 内存

```csharp
MaximumRamMb = 4096,  // -Xmx4G
MinimumRamMb = 1024,  // -Xms1G
```

- `MaximumRamMb` 对应 JVM 的 `-Xmx` 参数。x64 平台默认 2048，32 位平台默认 1024。
- `MinimumRamMb` 对应 JVM 的 `-Xms` 参数。不能为负，不能大于 `MaximumRamMb`。
- **32 位 Java 下 `-Xmx` 不能超过 1024 MB**。如果用户用的是 32 位 Java，设 2048 会直接启动失败。

> 对于现代 Mod 包（超过 100 个 Mod），建议 `MinimumRamMb` 和 `MaximumRamMb` **设为相同值**（比如都是 8192）。这样 JVM 启动时直接分配全部堆内存，避免运行时动态扩展堆带来的 GC 卡顿。代价是多占了一点内存——但对于玩 Mod 包的场景来说，这点内存不值一提。

### 2.3 `JavaPath` —— Java 运行时路径

```csharp
JavaPath = "",             // 留空，让库自动处理
JavaPath = "javaw.exe",    // 或者指一个可执行文件的名字/路径
```

**强烈建议留空**。留空时库的行为分两步：

1. 先搜索系统里已安装的 Java（检查 `JAVA_HOME`、注册表、`PATH` 等）；
2. 如果找不到合适的版本，**自动从 Mojang 服务器下载该 Minecraft 版本匹配的 Java 运行时**。

这意味着你的启动器用户电脑上可以完全没有 Java——库会帮你搞定一切。

只有在极少数情况下才需要手动设：
- 你需要用某个特定发行版的 JDK（比如 GraalVM、Zulu）；
- 某 Mod 包要求特定 Java 大版本（比如必须 Java 17，但 Mojang 推荐的是 Java 21）；
- 你做了性能调优，想用自己调过 JVM 参数的那个 Java。

**设成 `null` 会抛异常**——库不认为 `null` 等同于"去自动处理"。留空字符串 `""` 才是正确的"自动"写法。

> 自动下载的 Java 存放在 `.minecraft/runtime/` 下，和游戏文件放在一起，启动器卸载时一起清掉，不留残留。

### 2.4 `ScreenWidth` / `ScreenHeight` / `FullScreen` —— 窗口设置

```csharp
ScreenWidth = 1920,
ScreenHeight = 1080,
FullScreen = false,
```

这三个值对应原版启动器的「分辨率」和「全屏」设置。设 0 表示不指定，由游戏自己决定。

### 2.5 `ServerIp` / `ServerPort` —— "一键进服"

```csharp
ServerIp = "mc.hypixel.net",
ServerPort = 25565,
```

启动后 Minecraft 会自动连接到指定服务器。这就是各种"一键进服"功能的实现方式。只设 `ServerIp` 不设 `ServerPort` 也行——端口不设时默认 25565。

注意：这个功能只是传参数给 Minecraft 主程序，告诉它"连这个服务器"。如果目标服务器开启了正版验证，离线玩家是连不进去的——这不关 CmlLib.Core 的事，是 Mojang 服务端的行为。

### 2.6 其他识别参数

```csharp
VersionType = "MyLauncher",     // 启动器版本标识
GameLauncherName = "MyLauncher", // 启动器名称
```

这两个值会写进启动参数里，Minecraft 崩溃日志里能看到。对于启动器开发者来说，这有助于排查"是哪个启动器出的问题"。

### 2.7 `ExtraJvmArguments` 与 `JvmArgumentOverrides` —— JVM 参数定制

```csharp
// 追加参数：在默认 JVM 参数后面追加
launchOption.ExtraJvmArguments = new MArgument[]
{
    new MArgument { Key = "-XX:+UseG1GC" },           // 强制用 G1 垃圾回收器
    new MArgument { Key = "-XX:ParallelGCThreads", Value = "4" },
};

// 覆盖参数：用你给的值替换掉默认的对应参数
launchOption.JvmArgumentOverrides = new MArgument[]
{
    new MArgument { Key = "-Xmx", Value = "8192M" },  // 覆盖掉 MaximumRamMb 的 -Xmx
};
```

- **`ExtraJvmArguments`**：**追加**到列表末尾。如果你设了一个已经存在的参数（比如 `-Xmx`），它不会覆盖原有的——这样就会有两个 `-Xmx`，JVM 取最后出现的那个。
- **`JvmArgumentOverrides`**：**覆盖**默认参数。如果默认参数列表里有同 Key 的参数，就用你提供的值替换；没有就追加。

大多数情况下用 `ExtraJvmArguments` 就够了。`JvmArgumentOverrides` 是给深度定制场景用的——比如你完全不信任库的默认参数拼接逻辑。

---

## 3. 版本管理

### 3.1 获取所有可用版本

```csharp
var versions = await launcher.GetAllVersionsAsync();
foreach (var version in versions)
{
    Console.WriteLine($"{version.Type} - {version.Name}");
    // 输出示例：
    // release - 1.21.4
    // release - 1.21.3
    // release - 1.20.6
    // snapshot - 24w40a
}
```

`GetAllVersionsAsync` 从 Mojang 的版本清单 API 拉取官方所有已知版本。`version.Type` 主要有两种：`"release"`（正式版）和 `"snapshot"`（快照版）。

> 这个方法获取的是**Mojang 官方发布的版本列表**，不包括你本地安装的 Forge/Fabric 等 Mod 版本。

### 3.2 安装并启动指定版本

```csharp
// 一条龙：检查安装 + 构建进程
var process = await launcher.InstallAndBuildProcessAsync("1.21.4", launchOption);
process.Start();
```

第一次调用会从 Mojang 服务器下载该版本的全部依赖，后续调用就很快了（文件已有，只做校验）。

### 3.3 启动 Forge / Fabric 等 Mod 版本

CmlLib.Core **原生支持启动已安装的任意自定义版本**。你只需要把版本名传给启动方法：

```csharp
// 假设本地已经安装了 Forge 1.20.1-47.2.0
var process = await launcher.BuildProcessAsync("1.20.1-forge-47.2.0", launchOption);
process.Start();
```

版本名就是你在官方启动器的「新建启动配置 → 版本」下拉框里看到的那个名字。Fabric、Optifine、LiteLoader 同理——不需要任何额外代码。

**自动安装** Mod 加载器则需要安装器包。以 Forge 为例：

```bash
dotnet add package CmlLib.Core.Installer.Forge
```

```csharp
using CmlLib.Core.Installer.Forge;

var forgeInstaller = new ForgeInstaller(launcher);
await forgeInstaller.Install("1.20.1", "47.2.0");  // 下载并安装 Forge

// 安装完成后，用和原版一样的方式启动
var process = await launcher.BuildProcessAsync("1.20.1-forge-47.2.0", launchOption);
process.Start();
```

> Fatrice 和 Quilt 也有对应的安装器包，用法模式一致：创建 Installer → 调 `Install` → 然后 `BuildProcessAsync`。Quilt 和 Quilt 的区别在于包名和类名，API 形态是一样的。

---

## 4. 进度监控与事件

下载一个 Minecraft 版本可能需要几百 MB 的文件，尤其对于大版本更新或 Mod 包。你必须给用户一个进度反馈——不能让他盯着空白的界面以为程序卡死了。

CmlLib.Core 提供两层进度事件：

### 4.1 文件级进度：`FileProgressChanged`

```csharp
launcher.FileProgressChanged += (sender, args) =>
{
    Console.WriteLine($"[{args.ProgressedTasks}/{args.TotalTasks}] {args.Name}");
    Console.WriteLine($"    类型: {args.EventType}");
};
```

这个事件按**文件任务**报告进度。`args.EventType` 告诉你当前在干什么：

| EventType | 含义 |
|-----------|------|
| `CheckJvm` | 正在检查/下载 Java 运行时 |
| `DownloadLibrary` | 正在下载一个依赖库 |
| `DownloadClient` | 正在下载游戏主 jar |
| `ExtractNatives` | 正在解压 natives 库 |
| `DownloadAsset` | 正在下载资源文件（音效、语言文件等） |
| `DownloadVersionMetadata` | 正在获取版本元数据 |

适合在 UI 上显示"正在下载 xxx.jar (3/42)"这样的文字。

### 4.2 字节级进度：`ByteProgressChanged`

```csharp
launcher.ByteProgressChanged += (sender, args) =>
{
    double percent = (double)args.ProgressedBytes / args.TotalBytes * 100;
    Console.WriteLine($"字节进度: {args.ProgressedBytes}/{args.TotalBytes} ({percent:F1}%)");
};
```

这个事件按**字节**报告进度，适合绘制精确的进度条。注意 `args.TotalBytes` 代表的是**当前文件的**总量，不是整个安装任务的总量——每个文件开始下载时它都会变化。

### 4.3 WPF 实战示例

```csharp
// ViewModel 里的典型写法
private int _progressValue;
public int ProgressValue
{
    get => _progressValue;
    set { _progressValue = value; OnPropertyChanged(); }
}

private string _statusText = "准备中...";
public string StatusText
{
    get => _statusText;
    set { _statusText = value; OnPropertyChanged(); }
}

private async Task LaunchAsync(string versionId)
{
    var launcher = new MinecraftLauncher();

    launcher.FileProgressChanged += (s, e) =>
    {
        Application.Current.Dispatcher.Invoke(() =>
        {
            StatusText = $"[{e.ProgressedTasks}/{e.TotalTasks}] {e.Name}";
        });
    };

    launcher.ByteProgressChanged += (s, e) =>
    {
        Application.Current.Dispatcher.Invoke(() =>
        {
            ProgressValue = (int)((double)e.ProgressedBytes / e.TotalBytes * 100);
        });
    };

    var process = await launcher.InstallAndBuildProcessAsync(versionId, launchOption);
    StatusText = "启动中...";
    process.Start();
}
```

> 关键细节：**事件回调在工作线程触发，更新 UI 属性必须编组到 UI 线程**。WPF 用 `Dispatcher.Invoke`，WinForms 用 `Control.Invoke`，Avalonia 用 `Dispatcher.UIThread.Post`。忘了编组会收到跨线程访问异常。

---

## 5. Java 运行时：自动处理的完整逻辑

这是 CmlLib.Core 最省心的特性之一。把这段逻辑单独拆出来讲，是因为很多人不清楚它到底做了什么、什么时候该手动干预。

### 自动处理的工作流

当你把 `JavaPath` 留空时，库在启动流程中会经历以下步骤：

```
① 检查 MLaunchOption.JavaPath 是否为空
       │
       ├── 不为空 → 直接用你给的路径
       │
       ▼ 为空
② 从版本 JSON 中读取该 Minecraft 版本要求的 Java 大版本
   （例如 1.21 要求 Java 21，1.16.5 要求 Java 8）
       │
       ▼
③ 搜索系统已安装的 Java：
   ├── JAVA_HOME 环境变量
   ├── PATH 环境变量中的 java/javaw
   └── Windows 注册表中的 Java Runtime
       │
       ├── 找到 + 版本匹配 → 使用
       ├── 找到 + 版本不匹配 → 跳过
       │
       ▼ 找不到合适的
④ 从 Mojang 服务器下载匹配的 Java 运行时
   下载到 .minecraft/runtime/java-runtime-xxx/
       │
       ▼
⑤ 用下载的 Java 启动游戏
```

### 什么时候需要手动设 `JavaPath`

- 模组包强制要求特定 Java 版本（比如某个老 Mod 只能在 Java 8 上跑，但 Mojang 已经不给 1.20+ 配 Java 8 了）；
- 你想用某个非 Oracle/OpenJDK 的发行版（GraalVM、Zulu、Liberica 等）；
- 你做了 JVM 调优，绑定了特定版本的 JDK 参数。

除此之外，一律留空。

---

## 6. 账户认证

### 6.1 离线模式

```csharp
Session = MSession.CreateOfflineSession("Ksayus")
```

离线模式的实质：给 Minecraft 主程序传一个"我是谁"的参数，不经过任何服务器验证。离线玩家无法进入开启正版验证的服务器。

> 离线模式不是"破解"，只是跳过了 Mojang 的身份验证环节。游戏本身的运行逻辑没有任何区别。

### 6.2 微软账户登录（正版）

要支持正版登录，需要额外安装认证包：

```bash
dotnet add package CmlLib.Core.Auth.Microsoft
```

微软登录的完整链条是：**Microsoft OAuth → Xbox Live 认证 → Xbox XSTS 令牌 → Minecraft 认证 → 获取游戏会话**。每一步都可能失败，每一种错误原因都不同。CmlLib.Core.Auth.Microsoft 把这个链条封装成了一个方法调用：

```csharp
using CmlLib.Core.Auth.Microsoft;

// 构建登录处理器
var loginHandler = JELoginHandlerBuilder.BuildDefault();

// 弹窗登录（打开浏览器让用户登录微软账户）
MSession session = await loginHandler.Authenticate();

// 把认证得到的会话传给启动选项
var launchOption = new MLaunchOption
{
    Session = session,
    MaximumRamMb = 4096,
};
```

`Authenticate()` 会打开系统默认浏览器，让用户登录微软账户并授权。授权完成后，浏览器会重定向到一个 `localhost` 地址——库在本地监听一个临时端口来接收这个重定向，从中提取授权码，完成后续的令牌交换。

整个过程对用户来说就是：**点启动 → 浏览器弹出来 → 登录微软账户 → 授权 → 回到启动器 → 游戏启动**。

### 6.3 缓存与刷新

```csharp
// 认证结果可以缓存到本地，下次启动直接用
var session = await loginHandler.TryAuthenticateWithCachedToken();
if (session == null)
{
    // 缓存过期或不存在，重新弹窗登录
    session = await loginHandler.Authenticate();
}
```

Minecraft 的 AccessToken 有效期是有限的（通常是几小时到一天）。`TryAuthenticateWithCachedToken` 会尝试用之前缓存的刷新令牌自动续期——如果成功就不用弹窗。

---

## 7. 自定义游戏目录

```csharp
var path = new MinecraftPath("./my_custom_game_dir");
var launcher = new MinecraftLauncher(path);
```

`MinecraftPath` 封装了 `.minecraft` 目录下的标准子目录结构：

| 属性 | 路径 | 说明 |
|------|------|------|
| `BasePath` | `./my_custom_game_dir` | 游戏根目录 |
| `Versions` | `./my_custom_game_dir/versions` | 版本 JSON + jar 存放处 |
| `Libraries` | `./my_custom_game_dir/libraries` | 依赖库存放处 |
| `Assets` | `./my_custom_game_dir/assets` | 资源文件存放处 |
| `Runtime` | `./my_custom_game_dir/runtime` | 自动下载的 Java 运行时 |

自定义目录最常见的应用场景：
- 启动器本身带一个"游戏目录切换"功能，让玩家可以分别管理原版和模组包的游戏文件；
- 把 `.minecraft` 放在非系统盘（节省 C 盘空间）；
- 做"版本隔离"——不同整合包用不同的游戏目录，避免库文件冲突。

```csharp
// 典型的多实例场景
var vanillaLauncher = new MinecraftLauncher(new MinecraftPath("./instances/vanilla"));
var modpackLauncher = new MinecraftLauncher(new MinecraftPath("./instances/modpack-01"));
```

---

## 8. 完整启动器示例

下面是一个可以直接编译运行的 WPF 启动器最小示例——包含版本列表、进度条、内存设置、一键启动。去掉 WPF 的部分，Console 启动器也是同理。

```csharp
// MainWindow.xaml.cs（简化版）
public partial class MainWindow : Window, INotifyPropertyChanged
{
    private MinecraftLauncher _launcher;

    private int _progressValue;
    public int ProgressValue
    {
        get => _progressValue;
        set { _progressValue = value; OnPropertyChanged(); }
    }

    private string _statusText = "就绪";
    public string StatusText
    {
        get => _statusText;
        set { _statusText = value; OnPropertyChanged(); }
    }

    private string _selectedVersion = "1.21";
    public string SelectedVersion
    {
        get => _selectedVersion;
        set { _selectedVersion = value; OnPropertyChanged(); }
    }

    private int _maxRam = 4096;
    public int MaxRam
    {
        get => _maxRam;
        set { _maxRam = value; OnPropertyChanged(); }
    }

    private string _playerName = "Player";
    public string PlayerName
    {
        get => _playerName;
        set { _playerName = value; OnPropertyChanged(); }
    }

    public MainWindow()
    {
        InitializeComponent();
        DataContext = this;
        _launcher = new MinecraftLauncher();

        _launcher.FileProgressChanged += (s, e) =>
        {
            Dispatcher.Invoke(() =>
            {
                StatusText = $"[{e.ProgressedTasks}/{e.TotalTasks}] {e.Name}";
            });
        };

        _launcher.ByteProgressChanged += (s, e) =>
        {
            Dispatcher.Invoke(() =>
            {
                ProgressValue = (int)((double)e.ProgressedBytes / e.TotalBytes * 100);
            });
        };
    }

    private async void LaunchButton_Click(object sender, RoutedEventArgs e)
    {
        LaunchButton.IsEnabled = false;

        try
        {
            var launchOption = new MLaunchOption
            {
                Session = MSession.CreateOfflineSession(PlayerName),
                MaximumRamMb = MaxRam,
                MinimumRamMb = Math.Min(MaxRam, 1024),
                // JavaPath 留空，自动处理
            };

            StatusText = "正在检查游戏文件...";
            var process = await _launcher.InstallAndBuildProcessAsync(SelectedVersion, launchOption);

            StatusText = "游戏已启动";
            process.Start();
        }
        catch (Exception ex)
        {
            MessageBox.Show($"启动失败: {ex.Message}", "错误",
                MessageBoxButton.OK, MessageBoxImage.Error);
            StatusText = "启动失败";
        }
        finally
        {
            LaunchButton.IsEnabled = true;
        }
    }

    public event PropertyChangedEventHandler? PropertyChanged;
    private void OnPropertyChanged([CallerMemberName] string? name = null)
        => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
}
```

配套的 XAML：

```xml
<StackPanel Margin="20" Width="400">
    <TextBlock Text="CmlLib.Core 示例启动器" FontSize="20" FontWeight="Bold" Margin="0,0,0,15"/>

    <TextBlock Text="玩家名"/>
    <TextBox Text="{Binding PlayerName, UpdateSourceTrigger=PropertyChanged}" Margin="0,0,0,10"/>

    <TextBlock Text="最大内存 (MB)"/>
    <TextBox Text="{Binding MaxRam, UpdateSourceTrigger=PropertyChanged}" Margin="0,0,0,10"/>

    <TextBlock Text="版本 (如 1.21)"/>
    <TextBox Text="{Binding SelectedVersion, UpdateSourceTrigger=PropertyChanged}" Margin="0,0,0,10"/>

    <TextBlock Text="{Binding StatusText}" Foreground="Gray" Margin="0,0,0,10"/>

    <ProgressBar Value="{Binding ProgressValue}" Height="20" Margin="0,0,0,10"/>

    <Button x:Name="LaunchButton" Content="启动 Minecraft"
            Click="LaunchButton_Click" Height="35"/>
</StackPanel>
```

> 这已经是一个**功能完整**的启动器了——离线登录、可选版本、可配内存、进度反馈、错误提示。从这出发加功能（正版登录、版本列表下拉框、Mod 管理）都是增量，骨架不用动。

---

## 9. 常见坑与注意事项

### 9.1 API 版本要对上

v3.x（及更早）的入口类是 `MinecraftProcessBuilder`，方法是同步的。v4.x 的入口是 `MinecraftLauncher`，方法是 `BuildProcessAsync` / `InstallAndBuildProcessAsync` 这些**异步方法**。

网络上的旧教程（尤其是中文社区）大量基于 v3.x。如果你照着旧教程写发现没有对应的类和方法，**不要怀疑自己装错了包**——你装的是 v4，教程写的是 v3。

判断依据：
- 看到 `new MinecraftLauncher()` → v4.x ✅
- 看到 `new MinecraftProcessBuilder()` → v3.x ❌
- 看到 `BuildProcessAsync` → v4.x ✅
- 看到 `.BuildProcess()`（同步） → v3.x ❌

### 9.2 版本名必须精确

`"1.21"` 和 `"1.21.0"` 在 CmlLib.Core 看来是不同的版本标识符。Mojang 发布版本时用的 ID 是 `"1.21"`（不带 `.0`），所以传 `"1.21.0"` 会查不到。

建议先跑一遍 `GetAllVersionsAsync()`，让用户从列表里**选择**而不是手打版本号——这是所有成熟启动器的做法。

### 9.3 "版本能启动"的前提

CmlLib.Core 能启动的版本，**首先需要能在 Mojang 官方启动器中正常运行**。如果一个自定义版本本身是损坏的（比如 Forge 安装不全、Mod 之间冲突导致崩溃），CmlLib.Core 也启动不了它——问题出在版本本身，不是库的问题。

### 9.4 进度事件的线程安全

前面提过但值得再强调：`FileProgressChanged` 和 `ByteProgressChanged` 在**工作线程**触发。更新 UI 控件必须编组到 UI 线程。忘了编组不会立刻崩——它会在某个随机时间点抛出 `InvalidOperationException`，定位起来很头疼。

### 9.5 首次启动慢是正常的

第一次启动某个版本时，`InstallAndBuildProcessAsync` 需要下载几百 MB 的游戏文件。这个"慢"是网络下载造成的，不是库的问题。你可以通过 `ByteProgressChanged` 给用户展示进度，让等待不那么焦虑。

---

## 总结

CmlLib.Core 的使用，一句话就能概括：

> **装包 → 创建 `MinecraftLauncher` → 配置 `MLaunchOption` → 调 `InstallAndBuildProcessAsync` → `process.Start()`**

展开来就是本文的 9 节内容：

| 环节 | 要点 |
|------|------|
| 安装 | `dotnet add package CmlLib.Core` |
| 启动器 | `new MinecraftLauncher(path?)` |
| 配置 | `MLaunchOption`（Session、内存、Java 路径、屏幕、JVM 参数） |
| 版本 | `GetAllVersionsAsync` / `InstallAndBuildProcessAsync` / `BuildProcessAsync` |
| 进度 | `FileProgressChanged` + `ByteProgressChanged` + UI 线程编组 |
| Java | 留空 `JavaPath`，库自动下载 |
| 认证 | `CreateOfflineSession` 或 `CmlLib.Core.Auth.Microsoft` |
| 目录 | `MinecraftPath` 自定义游戏目录 |
| Mod | 传版本名直接启动；自动安装需要 installer 包 |

如果你准备动手写一个启动器，建议的起步路线：先把第 8 节的完整示例跑起来 → 加入版本列表下拉框 → 加入正版登录 → 加入 Forge/Fabric 安装。每一步都是增量，骨架不动。