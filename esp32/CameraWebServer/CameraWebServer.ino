#define CAMERA_MODEL_AI_THINKER
#include "esp_camera.h"
#include "camera_pins.h"
#include <WiFi.h>
#include <ESP32Servo.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include <rtc_wdt.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"
#include <esp_task_wdt.h>
#include <ArduinoJson.h>

// Pin tanımlamaları
#define PAN_SERVO_PIN 13   // Pan servo için GPIO
#define TILT_SERVO_PIN 15  // Tilt servo için GPIO
#define LED_PIN 4          // Board flash LED

// WiFi bilgileri
const char* ssid = "SUPERONLINE_WiFi_BBB0";
const char* password = "ARRJKM3KCATT";
unsigned long lastClientActivity = 0;
const unsigned long CLIENT_TIMEOUT = 15000;  // 15 saniye bağlantı zaman aşımı
bool clientConnected = false;
bool wifiConnected = false;
unsigned long lastWifiCheck = 0;

// HTTP Server
WiFiServer server(80);
SemaphoreHandle_t streamMutex = NULL;
QueueHandle_t clientQueue;
TaskHandle_t streamTaskHandle = NULL;

// Servo motor değişkenleri
Servo panServo, tiltServo;
volatile int pan_angle = 90;
volatile int tilt_angle = 90;
volatile int pan_target = 90;
volatile int tilt_target = 90;
bool led_on = false;

// Komut kuyruk yapısı
typedef struct {
  int panTarget;
  int tiltTarget;
} PTCommand;

QueueHandle_t ptQueue;

// Pan-tilt task
void panTiltTask(void* parameter) {
  // Watchdog'u devre dışı bırak
  esp_task_wdt_delete(NULL);

  panServo.attach(PAN_SERVO_PIN);
  tiltServo.attach(TILT_SERVO_PIN);

  // Başlangıç pozisyonu
  panServo.write(pan_angle);
  tiltServo.write(tilt_angle);
  delay(500);  // Servo'ların yerleşmesi için bekle

  TickType_t lastWakeTime = xTaskGetTickCount();
  const TickType_t interval = pdMS_TO_TICKS(20);  // 20ms aralıklarla çalış (50Hz)

  for (;;) {
    // Komut geldi mi kontrol et
    PTCommand cmd;
    if (xQueueReceive(ptQueue, &cmd, 0) == pdTRUE) {
      pan_target = constrain(cmd.panTarget, 0, 180);
      tilt_target = constrain(cmd.tiltTarget, 0, 180);
    }

    // Pan hareketi yumuşat (max 2 derece/adım)
    if (pan_angle != pan_target) {
      int diff = pan_target - pan_angle;
      int step = constrain(diff, -2, 2);
      pan_angle += step;
      panServo.write(pan_angle);
    }

    // Tilt hareketi yumuşat (max 2 derece/adım)
    if (tilt_angle != tilt_target) {
      int diff = tilt_target - tilt_angle;
      int step = constrain(diff, -2, 2);
      tilt_angle += step;
      tiltServo.write(tilt_angle);
    }

    // Task zamanlaması - düzenli aralıklarla çalıştır
    vTaskDelayUntil(&lastWakeTime, interval);
  }
}

