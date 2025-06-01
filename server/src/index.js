require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const cors = require('cors');
const { Readable } = require('stream');

// ESP32 bağlantı durumu ve izleyici listesi
let esp32Stream = null;
let frameBuffer = [];
let viewers = [];
let isRecording = false;
let ffmpegProcess = null;

const app = express();
app.use(cors());

const PORT = process.env.PORT || 5000;
const STREAM_URL = process.env.ESP32_STREAM_URL || "http://192.168.1.37:81/stream";
const VIDEOS_DIR = path.join(__dirname, '..', 'videos');
const TEN_DAYS = 10 * 24 * 60 * 60 * 1000;

if (!fs.existsSync(VIDEOS_DIR)) fs.mkdirSync(VIDEOS_DIR);

// 1. Videoları statik olarak sun
app.use('/videos', express.static(VIDEOS_DIR));

// 2. Video dosya listesini API ile ver
app.get('/api/videos', (req, res) => {
    fs.readdir(VIDEOS_DIR, (err, files) => {
        if (err) return res.status(500).json({ error: "Liste hatası" });
        // Sadece .mp4 dosyalarını, en son kayıttan en eskiye sırala
        const videos = files
            .filter(f => f.endsWith('.mp4'))
            .map(f => ({
                name: f,
                url: `/videos/${f}`,
                ctime: fs.statSync(path.join(VIDEOS_DIR, f)).ctime
            }))
            .sort((a, b) => b.ctime - a.ctime);
        res.json(videos);
    });
});

// 3. ESP32 stream yönetimi - tek bağlantı ile birden fazla istemciye hizmet
function connectToESP32() {
    if (esp32Stream) return; // Zaten bağlıysa tekrar bağlanma
    console.log(`[+] ESP32 Stream URL: ${STREAM_URL}`);
    console.log('[+] ESP32 stream bağlantısı başlatılıyor...');
    const httpOptions = {
        timeout: 10000, // 10 saniye timeout
        headers: {
            'Connection': 'keep-alive'
        }
    };

    try {
        esp32Stream = http.get(STREAM_URL, httpOptions, (espRes) => {
            if (espRes.statusCode !== 200) {
                console.error(`[!] ESP32 bağlantısı hata kodu: ${espRes.statusCode}`);
                esp32Stream = null;
                setTimeout(connectToESP32, 5000); // 5 saniye sonra tekrar dene
                return;
            }

            console.log(`[+] ESP32 bağlantısı kuruldu (${espRes.statusCode})`);

            let frameCount = 0;
            let currentFrameData = [];
            let isInFrame = false;

            espRes.on('data', (chunk) => {
                // MJPEG stream'de frame sınırlarını kontrol et
                const chunkStr = chunk.toString();

                // Her parçayı buffer'a ekle
                if (viewers.length > 0) {
                    viewers.forEach(v => {
                        try {
                            v.write(chunk);
                        } catch (e) {
                            // İstemci bağlantısı hatası, session'ı kaldır
                            console.error(`[!] İstemci yazma hatası:`, e.message);
                        }
                    });
                }

                frameCount++;
                if (frameCount % 100 === 0) {
                    console.log(`[+] ${frameCount} frame alındı (${chunk.length} bytes), ${viewers.length} izleyici var`);
                }
            });

            espRes.on('end', () => {
                console.log('[!] ESP32 stream bağlantısı sonlandı');
                esp32Stream = null;

                // İzleyicilere bağlantı kapandığını bildir
                viewers.forEach(v => {
                    try {
                        v.end();
                    } catch (e) { }
                });
                viewers = [];

                // Yeniden bağlanmayı dene
                setTimeout(connectToESP32, 5000);
            });

            espRes.on('error', (err) => {
                console.error('[!] ESP32 stream hatası:', err.message);
                esp32Stream = null;
                setTimeout(connectToESP32, 5000);
            });

            // Kayıt işlemini başlat
            if (!isRecording) {
                startRecording();
            }
        });

        esp32Stream.on('error', (err) => {
            console.error('[!] ESP32 bağlantı hatası:', err.message);
            esp32Stream = null;
            setTimeout(connectToESP32, 5000);
        });

    } catch (err) {
        console.error('[!] ESP32 bağlantısı kurulamadı:', err.message);
        esp32Stream = null;
        setTimeout(connectToESP32, 5000);
    }
}

