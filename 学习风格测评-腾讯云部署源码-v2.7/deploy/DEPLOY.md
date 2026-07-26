# 腾讯云 Ubuntu 部署手册

本文以腾讯云 CVM、Ubuntu 22.04/24.04、域名 `assessment.example.com` 为例。执行前把域名、邮箱和仓库地址替换为真实值。

## 1. 腾讯云准备

1. 创建 Ubuntu CVM，并绑定公网 IP。
2. 在腾讯云安全组仅开放：
   - TCP 22：只允许管理员固定 IP。
   - TCP 80：允许 `0.0.0.0/0` 和 `::/0`。
   - TCP 443：允许 `0.0.0.0/0` 和 `::/0`。
3. 不要在安全组开放 3000 端口。
4. 在 DNS 服务商处把 `assessment.example.com` 的 A 记录指向 CVM 公网 IP，等待解析生效。
5. 使用 SSH 密钥登录，不启用 root 密码登录。

以下命令在 SSH 登录后的 Ubuntu 终端执行：

```bash
export DOMAIN="assessment.example.com"
export EMAIL="admin@example.com"
export REPO_URL="https://github.com/wangrui967033-droid/learning-style-assessment.git"
```

## 2. 安装系统依赖和 Node.js

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git nginx sqlite3 certbot python3-certbot-nginx openssl ufw

curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/nodesource_setup.sh
less /tmp/nodesource_setup.sh
sudo -E bash /tmp/nodesource_setup.sh
sudo apt-get install -y nodejs

node --version
npm --version
sudo corepack enable
sudo corepack prepare pnpm@11.9.0 --activate
pnpm --version
```

生产服务器应使用受支持的 Node.js LTS 版本。仓库使用 `pnpm-lock.yaml`，因此生产安装使用 pnpm 的冻结锁文件模式，而不是生成新的依赖锁文件。

## 3. 创建专用用户和目录

```bash
getent passwd lsa >/dev/null || sudo useradd --system --home /nonexistent --shell /usr/sbin/nologin lsa

sudo install -d -o root -g lsa -m 0750 /opt/learning-style-assessment-v2
sudo install -d -o lsa -g lsa -m 0750 /var/lib/learning-style-assessment
sudo install -d -o root -g lsa -m 0750 /var/backups/learning-style-assessment
```

首次部署代码：

```bash
sudo git clone "$REPO_URL" /opt/learning-style-assessment-v2
cd /opt/learning-style-assessment-v2
sudo corepack pnpm install --prod --frozen-lockfile

sudo chown -R root:lsa /opt/learning-style-assessment-v2
sudo find /opt/learning-style-assessment-v2 -type d -exec chmod 0750 {} \;
sudo find /opt/learning-style-assessment-v2 -type f -exec chmod 0640 {} \;
```

如果目录已由 `install -d` 创建且 `git clone` 提示目录非空，请先删除这个空目录，再执行 clone，然后立即恢复上述所有权和权限：

```bash
sudo rmdir /opt/learning-style-assessment-v2
sudo git clone "$REPO_URL" /opt/learning-style-assessment-v2
```

## 4. 创建生产环境文件

分别生成两个只使用一次的随机导出密钥：

```bash
ADMIN_TOKEN="$(openssl rand -hex 32)"
CONTACT_TOKEN="$(openssl rand -hex 32)"
sudo install -o root -g root -m 0600 /dev/null /etc/learning-style-assessment-v2.env
sudo tee /etc/learning-style-assessment-v2.env >/dev/null <<EOF
NODE_ENV=production
PORT=3000
DATABASE_PATH=/var/lib/learning-style-assessment/assessment.sqlite
ADMIN_EXPORT_TOKEN=${ADMIN_TOKEN}
CONTACT_EXPORT_TOKEN=${CONTACT_TOKEN}
PUBLIC_BASE_URL=https://${DOMAIN}
ASSESSMENT_VERSION=v2.7.1
EOF
unset ADMIN_TOKEN CONTACT_TOKEN
sudo chmod 0600 /etc/learning-style-assessment-v2.env
```

不要把该文件内容粘贴到工单、聊天或 Git 仓库。`ADMIN_EXPORT_TOKEN` 只授权常规分析数据，`CONTACT_EXPORT_TOKEN` 只授权联系信息，两者必须不同。轮换时单独替换对应令牌并重启服务，不要复用另一个令牌。

## 5. 安装并启动 systemd 服务

```bash
cd /opt/learning-style-assessment-v2
sudo install -o root -g root -m 0644 deploy/learning-style-assessment.service /etc/systemd/system/learning-style-assessment.service
sudo systemctl daemon-reload
sudo systemctl enable --now learning-style-assessment.service
sudo systemctl status learning-style-assessment.service --no-pager
```

systemd 单元通过 `IPAddressAllow=localhost` 和 `IPAddressDeny=any` 限制应用网络访问，只允许 Nginx 从本机回环地址访问。再启用主机防火墙作为第二道边界：

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw deny 3000/tcp
sudo ufw --force enable
sudo ufw status verbose
```