// Video stream task
void streamTask(void* parameter) {
  // Watchdog'u devre dışı bırak
  esp_task_wdt_delete(NULL);

  WiFiClient* client = NULL;
  const char* boundary = "frame";

  for (;;) {
    // Aktif client varsa zaman aşımını kontrol et
    if (client != NULL && clientConnected) {
      if (!client->connected() || millis() - lastClientActivity > CLIENT_TIMEOUT) {
        Serial.println("Stream client timeout veya bağlantısı kesildi, temizleniyor");
        client->stop();
        delete client;
        client = NULL;
        clientConnected = false;
      }
    }

    // Yeni client var mı?
    if (client == NULL && !clientConnected && xQueueReceive(clientQueue, &client, 0) == pdTRUE && client != NULL) {
      Serial.println("Yeni stream client bağlandı");
      clientConnected = true;
      lastClientActivity = millis();

      // CORS header'ları ve HTTP header'ı gönder
      client->println("HTTP/1.1 200 OK");
      client->println("Access-Control-Allow-Origin: *");
      client->println("Access-Control-Allow-Methods: GET, POST, OPTIONS");
      client->println("Access-Control-Allow-Headers: Content-Type");
      client->printf("Content-Type: multipart/x-mixed-replace; boundary=%s\r\n", boundary);
      client->println("Cache-Control: no-cache");
      client->println("Pragma: no-cache");
      client->println("Connection: close");
      client->println();
      client->flush();  // Hemen gönder
    }

    // Bağlı client'a stream gönder
    if (client != NULL && clientConnected && client->connected()) {
      if (xSemaphoreTake(streamMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
        camera_fb_t* fb = esp_camera_fb_get();
        if (fb) {
          bool sendError = false;

          // Multipart boundary ve içerik bilgilerini gönder
          if (client->connected()) {
            client->printf("--%s\r\n", boundary);
            client->println("Content-Type: image/jpeg");
            client->printf("Content-Length: %u\r\n\r\n", fb->len);
          } else {
            sendError = true;
          }

          // Buffer'ı 4K'lık parçalar halinde gönder
          if (!sendError) {
            size_t net_len = 0;
            while (net_len < fb->len && client->connected()) {
              size_t chunk_size = fb->len - net_len;
              if (chunk_size > 4096) chunk_size = 4096;

              size_t bytesWritten = client->write(fb->buf + net_len, chunk_size);
              if (bytesWritten != chunk_size) {
                sendError = true;
                break;
              }
              net_len += chunk_size;

              // Her parça sonrası buffer'ın boşalması için flush
              client->flush();
            }
          }

          if (!sendError && client->connected()) {
            client->println();
            lastClientActivity = millis();  // Başarıyla gönderildiyse aktivite zamanını güncelle
          }

          esp_camera_fb_return(fb);

          // Hata durumu - bağlantıyı kapat
          if (sendError || !client->connected()) {
            Serial.println("Stream gönderme hatası, client kapatılıyor");
            client->stop();
            delete client;
            client = NULL;
            clientConnected = false;
          } else {
            // Düzenli frame rate için
            vTaskDelay(pdMS_TO_TICKS(30));  // ~30fps hedef
          }
        }
        xSemaphoreGive(streamMutex);
      }
    }

    vTaskDelay(pdMS_TO_TICKS(5));  // CPU yükünü azalt
  }
}

// WiFi bağlantı kontrolü görevi - EKLENECEK
void wifiMonitorTask(void* parameter) {
  const TickType_t xDelay = pdMS_TO_TICKS(5000);  // 5 saniyede bir kontrol et

  for (;;) {
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("WiFi bağlantısı kesildi, yeniden bağlanılıyor...");
      wifiConnected = false;

      WiFi.disconnect();
      WiFi.begin(ssid, password);

      // 10 saniye bağlantı için bekle
      unsigned long startAttemptTime = millis();
      while (WiFi.status() != WL_CONNECTED && millis() - startAttemptTime < 10000) {
        vTaskDelay(pdMS_TO_TICKS(500));
        Serial.print(".");
      }

      if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\nWiFi yeniden bağlandı");
        Serial.print("IP adresi: ");
        Serial.println(WiFi.localIP());
        wifiConnected = true;
      }
    } else {
      wifiConnected = true;
    }

    vTaskDelay(xDelay);
  }
}

// Reset endpoint'i: uzaktan yeniden başlatma için
void handleReset(String req, WiFiClient* client) {
  // İsteğe bağlı gecikme parametresi: delay=X (milisaniye cinsinden)
  int delayIdx = req.indexOf("delay=");
  int delayMs = 1000;  // Varsayılan 1 saniye gecikme

  if (delayIdx != -1) {
    int valStart = delayIdx + 6;
    int valEnd = req.indexOf('&', valStart);
    if (valEnd == -1) valEnd = req.indexOf(' ', valStart);
    if (valEnd == -1) valEnd = req.length();
    delayMs = constrain(req.substring(valStart, valEnd).toInt(), 500, 10000);
  }

  // JSON yanıt oluştur
  DynamicJsonDocument doc(128);
  doc["status"] = "restarting";
  doc["delay_ms"] = delayMs;

  // CORS ve JSON yanıtı gönder
  client->println("HTTP/1.1 200 OK");
  client->println("Access-Control-Allow-Origin: *");
  client->println("Access-Control-Allow-Methods: GET, POST, OPTIONS");
  client->println("Content-Type: application/json");
  client->println("Connection: close");
  client->println();

  String output;
  serializeJson(doc, output);
  client->println(output);
  client->flush();  // Yanıtın hemen gönderildiğinden emin ol

  Serial.printf("Sistem %d ms içinde yeniden başlatılacak\n", delayMs);
  delay(delayMs);
  ESP.restart();
}

