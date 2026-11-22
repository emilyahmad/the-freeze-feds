// Freeze Pad: the s'mores-pad (Seeed XIAO ESP32-C3, 4 keys, 128x32 OLED) as a controller for The Freeze Feds.
// Based on smores-pad's code/FinalizedMacropad.cpp: same Bluetooth keyboard ("Macropad"), pins, OLED wiring and
// twinkling symbols; only the keys it types changed. The game reads them as ordinary key presses:
//   SW1  ←      select the next person to the left
//   SW2  →      select the next person to the right
//   SW3  Enter  call the selected person up for an ID check / let them go again (also START / Play again)
//   SW4  Space  Freeze: opens the snowball cam (press again while it's open to throw straight away)
// Libraries: ESP32-BLE-Keyboard (T-vK), Adafruit SSD1306 + Adafruit GFX. Board: XIAO_ESP32C3.
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <BleKeyboard.h>

#define OLED_ADDRESS 0x3C
Adafruit_SSD1306 display(128, 32, &Wire, -1);
BleKeyboard bleKeyboard("Macropad", "DIY", 100);   // same name as before, so the Mac it's paired with reconnects
bool oledOk = false;

// ---------- Blink state (symbols twinkle: group 0 and group 1 alternate) ----------
bool blinkPhase = false;
unsigned long lastBlink = 0;
const unsigned long BLINK_MS = 500;
bool dirty = true;
inline bool vis(int group) { return blinkPhase == (group == 1); }

// ---------- Cute symbols drawn with shapes ----------
void drawSparkle(int x, int y, int r) {            // ⋆
  display.drawLine(x - r, y, x + r, y, SSD1306_WHITE);
  display.drawLine(x, y - r, x, y + r, SSD1306_WHITE);
}
void drawRing(int x, int y) { display.drawCircle(x, y, 1, SSD1306_WHITE); }   // ˚ ｡
void drawSpiral(int cx, int cy) {                   // ꩜
  int px = cx, py = cy;
  for (float t = 0.5; t < 12.5; t += 0.4) {
    float r = t * 0.4;
    int x = cx + (int)(r * cos(t));
    int y = cy + (int)(r * sin(t));
    display.drawLine(px, py, x, y, SSD1306_WHITE);
    px = x; py = y;
  }
}
void decorate(int style) {
  switch (style) {
    case 0:  // left
      if (vis(0)) { drawSparkle(6, 5, 3);   drawRing(120, 27); }
      if (vis(1)) { drawSparkle(121, 27, 2); drawRing(18, 4); }
      break;
    case 1:  // right
      if (vis(0)) { drawSpiral(119, 8);     drawRing(14, 5); }
      if (vis(1)) { drawSparkle(6, 27, 2);  drawRing(112, 26); }
      break;
    case 2:  // ID check
      if (vis(0)) { drawSparkle(8, 6, 3);   drawRing(112, 27); }
      if (vis(1)) { drawRing(120, 5);       drawSparkle(8, 26, 2); }
      break;
    case 3:  // freeze
      if (vis(0)) { drawRing(6, 5);         drawSpiral(8, 26); }
      if (vis(1)) { drawSparkle(121, 6, 2); drawRing(112, 27); }
      break;
    case 5:  // idle, connected
      if (vis(0)) { drawSparkle(8, 25, 2); }
      if (vis(1)) { drawSparkle(120, 25, 2); }
      break;
    case 6:  // idle, pairing
      if (vis(0)) drawSpiral(10, 9);
      if (vis(1)) { drawRing(10, 9); drawRing(118, 9); }
      break;
    default: // not connected
      if (vis(0)) drawSparkle(6, 5, 3);
      if (vis(1)) drawSparkle(121, 27, 3);
      break;
  }
}

// ---------- Screen state ----------
enum Screen { SCREEN_IDLE, SCREEN_MESSAGE };
Screen screen = SCREEN_IDLE;
const char* msgText = "";
int msgSize = 1, msgStyle = 0;
unsigned long messageUntil = 0;

