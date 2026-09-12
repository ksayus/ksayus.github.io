---
title: 正方教务系统课表查询 API 逆向分析
published: 2026-09-13
description: 以广州软件学院教务系统为例，详解正方教务管理系统 V9.0 的登录流程、RSA 加密机制以及课表查询 API 的完整调用方法，附 Python 实战代码。
tags: [教务系统, API, 逆向, RSA, Python, 课表查询]
category: 技术教程
image: ""
slug: jiaowu-schedule-api
---

## 前言

大学教务系统通常采用**正方教务管理系统**（V9.0），这是一个广泛使用的高校教务平台。虽然系统本身不提供公开 API，但通过分析前端页面的网络请求，我们可以直接调用后端接口获取课表等数据。

本文以**广州软件学院教务系统**（`jwxt.gzus.edu.cn`）为例，详细讲解从登录认证到课表查询的完整流程与实现。

> [!NOTE]
> 本文内容基于系统页面分析和公开技术资料编写，仅供学习研究使用。不同学校的正方教务系统可能略有差异，请根据实际情况调整。

---

## 1. API 总览

本系统采用前后端分离架构，课表数据通过 AJAX POST 请求获取 JSON 格式响应。

| 项目 | 说明 |
|---|---|
| Base URL | `https://jwxt.gzus.edu.cn/jwglxt` |
| 课表查询端点 | `/kbcx/xskbcx_cxXsgrkb.html?gnmkdm=N2151` |
| 请求方法 | `POST` |
| Content-Type | `application/x-www-form-urlencoded;charset=UTF-8` |
| 认证方式 | Cookie（JSESSIONID + route） |
| 响应格式 | JSON |
| gnmkdm | `N2151`（功能模块代码：学生个人课表） |

---

## 2. 登录流程（获取会话 Cookie）

在调用课表 API 之前，必须先完成登录获取有效的 `JSESSIONID` 和 `route` Cookie。

### 2.1 整体流程

```
┌─────────────────────────────────────────────┐
│  Step 1: GET 登录页面                        │
│  GET /jwglxt/xtgl/login_slogin.html         │
│  获取 JSESSIONID + route Cookie              │
│  从 HTML 中提取 csrftoken                    │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│  Step 2: GET RSA 公钥                        │
│  GET /jwglxt/xtgl/login_getPublicKey.html    │
│  返回 {"modulus":"...","exponent":"AQAB"}    │
│  1024 位 RSA 公钥                            │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│  Step 3: RSA 加密密码                        │
│  PKCS#1 v1.5 填充 + 服务器公钥加密           │
│  输出 Base64 格式                            │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│  Step 4: POST 登录                           │
│  POST /jwglxt/xtgl/login_slogin.html?time=   │
│  提交表单：csrftoken + yhm + mm + language   │
│  成功后跳转至首页                             │
└─────────────────────────────────────────────┘
```

### 2.2 登录页面关键 HTML 字段

| 字段名 | 说明 | 示例值 |
|---|---|---|
| csrftoken | CSRF 令牌（逗号分隔的 UUID 对） | `xxxx-xxxx-xxxx,xxxxxxxxxxxxxxxx` |
| mmsfjm | 密码是否加密（1=加密） | `1` |
| yzcskz | 验证码触发次数 | `3` |
| dlsbsdsj | 登录失败锁定时间（分钟） | `3` |
| xxdm | 学校代码 | `12618` |

### 2.3 RSA 加密细节

前端 JS 加密流程（`login.js`）：

```javascript
var rsaKey = new RSAKey();
rsaKey.setPublic(b64tohex(modulus), b64tohex(exponent));
var enPassword = hex2b64(rsaKey.encrypt(password));
```

Python 等效实现（使用 `cryptography` 库）：

```python
from cryptography.hazmat.primitives.asymmetric import rsa, padding
import base64

modulus = int.from_bytes(base64.b64decode(modulus_b64), 'big')
exponent = int.from_bytes(base64.b64decode('AQAB'), 'big')
pub_key = rsa.RSAPublicNumbers(exponent, modulus).public_key()
encrypted = pub_key.encrypt(password.encode('utf-8'), padding.PKCS1v15())
encrypted_b64 = base64.b64encode(encrypted).decode()
```

### 2.4 关键实现细节

登录过程中有几个容易被忽略的细节：

1. **公钥 modulus 的前导零字节**：modulus 占 129 字节，但实际密钥为 **1024 位 = 128 字节**，解析时注意去掉前导零
2. **登录 URL 的时间戳**：必须附加 `?time=<毫秒时间戳>` 参数（由 `login.js` 动态添加）
3. **csrftoken 中的逗号不需 URL 编码**：浏览器表单提交行为如此
4. **加密后的密码需 URL 编码**：Base64 中的 `+`、`/`、`=` 需转义为 `%2B`、`%2F`、`%3D`

---

