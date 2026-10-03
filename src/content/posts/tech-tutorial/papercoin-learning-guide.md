---
title: PaperCoin 开源项目学习指南：从零到一看懂 WPF 记账应用
published: 2026-10-03
description: 面向 .NET/C# 学习者的 PaperCoin 项目学习路线图，介绍项目概况、技术栈、学习顺序、环境准备，以及从看懂代码到动手修改的全过程。
tags: [WPF, C#, .NET, PaperCoin, 开源, 学习指南, 记账, MVVM]
category: 技术教程
image: ""
slug: papercoin-learning-guide
---

## 前言

[PaperCoin](https://github.com/ksayus/PaperCoin) 是一款 Windows 桌面记账应用，用 WPF + .NET 10 编写。每天打开记一笔收支，数据存成本地 JSON 文件，支持 Dark/Bright/跟随系统三种主题，所有交互动画统一交给一个叫 LAE 的动画引擎驱动。

它的代码体量适中、架构清晰、注释充分，非常适合作为**学习 WPF + MVVM + DI 的实战项目**。本文是一份完整的学习路线指南，帮你规划从"看不懂代码"到"能动手改"的全过程。

> [!NOTE]
> 本文围绕 PaperCoin 项目展开，但其中涉及的 MVVM 分层思想、依赖注入、WPF 自定义控件、动画引擎等知识，对学习任何一个 WPF/桌面应用项目都有帮助。

---

## 三句话认识这个项目

1. **它是什么**：Windows 桌面记账应用，支持当日账单、日历查询、分类管理。
2. **它用什么写**：WPF + .NET 10、CommunityToolkit.Mvvm、Microsoft.Extensions.DependencyInjection、Serilog、LAE（自研动画引擎）。没有数据库框架，数据全部存成 JSON 文件。
3. **它最大的特点**：分层架构极简且干净——Core（领域模型）、Service（持久化/配置/主题）、WPF 界面层，三层单向依赖，每一层的职责一眼就能看明白。

---

## 推荐学习顺序

| 顺序 | 文章 | 内容 | 适合谁 | 预计耗时 |
|------|------|------|--------|----------|
| 1 | [项目架构详解](/posts/papercoin-project-architecture/) | 三层设计 + 启动流程 + 数据流 | 想先看懂全貌的人 | 1-2 小时 |
| 2 | [核心代码导读（上）](/posts/papercoin-code-walkthrough-1/) | 领域模型、持久化、配置与主题 | 准备深入源码的人 | 2-3 小时 |
| 3 | [核心代码导读（下）](/posts/papercoin-code-walkthrough-2/) | UI 层、自定义控件、动画、ViewModel | 准备深入源码的人 | 2-3 小时 |

每篇之间隔一两天，记忆更牢。卡住了就打开项目源码对照着看——项目代码里的注释同样非常详尽。

> 如果只想**尽快把项目跑起来**，克隆代码后直接 `dotnet run`，不需要装数据库、不需要配环境变量——PaperCoin 是零依赖启动的。

---

## 项目技术栈一览

| 层级 | 技术 | 说明 |
|------|------|------|
| 语言 | C# 13（.NET 10） | 微软官方推荐的桌面开发语言 |
| UI | WPF（XAML + 代码后置） | 原生 Windows 桌面框架 |
| MVVM | CommunityToolkit.Mvvm 8.4 | `ObservableObject` + `[ObservableProperty]` 源生成器 |
| DI | Microsoft.Extensions.DependencyInjection | 微软官方的依赖注入容器 |
| 配置 | Microsoft.Extensions.Configuration | JSON 配置文件读写，支持热重载 |
| 日志 | Serilog | 控制台 + 按天滚动文件 |
| 动画 | LAE（Lively Animation Engine） | 自研轻量动画引擎，驱动所有过渡动效 |
| 构建 | .NET SDK | `dotnet build` 一把梭 |

> 从学习角度来说，这个技术栈非常"干净"——没有 Prism、没有 ReactiveUI、没有数据库 ORM。每行代码都能追溯到它为什么存在。

---

## 需要准备什么

- 会一点 **C# 基础**（类、属性、接口、泛型）；
- 一台 **Windows 电脑**（WPF 只跑在 Windows 上）；
- 装了 **.NET 10 SDK**（或更高版本）；
- **耐心**。零基础读 WPF 代码，第一遍不懂很正常，照着文档翻第二遍就通了。

### 环境要求

| 需要 | 版本 |
|------|------|
| .NET SDK | 10.0 或以上 |
| 操作系统 | Windows 10/11 |
| IDE | Visual Studio 2022 或 JetBrains Rider（可选，命令行也能跑） |

---

## 项目代码在哪

项目开源在 GitHub：[`https://github.com/ksayus/PaperCoin`](https://github.com/ksayus/PaperCoin)

克隆后，在项目根目录执行：

```bash
cd PaperCoin
dotnet run --project PaperCoin/PaperCoin.csproj
```

> 不需要装数据库、不需要配环境变量。应用首次启动会在程序目录下自动创建 `PaperCoin/` 数据目录（含 Config/、Logs/、Bills/ 三个子目录）。

---

## 核心概念预览

在深入阅读之前，先记住三个最核心的概念，它们贯穿整个项目：

### `BillEntry` —— 一条账单流水

`BillEntry` 是项目的核心领域模型。一条流水包含：描述（description）、金额（amount，正数为收入、负数为支出）、分类（category）、日期（date）。它同时也是列表卡片的绑定源——画面上每一行账单的背后就是一个 `BillEntry` 对象。

### `BillRepository` —— 全局账单仓库

一个单例服务，用内存索引 + 磁盘 JSON 文件管理所有账单。磁盘布局为 `Bills/yyyy/M/d/bills.json`，年/月/日本身就是路径的一部分，因此**没有独立索引文件**。查询时遍历目录构建内存索引，之后常驻内存。

### `ThemeManager` —— 主题管理

管理 Dark/Bright/System 三种主题模式。System 模式会读 Windows 注册表探测当前系统主题。主题切换不是替换整个 `ResourceDictionary` 实例（那样会破坏 DynamicResource 缓存），而是在原字典里**原地改写每个 key 的值**，并给颜色变化挂一段 300ms 的过渡动画。

---

## 两条铁律（改代码前必读）

1. **金额约定：正数为收入，负数为支出**。`AmountText` 手动补正负号，不用 `N2` 格式串——因为 `N2` 对负数的输出受系统区域设置影响。
2. **写操作都在 `_writeGate` 信号量内串行**。`BillRepository` 的保存/删除/更新全部由 `_writeGate` 信号量保护，因为保存是即发即忘的，两个写句柄落在同一个文件会让后一个抛 `IOException`。

---

## 系列文章导航

本系列共三篇文章，建议按顺序阅读：

1. **[项目架构详解](/posts/papercoin-project-architecture/)** —— 三层设计（Core/Service/WPF）、一次启动的完整流程、依赖注入容器配置、数据从界面到磁盘的完整路径。想看懂全貌必读。
2. **[核心代码导读（上）](/posts/papercoin-code-walkthrough-1/)** —— 逐文件精读 Core 层（领域模型、常量）+ Service 层（持久化、配置、主题、安装位置）。准备深入源码必读。
3. **[核心代码导读（下）](/posts/papercoin-code-walkthrough-2/)** —— 逐文件精读 UI 层（启动流程、主窗口、主题渲染器、自定义控件、ViewModel、Views 交互动画、冒烟测试）。准备深入源码必读。

> **快速跳转**：如果你只想看懂"数据怎么存、主题怎么切"，直接跳到第 1 篇；如果你想逐行精读代码，按顺序读第 2、3 篇。