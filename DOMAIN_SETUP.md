# Adding New Domain: www.fincollectpro.com

## Summary ✅ COMPLETED
Added `www.fincollectpro.com` to existing Daily Finance deployment. Both domains now serve the same app with SSL.

**Current domain:** `reddyloanbook.duckdns.org`  
**New domain:** `www.fincollectpro.com`  
**Server IP:** `80.225.201.199`  
**DNS:** Already pointed to 80.225.201.199 ✓  
**SSL Certificate:** Both domains included (valid until 2027-01-17)

---

## ✅ Deployment Completed

### Step 1: Deploy Updated Nginx Config ✓
- Updated `deploy/nginx.conf` with SSL configuration for both domains
- Config includes HTTP→HTTPS redirect
- Deployed to `/etc/nginx/conf.d/dailyfinance.conf`
- Syntax validated: `configuration file syntax is ok`

### Step 2: Add SSL Certificate for New Domain ✓
- Installed certbot via pip on OCI server
- Generated new certificate: `reddyloanbook.duckdns.org-0001`
- Certificate includes: `reddyloanbook.duckdns.org` + `www.fincollectpro.com`
- Expires: 2027-01-17 (valid for 89 days)
- Deployed to: `/etc/letsencrypt/live/reddyloanbook.duckdns.org-0001/`

### Step 3: Verify Both Domains ✓
Open in browser:
- **https://reddyloanbook.duckdns.org** — ✅ Works (existing domain)
- **https://www.fincollectpro.com** — ✅ Works (new domain)

Both serve the same Daily Finance app without any downtime.

### SSL Certificate Status ✓
```
Certificate Name: reddyloanbook.duckdns.org-0001
Domains: reddyloanbook.duckdns.org, www.fincollectpro.com
Expiry Date: 2027-01-17 04:21:37+00:00 (VALID: 89 days)
Certificate Path: /etc/letsencrypt/live/reddyloanbook.duckdns.org-0001/fullchain.pem
```

### Auto-Renewal ✓
- Certbot is installed on the OCI server
- Auto-renewal runs every 15 minutes via `monitor.sh` in cleanup cron
- Renewal set to happen 30 days before expiry

---

## What Was Changed

| File | Change |
|------|--------|
| `deploy/nginx.conf` | Added SSL configuration with both domains, HTTP→HTTPS redirect, and SSL certificate paths |

**No app redeployment needed** — nginx just proxies to the same Next.js app.

---

## Verify Setup

Check that both domains are working:

```bash
# From browser:
https://reddyloanbook.duckdns.org   # Existing domain
https://www.fincollectpro.com       # New domain

# From terminal (ignore SSL warnings if testing locally):
ssh -i ssh_Keys/<your-key> opc@80.225.201.199 "sudo /usr/local/bin/certbot certificates"
```

---

## Rollback (if needed)

If something goes wrong, restore the old nginx config:

```bash
ssh -i ssh_Keys/<your-key> opc@80.225.201.199 "cd /opt/dailyfinance && \
  git checkout deploy/nginx.conf && \
  sudo cp deploy/nginx.conf /etc/nginx/conf.d/dailyfinance.conf && \
  sudo systemctl reload nginx"
```

---

## Important Notes

- ✅ Both domains serve the **exact same content** (same Next.js instance)
- ✅ Nginx handles SSL termination, app doesn't need to change
- ✅ No downtime — deployment was a simple nginx reload
- ✅ SSL certificate auto-renews 30 days before expiry
- ✅ Certificate renewal monitored by `cleanup.sh` cron job
- If certificate renewal fails, check `/opt/dailyfinance/backups/maintenance.log`

---

## ⚠️ Preventing Config Reversion (Permanent Fix)

To prevent nginx config from reverting, install automatic monitoring:

### Step 1: Install Nginx Monitoring on Server

```bash
ssh -i ssh_Keys/<your-key> opc@80.225.201.199 "cd /opt/dailyfinance && bash deploy/scripts/install-nginx-monitoring.sh"
```

This will:
- ✅ Create an hourly cron job that validates nginx config
- ✅ Auto-restore config from git if it goes missing or changes
- ✅ Log all syncs to `/opt/dailyfinance/backups/nginx-sync.log`
- ✅ Alert if config is invalid or nginx fails to reload

### Step 2: Verify Monitoring is Running

```bash
# Check cron job is installed
ssh -i ssh_Keys/<your-key> opc@80.225.201.199 "sudo crontab -l | grep sync-nginx-config"

# View sync logs
ssh -i ssh_Keys/<your-key> opc@80.225.201.199 "tail -f /opt/dailyfinance/backups/nginx-sync.log"

# Run manual sync (test)
ssh -i ssh_Keys/<your-key> opc@80.225.201.199 "sudo bash /opt/dailyfinance/deploy/scripts/sync-nginx-config.sh"
```

### How It Works

| Component | What It Does |
|-----------|-------------|
| `sync-nginx-config.sh` | Runs hourly, validates & restores nginx config from git |
| `deploy.sh` | Now includes nginx config deployment |
| Cron job | `0 * * * *` — checks every hour (runs at :00 each hour) |
| Logs | `/opt/dailyfinance/backups/nginx-sync.log` |

**If config reverts:**
1. The hourly cron job detects the mismatch
2. Automatically restores config from git
3. Validates syntax with `nginx -t`
4. Reloads nginx if valid
5. Logs the action

---

## Server Operations

```bash
# Check nginx status
ssh -i ssh_Keys/<your-key> opc@80.225.201.199 "sudo systemctl status nginx"

# View nginx error logs
ssh -i ssh_Keys/<your-key> opc@80.225.201.199 "sudo tail -f /var/log/nginx/error.log"

# View nginx config sync logs
ssh -i ssh_Keys/<your-key> opc@80.225.201.199 "tail -f /opt/dailyfinance/backups/nginx-sync.log"

# Test certificate renewal (dry-run)
ssh -i ssh_Keys/<your-key> opc@80.225.201.199 "sudo /usr/local/bin/certbot renew --dry-run"

# List all certificates
ssh -i ssh_Keys/<your-key> opc@80.225.201.199 "sudo /usr/local/bin/certbot certificates"

# Force sync nginx config now (don't wait for cron)
ssh -i ssh_Keys/<your-key> opc@80.225.201.199 "sudo bash /opt/dailyfinance/deploy/scripts/sync-nginx-config.sh"

# View cron schedule
ssh -i ssh_Keys/<your-key> opc@80.225.201.199 "sudo crontab -l | grep -E 'sync|certbot|dailyfinance'"
```
