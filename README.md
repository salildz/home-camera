# 🏡 Home Camera – ESP32-Powered Open Source Surveillance 🎥

> Make your own **private, hackable, no-cloud-needed security camera** with an ESP32 and Docker!  

## 🚀 What is This?

- Live video streaming from **ESP32-CAM** to your browser, 100% private!
- Modern web dashboard (React + Material UI)
- Camera pan/tilt control support 🕹️
- User login/auth (set your own credentials!)
- Runs **everywhere** with Docker: local PC, Raspberry Pi, VPS...
- **Easy integration:** open REST API, totally modifiable!

---

## 🗂️ Project Structure

```

home-camera/
│
├── client/        # Web UI (React)
├── server/        # Backend API (Node.js/Express)
├── esp32/         # ESP32 Arduino code
└── docker-compose.yml

````

---

## ⚡ Quick Start – The Easiest Way

> **No need to edit any .env files! Everything is managed in `docker-compose.yml`.**
> You **must flash your ESP32-CAM first!**

### 1️⃣ Flash the ESP32-CAM

- Open `esp32/CameraWebServer/CameraWebServer.ino` in Arduino IDE
- Edit the top of the file with your Wi-Fi:
  ```cpp
  const char* ssid = "your_wifi_ssid";
  const char* password = "your_wifi_password";

* Board: **AI Thinker ESP32-CAM**
* Flash the board (use FTDI, IO0 to GND)
* Open Serial Monitor (baud: 115200)
  **Note the ESP32's IP address! (e.g., `192.168.1.30`)**

### 2️⃣ Set Your ESP32 IP in Docker Compose

* Edit `docker-compose.yml`
* Find this line in the `server.environment` section:

  ```
  - ESP32_URL=http://192.168.1.XXX
  ```
* **Replace `192.168.1.XXX` with your ESP32’s real IP!**

### 3️⃣ (Optional) Set Login Credentials

* Still in `docker-compose.yml`, update:

  ```
  - LOGIN_USER=your_username
  - LOGIN_PASS=your_password
  - JWT_SECRET=your_jwt_secret
  ```
* Save and close.

### 4️⃣ Run Everything with Docker Compose

```bash
git clone https://github.com/salildz/home-camera.git
cd home-camera
docker-compose up --build
```

* Backend runs at [http://localhost:9030](http://localhost:9030)
* Frontend (dashboard): [http://localhost:9031](http://localhost:9031)
* **Log in** with the credentials you set above.

---

## 👀 Usage

* Live video stream should appear automatically on the dashboard!
* Pan/tilt controls if your setup supports it (see ESP32 code and wiring)
* Web app is mobile friendly – view from any device on your LAN.
* Want remote access? Use [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/), Tailscale, or port forwarding.

---

## 🛠️ Advanced & Dev Setup

Want to develop or run parts separately?
See `client/` and `server/` for detailed developer setup.

* All config is via Docker Compose **environment** variables.
* No `.env` files needed!

---

## 🕹️ Customization & Extensions

* Add your own sensors to ESP32 code (PIR, temperature, light…)
* Expand backend API for cloud upload, notifications, etc.
* Use another frontend? Just hit the REST endpoints.
* Multi-camera: spin up more ESP32s and set up separate services or extend backend for multi-cam.

---

## 🩻 Troubleshooting

* **ESP32 not found?**

  * Check it’s on the same network as Docker host!
  * Confirm ESP32 IP is correct and reachable.
  * Power issues? ESP32-CAM is picky!
* **No video in dashboard?**

  * Try opening ESP32’s IP in browser directly.
  * Is `ESP32_URL` correct in `docker-compose.yml`?
  * Check firewall settings!

---

## 🌟 Roadmap & Ideas

* [ ] Multi-camera dashboard
* [ ] Motion recording & cloud upload
* [ ] Push notifications (Telegram, Email)
* [ ] Home Assistant integration
* [ ] Face/object detection (Edge AI!)
* [ ] More user roles

---

## 🤝 Contributing

Pull requests, issues, and ideas are always welcome!
Star the repo if you like the project!
Want to help with documentation or a new feature? Open a PR!

---

## 📸 Screenshots
> *Screenshots will be added soon!

---

## 💬 Contact

Made by [salildz](https://github.com/salildz)

Questions? Open an issue or DM me on GitHub!

---

*Happy hacking & keep your home private! 🚀*
