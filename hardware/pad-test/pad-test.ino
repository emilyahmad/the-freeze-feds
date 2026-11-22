// Pad test: the smallest thing that gets a key press from the s'mores-pad (XIAO ESP32-C3) into the browser.
// No keyboard emulation: the pad is a plain Bluetooth LE device ("FreezePad") with one characteristic that sends
// the switch name (SW1 … SW4) on every press. pad-test.html connects to it with Web Bluetooth (Chrome) and shows
// "works". The OLED shows whether a browser is connected and the last key sent.
// Libraries: none extra (BLE comes with the esp32 board package), Adafruit SSD1306 + GFX for the OLED.
// Board: XIAO_ESP32C3.
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLE2902.h>

// must match pad-test.html
#define SERVICE_UUID "6e0f0001-5a1e-4f2e-9c1b-f2ee2efd0001"
#define KEYS_UUID    "6e0f0002-5a1e-4f2e-9c1b-f2ee2efd0001"

Adafruit_SSD1306 display(128, 32, &Wire, -1);
bool oledOk = false;
BLECharacteristic *keysChar;
volatile bool connected = false;
const char *lastSent = "";

// pins checked on the real pad: SW1 D2, SW2 D7, SW3 D3, SW4 D8 (each to GND, read LOW when pressed)
struct Key { int pin; const char *name; bool state; unsigned long changed; };
Key keys[] = {
  { D2, "SW1", HIGH, 0 },
  { D7, "SW2", HIGH, 0 },
  { D3, "SW3", HIGH, 0 },
  { D8, "SW4", HIGH, 0 },
};

void show() {
  if (!oledOk) return;
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.print("Pad test");
  display.setCursor(0, 12);
  display.print(connected ? "browser connected" : "waiting for browser");
  display.setCursor(0, 24);
  if (*lastSent) { display.print("sent "); display.print(lastSent); }
  display.display();
}

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *server) override { connected = true; }
  void onDisconnect(BLEServer *server) override { connected = false; server->startAdvertising(); }   // findable again
};

void setup() {
  Serial.begin(115200);
  for (Key &k : keys) pinMode(k.pin, INPUT_PULLUP);

  Wire.begin(7, 6);   // swapped: SDA = GPIO7, SCL = GPIO6
  oledOk = display.begin(SSD1306_SWITCHCAPVCC, 0x3C);

  BLEDevice::init("FreezePad");
  BLEServer *server = BLEDevice::createServer();
  server->setCallbacks(new ServerCallbacks());
  BLEService *service = server->createService(SERVICE_UUID);
  keysChar = service->createCharacteristic(KEYS_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
#if ESP_ARDUINO_VERSION < ESP_ARDUINO_VERSION_VAL(3, 3, 0)
  keysChar->addDescriptor(new BLE2902());   // lets the browser turn notifications on (added automatically from 3.3)
#endif
  keysChar->setValue((uint8_t *)"ready", 5);
  service->start();

  BLEAdvertising *adv = BLEDevice::getAdvertising();
  adv->addServiceUUID(SERVICE_UUID);
  adv->setScanResponse(true);               // the name goes in the scan response (no room next to the 128-bit UUID)
  BLEDevice::startAdvertising();

  Serial.println("Pad test ready: advertising as FreezePad");
  show();
}

void loop() {
  static bool wasConnected = false;
  unsigned long now = millis();
  for (Key &k : keys) {
    bool s = digitalRead(k.pin);
    if (s == k.state || now - k.changed <= 25) continue;   // debounce
    k.state = s; k.changed = now;
    if (s != LOW) continue;
    lastSent = k.name;
    Serial.printf("%s pressed, browser %s\n", k.name, connected ? "connected" : "not connected");
    if (connected) { keysChar->setValue((uint8_t *)k.name, strlen(k.name)); keysChar->notify(); }
    show();
  }
  if (connected != wasConnected) { wasConnected = connected; show(); }
  delay(1);
}
