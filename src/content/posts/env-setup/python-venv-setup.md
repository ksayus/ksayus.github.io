---
title: Python 虚拟环境搭建指南（venv + pip）
published: 2026-09-10
description: 从零开始学习 Python 虚拟环境的创建与使用，涵盖 venv 创建、激活、包管理、requirements.txt 的使用，帮助你隔离项目依赖，避免版本冲突。
tags: [Python, 虚拟环境, venv, pip, 环境配置]
category: 环境配置
image: ""
slug: python-venv-setup
---

## 前言

在 Python 开发中，**虚拟环境（Virtual Environment）** 是一个不可或缺的工具。它允许你为每个项目创建独立的 Python 运行环境，不同项目之间的依赖包互不干扰。

如果你不熟悉虚拟环境，可能会遇到以下问题：

- 项目 A 需要 `requests==2.25.0`，项目 B 需要 `requests==2.28.0`，全局安装只能保留一个版本
- 不同项目依赖同一个包的不同大版本，升级后老项目无法运行
- 把项目交给别人时，对方不知道需要安装哪些依赖

本文将从零开始，带你掌握 Python 虚拟环境的完整用法：

- **venv**：Python 自带的虚拟环境创建工具
- **pip**：Python 包管理器
- **requirements.txt**：项目依赖清单

