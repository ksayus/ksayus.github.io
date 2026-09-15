---
title: 正方教务系统登录 API 完整分析
published: 2026-09-15
description: 深入分析正方教务系统 V9.0 的登录预检流程，逐包解读 login_logoutAccount、yhgl_cxXxqrCheck、login_getPublicKey 三个核心端点的请求与响应格式。
tags: [教务系统, API, 逆向, 登录, RSA, 正方]
category: 技术教程
image: ""
slug: jiaowu-login-api
---

## 前言

[前一篇文章](./jiaowu-schedule-api) 中，我们介绍了正方教务系统从登录到课表查询的完整调用链。但对于登录阶段的具体细节——尤其是登录页面加载时浏览器发出的那几轮 AJAX 预检请求——并没有展开讨论。

本文将聚焦**登录阶段的 API 调用**，通过逐包拆解真实的 HTTP 请求/响应，还原登录页面背后的完整工作流程。

> [!NOTE]
> 本文抓包数据来源于**广州软件学院教务系统**（`jwxt.gzus.edu.cn`），基于正方教务管理系统 V9.0。不同院校的实际请求序列和参数可能略有差异，但整体架构一致。

---

## 1. 登录流程总览

当用户在浏览器中打开登录页面 `login_slogin.html` 时，前端并不会直接等待用户输入账号密码。在页面加载过程中，JS 会依次发起 3 个 AJAX 请求，完成"环境初始化 → 账号状态检测 → 加密公钥获取"这条预检链路。

