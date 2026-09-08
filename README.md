<div align="center">

# 🐱 Ksayus の 猫窝

> 这里是小猫的代码博客喵

[![Node.js](https://img.shields.io/badge/node.js-%3E%3D22-brightgreen)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-%3E%3D11-blue)](https://pnpm.io/)
[![Astro](https://img.shields.io/badge/Astro-7-orange)](https://astro.build/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

</div>

---

## 📖 关于本站

**Ksayus の 猫窝** 是 Ksayus 的个人技术博客，基于 [Astro](https://astro.build/) 框架和 [Firefly](https://github.com/CuteLeaf/Firefly) 主题构建。

在这里，你可以找到：

- 💻 **技术笔记** — 前端、后端、运维等方向的学习与实践记录
- 🎮 **ACGN 文化** — 动漫、游戏、轻小说相关的分享
- 📝 **生活随笔** — 日常思考与碎碎念
- 🔧 **折腾记录** — 建站、工具、效率提升的经验

## ✨ 技术栈

| 分类 | 技术 |
|------|------|
| 框架 | [Astro 7](https://astro.build/) |
| 样式 | [Tailwind CSS](https://tailwindcss.com/) |
| 交互 | [Svelte](https://svelte.dev/) |
| 动画 | [Swup](https://swup.js.org/) 页面过渡 |
| 搜索 | [Pagefind](https://pagefind.app/) 全文搜索 |
| 部署 | Cloudflare Pages |
| 主题 | [Firefly](https://github.com/CuteLeaf/Firefly)（基于 [fuwari](https://github.com/saicaca/fuwari) 二次开发） |

## 🚀 本地开发

### 环境要求

- Node.js ≥ 22
- pnpm ≥ 11

### 启动步骤

```bash
# 1. 安装依赖
pnpm install

# 2. 启动开发服务器
pnpm dev
```

博客将在 `http://localhost:4321` 启动。

### 常用命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动本地开发服务器 |
| `pnpm build` | 构建生产版本到 `./dist/` |
| `pnpm preview` | 本地预览构建产物 |
| `pnpm check` | 检查代码类型与错误 |
| `pnpm format` | 格式化代码 |
| `pnpm new-post <文件名>` | 创建新文章 |
| `pnpm new-d <内容>` | 创建一条动态 |

## 📁 项目结构

```
.
├── public/                  # 静态资源（图片、字体、favicon 等）
│   ├── assets/              # CSS、JS、图片、音乐
│   ├── favicon/             # 站点图标
│   └── gallery/             # 相册图片
├── src/
│   ├── components/          # 可复用组件
│   ├── config/              # 站点配置（核心）
│   │   ├── siteConfig.ts    # 站点基础配置
│   │   ├── backgroundWallpaper.ts  # 背景壁纸与首页横幅
│   │   ├── navBarConfig.ts  # 导航栏
│   │   ├── sidebarConfig.ts # 侧边栏
│   │   └── ...              # 其他功能模块配置
│   ├── content/
│   │   ├── posts/           # 博客文章（Markdown / MDX）
│   │   └── dynamic/         # 动态内容
│   ├── layouts/             # 页面布局
│   ├── pages/               # 页面路由
│   └── styles/              # 全局样式
└── astro.config.mjs         # Astro 配置
```

## ✍️ 写文章

### 创建新文章

使用快捷命令创建（会自动生成 frontmatter 模板）：

```bash
pnpm new-post 我的第一篇文章
```

生成的文件位于 `src/content/posts/`，编辑即可。

### 文章 Frontmatter

```yaml
---
title: 文章标题
published: 2024-01-01        # 发布日期
description: 文章摘要描述    # 用于 SEO 和列表预览
image: ./cover.jpg           # 封面图（相对路径或远程 URL）
tags: [标签1, 标签2]         # 标签
category: 分类名             # 分类
draft: false                 # 是否为草稿（草稿不发布）
pinned: false                # 是否置顶
comment: true                # 是否允许评论
---
```

### 写动态

```bash
pnpm new-d 今天的动态内容
```

动态文件保存在 `src/content/dynamic/`，支持 Markdown 语法。

## ⚙️ 配置说明

站点的所有配置都集中在 `src/config/` 目录下，常用配置文件：

| 文件 | 说明 |
|------|------|
| `siteConfig.ts` | 站点标题、URL、语言、主题色、favicon |
| `backgroundWallpaper.ts` | 首页横幅标题、副标题、壁纸、轮播 |
| `navBarConfig.ts` | 导航栏菜单、Logo |
| `sidebarConfig.ts` | 侧边栏组件与布局 |
| `profileConfig.ts` | 个人资料（头像、昵称、简介、社交链接） |
| `friendsConfig.ts` | 友链页面 |
| `footerConfig.ts` | 页脚内容 |
| `musicConfig.ts` | 背景音乐播放器 |
| `commentConfig.ts` | 评论系统（Twikoo 等） |

## 📄 Markdown 教程

本站支持丰富的 Markdown 扩展语法，详细用法请参考博客内的 [Markdown 编写教程](/posts/markdown-tutorial/)。

核心扩展包括：

- 📌 **提醒块（Callouts）** — 支持 GitHub / Obsidian / VitePress / Docusaurus 四种风格
- 🔗 **GitHub 仓库卡片** — 一行代码展示仓库信息
- 🎨 **增强代码块** — 基于 Expressive Code，支持行号、高亮、折叠
- 📊 **Mermaid / PlantUML** — 在文章中绘制图表
- 🧮 **KaTeX** — 数学公式渲染

## 📝 许可协议

本项目代码遵循 [MIT License](./LICENSE) 开源协议。

文章内容版权归作者所有，未经授权请勿转载。

---

<div align="center">

Made with 🐱 by **Ksayus** · Powered by [Astro](https://astro.build/) & [Firefly](https://github.com/CuteLeaf/Firefly)

</div>