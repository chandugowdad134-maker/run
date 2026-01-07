# HTTPS Setup with Reverse Proxy

## Local Development (macOS/Linux)

### 1. Install Tools
```bash
# macOS
brew install caddy mkcert

# Linux (Debian/Ubuntu)
sudo apt install -y caddy
curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64"
chmod +x mkcert-v*-linux-amd64
sudo cp mkcert-v*-linux-amd64 /usr/local/bin/mkcert
```

### 2. Create Trusted Local Certificate
```bash
# Initialize local CA (adds to system trust store)
mkcert -install

# Generate cert for your LAN IP
cd backend
mkcert 192.168.0.117

# This creates:
# - 192.168.0.117.pem (certificate)
# - 192.168.0.117-key.pem (private key)
```

### 3. Trust Certificate on Mobile Device/Emulator

#### Android Emulator
```bash
# Get the CA cert location
mkcert -CAROOT
# Copy rootCA.pem to device
adb push "$(mkcert -CAROOT)/rootCA.pem" /sdcard/
# Install: Settings → Security → Install from SD card → rootCA.pem
```

#### iOS Simulator
The simulator uses your Mac's trust store, so `mkcert -install` is sufficient.

#### Physical Devices
Transfer `rootCA.pem` (from `mkcert -CAROOT` folder) via email/cloud and install it:
- **Android**: Settings → Security → Install certificate
- **iOS**: Settings → Profile Downloaded → Install → Trust (Settings → General → About → Certificate Trust Settings)

### 4. Start Backend + Caddy
```bash
# Terminal 1: Node backend on HTTP 4000
cd backend
npm run dev

# Terminal 2: Caddy reverse proxy on HTTPS 4443
caddy run --config backend/Caddyfile
```

### 5. Rebuild Frontend & Sync Mobile
```bash
# Frontend is already configured with VITE_API_URL=https://192.168.0.117:4443
npm run build
npx cap sync

# Open in Android Studio or Xcode
npm run mobile:android
# or
npm run mobile:ios
```

### 6. Verify
```bash
# Test HTTPS endpoint
curl -k https://192.168.0.117:4443/health
# Should return: {"ok":true}

# Test from mobile device browser (should show green lock)
# Open: https://192.168.0.117:4443/health
```

## Production (Cloud Deployment)

### Option 1: Caddy (Automatic HTTPS)
```caddyfile
# Caddyfile
your-domain.com {
  reverse_proxy localhost:4000
  
  # Caddy automatically gets Let's Encrypt certs
}
```

### Option 2: NGINX + Certbot
```nginx
server {
  listen 443 ssl http2;
  server_name your-domain.com;
  
  ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
  
  location / {
    proxy_pass http://localhost:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
  }
}
```

### Option 3: Cloud Load Balancer (AWS/GCP/Azure)
Configure TLS termination at the load balancer, forward HTTP to your backend on port 4000.

## Troubleshooting

### "Certificate not trusted" on device
- Ensure you ran `mkcert -install` on your Mac
- For physical devices, install `rootCA.pem` from `$(mkcert -CAROOT)` folder
- For Android 7+, may need to add network security config

### Mixed content errors persist
- Verify `.env` has `VITE_API_URL=https://...`
- Rebuild frontend: `npm run build`
- Sync mobile: `npx cap sync`
- Check `capacitor.config.ts` has `server.androidScheme: 'https'`

### Connection refused
- Ensure Caddy is running: `caddy run --config backend/Caddyfile`
- Verify backend is on 4000: `curl http://localhost:4000/health`
- Check firewall allows 4443

### Certificate SAN warning
If your LAN IP changes, regenerate cert:
```bash
cd backend
rm 192.168.0.117*.pem
mkcert <NEW_IP>
# Update .env with new IP
# Rebuild and sync
```