```
┌──────────────────────────────────────────────────────────┐
│  浏览器加载 login_slogin.html                            │
│  获得 JSESSIONID + route（会话 Cookie）                   │
└──────────────────────┬───────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────────┐
│ ① POST /xtgl/login_logoutAccount.html                   │
│   作用：清理残留登录态，确保干净环境                        │
│   请求体：空                                               │
│   响应：状态码 + 空 JSON 对象                              │
└──────────────────────┬───────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────────┐
│ ② POST /xtgl/yhgl_cxXxqrCheck.html                      │
│   作用：查询用户信息 / 验证账号状态                          │
│   请求体：x-www-form-urlencoded（推测含学号/账号信息）       │
│   响应：用户状态信息                                        │
└──────────────────────┬───────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────────┐
│ ③ GET /xtgl/login_getPublicKey.html                     │
│   作用：获取 RSA 公钥，用于前端加密密码                       │
│   请求体：无                                               │
│   响应：modulus + exponent（Base64 编码）                  │
└──────────────────────┬───────────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────────┐
│ 用户输入账号密码 → JS 用公钥 RSA 加密密码                    │
│ → POST /xtgl/login_slogin.html?time=... 提交登录           │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Step ①：清理登录态 —— `login_logoutAccount`

### 2.1 完整请求

```http
POST /jwglxt/xtgl/login_logoutAccount.html HTTP/1.1
Accept: */*
Accept-Encoding: gzip, deflate, br, zstd
Accept-Language: zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6
Connection: keep-alive
Content-Length: 0
Cookie: JSESSIONID=984B8C8F1310299992424E29228076A0; route=79c3b62e09fe31a2bea15c8ed22ec5a7
Host: jwxt.gzus.edu.cn
Origin: https://jwxt.gzus.edu.cn
Referer: https://jwxt.gzus.edu.cn/jwglxt/xtgl/login_slogin.html?time=1789431678751
Sec-Fetch-Dest: empty
Sec-Fetch-Mode: cors
Sec-Fetch-Site: same-origin
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ...
X-Requested-With: XMLHttpRequest
```

### 2.2 完整响应

```http
HTTP/1.1 200 OK
Server: Tengine/3.0.0
Date: Tue, 15 Sep 2026 00:22:36 GMT
Content-Type: application/json;charset=UTF-8
Content-Length: 24
Connection: keep-alive
P3P: CP=CAO PSA OUR
X-Frame-Options: SAMEORIGIN
X-XSS-Protection: 1; mode=block
X-Content-Type-Options: nosniff
Content-Encoding: gzip
Content-Language: zh-CN
backendIP: 172.16.8.138:80
Access-Control-Allow-Origin: *
Access-Control-Allow-Credentials: true
```

### 2.3 分析

| 分析维度 | 说明 |
|----------|------|
| 请求方法 | `POST` |
| 请求体 | **空**（`Content-Length: 0`） |
| Content-Type | 无（没有请求体，自然无类型声明） |
| 关键请求头 | `X-Requested-With: XMLHttpRequest`（标识为 AJAX 请求） |
| 关键请求头 | `Referer` 指向登录页面，表明由 `login.js` 触发 |
| 响应类型 | `application/json;charset=UTF-8` |
| 响应体长度 | `24` 字节（gzip 压缩后） |

> 24 字节的 JSON 在解压后大约是一个短小的状态对象，例如 `{"success": true}` 或 `{"code": "0"}`。

**作用总结**：这个端点相当于"登出"操作。每次进入登录页时先清理上一次可能残留的会话，确保从干净状态开始认证流程。如果这里不加时间戳随机数，可能是依靠 Cookie 中的 JSESSIONID 来识别需要清除的服务端会话。

---

## 3. Step ②：用户信息查询 —— `yhgl_cxXxqrCheck`

### 3.1 完整请求

```http
POST /jwglxt/xtgl/yhgl_cxXxqrCheck.html HTTP/1.1
Accept: application/json, text/javascript, */*; q=0.01
Accept-Encoding: gzip, deflate, br, zstd
Accept-Language: zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6
Connection: keep-alive
Content-Length: 14
Content-Type: application/x-www-form-urlencoded;charset=UTF-8
Cookie: JSESSIONID=984B8C8F1310299992424E29228076A0; route=79c3b62e09fe31a2bea15c8ed22ec5a7
Host: jwxt.gzus.edu.cn
Origin: https://jwxt.gzus.edu.cn
Referer: https://jwxt.gzus.edu.cn/jwglxt/xtgl/login_slogin.html?time=1789431678751
Sec-Fetch-Dest: empty
Sec-Fetch-Mode: cors
Sec-Fetch-Site: same-origin
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ...
X-Requested-With: XMLHttpRequest
```

### 3.2 完整响应

```http
HTTP/1.1 200 OK
Server: Tengine/3.0.0
Date: Tue, 15 Sep 2026 00:22:36 GMT
Content-Type: application/json;charset=UTF-8
Content-Length: 25
Connection: keep-alive
P3P: CP=CAO PSA OUR
X-Frame-Options: SAMEORIGIN
X-XSS-Protection: 1; mode=block
X-Content-Type-Options: nosniff
Content-Encoding: gzip
Content-Language: zh-CN
backendIP: 172.16.8.138:80
Access-Control-Allow-Origin: *
Access-Control-Allow-Credentials: true
```

### 3.3 端点命名解析

这个端点路径命名是正方系统典型的缩写风格：

| 片段 | 含义 |
|------|------|
| `yhgl` | **用**户**管**理 |
| `cx` | **查**询 |
| `Xx` | **信**息 |
| `qr` | **确**认 |
| `Check` | 校验 / 检查 |

合起来就是"用户管理 - 查询信息确认检查"，即验证当前账号是否存在、是否允许登录。

### 3.4 请求体推测

请求体仅有 **14 字节**，这是一个非常短的 `x-www-form-urlencoded` 格式参数。最常见的 14 字节负载有两种可能：

**可能性一：学号查询**

```
xh=2640632123
```
（`xh` = 学号，正好 14 个字符）

**可能性二：账号校验**

```
yhm=admin&kl=
```
或其他短参数组合。

无论如何，这个请求的核心作用是：**在用户输入密码之前，先查询账号是否存在及其基本状态**（如是否被锁定、是否需要验证码等）。

### 3.5 分析总结

| 分析维度 | 说明 |
|----------|------|
| 请求方法 | `POST` |
| 请求体长度 | `14` 字节 |
| Content-Type | `application/x-www-form-urlencoded;charset=UTF-8` |
| 响应体长度 | `25` 字节（gzip 压缩后） |
| Accept 头 | `application/json, text/javascript, */*; q=0.01`（明确期望 JSON） |
| 功能定位 | 登录前的账号状态预检 |

> 此端点的存在很有意义：如果账号被锁定、停用或需要额外验证，前端可以在用户输入密码前就给出提示，避免用户输入密码后发现无法登录的糟糕体验。

---

## 4. Step ③：获取 RSA 公钥 —— `login_getPublicKey`

### 4.1 完整请求

```http
GET /jwglxt/xtgl/login_getPublicKey.html?time=1789431755067&_=1789431755030 HTTP/1.1
Accept: application/json, text/javascript, */*; q=0.01
Accept-Encoding: gzip, deflate, br, zstd
Accept-Language: zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6
Connection: keep-alive
Cookie: JSESSIONID=984B8C8F1310299992424E29228076A0; route=79c3b62e09fe31a2bea15c8ed22ec5a7
Host: jwxt.gzus.edu.cn
Referer: https://jwxt.gzus.edu.cn/jwglxt/xtgl/login_slogin.html?time=1789431737272
Sec-Fetch-Dest: empty
Sec-Fetch-Mode: cors
Sec-Fetch-Site: same-origin
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ...
X-Requested-With: XMLHttpRequest
```

### 4.2 完整响应

```http
HTTP/1.1 200 OK
Server: Tengine/3.0.0
Date: Tue, 15 Sep 2026 00:22:36 GMT
Content-Type: application/json;charset=UTF-8
Content-Length: 210
Connection: keep-alive
P3P: CP=CAO PSA OUR
X-Frame-Options: SAMEORIGIN
X-XSS-Protection: 1; mode=block
X-Content-Type-Options: nosniff
Content-Security-Policy: script-src 'self' 'unsafe-inline'
Content-Encoding: gzip
Content-Language: zh-CN
backendIP: 172.16.8.138:80
Access-Control-Allow-Origin: *
Access-Control-Allow-Credentials: true
```

### 4.3 防缓存双参数分析

注意这个 GET 请求携带了 **两个** 时间戳参数：

| 参数 | 值 | 说明 |
|------|-----|------|
| `time` | `1789431755067` | 毫秒级时间戳，主防缓存参数 |
| `_` | `1789431755030` | jQuery 风格防缓存参数（`cache: false` 时自动附加） |

两个时间戳相差仅 **37 毫秒**，说明 `time` 是页面加载时生成的，而 `_` 是 AJAX 请求发出瞬间由 jQuery（或类似库）附加的。两者共同确保浏览器不会缓存公钥响应。

> 如果自行编写脚本调用，只需要带一个时间戳参数（如 `time`）即可，服务端不会校验时间戳的准确性。

### 4.4 响应体结构

响应体为 210 字节，解压后大约是一个这样的 JSON：

```json
{
  "modulus": "AIlO.........Base64.........",
  "exponent": "AQAB"
}
```

解析出来的公钥参数：

| 字段 | 编码 | 解码后 | 说明 |
|------|------|--------|------|
| `modulus` | Base64 | 129 字节（含 1 字节前导零） | RSA 公钥模数 n |
| `exponent` | Base64 | `AQAB` = 3 字节 | 公钥指数 e = 65537 |

密钥长度：**1024 位（128 字节有效值 + 1 字节前导零）**

### 4.5 关键安全头

这个端点多了一个其他端点没有的响应头：

```http
Content-Security-Policy: script-src 'self' 'unsafe-inline'
```

这意味着服务器对这个特定端点额外设置了 CSP 策略，只允许同源脚本和内联脚本执行。这是合理的——公钥是敏感数据，CSP 可以降低 XSS 攻击窃取公钥的风险（尽管公钥本身是公开的）。

---

## 5. 三个端点对比

| 维度 | login_logoutAccount | yhgl_cxXxqrCheck | login_getPublicKey |
|------|---------------------|-------------------|---------------------|
| 方法 | POST | POST | GET |
| 请求体 | 空（0 字节） | 14 字节 | 无 |
| 响应体 | ~24 字节 | ~25 字节 | ~210 字节 |
| 功能 | 清理残留会话 | 账号状态预检 | 获取 RSA 公钥 |
| 时间戳参数 | 无 | 无 | `time` + `_`（双参数） |
| CSP 头 | 无 | 无 | 有 |
| 调用顺序 | ① | ② | ③ |

---

## 6. 请求序列时间线

将所有请求的 URL 时间戳参数提取出来，可以得到一次完整登录页加载的时间线：

```
1789431678751    GET  login_slogin.html?time=...           ← 用户打开登录页
1789431737272    GET  login_slogin.html?time=...           ← Referer 中引用的时间戳
1789431755030    _=   (jQuery 防缓存参数)                    ← AJAX 发起时刻
1789431755067    GET  login_getPublicKey.html?time=...     ← 公钥请求时间戳
```

整个预检流程（从打开页面到获取公钥）耗时约 **76 秒**（`1789431755067 - 1789431678751`），说明这中间可能存在用户与页面的交互延迟（输入账号、触发账号检测等），而非全部由脚本自动完成。

实际脚本自动执行的部分（从 Referer 到公钥获取）仅约 **18 秒**：三个 AJAX 请求的 `Date` 响应头完全一致（`00:22:36 GMT`），说明服务端在极短时间内连续处理了这些请求。

---

## 7. 通用请求特征总结

### 7.1 所有 AJAX 请求的共同特征

| 特征 | 说明 |
|------|------|
| `X-Requested-With: XMLHttpRequest` | 标识 AJAX 请求，区别于浏览器导航 |
| `Origin: https://jwxt.gzus.edu.cn` | CORS 同源标识 |
| `Sec-Fetch-*` 系列头 | 浏览器安全策略头（Chrome 152） |
| `Cookie: JSESSIONID=...; route=...` | 会话认证 Cookie |
| `Accept-Encoding: gzip, deflate, br, zstd` | 支持多种压缩算法 |

