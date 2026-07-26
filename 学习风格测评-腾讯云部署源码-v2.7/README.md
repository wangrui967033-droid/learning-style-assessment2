# 学习风格测评 V2.7.1

面向高中生的学习风格测评。服务端使用 Node.js、Express 和 SQLite，浏览器端完成固定 42 题、可选 4 道场景题，并在独立页面展示“结果总览＋六个解读板块”报告。

## 本地运行

要求 Node.js 20 或更高版本，并使用仓库声明的 pnpm 版本。

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
```

本地开发时，将 `.env` 中的 `DATABASE_PATH` 和 `PUBLIC_BASE_URL` 改为：

```dotenv
DATABASE_PATH=./data/assessment.sqlite
PUBLIC_BASE_URL=http://localhost:3000
```

同时把 `ADMIN_EXPORT_TOKEN` 和 `CONTACT_EXPORT_TOKEN` 替换为两个不同的随机密钥，然后启动：

```bash
set -a
. ./.env
set +a
pnpm start
```

访问 `http://localhost:3000`，健康检查地址为 `http://localhost:3000/api/health`。

## 验证

静态题库验证和全量测试：

```bash
pnpm validate:questions
pnpm test
```

浏览器端到端 QA 使用本机 Playwright 运行时和 Google Chrome，默认从 `3100` 开始选择空闲端口、创建临时数据库并自动启动和关闭服务：

```bash
node scripts/browser-qa.mjs
```

可用 `QA_START_PORT` 修改探测起点；若要验证已经启动的服务，设置 `QA_BASE_URL`。脚本在 `390 x 844` 和 `1440 x 1000` 视口分别运行 42 题直达路径和 42＋4 题路径，产物写入 `docs/qa-artifacts/`：

- `assessment-basic-mobile.png`
- `assessment-question-mobile.png`
- `report-mobile.png`
- `report-desktop.png`
- `report-a4.pdf`
- `report-a4-page-1.png`

完整验收结果见 [docs/qa-results.txt](docs/qa-results.txt)，发布门禁见 [docs/release-checklist.md](docs/release-checklist.md)。

## 腾讯云部署

生产环境采用以下结构：

- 应用：`/opt/learning-style-assessment-v2`
- 环境变量：`/etc/learning-style-assessment-v2.env`
- SQLite：`/var/lib/learning-style-assessment/assessment.sqlite`
- 备份：`/var/backups/learning-style-assessment`
- 进程：systemd，以无登录权限的 `lsa` 用户运行
- 公网入口：Nginx，仅向本机 `127.0.0.1:3000` 转发

完整的 Ubuntu、腾讯云安全组、HTTPS、备份恢复和 CSV 导出步骤见 [deploy/DEPLOY.md](deploy/DEPLOY.md)。

## 数据边界

测评必填姓名、中国大陆 11 位手机号和信息用途确认，不采集学校或请求 IP。姓名、手机号和确认时间只用于报告识别、结果查询及经授权的后续联系，不参与计分、画像分类、追加题触发或策略推荐。公开接口只返回姓名和脱敏手机号，公开报告地址使用独立随机令牌且不暴露内部会话 ID。

常规分析 CSV 位于 `/api/admin/export.csv`，仅接受 `ADMIN_EXPORT_TOKEN`，不含身份信息。联系人 CSV 位于 `/api/admin/contacts.csv`，仅接受独立的 `CONTACT_EXPORT_TOKEN`，字段限定为匿名编号、姓名、完整手机号、年级、目标学科和会话开始时间。两类令牌不得相同或互换；生产环境密钥、数据库和导出文件不得提交到 Git。