## 3. 课表查询 API 详解

### 3.1 请求格式

```http
POST /jwglxt/kbcx/xskbcx_cxXsgrkb.html?gnmkdm=N2151 HTTP/1.1
Host: jwxt.gzus.edu.cn
Accept: */*
Content-Type: application/x-www-form-urlencoded;charset=UTF-8
X-Requested-With: XMLHttpRequest
Referer: https://jwxt.gzus.edu.cn/jwglxt/kbcx/xskbcx_cxXskbcxIndex.html?gnmkdm=N2151&layout=default
Origin: https://jwxt.gzus.edu.cn
Cookie: JSESSIONID=<会话ID>; route=<路由值>

xnm=2025&xqm=12&kzlx=ck&xsdm=
```

### 3.2 请求参数说明

| 参数 | 必填 | 说明 | 示例 |
|---|---|---|---|
| gnmkdm | ✅ 必填 | 功能模块代码（URL Query 参数） | `N2151` |
| xnm | ✅ 必填 | 学年码（学年起始年份） | `2025`（2025-2026学年） |
| xqm | ✅ 必填 | 学期码 | `3`=第一学期 / `12`=第二学期 / `16`=第三学期（短学期） |
| kzlx | ⚪ 可选 | 查询类型（固定值 `ck` = 查看） | `ck` |
| xsdm | ⚪ 可选 | 院系代码（个人课表可留空） | `""`（空） |

> [!TIP]
> 不同学校的请求参数可能略有差异。如果响应 `kbList` 为空，建议登录后在浏览器 F12 网络面板中确认实际请求体内容和字段名。

### 3.3 响应格式

响应为 JSON 对象，核心数据在 `kbList` 数组中：

```json
{
  "kbList": [
    {
      "kcmc": "高等数学",
      "kcxzmc": "必修",
      "xf": "4.0",
      "cdmc": "教学楼A-101",
      "xm": "张三",
      "jc": "0102",
      "xq": "1",
      "zcd": "01-16",
      "jxbmc": "高等数学-01班",
      "bjmc": "软件工程1班",
      "xqmc": "2025-2026-2",
      "zcs": "01",
      "zce": "16",
      "jcor": "01",
      "jcend": "02"
    }
  ],
  "xxmc": "广州软件学院",
  "xqmc": "2025-2026学年第二学期",
  "xsxm": "学生姓名",
  "xsbh": "2640632123"
}
```

### 3.4 响应字段说明

| 字段 | 类型 | 说明 |
|---|---|---|
| kcmc | String | 课程名称 |
| kcxzmc | String | 课程性质（必修/选修/公共选修等） |
| xf | String | 学分 |
| cdmc | String | 教室名称 / 上课地点 |
| xm | String | 授课教师姓名 |
| jc | String | 节次编码（格式：开始节+结束节，如 "0102" = 第1-2节） |
| xq | String | 星期（1=周一 ... 7=周日） |
| zcd | String | 周次范围（如 "01-16" = 第1-16周） |
| jxbmc | String | 教学班名称 |
| bjmc | String | 行政班名称 |
| zcs | String | 开始周次 |
| zce | String | 结束周次 |
| jcor | String | 开始节次 |
| jcend | String | 结束节次 |

---

## 4. Python 完整调用示例

以下是一个完整的 Python 示例，演示从登录到查询课表的全流程：

```python
import requests
import base64
import re
import time
import json
import urllib3
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from urllib.parse import quote

urllib3.disable_warnings()

BASE = "https://jwxt.gzus.edu.cn"
USERNAME = "你的学号"
PASSWORD = "你的密码"

# === 创建会话 ===
session = requests.Session()
session.verify = False
session.headers["User-Agent"] = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)

# === Step 1: 获取登录页面 + csrftoken ===
page = session.get(f"{BASE}/jwglxt/xtgl/login_slogin.html")
csrf = re.search(r'id="csrftoken".*?value="([^"]*)"', page.text).group(1)

# === Step 2: 获取 RSA 公钥 ===
key_data = session.get(
    f"{BASE}/jwglxt/xtgl/login_getPublicKey.html",
    headers={"X-Requested-With": "XMLHttpRequest"}
).json()

# === Step 3: RSA 加密密码 ===
mod = int.from_bytes(base64.b64decode(key_data["modulus"]), 'big')
exp = int.from_bytes(base64.b64decode(key_data["exponent"]), 'big')
pub_key = rsa.RSAPublicNumbers(exp, mod).public_key()
enc_pw = base64.b64encode(
    pub_key.encrypt(PASSWORD.encode(), padding.PKCS1v15())
).decode()

# === Step 4: 登录 ===
body = (
    f"csrftoken={csrf}&yhm={USERNAME}"
    f"&mm={quote(enc_pw, safe='')}&language=zh_CN"
)

resp = session.post(
    f"{BASE}/jwglxt/xtgl/login_slogin.html?time={int(time.time() * 1000)}",
    data=body,
    headers={
        "Content-Type": "application/x-www-form-urlencoded",
        "Origin": BASE,
        "Referer": f"{BASE}/jwglxt/xtgl/login_slogin.html"
    },
    allow_redirects=False
)

if resp.status_code in (301, 302):
    print("✅ 登录成功！")
else:
    print("❌ 登录失败，请检查账号密码")
    exit(1)

# === Step 5: 查询课表 ===
schedule = session.post(
    f"{BASE}/jwglxt/kbcx/xskbcx_cxXsgrkb.html?gnmkdm=N2151",
    headers={
        "Accept": "*/*",
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": (
            f"{BASE}/jwglxt/kbcx/xskbcx_cxXskbcxIndex.html"
            "?gnmkdm=N2151&layout=default"
        ),
    },
    data="xnm=2025&xqm=12&kzlx=ck&xsdm="
)

result = schedule.json()
print(f"\n📅 {result.get('xqmc', '未知学期')}")
print(f"👤 {result.get('xsxm', '未知')} | 共 {len(result.get('kbList', []))} 门课\n")

for course in result.get("kbList", []):
    print(
        f"📖 {course['kcmc']} | 👨‍🏫 {course['xm']} | "
        f"周{course['xq']} 第{course['jcor']}-{course['jcend']}节 "
        f"| 📍 {course['cdmc']}"
    )
```