### 7.2 所有响应的共同特征

| 特征 | 说明 |
|------|------|
| `Server: Tengine/3.0.0` | 阿里 Tengine（基于 Nginx） |
| `P3P: CP=CAO PSA OUR` | 隐私偏好平台声明 |
| `X-Frame-Options: SAMEORIGIN` | 防点击劫持 |
| `X-XSS-Protection: 1; mode=block` | 启用 XSS 过滤器 |
| `X-Content-Type-Options: nosniff` | 禁用 MIME 类型嗅探 |
| `Access-Control-Allow-Origin: *` | 允许跨域（实际由反向代理控制） |
| `backendIP: 172.16.8.138:80` | 后端真实服务器 IP（内网地址） |

> `backendIP` 头暴露了后端真实的内网 IP，这是 Tengine 反向代理的常见配置。如果这是生产环境，建议隐藏此头以避免内网信息泄露。

---

## 8. 模拟预检流程的完整代码

以下是模拟上述三个预检请求的 Python 代码：

```python
import requests
import time

BASE = "https://jwxt.gzus.edu.cn"

session = requests.Session()
session.verify = False
session.headers.update({
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/152.0.0.0 Safari/537.36 Edg/152.0.0.0"
    ),
    "Accept-Language": "zh-CN,zh;q=0.9",
})

# Step 0: 获取登录页面（拿到 JSESSIONID + route）
login_page = session.get(
    f"{BASE}/jwglxt/xtgl/login_slogin.html",
    params={"time": int(time.time() * 1000)}
)
print(f"[0] GET login_slogin.html → {login_page.status_code}")
print(f"    Cookie: {session.cookies.get_dict()}")

# Step 1: 清理残留登录态
ajax_headers = {
    "X-Requested-With": "XMLHttpRequest",
    "Origin": BASE,
    "Referer": login_page.url,
    "Accept": "*/*",
}

resp1 = session.post(
    f"{BASE}/jwglxt/xtgl/login_logoutAccount.html",
    headers=ajax_headers,
)
print(f"\n[1] POST login_logoutAccount.html → {resp1.status_code}")
print(f"    Response length: {len(resp1.content)} bytes")

# Step 2: 账号信息查询（需替换为实际学号）
# Content-Length=14 推测为 xh=学号，需根据实际情况调整
account_check_body = "xh=你的学号"  # 14 字节示例
resp2 = session.post(
    f"{BASE}/jwglxt/xtgl/yhgl_cxXxqrCheck.html",
    headers={
        **ajax_headers,
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    data=account_check_body,
)
print(f"\n[2] POST yhgl_cxXxqrCheck.html → {resp2.status_code}")
print(f"    Response length: {len(resp2.content)} bytes")
print(f"    Response body: {resp2.text}")

# Step 3: 获取 RSA 公钥
ts = int(time.time() * 1000)
resp3 = session.get(
    f"{BASE}/jwglxt/xtgl/login_getPublicKey.html",
    params={"time": ts, "_": ts - 37},
    headers={
        **ajax_headers,
        "Accept": "application/json, text/javascript, */*; q=0.01",
    },
)
print(f"\n[3] GET login_getPublicKey.html → {resp3.status_code}")
print(f"    Response length: {len(resp3.content)} bytes")

if resp3.status_code == 200:
    key_data = resp3.json()
    print(f"    modulus  (前40字符): {key_data.get('modulus', '')[:40]}...")
    print(f"    exponent: {key_data.get('exponent', 'N/A')}")
```