// Pan/tilt komutlarını işle
void handleMove(String req, WiFiClient* client) {
  int panIdx = req.indexOf("pan=");
  int tiltIdx = req.indexOf("tilt=");

  PTCommand cmd = { pan_target, tilt_target };  // Mevcut değerlerle başla

  if (panIdx != -1) {
    int valStart = panIdx + 4;
    int valEnd = req.indexOf('&', valStart);
    if (valEnd == -1) valEnd = req.indexOf(' ', valStart);
    if (valEnd == -1) valEnd = req.length();
    cmd.panTarget = constrain(req.substring(valStart, valEnd).toInt(), 0, 180);
  }

  if (tiltIdx != -1) {
    int valStart = tiltIdx + 5;
    int valEnd = req.indexOf('&', valStart);
    if (valEnd == -1) valEnd = req.indexOf(' ', valStart);
    if (valEnd == -1) valEnd = req.length();
    cmd.tiltTarget = constrain(req.substring(valStart, valEnd).toInt(), 0, 180);
  }

  xQueueOverwrite(ptQueue, &cmd);  // Kuyruğa en güncel hedefi gönder

  // JSON yanıt oluştur
  DynamicJsonDocument doc(256);
  doc["pan"] = cmd.panTarget;
  doc["tilt"] = cmd.tiltTarget;
  doc["current_pan"] = pan_angle;
  doc["current_tilt"] = tilt_angle;

  // CORS ve JSON yanıtı gönder
  client->println("HTTP/1.1 200 OK");
  client->println("Access-Control-Allow-Origin: *");
  client->println("Access-Control-Allow-Methods: GET, POST, OPTIONS");
  client->println("Content-Type: application/json");
  client->println("Connection: close");
  client->println();

  String output;
  serializeJson(doc, output);
  client->println(output);
}

// LED kontrolü
void handleLed(String req, WiFiClient* client) {
  int onIdx = req.indexOf("on=");
  bool changed = false;

  if (onIdx != -1) {
    int valStart = onIdx + 3;
    int valEnd = req.indexOf('&', valStart);
    if (valEnd == -1) valEnd = req.indexOf(' ', valStart);
    if (valEnd == -1) valEnd = req.length();
    int val = req.substring(valStart, valEnd).toInt();

    if ((val != 0) != led_on) {
      changed = true;
      led_on = (val != 0);
      digitalWrite(LED_PIN, led_on ? HIGH : LOW);
    }
  }

  // JSON yanıt oluştur
  DynamicJsonDocument doc(128);
  doc["led"] = led_on ? 1 : 0;
  doc["changed"] = changed;

  // CORS ve JSON yanıtı gönder
  client->println("HTTP/1.1 200 OK");
  client->println("Access-Control-Allow-Origin: *");
  client->println("Access-Control-Allow-Methods: GET, POST, OPTIONS");
  client->println("Content-Type: application/json");
  client->println("Connection: close");
  client->println();

  String output;
  serializeJson(doc, output);
  client->println(output);
}

// Sistem durumu bilgisi
void handleStatus(WiFiClient* client) {
  // JSON yanıt oluştur
  DynamicJsonDocument doc(768);
  doc["system"]["uptime"] = millis() / 1000;
  doc["system"]["free_heap"] = ESP.getFreeHeap();
  doc["system"]["total_heap"] = ESP.getHeapSize();
  doc["system"]["cpu_freq_mhz"] = ESP.getCpuFreqMHz();

  doc["servo"]["pan"] = pan_angle;
  doc["servo"]["tilt"] = tilt_angle;
  doc["servo"]["pan_target"] = pan_target;
  doc["servo"]["tilt_target"] = tilt_target;

  doc["led"] = led_on ? 1 : 0;

  doc["network"]["ip"] = WiFi.localIP().toString();
  doc["network"]["rssi"] = WiFi.RSSI();
  doc["network"]["ssid"] = WiFi.SSID();
  doc["network"]["connected"] = wifiConnected;
  doc["network"]["wifi_status"] = WiFi.status();

  doc["stream"]["active"] = clientConnected;
  if (clientConnected) {
    doc["stream"]["active_time"] = (millis() - lastClientActivity) / 1000;
  }

  // Kamera sensör bilgisi
  sensor_t* s = esp_camera_sensor_get();
  if (s) {
    doc["camera"]["brightness"] = s->status.brightness;
    doc["camera"]["contrast"] = s->status.contrast;
    doc["camera"]["saturation"] = s->status.saturation;
    doc["camera"]["sharpness"] = s->status.sharpness;
    doc["camera"]["denoise"] = s->status.denoise;
    doc["camera"]["quality"] = s->status.quality;
  }

  // CORS ve JSON yanıtı gönder
  client->println("HTTP/1.1 200 OK");
  client->println("Access-Control-Allow-Origin: *");
  client->println("Access-Control-Allow-Methods: GET, POST, OPTIONS");
  client->println("Content-Type: application/json");
  client->println("Connection: close");
  client->println();

  String output;
  serializeJson(doc, output);
  client->println(output);
  client->flush();
}

