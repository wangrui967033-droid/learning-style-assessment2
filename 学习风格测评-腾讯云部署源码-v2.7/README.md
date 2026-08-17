# 学习模式定位

面向高中生，尤其是高三艺考生的匿名学习模式定位工具。服务端使用 Node.js、Express 和 SQLite，浏览器端完成测评并单独展示一门文化课的学习方案。

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

同时把 `ADMIN_EXPORT_TOKEN` 替换为随机密钥，然后启动：

```bash
set -a
. ./.env
set +a
pnpm start
```

访问 `http://localhost:3000`，健康检查地址为 `http://localhost:3000/api/health`。

## 测试

```bash
pnpm test
pnpm validate:questions
```

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

测评仅采集学生填写的姓名和联系方式，用于报告展示与后台查找；不采集学校和请求 IP。管理端 CSV 接口需要独立的 Bearer Token；生产环境密钥和数据库文件不得提交到 Git。
