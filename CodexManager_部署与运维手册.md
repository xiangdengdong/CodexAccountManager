# CodexManager 部署与运维手册

> 记录时间：2026-05-13  
> 部署方式：Docker All-in-One（单容器）  
> 平台：Windows Server（本机宿主）

---

## 目录

1. [项目简介](#1-项目简介)
2. [部署方式与目录结构](#2-部署方式与目录结构)
3. [当前环境快照](#3-当前环境快照)
4. [平台秘钥（Platform Key）](#4-平台秘钥platform-key)
5. [账号管理](#5-账号管理)
6. [聚合 API 管理](#6-聚合-api-管理)
7. [路由策略说明](#7-路由策略说明)
8. [Codex CLI 接入配置](#8-codex-cli-接入配置)
9. [常用运维命令](#9-常用运维命令)
10. [遇到的问题与解决方案](#10-遇到的问题与解决方案)
11. [后续拓展建议](#11-后续拓展建议)

---

## 1. 项目简介

CodexManager 是一个 Codex / OpenAI 账号与聚合 API 的网关管理平台，核心功能：

- 统一管理多个 ChatGPT Plus/Pro 账号，自动刷新 Token、轮转负载
- 接入第三方聚合 API（ailjf.fun 等中转站），实现主备切换
- 对外暴露一个标准 OpenAI 兼容接口，Codex CLI / VS Code Copilot 等客户端无需感知上游变化
- Web UI 可视化管理（账号状态、用量、聚合测试等）

仓库地址：`F:\SelfWorkFolder\Codex-Manager`

---

## 2. 部署方式与目录结构

### 2.1 部署命令

```powershell
# 在项目根目录执行（首次部署或有代码改动后重建）
cd F:\SelfWorkFolder\Codex-Manager
docker compose -f docker/docker-compose.all-in-one.yml up -d --build
```

### 2.2 关键文件

| 文件 | 说明 |
|------|------|
| `docker/docker-compose.all-in-one.yml` | All-in-One 容器编排文件 |
| `docker/Dockerfile.all-in-one` | 多阶段构建：Rust 后端 + Next.js 前端 |
| `crates/service/src/` | 后端核心逻辑（Rust） |
| `apps/src/` | 前端（Next.js 14，App Router） |

### 2.3 容器信息

| 项目 | 值 |
|------|----|
| 容器名 | `docker-codexmanager-1` |
| 镜像名 | `docker-codexmanager` |
| 服务 API 端口 | `48760`（RPC + 网关请求） |
| Web UI 端口 | `48761` |
| 数据持久化目录 | 容器内 `/data/`（包含数据库和 RPC Token） |

### 2.4 访问地址

- **Web 管理界面**：`http://localhost:48761`
- **API 网关**：`http://localhost:48760/v1`（对接 Codex CLI）
- **RPC 接口**：`http://localhost:48760/rpc`

---

## 3. 当前环境快照

> 最后更新：2026-05-13

### 整体状态

```
路由策略：ordered（有序，sort 值小优先）
平台秘钥：1 个（active）
账号池：   1 个账号（active，plus plan）
聚合池：   1 条线路（active，连通成功）
```

### 模型转发规则（modelForwardRules）

```
gpt-5.1-codex*      → gpt-5.3-codex
gpt-5.1-codex-max*  → gpt-5.3-codex
gpt-5.1-codex-mini* → gpt-5.3-codex
```

上游实际返回模型为 `gpt-5.4`（上游侧做了模型归一化映射）。

---

## 4. 平台秘钥（Platform Key）

> 平台秘钥是 Codex CLI 等客户端接入 CodexManager 网关的唯一凭证，客户端侧配置后**永久不需要更换**。

### 当前秘钥

| 字段 | 值 |
|------|----|
| 秘钥 ID | `gk_7c5b5db83d82` |
| 秘钥值（Bearer Token） | `gk_241b757b16f4` |
| 名称 | `Codex CLI - ailjf.fun (restored)` |
| 状态 | `active` |
| 客户端类型 | `codex` |
| 协议类型 | `openai_compat` |
| 路由策略 | `hybrid_rotation`（账号优先，聚合兜底） |

### 切换路由策略（PowerShell RPC 命令）

> 执行前需先获取 RPC Token，见[运维命令](#9-常用运维命令)。

```powershell
# 读取 RPC Token
$token = docker exec docker-codexmanager-1 sh -c "cat /data/codexmanager.rpc-token"
$headers = @{ 'Content-Type'='application/json'; 'X-CodexManager-Rpc-Token'=$token }

# 仅走账号池
$body = @{ jsonrpc='2.0'; id=1; method='apikey/updateModel'; params=@{
    addr='127.0.0.1:48760'; id='gk_7c5b5db83d82'; rotationStrategy='account_rotation'
}} | ConvertTo-Json -Depth 20
Invoke-WebRequest -Uri 'http://localhost:48760/rpc' -Method Post -Headers $headers -Body $body

# 仅走聚合 API
$body = @{ jsonrpc='2.0'; id=1; method='apikey/updateModel'; params=@{
    addr='127.0.0.1:48760'; id='gk_7c5b5db83d82'
    rotationStrategy='aggregate_api_rotation'; aggregateApiId='ag_34983e34a75b'
}} | ConvertTo-Json -Depth 20
Invoke-WebRequest -Uri 'http://localhost:48760/rpc' -Method Post -Headers $headers -Body $body

# 恢复混合（账号优先，聚合兜底）
$body = @{ jsonrpc='2.0'; id=1; method='apikey/updateModel'; params=@{
    addr='127.0.0.1:48760'; id='gk_7c5b5db83d82'
    rotationStrategy='hybrid_rotation'; aggregateApiId='ag_34983e34a75b'
}} | ConvertTo-Json -Depth 20
Invoke-WebRequest -Uri 'http://localhost:48760/rpc' -Method Post -Headers $headers -Body $body
```

---

## 5. 账号管理

### 5.1 当前账号列表

| 字段 | 值 |
|------|----|
| 邮箱 | `xiangdengdong@gmail.com` |
| Plan | `plus` |
| 状态 | `active` |
| statusReason | `usage_ok` |
| sort（优先级） | `0`（值越小越优先） |

### 5.2 新增账号

1. 打开 `http://localhost:48761`，进入"账号管理"
2. 点击"新增账号"，按照界面引导完成 Google OAuth 登录授权
3. 导入完成后账号状态应为 `active`，`statusReason` 为 `usage_ok`

### 5.3 账号状态说明

| 状态 | 说明 |
|------|------|
| `active` / `usage_ok` | 正常，参与路由候选 |
| `rate_limited` | 触发限速，网关会自动跳过等待恢复 |
| `suspended` | 账号被封禁或欠费，需手动处理 |
| `disabled` | 手动禁用，不参与路由 |

### 5.4 多账号优先级控制

- `sort` 值越小越优先；相同 sort 时 `ordered` 模式按健康度（P2C 算法）选择
- 通过 UI 或 RPC 修改账号 `sort` 值可调整顺序

---

## 6. 聚合 API 管理

### 6.1 当前聚合线路

| 字段 | 值 |
|------|----|
| ID | `ag_34983e34a75b` |
| 供应商名称 | `ailjf.fun` |
| URL | `https://ailjf.fun` |
| Provider 类型 | `codex` |
| 认证方式 | `apikey` |
| modelOverride | `gpt-5.3-codex` |
| 状态 | `active` |
| 最后测试状态 | `success` |

**说明**：`modelOverride` 使该聚合线路接收任意模型请求时，统一转发为 `gpt-5.3-codex`，兼容上游只支持特定模型名的场景。

### 6.2 新增聚合 API

1. 打开 Web UI → 聚合 API 管理 → 新增
2. 填写：URL（含路径前缀，如 `https://xxx.example.com`）、API Key、Provider 类型（一般选 `codex`）
3. 如果上游模型名与标准不一致，填入 `modelOverride`
4. 点击"测试连通性"，显示 `success` 后启用

### 6.3 禁用/启用聚合线路

Web UI 直接操作，或 RPC：

```powershell
# 禁用
$body = @{ jsonrpc='2.0'; id=1; method='aggregateApi/disable'; params=@{
    addr='127.0.0.1:48760'; id='ag_34983e34a75b'
}} | ConvertTo-Json -Depth 20

# 启用
$body = @{ jsonrpc='2.0'; id=1; method='aggregateApi/enable'; params=@{
    addr='127.0.0.1:48760'; id='ag_34983e34a75b'
}} | ConvertTo-Json -Depth 20
```

---

## 7. 路由策略说明

### 7.1 全局路由策略（routeStrategy）

当前值：`ordered`

| 策略 | 说明 |
|------|------|
| `ordered` | 按 sort 值从小到大依次尝试，sort 相同时 P2C 健康选择（默认推荐） |
| `balanced` | 忽略 sort，所有候选均衡分发 |

### 7.2 平台秘钥路由策略（rotationStrategy）

当前值：`hybrid_rotation`

| 策略 | 说明 |
|------|------|
| `account_rotation` | 只走账号池 |
| `aggregate_api_rotation` | 只走聚合 API |
| `hybrid_rotation` | 账号优先，账号全部失败后自动回落聚合（**推荐常用**） |

**重要**：`hybrid_rotation` 的优先级是**固定的**：账号永远先于聚合，代码层面写死，无法通过配置反转。如需"聚合优先"，需要临时切换到 `aggregate_api_rotation`。

---

## 8. Codex CLI 接入配置

### 8.1 Codex CLI 本地配置文件

路径：`C:\Users\Administrator\.codex\config.toml`

```toml
model = "gpt-5.5"
model_reasoning_effort = "low"
openai_base_url = "http://localhost:48760/v1"
```

### 8.2 认证文件

路径：`C:\Users\Administrator\.codex\auth.json`

```json
{
  "auth_mode": "apikey",
  "OPENAI_API_KEY": "gk_241b757b16f4"
}
```

### 8.3 接入说明

- `openai_base_url` 指向本机 CodexManager 网关，**不要改成 OpenAI 官方地址**
- `OPENAI_API_KEY` 填写平台秘钥值（`gk_241b757b16f4`），不是 OpenAI 官方 key
- 后续无论账号怎么换、聚合 API 怎么切换，这两个值**永久不变**

### 8.4 验证接入是否正常

```powershell
# 直接测试网关可用性
Add-Type -AssemblyName System.Net.Http
$client = New-Object System.Net.Http.HttpClient
$req = New-Object System.Net.Http.HttpRequestMessage([System.Net.Http.HttpMethod]::Post, 'http://localhost:48760/v1/responses')
$req.Headers.Add('Authorization','Bearer gk_241b757b16f4')
$req.Content = New-Object System.Net.Http.StringContent('{"model":"gpt-5.1-codex","input":"ping","stream":false}',[System.Text.Encoding]::UTF8,'application/json')
$resp = $client.SendAsync($req).Result
"STATUS=$([int]$resp.StatusCode)"
$resp.Content.ReadAsStringAsync().Result
# 期望：STATUS=200，响应 JSON 中 output[0].content[0].text = "pong"
```

---

## 9. 常用运维命令

所有 RPC 命令均需先获取 Token，建议封装为变量：

```powershell
$token = docker exec docker-codexmanager-1 sh -c "cat /data/codexmanager.rpc-token"
$headers = @{ 'Content-Type'='application/json'; 'X-CodexManager-Rpc-Token'=$token }
$rpc = 'http://localhost:48760/rpc'
```

### 查询类

```powershell
# 查看账号列表
$b = @{ jsonrpc='2.0'; id=1; method='account/list'; params=@{ addr='127.0.0.1:48760'; page=1; pageSize=20 } } | ConvertTo-Json -Depth 20
(Invoke-WebRequest -Uri $rpc -Method Post -Headers $headers -Body $b).Content

# 查看聚合 API 列表及连通状态
$b = @{ jsonrpc='2.0'; id=1; method='aggregateApi/list'; params=@{ addr='127.0.0.1:48760' } } | ConvertTo-Json -Depth 20
(Invoke-WebRequest -Uri $rpc -Method Post -Headers $headers -Body $b).Content

# 查看平台秘钥列表
$b = @{ jsonrpc='2.0'; id=1; method='apikey/list'; params=@{ addr='127.0.0.1:48760' } } | ConvertTo-Json -Depth 20
(Invoke-WebRequest -Uri $rpc -Method Post -Headers $headers -Body $b).Content

# 查看全局设置（路由策略等）
$b = @{ jsonrpc='2.0'; id=1; method='appSettings/get'; params=@{ addr='127.0.0.1:48760' } } | ConvertTo-Json -Depth 20
(Invoke-WebRequest -Uri $rpc -Method Post -Headers $headers -Body $b).Content
```

### 测试类

```powershell
# 手动触发聚合 API 连通性测试
$b = @{ jsonrpc='2.0'; id=1; method='aggregateApi/testConnection'; params=@{
    addr='127.0.0.1:48760'; id='ag_34983e34a75b'
}} | ConvertTo-Json -Depth 20
(Invoke-WebRequest -Uri $rpc -Method Post -Headers $headers -Body $b).Content
# 期望：{"result":{"ok":true,"statusCode":200,...}}
```

### 容器操作

```powershell
# 查看容器状态
docker compose -f docker/docker-compose.all-in-one.yml ps

# 重启容器（不重建镜像）
docker compose -f docker/docker-compose.all-in-one.yml restart

# 重建并启动（有代码改动时使用）
docker compose -f docker/docker-compose.all-in-one.yml up -d --build

# 查看实时日志
docker logs -f docker-codexmanager-1

# 查看最近 100 行日志
docker logs --tail 100 docker-codexmanager-1
```

---

## 10. 遇到的问题与解决方案

### 问题一：UI 显示"连接测试失败"，但实际请求正常

**现象**：
- Web UI 对聚合 API 点击"测试连通性"，返回 `failed`，错误信息为 `provider=codex; codex probe http_status=502`
- 但用平台秘钥直接请求 `/v1/responses` 返回 `200`，内容正常

**根因分析**：
- 连通性探针发送的是流式请求（`stream: true`，`Accept: text/event-stream`）
- 上游 ailjf.fun 对该探针格式返回 `502`，但对正常非流式请求返回 `200`
- 导致探针误判为失败，而实际业务请求完全可用

**解决方案**：
修改 `crates/service/src/aggregate_api.rs`，对 Codex 探针做两处调整：

1. `build_codex_probe_body()`：将 `"stream": true` 改为 `"stream": false`
2. `probe_codex_responses_endpoint()`：将请求头 `accept: text/event-stream` 改为 `accept: application/json`
3. 在 `probe_codex_endpoint()` 的 `has_model_override` 分支中，增加回退逻辑：先测 responses 端点，失败时自动回退测 models 端点，只要任一成功就判连通

修改后重建容器：
```powershell
docker compose -f docker/docker-compose.all-in-one.yml up -d --build
```

**验证**：测试连通性 RPC 返回 `ok=true`，`statusCode=200`。

---

### 问题二：聚合 API 配置 modelOverride 后请求返回 502

**现象**：
- 聚合 API 的 `modelOverride` 设置为 `gpt-5.3-codex`
- 使用 Codex CLI 发送请求时，上游返回 `502`

**根因分析**：
- 上游 ailjf.fun 的模型名与 CodexManager 探针默认请求的模型名不匹配
- 上游侧会做模型映射，但探针使用的默认模型名不被识别

**解决方案**：
探针回退逻辑修复（见问题一），同时确保 `modelOverride` 值与上游实际支持的模型名一致（可在上游管理面板确认）。

---

### 问题三：平台秘钥路由策略无法"聚合优先"

**现象**：
- `hybrid_rotation` 模式下，账号存在时永远优先走账号，聚合只作兜底
- 无法通过配置将聚合设为主线路、账号作兜底

**根因分析**：
`HybridAccountFirst` 路由逻辑在 `crates/service/src/gateway/upstream/proxy.rs` 中写死，无"聚合优先"对应策略。

**当前替代方案**：
- 如需聚合优先：将平台秘钥切换为 `aggregate_api_rotation`，账号禁用或保留待用
- 如需灵活切换：通过 UI 或 RPC 命令按需切换 rotationStrategy（见第 4 节）

---

### 问题四：Codex CLI 出现 426 WebSocket Upgrade 警告

**现象**：
Codex CLI 日志出现 `426 Upgrade Required` 或 WebSocket 相关警告。

**根因分析**：
Codex CLI 部分请求路径会尝试升级为 WebSocket 连接，而 CodexManager 网关默认不处理 WebSocket 升级，返回 `426`。

**影响**：
该警告不影响正常的 `/v1/responses` 文本请求，实际对话仍然正常完成。

**状态**：已知 Bug，不影响核心功能使用，可忽略。

---

## 11. 后续拓展建议

### 11.1 新增账号

1. 准备 ChatGPT Plus 或 Pro 账号（Google OAuth 授权）
2. Web UI → 账号管理 → 新增账号
3. 导入后确认状态为 `active` / `usage_ok`
4. 无需修改任何 Codex CLI 配置

### 11.2 新增聚合 API

1. 购买或获取中转站 API Key（需支持 Codex/OpenAI 兼容接口）
2. Web UI → 聚合 API → 新增
3. 填入 URL、Key、Provider 类型
4. 如需模型名映射，填入 `modelOverride`
5. 点击测试，成功后启用

### 11.3 多账号优先级

- `sort = 0` 优先级最高；值越大优先级越低
- 主账号设 `sort=0`，备用账号设 `sort=1`、`sort=2`，以此类推
- `ordered` 策略保证主账号可用时不会路由到备用账号

### 11.4 多聚合线路主备

- 同样通过 `sort` 值控制聚合线路优先级
- 主聚合设 `sort=0`，备用聚合设 `sort=1`
- `ordered` 策略自动保证主备顺序

### 11.5 数据备份

容器内 `/data/` 目录包含 SQLite 数据库（账号、秘钥、聚合配置）和 RPC Token，建议定期备份：

```powershell
# 将 /data 目录备份到宿主机
docker cp docker-codexmanager-1:/data ./codexmanager-data-backup-$(Get-Date -Format 'yyyyMMdd')
```

### 11.6 升级 CodexManager

```powershell
cd F:\SelfWorkFolder\Codex-Manager
git pull
docker compose -f docker/docker-compose.all-in-one.yml up -d --build
```

升级前建议先备份 `/data` 目录（见 11.5）。
---

## 2026-06-07 当前部署与运维基线

本节记录当前已经验证可用的 Docker 部署、平台 API、聚合 API、模型目录和新增供应商的安全处理方式。后续排障优先以本节为准，旧章节中的历史 ID、旧供应商和旧模型映射只作为历史参考。

### 当前 Docker 部署

当前生产使用 all-in-one 单容器部署：

```powershell
cd F:\SelfWorkFolder\Codex-Manager
docker compose -f docker/docker-compose.all-in-one.yml build codexmanager
docker compose -f docker/docker-compose.all-in-one.yml up -d codexmanager
```

当前容器与端口：

| 项目 | 当前值 |
| --- | --- |
| 容器 | `docker-codexmanager-1` |
| 镜像 | `docker-codexmanager` |
| Service / Gateway | `http://127.0.0.1:48760` |
| Web UI | `http://127.0.0.1:48761` |
| 健康检查 | `http://127.0.0.1:48760/health` 返回 `ok` |
| RPC Token | 容器内 `/data/codexmanager.rpc-token` |

常用检查命令：

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:48760/health | Select-Object -ExpandProperty Content
docker ps --filter "name=docker-codexmanager-1" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
docker logs --tail 200 docker-codexmanager-1
```

### 当前平台 API 与路由模式

当前可用平台 API：

| 项目 | 当前值 |
| --- | --- |
| 平台 API ID | `gk_7c5b5db83d82` |
| 名称 | `Link API (gs88) - recovered` |
| 状态 | `active` |
| 协议 | `openai_compat` |
| 当前路由 | `aggregate_api_rotation` |
| 固定模型 | 空，跟随 Codex 客户端请求 |

当前聚合主链路已经验证：

- `gpt-5.5` 通过 `/v1/responses` 返回 HTTP `200`。
- `gpt-5.4` 通过 `/v1/responses` 返回 HTTP `200`。
- 日志中应看到 `route_kind=aggregate_api`、`terminal_error=-`、`last_sse_event=response.completed`。

注意：当前平台 API 处在聚合轮转模式，不是账号轮转或混合轮转。账号池和账号模型映射存在，但没有在当前主 key 上做 live 切换验证。需要验证账号链路时，建议新建测试平台 key 或在低风险窗口临时切换，不要直接在正在使用的主 key 上反复切换。

### 当前聚合 API

| 聚合 API ID | 名称 | URL | 状态 | 说明 |
| --- | --- | --- | --- | --- |
| `ag_d1af5bf2a707` | `Link API (gs88)` | `https://ai.gs88.shop` | `active` | 当前可用主链路 |
| `ag_54b0334d903e` | `AI龙卷风` | `https://api.ailjf.cc` | `disabled` | 上游 key 校验失败，禁止启用 |

`AI龙卷风` 排查结论：

- `https://ailjf.cc` 主域不可作为 API base，主机连接超时或 TLS 握手 `unexpected eof while reading`。
- `https://api.ailjf.cc` 能连接，`/v1/models`、`/v1/responses`、`/v1/chat/completions` 有服务响应。
- 上游返回 `{"code":"INTERNAL_ERROR","message":"Failed to validate API key"}`。
- Bearer、`x-api-key`、`x-goog-api-key` 均测试失败。
- 结论是供应商 key、账号激活、域名归属或供应商后台校验问题，不是 CodexManager 当前路由问题。

在供应商确认前，必须保持 `AI龙卷风` 为 `disabled`，避免影响 gs88。

### 当前模型目录

当前普通模型栏默认只显示以下主模型：

- `gpt-5.4-mini`
- `gpt-5.5`
- `gpt-5.3-codex`
- `gpt-5.4`
- `gpt-5.5-pro`

图片、音频、realtime、旧版本、日期后缀、spark 等模型已设置为 `visibility=hide`。这些记录没有删除，底层 source model 和 mapping 仍保留，后续需要时可以恢复显示。

### 模型跟随客户端请求

当前设计目标：

- Codex 客户端请求什么模型，网关优先按客户端请求转发。
- 平台 API 不应把模型固定死。
- 聚合 API 的 `modelOverride` 只在没有明确来源映射时作为兼容旧上游的兜底，不应压过客户端请求。
- 如果某个上游模型名与平台模型名不同，应使用模型映射记录做内部转换，而不是在每个聚合 API 上写一套固定模型。

当前已落地修复：

- 聚合候选在客户端请求带模型时，如没有 source-specific mapping，会清掉聚合 API 默认 `modelOverride`，让请求体里的客户端模型继续传递。
- 平台 API 或聚合 API 配置变更后，会清理 gateway candidate cache，避免切换后继续使用旧候选。
- 禁用的聚合 API 不会因为被设置为 preferred aggregate API 而重新插入候选。

### 新增聚合 API 的安全流程

为了不影响当前可用 gs88，新增第三方聚合 API 时按以下步骤执行：

1. 新增供应商前，先用当前平台 API 请求 `gpt-5.5` 做基线验证，确认 gs88 仍 HTTP `200`。
2. 新增供应商后，不要直接启用到轮转；先设为 `disabled`。
3. 对新供应商单独测试 base URL、`/v1/models`、`/v1/responses`、`/v1/chat/completions`。
4. 只有当连接测试成功，并且真实请求返回 HTTP `200` 后，才允许改为 `active`。
5. 启用后立刻再次请求当前平台 API，确认日志仍没有 `terminal_error` 或错误轮转。

关键原则：新增供应商不等于加入轮转。只有 `status=active` 的聚合 API 才会进入候选。

### RPC 快速查询

```powershell
$token = (docker exec docker-codexmanager-1 sh -lc 'cat /data/codexmanager.rpc-token').Trim()
$headers = @{ 'X-CodexManager-Rpc-Token' = $token }
$rpcUrl = 'http://127.0.0.1:48760/rpc'

function Invoke-CmRpc([string]$method, $params = @{}) {
  $body = @{ jsonrpc = '2.0'; id = 1; method = $method; params = $params } | ConvertTo-Json -Depth 50
  Invoke-RestMethod -Uri $rpcUrl -Method Post -Headers $headers -ContentType 'application/json' -Body $body
}

Invoke-CmRpc 'apikey/list'
Invoke-CmRpc 'aggregateApi/list'
Invoke-CmRpc 'apikey/modelCatalogList' @{ refreshRemote = $false }
Invoke-CmRpc 'apikey/modelRouting'
```

### 验证命令

使用当前平台 API 做最小请求时，先通过 RPC 读取平台 key secret，不要在终端输出密钥：

```powershell
$secretResult = (Invoke-CmRpc 'apikey/readSecret' @{ id = 'gk_7c5b5db83d82' }).result
$secret = [string]$secretResult.key
$payload = @{
  model = 'gpt-5.5'
  input = @(@{ role = 'user'; content = @(@{ type = 'input_text'; text = 'reply with exactly ok' }) })
  stream = $false
  max_output_tokens = 16
} | ConvertTo-Json -Depth 20

Invoke-WebRequest -UseBasicParsing `
  -Uri 'http://127.0.0.1:48760/v1/responses' `
  -Method Post `
  -Headers @{ Authorization = "Bearer $secret" } `
  -ContentType 'application/json' `
  -Body $payload `
  -TimeoutSec 120
```

成功标准：

- HTTP `200`。
- `docker logs` 中存在对应 `REQUEST_START model=gpt-5.5`。
- `REQUEST_EXECUTION_PLAN route_kind=aggregate_api`。
- `BRIDGE_RESULT terminal_error=- delivery_error=-`。