// CORS preflight isteklerini işle
void handleOptions(WiFiClient* client) {
  client->println("HTTP/1.1 200 OK");
  client->println("Access-Control-Allow-Origin: *");
  client->println("Access-Control-Allow-Methods: GET, POST, OPTIONS");
  client->println("Access-Control-Allow-Headers: Content-Type");
  client->println("Access-Control-Max-Age: 86400");
  client->println("Content-Length: 0");
  client->println("Connection: close");
  client->println();
}

void setup() {
  // Brownout dedektörünü devre dışı bırak - güvenli bir yöntemle
  uint32_t brown_reg_temp = READ_PERI_REG(RTC_CNTL_BROWN_OUT_REG);
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);

  Serial.begin(115200);
  Serial.setDebugOutput(true);
  Serial.println();

  // LED pin'ini ayarla
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  // Kamera konfigürasyonu
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;        // 20MHz XCLK
  config.frame_size = FRAMESIZE_VGA;     // 640x480
  config.pixel_format = PIXFORMAT_JPEG;  // JPEG formatı
  config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
  config.fb_location = CAMERA_FB_IN_PSRAM;
  config.jpeg_quality = 12;  // 0-63, düşük değer = yüksek kalite
  config.fb_count = 2;       // Frame buffer sayısı

  // Kamera başlatma
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Kamera başlatma hatası 0x%x\n", err);
    delay(1000);
    ESP.restart();
  }

  // Kamera parametrelerini ayarla
  sensor_t* s = esp_camera_sensor_get();
  if (s) {
    s->set_contrast(s, 2);                    // -2 to 2
    s->set_brightness(s, 0);                  // -2 to 2
    s->set_saturation(s, 0);                  // -2 to 2
    s->set_special_effect(s, 0);              // 0 = no effect
    s->set_whitebal(s, 1);                    // 1 = auto
    s->set_awb_gain(s, 1);                    // 1 = enable
    s->set_wb_mode(s, 0);                     // auto
    s->set_exposure_ctrl(s, 1);               // 1 = auto
    s->set_aec2(s, 1);                        // 1 = enable
    s->set_gain_ctrl(s, 1);                   // 1 = auto
    s->set_agc_gain(s, 0);                    // 0 to 30
    s->set_gainceiling(s, (gainceiling_t)6);  // 0 to 6
    s->set_bpc(s, 1);                         // 1 = enable
    s->set_wpc(s, 1);                         // 1 = enable
    s->set_raw_gma(s, 1);                     // 1 = enable
    s->set_lenc(s, 1);                        // 1 = enable
    s->set_hmirror(s, 0);                     // 0 = disable, 1 = enable
    s->set_vflip(s, 0);                       // 0 = disable, 1 = enable
    s->set_dcw(s, 1);                         // 1 = enable
    s->set_colorbar(s, 0);                    // 0 = disable
  }

  // WiFi bağlantısı
  WiFi.begin(ssid, password);
  WiFi.setSleep(false);

  Serial.print("WiFi bağlanıyor");
  unsigned long startAttemptTime = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startAttemptTime < 10000) {
    delay(100);
    Serial.print(".");
  }

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("\nWiFi bağlantı zaman aşımı, yeniden başlatılıyor...");
    delay(1000);
    ESP.restart();
  } else {
    wifiConnected = true;
  }

  Serial.println();
  Serial.print("IP adresi: ");
  Serial.println(WiFi.localIP());

  // HTTP server başlat
  server.begin();

  // Mutexler ve kuyruklar oluştur
  streamMutex = xSemaphoreCreateMutex();
  ptQueue = xQueueCreate(1, sizeof(PTCommand));
  clientQueue = xQueueCreate(1, sizeof(WiFiClient*));

  // Task'ları başlat
  xTaskCreatePinnedToCore(
    panTiltTask,
    "PanTiltTask",
    4096,
    NULL,
    3,  // Yüksek öncelik
    NULL,
    1  // Core 1'e atanmış
  );

  // WiFi monitör görevi ekle
  xTaskCreatePinnedToCore(
    wifiMonitorTask,
    "WiFiMonitor",
    4096,
    NULL,
    1,  // Düşük öncelik
    NULL,
    1  // Core 1'e atanmış
  );

  xTaskCreatePinnedToCore(
    streamTask,
    "StreamTask",
    8192,  // Büyük stack (JPEG işleme için)
    NULL,
    2,  // Orta öncelik
    &streamTaskHandle,
    0  // Core 0'a atanmış (WiFi ile aynı çekirdekte)
  );

  // Başlangıç bilgilerini yazdır
  Serial.println("API sunucusu hazır!");
  Serial.printf("API endpoint'leri http://%s/ adresinde\n", WiFi.localIP().toString().c_str());
  printAPIEndpoints();
}