确认应用进程已监听 3000 端口，并检查本机健康状态：

```bash
sudo ss -lntp | grep ':3000'
curl --fail --silent --show-error http://127.0.0.1:3000/api/health
sudo journalctl -u learning-style-assessment.service -n 100 --no-pager
```

健康检查应返回：

```json
{"status":"ok"}
```

## 6. 配置 Nginx 和 HTTPS

仓库中的 `deploy/nginx.conf` 是完整配置，便于使用指定文件做语法检查。安装前先备份系统原配置：

```bash
cd /opt/learning-style-assessment-v2
sudo cp /etc/nginx/nginx.conf "/etc/nginx/nginx.conf.before-lsa.$(date -u +%Y%m%dT%H%M%SZ)"
sudo install -o root -g root -m 0644 deploy/nginx.conf /etc/nginx/nginx.conf
sudo sed -i "s/assessment\.example\.com/${DOMAIN}/g" /etc/nginx/nginx.conf

sudo nginx -t -c /etc/nginx/nginx.conf
sudo systemctl reload nginx
curl --fail --silent --show-error "http://${DOMAIN}/api/health"
```

签发并自动写入 Let's Encrypt 证书配置：

```bash
sudo certbot --nginx -d "$DOMAIN" --redirect --agree-tos --no-eff-email -m "$EMAIL"
sudo nginx -t
sudo systemctl reload nginx
curl --fail --silent --show-error "https://${DOMAIN}/api/health"
sudo certbot renew --dry-run
```

Certbot 会管理证书路径和续期；不要在仓库配置中写死 `/etc/letsencrypt/live/...` 路径。HTTPS 正常后，可在 Certbot 生成的 443 `server` 块中加入 HSTS，但只有确认所有流量永久使用 HTTPS 后再启用。

## 7. 安装备份任务

```bash
cd /opt/learning-style-assessment-v2
sudo install -o root -g root -m 0750 scripts/backup-db.sh /usr/local/sbin/lsa-backup-db
sudo /usr/local/sbin/lsa-backup-db
sudo ls -lh /var/backups/learning-style-assessment
```

每天北京时间 03:17 执行。Ubuntu 默认使用服务器时区，请先设置上海时区：

```bash
sudo timedatectl set-timezone Asia/Shanghai
echo '17 3 * * * root /usr/local/sbin/lsa-backup-db 2>&1 | logger -t lsa-backup' | sudo tee /etc/cron.d/learning-style-assessment-backup >/dev/null
sudo chmod 0644 /etc/cron.d/learning-style-assessment-backup
```

脚本使用 SQLite `.backup` 获取一致快照，并对快照执行完整性检查。文件保留 30 天；它不会直接 `cp` 正在运行的数据库。云盘故障会同时影响数据库和本机备份，因此还应把备份加密同步到独立 COS 存储桶，并为 COS 配置最小权限和生命周期规则。

## 8. 导出 CSV

### 8.1 常规分析 CSV

常规分析接口只接受生产环境中的 `ADMIN_EXPORT_TOKEN`。不要把 Token 写进命令历史；下面从 root-only 环境文件临时读取：

```bash
DOMAIN="assessment.example.com"
read -r ADMIN_TOKEN < <(sudo sed -n 's/^ADMIN_EXPORT_TOKEN=//p' /etc/learning-style-assessment-v2.env)
umask 0077
curl --fail --silent --show-error \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  "https://${DOMAIN}/api/admin/export.csv" \
  -o "/tmp/learning-style-assessment-$(date -u +%Y%m%dT%H%M%SZ).csv"
unset ADMIN_TOKEN
ls -lh /tmp/learning-style-assessment-*.csv
```

常规分析 CSV 只含匿名编号、作答和分析字段，不含姓名、手机号、内部会话 ID 或报告访问令牌，但仍应按敏感教育数据管理：通过受控渠道下载，用完后从服务器 `/tmp` 删除，不要公开分享。

### 8.2 联系信息 CSV

联系信息接口只接受独立的 `CONTACT_EXPORT_TOKEN`，`ADMIN_EXPORT_TOKEN` 不能访问该接口。导出前登记用途、负责人和删除日期：