> [!NOTE]
> 本文适用于 Python 3.3+ 版本（Python 3.3 开始内置 venv 模块）。推荐使用 Python 3.8 及以上版本。如果你还没有安装 Python，请先前往 [Python 官网](https://www.python.org/) 下载安装。

---

## 什么是虚拟环境

虚拟环境是一个**独立的 Python 运行环境**，它包含：

- 一个独立的 Python 解释器（或软链接到系统 Python）
- 独立的 `site-packages` 目录（存放第三方包）
- 独立的 `pip` 包管理器

当你激活虚拟环境后，所有 `pip install` 安装的包都会被安装到该虚拟环境的 `site-packages` 中，**不会影响系统全局的 Python 环境**。

> [!TIP]
> 可以把虚拟环境理解为 Python 的「沙盒」：每个项目拥有自己独立的沙盒，互不干扰。项目完成后，删除虚拟环境目录即可彻底清理，不留任何残留。

---

## 第一步：创建虚拟环境

Python 自带的 `venv` 模块可以快速创建虚拟环境。

### 基本命令

打开终端（cmd 或 PowerShell），进入你的项目目录，执行：

```powershell
python -m venv venv
```

> [!NOTE]
> 命令解析：`python -m venv` 表示以模块方式运行 `venv`，最后的 `venv` 是虚拟环境目录的名称。目录名可以自定义，常见的有 `venv`、`.venv`、`env`。

执行后，项目目录下会生成一个 `venv` 文件夹，结构如下：

![创建虚拟环境命令](./images/python/venv/python-create-venv-cmd.png)

### 虚拟环境目录结构

```
venv/
├── Include/        # Python 头文件
├── Lib/            # 第三方包安装目录（site-packages）
│   └── site-packages/
├── Scripts/        # 激活脚本和 Python 解释器
│   ├── activate    # 激活脚本（bash）
│   ├── Activate.ps1 # 激活脚本（PowerShell）
│   ├── python.exe  # Python 解释器
│   └── pip.exe     # pip 包管理器
└── pyvenv.cfg      # 虚拟环境配置文件
```

> [!TIP]
> 建议将 `venv/` 目录添加到 `.gitignore` 中，不要将虚拟环境提交到 Git 仓库。别人拿到项目后，根据 `requirements.txt` 自行创建虚拟环境即可。

---

## 第二步：激活虚拟环境

创建完成后，需要**激活**虚拟环境才能使用。

### Windows

**cmd（命令提示符）：**

```cmd
venv\Scripts\activate
```

**PowerShell：**

```powershell
venv\Scripts\Activate.ps1
```

> [!WARNING]
> 如果 PowerShell 提示「无法加载文件，因为在此系统上禁止运行脚本」，需要先以管理员身份运行 PowerShell，执行以下命令允许脚本执行：
> ```powershell
> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
> ```
> 然后重新激活虚拟环境。

### Linux / macOS

```bash
source venv/bin/activate
```

### 验证激活状态

激活成功后，终端提示符前面会出现 `(venv)` 标识，表示当前处于虚拟环境中：

![激活虚拟环境](./images/python/venv/python-venv-active.png)

此时运行 `where python`（Windows）或 `which python`（Linux/macOS），会指向虚拟环境中的 Python 解释器，而非系统全局的 Python：

![激活效果](./images/python/venv/python-venv-active-effect.png)

> [!IMPORTANT]
> 每次打开新终端都需要重新激活虚拟环境，因为激活只在当前终端会话中生效。

---

## 第三步：安装与管理依赖包

激活虚拟环境后，所有 `pip` 操作都只影响当前虚拟环境。

### 安装包

```powershell
pip install requests
pip install flask==3.0.0
```

可以同时安装多个包：

```powershell
pip install requests flask numpy pandas
```

### 查看已安装的包

```powershell
pip list
```

### 卸载包

```powershell
pip uninstall requests
```

### 升级包

```powershell
pip install --upgrade requests
```

---

## 第四步：使用 requirements.txt

`requirements.txt` 是 Python 项目的依赖清单文件，记录了项目所需的所有包及其版本。它是团队协作和项目部署的关键文件。

### 生成 requirements.txt

在虚拟环境激活状态下，执行：

```powershell
pip freeze > requirements.txt
```

![生成 requirements.txt](./images/python/venv/python-requirements.png)

`pip freeze` 会列出当前环境中所有已安装的包及其精确版本号，`>` 将输出重定向到 `requirements.txt` 文件中。

### requirements.txt 示例

生成的 `requirements.txt` 内容如下：

```
flask==3.0.0
numpy==1.26.2
pandas==2.1.4
requests==2.31.0
```

你也可以手动编辑此文件，指定版本范围：

```
flask>=3.0.0,<4.0.0
numpy>=1.26.0
requests>=2.28.0
```

![编辑 requirements.txt](./images/python/venv/python-requirements-edit-sample.png)

> [!TIP]
> 版本锁定（`==`）适合生产环境，确保所有环境完全一致；版本范围（`>=`）适合开发阶段，允许小版本更新。

### 从 requirements.txt 安装依赖

其他人拿到项目后，只需在激活虚拟环境后执行：

```powershell
pip install -r requirements.txt
```

![从 requirements.txt 安装](./images/python/venv/python-use-requirements.png)

`pip` 会依次读取并安装 `requirements.txt` 中列出的所有包。

---

## 第五步：退出虚拟环境

完成工作后，可以通过以下命令退出虚拟环境：

```powershell
deactivate
```

退出后，终端提示符前的 `(venv)` 标识消失，`python` 和 `pip` 会恢复为系统全局的版本。

![退出虚拟环境](./images/python/venv/python-venv-finish.png)

---

## 完整工作流程

以下是一个典型项目的完整工作流程：

```powershell
# 1. 创建项目目录并进入
mkdir my-python-project
cd my-python-project

# 2. 创建虚拟环境
python -m venv venv

# 3. 激活虚拟环境
venv\Scripts\activate

# 4. 安装项目依赖
pip install requests flask

# 5. 开始开发...
# 编写代码、测试等

# 6. 导出依赖清单
pip freeze > requirements.txt

# 7. 退出虚拟环境
deactivate
```

> [!TIP]
> 建议在项目根目录下放置 `.gitignore` 文件，添加 `venv/` 和 `__pycache__/` 等不需要版本控制的目录。

---

## 常见问题

### 虚拟环境可以移动或复制吗？

不建议。虚拟环境中的脚本和路径是硬编码的，移动到其他位置后可能无法正常工作。正确的做法是在新位置重新创建虚拟环境，然后通过 `pip install -r requirements.txt` 恢复依赖。

### 虚拟环境和 Conda 有什么区别？

| 特性 | venv | Conda |
|------|------|-------|
| 来源 | Python 内置 | 需单独安装 Anaconda/Miniconda |
| 包管理 | pip（PyPI 生态） | conda（Conda 生态）+ pip |
| 跨语言支持 | 仅 Python | 支持 Python、R、C/C++ 等 |
| 体积 | 轻量（约 10MB） | 较重（约 500MB+） |
| 适用场景 | 纯 Python 项目 | 数据科学、多语言项目 |

> [!NOTE]
> 对于大多数纯 Python 项目，使用 `venv` + `pip` 就完全够用了。如果你从事数据科学或需要管理非 Python 依赖，可以考虑 Conda。

### 如何升级 pip？

```powershell
python -m pip install --upgrade pip
```

### 虚拟环境目录名必须是 venv 吗？

不必须。`venv`、`.venv`、`env` 都是常见命名。`.` 开头的目录名（如 `.venv`）在 Linux/macOS 下默认隐藏，看起来更整洁。

---

## 总结

Python 虚拟环境是每个 Python 开发者必须掌握的基础技能。它隔离了项目依赖，避免了版本冲突，也让项目协作和部署变得更加简单可靠。

核心要点回顾：

- 使用 `python -m venv venv` 创建虚拟环境
- 使用 `venv\Scripts\activate`（Windows）或 `source venv/bin/activate`（Linux/macOS）激活
- 使用 `pip install` 安装依赖，`pip freeze > requirements.txt` 导出依赖清单
- 使用 `pip install -r requirements.txt` 从清单恢复依赖
- 使用 `deactivate` 退出虚拟环境
- 将 `venv/` 目录添加到 `.gitignore`，不要提交到版本控制

有了虚拟环境，每个项目都可以拥有整洁、独立的依赖空间，再也不用担心「在我电脑上能跑」的问题了！