void printAPIEndpoints() {
  Serial.println("\nKullanılabilir API Endpoint'leri:");
  Serial.println("--------------------------------");
  Serial.println("/stream - MJPEG video akışı");
  Serial.println("/move?pan=X&tilt=Y - Pan ve tilt ayarı (0-180)");
  Serial.println("/led?on=1 - LED açık (1) veya kapalı (0)");
  Serial.println("/status - Sistem durumunu görüntüle");
  Serial.println("/reset?delay=1000 - Sistemi yeniden başlat (delay ms olarak)");
  Serial.println("--------------------------------\n");
}

void loop() {
  WiFiClient* client = new WiFiClient;

  if (server.hasClient()) {
    *client = server.available();

    if (client->connected()) {
      // HTTP isteğini oku
      String header = client->readStringUntil('\r');
      client->readStringUntil('\n');  // İlk satırı tamamla

      // HTTP başlıklarını atla
      while (client->available()) {
        String line = client->readStringUntil('\r');
        client->readStringUntil('\n');
        if (line.length() <= 1) break;  // Boş satır (header sonu)
      }

      Serial.println(header);

      // OPTIONS isteklerini işle (CORS preflight)
      if (header.startsWith("OPTIONS ")) {
        handleOptions(client);
      }
      // Stream istekleri
      else if (header.indexOf("GET /stream") >= 0) {
        // Eğer zaten bir stream client varsa (ve aktifse), bunu reddet
        if (clientConnected) {
          client->println("HTTP/1.1 503 Service Unavailable");
          client->println("Access-Control-Allow-Origin: *");
          client->println("Content-Type: application/json");
          client->println("Connection: close");
          client->println();
          client->println("{\"error\":\"Stream is already active with another client\",\"code\":503}");
        } else {
          // Queue'ya ekle ve client kontrolünü stream görevine devret
          if (xQueueSend(clientQueue, &client, 0) == pdTRUE) {
            client = NULL;  // Client'ı stream task'a devrettik
          } else {
            // Queue doluysa (olmamalı ama güvenlik için)
            client->println("HTTP/1.1 500 Internal Server Error");
            client->println("Access-Control-Allow-Origin: *");
            client->println("Content-Type: application/json");
            client->println("Connection: close");
            client->println();
            client->println("{\"error\":\"Stream queue is full\",\"code\":500}");
          }
        }
      }
      // Pan/Tilt kontrolü
      else if (header.indexOf("GET /move") >= 0) {
        handleMove(header, client);
      }
      // LED kontrolü
      else if (header.indexOf("GET /led") >= 0) {
        handleLed(header, client);
      }
      // Sistem durumu
      else if (header.indexOf("GET /status") >= 0) {
        handleStatus(client);
      }
      // Reset endpoint'i - YENİ
      else if (header.indexOf("GET /reset") >= 0) {
        handleReset(header, client);
      }
      // Bilinmeyen istek
      else {
        client->println("HTTP/1.1 404 Not Found");
        client->println("Access-Control-Allow-Origin: *");
        client->println("Content-Type: application/json");
        client->println("Connection: close");
        client->println();
        client->println("{\"error\":\"Endpoint not found\",\"code\":404}");
      }

      if (client) {
        client->stop();
        delete client;
        client = NULL;
      }
    }
  }

  // Client belleğini temizle
  if (client) {
    delete client;
    client = NULL;
  }

  delay(10);  // CPU kullanımını azalt
}