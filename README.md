# SubsTracker-wxpush

一个基于 Cloudflare Workers 的订阅到期提醒项目。仅集成微信模板消息推送，提供订阅管理、到期检查、计划任务触发等能力。


## 功能
- 订阅管理：新增、修改、删除、列表；KV 持久化
- 微信推送：支持多个用户 OpenID（使用 `|` 分隔）；可选 KV 缓存 `access_token`
- 到期检查：在到期日前 `remindDays` 天内自动提醒
- 安全授权：统一使用 `API_TOKEN` 进行接口访问控制
- 计划任务：Workers Cron 每日自动执行到期检查（可自定义时间）
- 前端管理页：根路径提供登录与订阅管理的简易界面


## 目录结构
- `src/worker.ts`：Workers 源码（TypeScript）
- `dist/_worker.js`：已构建的部署产物（ESM）
- `package.json`：构建脚本与依赖


## 环境准备
在 Cloudflare 中准备以下环境变量与 KV 绑定：

环境变量（必填）
- `API_TOKEN`：强随机字符串，用于接口授权
- `WX_APPID`：微信公众号 AppID
- `WX_SECRET`：微信公众号 AppSecret
- `WX_USERID`：接收者 OpenID，多个用 `|` 分隔
- `WX_TEMPLATE_ID`：模板消息 ID

KV 绑定
- `SUBSCRIPTIONS_KV`：订阅数据存储（必须）
- `WXPUSH_KV`：微信 `access_token` 缓存（可选，推荐）


## 快速部署（Workers 控制台）
1. 在 Cloudflare Dashboard 创建 Worker
2. 打开编辑器，将 `dist/_worker.js` 的完整内容粘贴到 Worker 代码区
3. 在 Settings -> Variables 添加环境变量（见上）
4. 在 Settings -> KV Namespace Bindings 绑定 `SUBSCRIPTIONS_KV` 与可选 `WXPUSH_KV`
5. 在 Triggers -> Cron Triggers 新建计划任务（例如每日 08:00），用于自动到期检查
6. 保存并部署；访问你的 Worker 域名进行接口调用


## Cloudflare Workers 部署详解

### 前提准备
- Cloudflare 账户（已启用 Workers）
- 微信公众号凭据：`WX_APPID`、`WX_SECRET`、可用模板 `WX_TEMPLATE_ID`、接收者 `WX_USERID`
- 项目产物：`dist/_worker.js`（本仓库已提供）
- 授权密钥：`API_TOKEN`（自定义强随机字符串）

### 创建 Worker
- 进入 Cloudflare Dashboard -> Workers & Pages -> Create application -> Worker
- 选择以编辑器方式创建
- 将 `dist/_worker.js` 全部内容粘贴到编辑器
- 点击 Save and deploy 完成首次部署

### 配置环境变量
- 进入新建 Worker -> Settings -> Variables
- 添加以下环境变量（五个必填）：
  - `API_TOKEN`
  - `WX_APPID`
  - `WX_SECRET`
  - `WX_USERID`（多个用户用 `|` 分隔）
  - `WX_TEMPLATE_ID`

### 创建与绑定 KV
- 创建命名空间：Workers & Pages -> KV -> Create namespace
  - 创建 `SUBSCRIPTIONS_KV`（订阅数据存储，必须）
  - 创建 `WXPUSH_KV`（Access Token 缓存，可选但推荐）
- 绑定命名空间：进入 Worker -> Settings -> Functions（或 Settings -> KV Namespace Bindings）
  - Add binding：
    - Variable name 填写：`SUBSCRIPTIONS_KV`
    - Namespace 选择刚创建的 `SUBSCRIPTIONS_KV`
  - 若使用缓存，再添加：
    - Variable name：`WXPUSH_KV`
    - Namespace：选择创建的 `WXPUSH_KV`

### 配置 Cron（计划任务）
- 进入 Worker -> Triggers -> Cron Triggers -> Add schedule
- 选择执行频率（例如每日 08:00）
- 注意：Cloudflare Cron 使用 UTC 时间，请按需换算到本地时区
- 保存后，系统将定时触发 `scheduled` 事件，自动执行到期检查与推送

### 绑定域名（可选）
- 如果需要自定义域名路由：
  - 进入 Worker -> Settings -> Routes
  - 添加 Route（例如 `https://api.example.com/*`）绑定到该 Worker
- 如果不绑定域名，仍可使用 `*.workers.dev` 的子域名直接访问

### 验证与测试
- 发送测试通知：
  ```bash
  curl -X POST https://<你的workers域名>/wxsend \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <你的TOKEN>" \
    -d '{"title":"测试消息","content":"这是一次部署验证"}'
  ```
