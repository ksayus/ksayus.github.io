---
title: ManyCourse 开源项目学习指南：从零到一看懂 Kotlin Android 课表应用
published: 2026-09-28
description: 面向 Kotlin 零基础学习者的 ManyCourse（课多多）项目学习路线图，介绍项目概况、学习顺序、环境准备，以及如何从看懂代码到动手修改的全过程。
tags: [Android, Kotlin, ManyCourse, 开源, 学习指南, 课表]
category: 技术教程
image: ""
slug: manycourse-learning-guide
---

## 前言

[ManyCourse](https://github.com/ksayus/ManyCourse)（课多多）是一款原生 Android 大学生课表 App。填一次学号密码登录学校教务系统，姓名、课表、教学周自动同步到手机，配一个周视图课表 + 月历 + 校园地图。

它的代码体量适中、架构清晰、注释充分，非常适合作为**从零开始学习 Kotlin + Android 开发**的实战项目。本文是一份完整的学习路线指南，帮你规划从 "看不懂代码" 到 "能动手改、能加学校" 的全过程。

> [!NOTE]
> 本文围绕 ManyCourse 项目展开，但其中涉及的 Kotlin 语法、分层架构思想、异步编程模式，对学习任何一个 Android 项目都有帮助。

---

## 三句话认识这个项目

1. **它是什么**：原生 Android 大学生课表 App，支持多所学校教务系统自动同步。
2. **它用什么写**：Kotlin 2.2 + Jetpack Compose（Material 3 玻璃拟态 UI）+ OkHttp 5（网络），没有 Retrofit、没有数据库框架，依赖极简。
3. **它最大的特点**：把「一所学校」抽象成一个 `SchoolApi` 接口，加新学校只需**新增一个文件 + 注册一行**，UI 完全不用改。

---

## 推荐学习顺序

| 顺序 | 文章 | 内容 | 适合谁 | 预计耗时 |
|------|------|------|--------|----------|
| 1 | [Kotlin 语法速成](./manycourse-kotlin-crash-course) | 用项目代码讲 Kotlin 语法 | 完全没写过 Kotlin 的人 | 2-3 小时 |
| 2 | [项目架构详解](./manycourse-project-architecture) | 四层设计 + 数据流 | 已过完语言、想看全貌的人 | 1-2 小时 |
| 3 | [核心代码导读](./manycourse-code-walkthrough) | 逐文件逐行精读 | 准备深入源码的人 | 3-4 小时 |
| 4 | [动手练习](./manycourse-hands-on-exercises) | 从改数据到加学校 | 想动手实践的人 | 4-8 小时 |

每遍之间隔一两天，记忆更牢。卡住了就回到项目 README——README 是写给"想加学校的开发者"的，细节非常详尽。

> 如果只想**尽快把项目跑起来**，跳过前三篇，直接看 [动手练习](./manycourse-hands-on-exercises) 的第一节「把项目跑起来」。

---

## 项目技术栈一览

| 层级 | 技术 | 说明 |
|------|------|------|
| 语言 | Kotlin 2.2 | Google 官方推荐的 Android 开发语言 |
| UI | Jetpack Compose + Material 3 | 声明式 UI，玻璃拟态风格 |
| 网络 | OkHttp 5 | 纯 OkHttp，无 Retrofit 封装 |
| 加密 | RSA / SM2 / AES | 各校教务系统密码加密 |
| 构建 | Gradle (KTS) | Kotlin DSL 构建脚本 |

> 从学习角度来说，这个技术栈非常"干净"——没有过度封装，每行代码都能追溯到它为什么存在。

---

## 需要准备什么

- 会一点**英文单词**（编程关键字都是英文）；
- 一台能装 **Android Studio** 的电脑（想跑起来的话）；
- **耐心**。零基础读代码，第一遍不懂很正常，照着文档翻第二遍就通了。

### 环境要求

| 需要 | 版本 |
|------|------|
| JDK | 17 或以上（项目在 JDK 21/25 上验证过） |
| Android SDK | Platform 37 + Build-Tools 36 |
| Android Studio | 最新稳定版 |

---

## 项目代码在哪

项目开源在 GitHub：[`https://github.com/ksayus/ManyCourse`](https://github.com/ksayus/ManyCourse)

克隆后，用 Android Studio 打开项目根目录（不是某个文件），Android Studio 会自动生成 `local.properties` 并同步 Gradle 依赖。

> 跑不起来多半是：SDK 没装 Platform 37、JDK 太老、`local.properties` 缺 `sdk.dir`。对照项目 README 的排查表逐一检查即可。

---

## 核心概念预览

在深入阅读之前，先记住三个最核心的概念，它们贯穿整个项目：

### `SchoolApi` 接口 —— 项目的"心脏"

一所学校就是一个 `SchoolApi` 的实现。它定义了登录、拉课表、拉姓名等操作。现有 3 所学校的接入（广软、金城学院、广工），每所学校一个文件。

### `CourseRepository` —— 全局课程仓库

一个 `object` 单例，用 Compose 的 `mutableStateListOf` 存储课程。一旦数据变了，所有用到它的界面自动重画——不需要手动刷新。

### `SchoolRegistry` —— 唯一的"加学校"入口

一个清单列表，列出所有已接入的学校。登录页下拉、会话持久化、登录分发——全都由它驱动。加学校 = 在列表里加一行。

---

## 两条铁律（改代码前必读）

项目 README 中强调过的两条规则，零基础最容易踩：

1. **学校 `id` 是持久化主键，定了不许改**——它存在本地 SharedPreferences 里，"上次选的学校"靠它恢复。改了就等于清空老用户的选择。全小写英文短名。
2. **加接口不要新建 `HttpMethod` 实例**——Cookie 会话挂在 `SchoolApi` 实例上，新建实例等于空会话，接口必然被认为"没登录"。

---

## 系列文章导航

本系列共四篇文章，建议按顺序阅读：

1. **[Kotlin 语法速成](./manycourse-kotlin-crash-course)** —— 用 ManyCourse 项目真实代码讲 Kotlin 语法，每个语法点都指回项目源码。零基础必读。
2. **[项目架构详解](./manycourse-project-architecture)** —— 四层设计（ui / data / gr_api / api）、一次登录的完整数据流。想看懂全貌必读。
3. **[核心代码导读](./manycourse-code-walkthrough)** —— 逐文件逐行精读最关键的 5 个源码文件。准备深入源码必读。
4. **[动手练习](./manycourse-hands-on-exercises)** —— 从改一行数据到加一所学校的 7 道实战练习。想动手实践必读。

> **快速跳转**：如果你是零基础，从第 1 篇开始；如果你已有 Kotlin 经验，直接跳到第 2 篇；如果只想尽快跑起来，直接看第 4 篇的第一节。