运行成功后将输出类似如下内容：

```
✅ 登录成功！

📅 2025-2026学年第二学期
👤 张三 | 共 8 门课

📖 高等数学 | 👨‍🏫 李老师 | 周一 第01-02节 | 📍 教学楼A-101
📖 大学英语 | 👨‍🏫 王老师 | 周二 第03-04节 | 📍 教学楼B-203
...
```

---

## 5. 注意事项

### 5.1 学期参数对照表

| xnm（学年） | xqm（学期码） | 对应学期 |
|---|---|---|
| 2025 | 3 | 2025-2026学年 第一学期（秋季） |
| 2025 | 12 | 2025-2026学年 第二学期（春季） |
| 2025 | 16 | 2025-2026学年 第三学期（短学期） |
| 2026 | 3 | 2026-2027学年 第一学期（秋季） |

### 5.2 常见错误排查

| 错误现象 | 可能原因 | 解决方案 |
|---|---|---|
| API 返回空 / HTML | 未登录 / Session 失效 | 重新执行登录流程获取新 Cookie |
| API 返回 JSON 但 kbList 为空 | 学年/学期参数错误 | 调整 xnm 和 xqm 参数值 |
| RSA 加密后登录失败 | 加密实现有误 | 确认使用 PKCS#1 v1.5 填充，确认公钥正确获取 |

### 5.3 关键实现要点总结

1. 登录 URL 必须附带 `?time=<毫秒时间戳>`（由 `login.js` 动态添加）
2. csrftoken 从登录页 HTML 的 `<input id="csrftoken">` 中提取
3. RSA 公钥的 modulus 有前导零字节，实际密钥长度为 1024 位（128 字节）
4. 加密后的密码为 Base64 格式，其中 `+`/`/`/`=` 需 URL 编码为 `%2B`/`%2F`/`%3D`
5. csrftoken 中的逗号**不需要** URL 编码
6. 所有请求需携带 `Cookie: JSESSIONID=...; route=...`
7. 课表 API 请求需设置 `X-Requested-With: XMLHttpRequest` 头

---

## 6. 端点速查表

| 端点 | 方法 | 用途 | 关键参数 |
|---|---|---|---|
| `/jwglxt/xtgl/login_slogin.html` | GET | 获取登录页面 | 返回 csrftoken + Cookie |
| `/jwglxt/xtgl/login_getPublicKey.html` | GET | 获取 RSA 公钥 | 返回 `{modulus, exponent}` |
| `/jwglxt/xtgl/login_slogin.html?time=` | POST | 提交登录 | csrftoken, yhm, mm（加密）, language |
| `/jwglxt/xtgl/login_logoutAccount.html` | POST | 登出已有账号 | csrfTokenLogout |
| `/jwglxt/xtgl/yhgl_cxXxqrCheck.html` | POST | 信息确认检查 | yhm |
| `/jwglxt/kbcx/xskbcx_cxXsgrkb.html?gnmkdm=N2151` | POST | **查询个人课表** | xnm, xqm, kzlx, xsdm |
| `/jwglxt/kbcx/xskbcx_cxXskbcxIndex.html` | GET | 课表查询页面（前端） | gnmkdm, layout |
| `/jwglxt/kaptcha?time=` | GET | 获取验证码图片 | time（时间戳） |

---

> **文档生成日期**：2026-09-13
>
> 本文档基于系统页面分析和公开技术资料编写，仅供参考学习使用。