- 新增订阅并检查：
  ```bash
  curl -X POST https://<你的workers域名>/subs \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <你的TOKEN>" \
    -d '{"name":"Netflix","expireDate":"2026-02-15","remindDays":7,"enabled":true}'

  curl -X POST https://<你的workers域名>/check \
    -H "Authorization: Bearer <你的TOKEN>"
  ```
- 查看订阅列表：
  ```bash
  curl -X GET https://<你的workers域名>/subs \
    -H "Authorization: Bearer <你的TOKEN>"
  ```

### 常见问题与排查
- 401 未授权：确认请求中携带 `Authorization: Bearer <API_TOKEN>` 或 `token=<API_TOKEN>`
- 微信返回 `40001/invalid credential`：检查 `WX_APPID/WX_SECRET` 是否正确；建议启用 `WXPUSH_KV` 缓存避免频繁刷新
- 未触发提醒：确认订阅 `enabled=true`，`expireDate` 合法且 `remindDays` >= 剩余天数；确认 Cron 触发时区转换正确
- KV 读写异常：确认命名空间已创建且正确绑定为 `SUBSCRIPTIONS_KV`（名称必须匹配变量名）

### 生产建议
- 使用强随机的 `API_TOKEN` 并避免在日志或页面中泄露
- 按需限制来源 IP、配合 Cloudflare 防火墙规则保护接口
- 模板内容字段可在 `src/worker.ts` 的 `sendWeChat` 函数中按你的模板结构定制


## 前端页面使用说明
本项目在根路径提供一个简易订阅管理界面（无需单独前端部署）：

- 打开页面：访问你的 Workers 根地址（例如 `https://<你的域名>/`）

- 登录方式：
  - 输入在 Cloudflare Worker 的 Settings -> Variables 中配置的 `API_TOKEN`
  - 点击“进入系统”，登录成功后会将 Token 保存在浏览器 `localStorage`，下次访问无需重复输入
  - 右上角“退出登录”可以清除 Token 并返回登录界面

- 管理功能：
  - 新增/更新：在表单填写 `名称`、`到期日期`、`提前提醒天数`、`启用`、`备注`，点击“提交”
  - 批量导入：在“批量导入”框粘贴 JSON 数组或 `{items:[...]}`，点击“批量提交”
  - 列表操作：点击“刷新”查看所有订阅；支持“删除”和“切换启用”
  - 到期检测：点击“到期检查并推送”立即执行检查并发送微信通知

示例批量数据（可直接粘贴到页面的“批量导入”框）：
```json
[
  {"name":"Netflix","expireDate":"2026-02-15","remindDays":7,"enabled":true,"remark":"家庭套餐"},
  {"name":"Disney+","expireDate":"2026-03-01","remindDays":5,"enabled":true},
  {"id":"manual-123","name":"Apple Music","expireDate":"2026-02-10","remindDays":3,"enabled":true}
]
```


## 最近更新
- 新增 `/health` 健康检查端点：快速查看环境变量与 KV 绑定是否配置完整
- 新增批量导入接口：`POST /subs/bulk` 支持一次性导入/更新多条订阅
- 根路径提供前端管理页：带登录卡片、Token 持久化（`localStorage`）、退出登录、列表管理与批量导入
- 订阅管理接口完善：支持删除、启停切换、到期检查触发按钮


## 自动化部署（Cloudflare Pages）
适合连接 GitHub 自动构建部署：

1. 将本项目推送到 GitHub 仓库
2. 在 Cloudflare Pages 连接该仓库
3. 构建配置：
   - Framework preset：`None`
   - Build command：`npm run build`
   - Build output directory：`dist`
4. 在 Pages 项目 Settings -> Functions 添加 KV Bindings（与环境变量同上）
5. 点击部署

说明：Pages 侧不支持 Cron 计划任务；如需自动到期提醒，建议：
- 使用 Workers 进行 Cron 调度；或
- 使用外部计划任务服务定期调用 `/check` 接口


## 推送到 GitHub（两种方式）

### 方式一：命令行（Git CLI）
1. 安装 Git（Windows 可用 Git for Windows）并确保命令可用：
   ```bash
   git --version
   ```
   如果未加入 PATH，可直接使用：`"C:\Program Files\Git\bin\git.exe"`
2. 在项目根目录执行：
   ```bash
   git init
   git add -A
   git commit -m "feat: initial project"
   git branch -M main
   ```
3. 在 GitHub 网页创建一个空仓库（例如：`SubsTracker-wxpush`），复制远程地址：
   - 形如 `https://github.com/<你的账号>/SubsTracker-wxpush.git`
4. 添加远程并推送：
   ```bash
   git remote add origin https://github.com/<你的账号>/SubsTracker-wxpush.git
   git push -u origin main
   ```
   如果使用绝对路径：
   ```powershell
   & "C:\Program Files\Git\bin\git.exe" remote add origin https://github.com/<你的账号>/SubsTracker-wxpush.git
   & "C:\Program Files\Git\bin\git.exe" push -u origin main
   ```