void centerText(const char* msg, int size, int y) {
  int16_t x1, y1; uint16_t w, h;
  display.setTextSize(size);
  display.getTextBounds(msg, 0, 0, &x1, &y1, &w, &h);
  display.setCursor((128 - w) / 2, y);
  display.print(msg);
}

void render() {
  if (!oledOk) return;
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  if (screen == SCREEN_MESSAGE) {
    centerText(msgText, msgSize, msgSize == 2 ? 8 : 12);
    decorate(msgStyle);
  } else if (bleKeyboard.isConnected()) {
    centerText("Freeze Feds", 2, 2);
    centerText("ready to freeze", 1, 22);
    decorate(5);
  } else {
    centerText("Pairing...", 1, 4);
    centerText("find \"Macropad\"", 1, 18);
    decorate(6);
  }
  display.display();
}

void showMessage(const char* text, int size, int style) {
  screen = SCREEN_MESSAGE;
  msgText = text; msgSize = size; msgStyle = style;
  messageUntil = millis() + 1000;
  dirty = true;
}

// ---------- Actions: plain keys the game listens for ----------
void tap(uint8_t key) {
  bleKeyboard.press(key);
  delay(30);
  bleKeyboard.releaseAll();
}

void doLeft()   { tap(KEY_LEFT_ARROW);  showMessage("\x1b Left", 2, 0); }   // SW1
void doRight()  { tap(KEY_RIGHT_ARROW); showMessage("Right \x1a", 2, 1); }  // SW2
void doCheck()  { tap(KEY_RETURN);      showMessage("ID check!", 2, 2); }   // SW3
void doFreeze() { tap(' ');             showMessage("FREEZE!", 2, 3); }     // SW4

// ---------- Keys ----------
// Pins checked on the real pad (and smorespad.kicad_sch): SW2 is on D7 and SW3 on D3, the other way round from
// FinalizedMacropad.cpp's comments.
struct Key { int pin; void (*action)(); bool state; unsigned long changed; };
Key keys[] = {
  { D2, doLeft,   HIGH, 0 },   // SW1
  { D7, doRight,  HIGH, 0 },   // SW2
  { D3, doCheck,  HIGH, 0 },   // SW3
  { D8, doFreeze, HIGH, 0 },   // SW4
};
const int NUM_KEYS = sizeof(keys) / sizeof(keys[0]);
bool wasConnected = false;

void setup() {
  Serial.begin(115200);
  for (int i = 0; i < NUM_KEYS; i++) pinMode(keys[i].pin, INPUT_PULLUP);

  Wire.begin(7, 6);   // swapped: SDA = GPIO7, SCL = GPIO6
  oledOk = display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDRESS);
  if (!oledOk) Serial.println("OLED init failed (the keys still work)");
  bleKeyboard.begin();
  render();
}

void loop() {
  unsigned long now = millis();
  bool connected = bleKeyboard.isConnected();

  for (int i = 0; i < NUM_KEYS; i++) {
    bool s = digitalRead(keys[i].pin);
    if (s != keys[i].state && now - keys[i].changed > 25) {   // debounce
      keys[i].state = s;
      keys[i].changed = now;
      if (s == LOW) {
        Serial.printf("SW%d pressed (pin %d)\n", i + 1, keys[i].pin);
        if (connected) keys[i].action();
        else showMessage("Not connected", 1, 4);
      }
    }
  }

  if (now - lastBlink >= BLINK_MS) { blinkPhase = !blinkPhase; lastBlink = now; dirty = true; }
  if (screen == SCREEN_MESSAGE && now > messageUntil) { screen = SCREEN_IDLE; dirty = true; }
  if (connected != wasConnected) { wasConnected = connected; dirty = true; }

  if (dirty) { dirty = false; render(); }
}