```bash
DOMAIN="assessment.example.com"
read -r CONTACT_TOKEN < <(sudo sed -n 's/^CONTACT_EXPORT_TOKEN=//p' /etc/learning-style-assessment-v2.env)
umask 0077
curl --fail --silent --show-error \
  -H "Authorization: Bearer ${CONTACT_TOKEN}" \
  "https://${DOMAIN}/api/admin/contacts.csv" \
  -o "/tmp/learning-style-contacts-$(date -u +%Y%m%dT%H%M%SZ).csv"
unset CONTACT_TOKEN
ls -lh /tmp/learning-style-contacts-*.csv
```

联系信息 CSV 仅含匿名编号、姓名、完整手机号、年级、目标学科和会话开始时间。它属于可识别身份数据，必须限制访问、使用受控传输和存储位置，并在登记期限结束后删除。

## 9. 从备份恢复

恢复前确认备份文件路径，并安排维护窗口。不要在服务运行时替换 SQLite 文件。

```bash
export RESTORE_SOURCE="/var/backups/learning-style-assessment/assessment-YYYYMMDDTHHMMSSZ.sqlite"
test -f "$RESTORE_SOURCE"

sudo systemctl stop learning-style-assessment.service
sudo /usr/local/sbin/lsa-backup-db

sudo rm -f /var/lib/learning-style-assessment/assessment.sqlite.restore
sudo sqlite3 "$RESTORE_SOURCE" ".backup '/var/lib/learning-style-assessment/assessment.sqlite.restore'"
sudo sqlite3 /var/lib/learning-style-assessment/assessment.sqlite.restore 'PRAGMA integrity_check;'
sudo chown lsa:lsa /var/lib/learning-style-assessment/assessment.sqlite.restore
sudo chmod 0640 /var/lib/learning-style-assessment/assessment.sqlite.restore
sudo mv /var/lib/learning-style-assessment/assessment.sqlite.restore /var/lib/learning-style-assessment/assessment.sqlite
sudo rm -f \
  /var/lib/learning-style-assessment/assessment.sqlite-wal \
  /var/lib/learning-style-assessment/assessment.sqlite-shm \
  /var/lib/learning-style-assessment/assessment.sqlite-journal

sudo systemctl start learning-style-assessment.service
curl --fail --silent --show-error http://127.0.0.1:3000/api/health
sudo journalctl -u learning-style-assessment.service -n 50 --no-pager
```

完整性检查必须输出 `ok` 后才能继续。如果失败，不要启动应用，改用上一份备份并保留失败文件供排查。

## 10. 更新应用

```bash
cd /opt/learning-style-assessment-v2
sudo git fetch --all --prune
sudo git pull --ff-only
sudo corepack pnpm install --prod --frozen-lockfile
sudo chown -R root:lsa /opt/learning-style-assessment-v2
sudo systemctl restart learning-style-assessment.service
curl --fail --silent --show-error http://127.0.0.1:3000/api/health
```

更新前先运行一次 `/usr/local/sbin/lsa-backup-db`。若涉及数据库结构变更，先在测试机验证迁移和恢复。

## 11. 安全与运维检查

- 3000 端口仅允许本机访问，不在腾讯云安全组中开放，并由 systemd 网络限制和 UFW 双重阻断外部连接。
- `lsa` 是无登录 shell 的专用用户；应用代码由 root 管理，只有 `/var/lib/learning-style-assessment` 可写。
- `/etc/learning-style-assessment-v2.env` 必须保持 `0600 root:root`，两类导出 Token 独立且定期轮换。
- 两类管理 CSV 接口仅通过 HTTPS 使用；不要在 URL 查询参数中传 Token，也不要交叉使用两个 Token。
- 每月安装 Ubuntu 安全更新，并关注 Node.js LTS、Nginx 和 SQLite 安全公告。
- 定期执行 `sudo certbot renew --dry-run`、恢复演练和备份完整性抽查。
- SQLite 适合单实例部署。不要同时启动多个写入同一数据库文件的应用进程。
- 本机 30 天备份不是异地容灾。至少保留一份加密、跨介质备份，并限制 COS 访问权限。
- Nginx 使用仓库中不含客户端 IP 的 `privacy` 日志格式；常规分析 CSV 不含姓名或手机号。联系信息 CSV 和数据库备份包含身份信息，必须按最小范围授权、加密保管并登记用途与删除期限。
- 发现密钥或数据泄露时，立即轮换 Token、吊销相关访问权限，并保留审计记录。

## 12. 故障排查

```bash
sudo systemctl status learning-style-assessment.service --no-pager
sudo journalctl -u learning-style-assessment.service -f
sudo nginx -t
sudo tail -n 100 /var/log/nginx/error.log
sudo -u lsa test -w /var/lib/learning-style-assessment
sudo sqlite3 /var/lib/learning-style-assessment/assessment.sqlite 'PRAGMA integrity_check;'
```
