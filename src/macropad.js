// The s'mores-pad macropad (hardware/freeze-pad/freeze-pad.ino) pairs as a Bluetooth keyboard and types
// ← → Enter Space, so it's read like any keyboard: SW1 ← 'left', SW2 → 'right' (move the selection),
// SW3 Enter 'select' (ID check / let them go), SW4 Space 'throw' (Freeze). A real keyboard works the same.
const KEYS = { ArrowLeft: 'left', ArrowRight: 'right', Enter: 'select', ' ': 'throw' };

export function installMacropad(onButton) {
  addEventListener('keydown', (e) => {
    const b = KEYS[e.key];
    if (!b || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    e.preventDefault();                    // Enter / Space would also click whatever button has focus
    onButton(b);
  });
}