// 4. MJPEG Stream endpoint'i
app.get('/stream', (req, res) => {
    // MJPEG headers
    res.writeHead(200, {
        'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
        'Cache-Control': 'no-cache',
        'Connection': 'close',
        'Pragma': 'no-cache'
    });

    // İzleyici listesine ekle
    viewers.push(res);
    console.log(`[+] Yeni izleyici bağlandı (toplam: ${viewers.length})`);

    // ESP32'ye bağlı değilse bağlan
    if (!esp32Stream) {
        connectToESP32();
    }

    // İstemci bağlantısı kesilirse listeden çıkar
    req.on('close', () => {
        viewers = viewers.filter(v => v !== res);
        console.log(`[+] İzleyici ayrıldı (kalan: ${viewers.length})`);
    });
});

// 5. FFMPEG ile sürekli video kaydı
function startRecording(durationMinutes = 1) {
    if (isRecording) return;
    isRecording = true;

    // ESP32'ye bağlı değilse bağlan
    if (!esp32Stream) {
        connectToESP32();
        return;
    }

    const now = new Date();
    const isoStr = now.toISOString().replace(/[:.]/g, '_');
    const fileName = `video_${isoStr}.mp4`;
    const filePath = path.join(VIDEOS_DIR, fileName);

    console.log(`[+] Video kaydı başlatılıyor: ${fileName}`);

    ffmpegProcess = spawn('ffmpeg', [
        '-y',                          // Var olan dosyanın üzerine yaz
        '-i', STREAM_URL,              // ESP32 stream URL'i
        '-c:v', 'libx264',             // H.264 codec
        '-preset', 'ultrafast',        // Hızlı encoding
        '-t', String(durationMinutes * 60), // Saniye cinsinden süre
        '-pix_fmt', 'yuv420p',         // Piksel formatı
        filePath
    ]);

    ffmpegProcess.stderr.on('data', (data) => {
        process.stdout.write(`[ffmpeg] ${data}`);
    });

    ffmpegProcess.on('close', (code) => {
        console.log(`[+] Video kaydı bitti: ${fileName} (ffmpeg kod: ${code})`);
        isRecording = false;
        ffmpegProcess = null;
        startRecording(durationMinutes); // Yeni kayıt başlat
    });

    ffmpegProcess.on('error', (err) => {
        console.error(`[!] FFMPEG hatası: ${err.message}`);
        isRecording = false;
        ffmpegProcess = null;
        setTimeout(() => startRecording(durationMinutes), 5000);
    });
}

// 6. API durum endpoint'i
app.get('/api/status', (req, res) => {
    res.json({
        streaming: !!esp32Stream,
        viewers: viewers.length,
        recording: isRecording
    });
});

// 7. Sunucuyu başlat
const server = app.listen(PORT, () => {
    console.log(`[+] Backend çalışıyor: http://localhost:${PORT}`);
    // ESP32'ye bağlan
    connectToESP32();
    // Video kayıtlarını başlat
    startRecording(1); // Her 1 dakikada bir yeni dosya
});

// 8. Eski videoları temizle (10 günden eski)
setInterval(() => {
    fs.readdir(VIDEOS_DIR, (err, files) => {
        if (err) return;
        const now = Date.now();
        files.filter(f => f.endsWith('.mp4')).forEach(f => {
            const filePath = path.join(VIDEOS_DIR, f);
            fs.stat(filePath, (err, stats) => {
                if (err) return;
                if ((now - stats.ctimeMs) > TEN_DAYS) {
                    fs.unlink(filePath, (err) => {
                        if (!err) {
                            console.log(`[+] Silindi: ${f} (10 günden eski)`);
                        }
                    });
                }
            });
        });
    });
}, 60 * 60 * 1000); // Her saat kontrol et

// Uygulama kapatılırsa temizlik yap
process.on('SIGINT', () => {
    console.log('\n[+] Uygulama kapatılıyor...');

    if (ffmpegProcess) {
        console.log('[+] FFMPEG durduruluyor...');
        ffmpegProcess.kill();
    }

    if (esp32Stream) {
        console.log('[+] ESP32 bağlantısı kapatılıyor...');
        esp32Stream.destroy();
    }

    setTimeout(() => {
        console.log('[+] Temiz çıkış yapıldı.');
        process.exit(0);
    }, 1000);
});