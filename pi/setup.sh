#!/bin/bash
set -e

echo "=== Smoky Scout Pro - Raspberry Pi Setup ==="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root: sudo bash pi/setup.sh"
  exit 1
fi

APP_DIR="/home/pi/HSUscout"
PI_USER="pi"

echo "[1/8] Installing system packages..."
apt-get update
apt-get install -y hostapd dnsmasq nginx nodejs npm

echo "[2/8] Installing Node.js 20 (if not present)..."
if ! node -v | grep -q "v20\|v21\|v22"; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "[3/8] Configuring static IP for wlan0..."
cat >> /etc/dhcpcd.conf << 'DHCP_EOF'

# SmokyScout hotspot config
interface wlan0
static ip_address=192.168.4.1/24
nohook wpa_supplicant
DHCP_EOF

echo "[4/8] Configuring hostapd (WiFi hotspot)..."
cp "$APP_DIR/pi/hostapd.conf" /etc/hostapd/hostapd.conf
sed -i 's/#DAEMON_CONF=""/DAEMON_CONF="\/etc\/hostapd\/hostapd.conf"/' /etc/default/hostapd

echo "[5/8] Configuring dnsmasq (DHCP + DNS)..."
mv /etc/dnsmasq.conf /etc/dnsmasq.conf.bak 2>/dev/null || true
cp "$APP_DIR/pi/dnsmasq.conf" /etc/dnsmasq.conf

echo "[6/8] Configuring nginx (captive portal)..."
rm -f /etc/nginx/sites-enabled/default
cp "$APP_DIR/pi/nginx.conf" /etc/nginx/sites-available/smoky-scout
ln -sf /etc/nginx/sites-available/smoky-scout /etc/nginx/sites-enabled/smoky-scout

echo "[7/8] Building the app..."
cd "$APP_DIR"
sudo -u "$PI_USER" npm install
sudo -u "$PI_USER" npm run build
mkdir -p "$APP_DIR/data"
chown "$PI_USER":"$PI_USER" "$APP_DIR/data"

echo "[8/8] Setting up systemd service..."
cp "$APP_DIR/pi/smoky-scout.service" /etc/systemd/system/smoky-scout.service
systemctl daemon-reload
systemctl enable hostapd
systemctl enable dnsmasq
systemctl enable nginx
systemctl enable smoky-scout

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Reboot to start everything:"
echo "  sudo reboot"
echo ""
echo "After reboot:"
echo "  WiFi SSID: SmokyScout"
echo "  Password:  frc8778scout"
echo "  App URL:   http://192.168.4.1:3001"
echo ""
echo "The app will auto-start and phones will be"
echo "redirected to the app via captive portal."
