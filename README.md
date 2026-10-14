# School Management System — school.clixworks.co.tz

Public website and management portal for a private school in Zanzibar: students, academics, examinations
and report cards, fees and receipts, expenses, Beem Africa SMS, audit trail and backups.

| Layer    | Technology |
|----------|------------|
| Frontend | React 19 + Vite, pure CSS (`client/`). Public site at `/`, portal at `/dashboard` |
| Backend  | Node.js 20 + Express 5 on port 5000, MySQL 8 (`server/`) |
| Ops      | Nginx (HTTPS, reverse proxy), PM2 cluster (`school-system-api`), Let's Encrypt, cron backups |

---

## Deploying on a fresh Contabo Ubuntu 22.04 / 24.04 VPS

**You need:** a Contabo VPS (2 vCPU / 4 GB RAM or more) with Ubuntu 22.04 or 24.04, root SSH access,
and access to the DNS settings of `clixworks.co.tz`.

### 1. Point the domain at the VPS
Create a DNS **A record**: `school.clixworks.co.tz` → your VPS IPv4 address (shown in the Contabo panel).
Before continuing, check that it resolves:
```bash
dig +short school.clixworks.co.tz        # must print the VPS IP
```

### 2. Clone the repository from GitHub
```bash
ssh root@YOUR_VPS_IP
apt-get update && apt-get install -y git
git clone https://github.com/<your-account>/<your-repo>.git /var/www/school-system
cd /var/www/school-system
chmod +x deploy.sh server/bin/backup-db.sh
```
For a **private** repository, first add a deploy key: run `ssh-keygen -t ed25519 -C deploy@school.clixworks.co.tz`,
add `~/.ssh/id_ed25519.pub` under *GitHub → repository → Settings → Deploy keys*, then clone with the
`git@github.com:<your-account>/<your-repo>.git` address.

### 3. Run the one-click deployment
```bash
sudo ./deploy.sh --email it@clixworks.co.tz --school-name "Al-Noor Academy Zanzibar" --enable-firewall
```
On the first run the script:
1. installs Node.js 20, MySQL 8, Nginx, PM2 and Certbot if they are missing;
2. creates the database with a generated password and writes `server/.env` (generated JWT secret, `DOMAIN=school.clixworks.co.tz`);
3. installs dependencies, runs the migrations and builds the React app into `client/dist`;
4. obtains the Let's Encrypt certificate for `school.clixworks.co.tz` and installs `nginx.conf` (HTTP → HTTPS);
5. starts `school-system-api` under PM2 (2 cluster workers, as the unprivileged `schoolapp` user);
6. schedules the daily 02:30 backup;
7. finishes with a health check against `http://127.0.0.1:5000` and `https://school.clixworks.co.tz/api/v1/health`.

### 4. SSL certificate (Certbot)
`deploy.sh` requests the certificate automatically. Run Certbot yourself only if DNS was not ready during
the first deploy, or to renew/inspect it:
```bash
sudo certbot certonly --webroot -w /var/www/certbot -d school.clixworks.co.tz \
     --email it@clixworks.co.tz --agree-tos --no-eff-email --deploy-hook "systemctl reload nginx"
sudo ./deploy.sh --no-pull            # installs the HTTPS site configuration
sudo certbot renew --dry-run          # confirm automatic renewal works
```

### 5. Create the Headmaster account
```bash
cd /var/www/school-system/server
sudo -u schoolapp npm run create-admin -- --name "Headmaster Name" --email head@clixworks.co.tz
```
Note the one-time temporary password. Sign in at **https://school.clixworks.co.tz** → *Ingia Kwenye Mfumo*;
you will be asked to change the password immediately.

### 6. Enable SMS (Beem Africa)
Set `BEEM_API_KEY`, `BEEM_SECRET_KEY` and `BEEM_SENDER_ID` in `/var/www/school-system/server/.env`, then:
```bash
sudo -u schoolapp pm2 reload school-system-api --update-env
```

### 7. First sign-in checklist
1. **School Settings:** confirm the school details, vision and mission, upload the logo, stamp and signatures, and post the first announcement.
2. **Academic Setup:** create the year and terms, set the current term, then add classes, streams, subjects and teacher assignments.
3. **User Accounts:** create the Bursar, teacher and parent accounts. **Fee Setup:** create fee types and structures.

### Public website content
- **Leadership photos:** copy official portraits (JPG, portrait orientation) to `client/public/images/leaders/`
  as `rais-jmt.jpg`, `rais-zanzibar.jpg` and `mkuu-wa-shule.jpg`, then run `sudo ./deploy.sh`. Until a photo
  exists, an initials frame is shown.
- **Slideshow, names, titles and other text:** edit `client/src/content/landing.js` (Kiswahili and English).
- **Vision, mission, contacts and announcements:** managed in the portal under **School Settings** (no redeploy needed).

---

## Updating to a new version
```bash
cd /var/www/school-system
sudo ./deploy.sh
```
This pulls the latest `main` from GitHub, installs dependencies, runs new migrations, rebuilds the frontend,
reloads PM2 with zero downtime, tests and reloads Nginx, and prints the health-check result.
Use `--branch <name>` to deploy another branch, or `--no-pull` to deploy the files on disk.

## Backups and restore
- **Automatic:** daily at 02:30 to `server/storage/backups/*.sql.gz` (14 days kept). Log: `/var/log/school-system/backup.log`.
- **On demand:** School Settings → *Download backup now*.
- **Restore** (overwrites current data):
  ```bash
  sudo -u schoolapp pm2 stop school-system-api
  gunzip -c /var/www/school-system/server/storage/backups/<file>.sql.gz | sudo mysql school_management
  sudo -u schoolapp pm2 start school-system-api
  ```

## Operations cheat-sheet
| Task | Command |
|------|---------|
| API status / logs | `sudo -u schoolapp pm2 status` · `sudo -u schoolapp pm2 logs school-system-api` |
| Restart API | `sudo -u schoolapp pm2 reload school-system-api --update-env` |
| Nginx test / reload | `sudo nginx -t && sudo systemctl reload nginx` |
| Health check | `curl https://school.clixworks.co.tz/api/v1/health` |

## Security notes
- `server/.env` (mode 600) holds the database password, JWT secret and Beem keys. It and `server/storage/`
  (stamps, signatures, backups) are excluded from git and must never be committed.
- Every sensitive action is recorded in the **Audit Trail** with user, IP address and before/after values.
- After setting up SSH keys, disable password login for root (`PermitRootLogin prohibit-password`).

---

## Local development
```bash
cd server && cp .env.example .env    # set DB_*, JWT_SECRET, SCHOOL_NAME; NODE_ENV=development, COOKIE_SECURE=false, TRUST_PROXY=0, DOMAIN=
npm install && npm run db:migrate && npm run create-admin -- --name "Admin" --email admin@example.com
npm run dev                          # API on http://localhost:5000

cd client && npm install && npm run dev   # http://localhost:5173 (proxies /api to :5000)
```
