# Backend Deployment Guide (EC2 + Nginx + Gunicorn)

This guide walks through deploying the AetherDash Django backend to an Ubuntu EC2 instance.

## Prerequisites

- AWS Account
- Domain Name (Optional, but recommended for HTTPS)
- SSH Client (Terminal or PuTTY)

## 1. Launch EC2 Instance

- **OS:** Ubuntu 22.04 LTS (x86)
- **Instance Type:** `t3.micro` or `t3.small`
- **Security Group Inbound Rules:**
  - SSH (22) -> My IP
  - HTTP (80) -> Anywhere (0.0.0.0/0)
  - HTTPS (443) -> Anywhere (0.0.0.0/0)

## 2. Server Setup

SSH into your instance:

```bash
ssh -i "your-key.pem" ubuntu@<public-ip>
```

Update system and install dependencies:

```bash
sudo apt update
sudo apt install python3-pip python3-venv nginx git supervisor -y
```

## 3. Clone Repository

```bash
git clone https://github.com/your-username/aetherdash.git
cd aetherdash/backend
```

## 4. Environment Setup

Create virtual environment:

```bash
python3 -m venv venv
source venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
pip install gunicorn psycopg2-binary
```

_(Note: `gunicorn` is the production server, `psycopg2-binary` is for Postgres if you use it)_

Create `.env` file:

```bash
nano .env
```

Paste your environment variables:

```env
DEBUG=False
SECRET_KEY=your-secret-key
ALLOWED_HOSTS=<public-ip>,your-domain.com
# Add DB credentials, API keys, etc.
```

Run migrations and collect static files:

```bash
python manage.py migrate
python manage.py collectstatic
```

## 5. Configure Gunicorn (Application Server)

Create a systemd service file to managing the app process.

```bash
sudo nano /etc/systemd/system/gunicorn.service
```

Content (Adjust paths as needed):

```ini
[Unit]
Description=gunicorn daemon for AetherDash
After=network.target

[Service]
User=ubuntu
Group=www-data
WorkingDirectory=/home/ubuntu/aetherdash/backend
ExecStart=/home/ubuntu/aetherdash/backend/venv/bin/gunicorn \
          --access-logfile - \
          --workers 3 \
          --bind unix:/home/ubuntu/aetherdash/backend/finance_app.sock \
          finance_app.wsgi:application

[Install]
WantedBy=multi-user.target
```

Start and enable Gunicorn:

```bash
sudo systemctl start gunicorn
sudo systemctl enable gunicorn
sudo systemctl status gunicorn  # Should say "active (running)"
```

## 6. Configure Nginx (Web Server)

Create Nginx configuration:

```bash
sudo nano /etc/nginx/sites-available/aetherdash
```

Content:

```nginx
server {
    listen 80;
    server_name <public-ip> your-domain.com;

    location = /favicon.ico { access_log off; log_not_found off; }

    # Serve Static Files
    location /static/ {
        root /home/ubuntu/aetherdash/backend;
    }

    # Serve Media Files (Uploads)
    location /media/ {
        root /home/ubuntu/aetherdash/backend;
    }

    # Proxy to Gunicorn
    location / {
        include proxy_params;
        proxy_pass http://unix:/home/ubuntu/aetherdash/backend/finance_app.sock;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/aetherdash /etc/nginx/sites-enabled
sudo nginx -t  # Test for syntax errors
sudo systemctl restart nginx
```

## 7. Firewall (UFW)

Ensure firewall allows Nginx:

```bash
sudo ufw allow 'Nginx Full'
```

## 8. HTTPS (SSL) - Only if you have a Domain

If you pointed a domain (e.g., `api.your-domain.com`) to the EC2 IP:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.your-domain.com
```

Follow prompts to enable redirect.

## Troubleshooting

- **502 Bad Gateway?** Gunicorn isn't running or socket permissions are wrong. Check logs:
  `journalctl -u gunicorn`
  `tail -f /var/log/nginx/error.log`
- **Static files missing?** Ensure `collectstatic` was run and Nginx `root` path is correct.