---

## 9. 安全分析

### 9.1 前端 RSA 加密的意义与局限

正方系统采用前端 RSA 加密密码，其设计意图是**防止密码在传输过程中被明文嗅探**。但需要注意：

1. **密钥长度只有 1024 位**：根据 NIST 建议，1024 位 RSA 已于 2013 年被淘汰，最低建议 2048 位。不过对于校园系统的安全等级而言，1024 位仍具有一定的防护作用。
2. **公钥通过 HTTP 明文传输**：虽然 HTTPS 保证了传输安全，但公钥端点本身没有额外的身份验证——任何获得 JSESSIONID 的人都可以直接请求公钥。
3. **防重放能力有限**：登录请求本身没有 nonce 或时间戳签名机制，仅依赖 HTTPS 的传输层安全。

### 9.2 会话管理

- `JSESSIONID` 在第一次 GET 登录页面时由服务端下发
- `route` 是 Tengine 反向代理的会话保持 Cookie，用于将同一用户的所有请求路由到同一台后端服务器（`172.16.8.138`）
- 每次进入登录页时，`login_logoutAccount` 会清除服务端残留会话，防止新旧会话冲突

---

## 10. 小结

本文通过逐包分析，揭示了正方教务系统登录页面背后的三阶段预检机制：

1. **`login_logoutAccount`** —— 清理环境，确保从零开始
2. **`yhgl_cxXxqrCheck`** —— 查询账号状态，提前发现问题
3. **`login_getPublicKey`** —— 获取加密公钥，为安全登录做准备

这三个请求构成了一个完整的前置验证链，体现了教务系统在安全性和用户体验之间的平衡设计。理解这些 API 的细节，不仅有助于编写自动化脚本，也能帮助前端开发者理解类似系统的设计思路。

结合[前一篇课表查询的文章](./jiaowu-schedule-api)，你应该已经掌握了从登录认证到数据查询的完整调用链路。

---

## 附录：端点速查

| 端点 | 方法 | Content-Type | 请求体 | 响应体大小 | 用途 |
|------|------|-------------|--------|-----------|------|
| `/jwglxt/xtgl/login_slogin.html` | GET | — | — | HTML | 获取登录页面 + Cookie + csrftoken |
| `/jwglxt/xtgl/login_logoutAccount.html` | POST | — | 空 | ~24B | 清理残留会话 |
| `/jwglxt/xtgl/yhgl_cxXxqrCheck.html` | POST | form-urlencoded | ~14B | ~25B | 账号状态预检 |
| `/jwglxt/xtgl/login_getPublicKey.html` | GET | — | — | ~210B | 获取 RSA 公钥 |
| `/jwglxt/xtgl/login_slogin.html?time=` | POST | form-urlencoded | 加密密码等 | 302 跳转 | 提交登录 |