5. 浏览器打开仓库地址，确认文件已推送。


### 方式二：GitHub Desktop
1. 安装并登录 GitHub Desktop。
2. 添加本地仓库：
   - 打开 GitHub Desktop
   - File -> Add Local Repository
   - Local Path：选择本项目目录（例如 `c:\Users\qh686\Desktop\google code\SubsTracker-wxpush`）
   - 点击 Add Repository
3. 发布到 GitHub（创建远程仓库）：
   - 顶部点击 Publish repository
   - Repository name：输入仓库名（建议 `SubsTracker-wxpush`）
   - 选择 Public 或 Private
   - 点击 Publish repository
4. 如果已经在网页创建了空仓库：
   - Repository -> Repository settings -> Remote -> Add
   - 填写远程 URL（如 `https://github.com/<你的账号>/SubsTracker-wxpush.git`）保存
   - 点击 Push origin 推送 main 分支
5. 在 GitHub Desktop 显示 “Published” 后，访问仓库页面确认内容。


## 使用 Wrangler CLI 部署（可选）
1. 安装依赖与登录
   ```bash
   npm install
   npx wrangler login
   ```
2. 创建 KV（可选）并绑定（需在 `wrangler.toml` 中配置）
   ```bash
   npx wrangler kv:namespace create SUBSCRIPTIONS_KV
   npx wrangler kv:namespace create WXPUSH_KV
   ```
3. 设置密钥
   ```bash
   npx wrangler secret put API_TOKEN
   npx wrangler secret put WX_APPID
   npx wrangler secret put WX_SECRET
   npx wrangler secret put WX_USERID
   npx wrangler secret put WX_TEMPLATE_ID
   ```
4. 部署
   ```bash
   npm run build
   npx wrangler deploy dist/_worker.js
   ```


## 接口说明
授权方式
- Header：`Authorization: Bearer <API_TOKEN>`
- 或 Query/body：`token=<API_TOKEN>`

订阅管理
- `GET /subs`：订阅列表
- `POST /subs`：新增或更新（带 `id` 更新；不带 `id` 新增）
- `DELETE /subs/:id`：删除订阅
- `POST /subs/bulk`：批量新增或更新（JSON 数组或 `{items:[...]}`）

到期检查
- `POST /check`：手动触发到期检测与推送（需授权）

微信推送
- `GET /wxsend`：简易发送（需授权）
- `POST /wxsend`：发送（支持覆盖 `userid`、`template_id`、`appid/secret`、`url`）

示例：发送模板消息（POST）
```bash
curl -X POST https://<你的域名>/wxsend \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <你的TOKEN>" \
  -d '{
    "title": "服务器报警",
    "content": "CPU 使用率超过 90%",
    "userid": "OPENID1|OPENID2"
  }'
```

示例：新增订阅
```bash
curl -X POST https://<你的域名>/subs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <你的TOKEN>" \
  -d '{
    "name": "Netflix",
    "expireDate": "2026-02-15",
    "remindDays": 7,
    "enabled": true,
    "remark": "家庭套餐"
  }'
```

示例：批量导入订阅
```bash
curl -X POST https://<你的域名>/subs/bulk \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <你的TOKEN>" \
  -d '[
    {"name":"Netflix","expireDate":"2026-02-15","remindDays":7,"enabled":true,"remark":"家庭套餐"},
    {"name":"Disney+","expireDate":"2026-03-01","remindDays":5,"enabled":true},
    {"id":"manual-123","name":"Apple Music","expireDate":"2026-02-10","remindDays":3,"enabled":true}
  ]'
```
说明：
- 如提供 `id` 将按该 `id` 更新；不提供 `id` 自动生成
- 每个对象字段：`name`、`expireDate`（YYYY-MM-DD）、`remindDays`、`enabled`、`remark`

示例：手动检查到期
```bash
curl -X POST https://<你的域名>/check \
  -H "Authorization: Bearer <你的TOKEN>"
```


## 本地构建
```bash
npm install
npm run build
```
产物输出到 `dist/_worker.js`，可直接用于 Workers 部署或 Pages Functions。


## 常见问题
- 401 未授权：确认 `API_TOKEN` 设置正确且传递到请求中
- 微信模板错误：检查 `WX_APPID`、`WX_SECRET`、`WX_TEMPLATE_ID` 与接收者 `OpenID`
- 未提醒：确认 `SUBSCRIPTIONS_KV` 已绑定、订阅 `enabled=true`、`expireDate` 与 `remindDays` 合理
- 频率限制：绑定 `WXPUSH_KV` 以缓存 `access_token`


## 许可证
MIT License
