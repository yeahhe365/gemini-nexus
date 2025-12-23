// background/control/actions/input/keyboard/press.js

export async function handlePressKey(handler, { key }) {
    const keyMap = {
        'Enter': { windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, key: 'Enter', code: 'Enter', text: '\r' },
        'Backspace': { windowsVirtualKeyCode: 8, nativeVirtualKeyCode: 8, key: 'Backspace', code: 'Backspace' },
        'Tab': { windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9, key: 'Tab', code: 'Tab' },
        'Escape': { windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27, key: 'Escape', code: 'Escape' },
        'Delete': { windowsVirtualKeyCode: 46, nativeVirtualKeyCode: 46, key: 'Delete', code: 'Delete' },
        'ArrowDown': { windowsVirtualKeyCode: 40, nativeVirtualKeyCode: 40, key: 'ArrowDown', code: 'ArrowDown' },
        'ArrowUp': { windowsVirtualKeyCode: 38, nativeVirtualKeyCode: 38, key: 'ArrowUp', code: 'ArrowUp' },
        'ArrowLeft': { windowsVirtualKeyCode: 37, nativeVirtualKeyCode: 37, key: 'ArrowLeft', code: 'ArrowLeft' },
        'ArrowRight': { windowsVirtualKeyCode: 39, nativeVirtualKeyCode: 39, key: 'ArrowRight', code: 'ArrowRight' },
        'PageUp': { windowsVirtualKeyCode: 33, nativeVirtualKeyCode: 33, key: 'PageUp', code: 'PageUp' },
        'PageDown': { windowsVirtualKeyCode: 34, nativeVirtualKeyCode: 34, key: 'PageDown', code: 'PageDown' },
        'End': { windowsVirtualKeyCode: 35, nativeVirtualKeyCode: 35, key: 'End', code: 'End' },
        'Home': { windowsVirtualKeyCode: 36, nativeVirtualKeyCode: 36, key: 'Home', code: 'Home' },
        'Space': { windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32, key: ' ', code: 'Space', text: ' ' }
    };

    try {
        await handler.waitHelper.execute(async () => {
            if (keyMap[key]) {
                const def = keyMap[key];
                // Sending both keyDown and keyUp
                await handler.cmd("Input.dispatchKeyEvent", { type: 'keyDown', ...def });
                await handler.cmd("Input.dispatchKeyEvent", { type: 'keyUp', ...def });
            } else if (key.length === 1) {
                // Character input
                await handler.cmd("Input.dispatchKeyEvent", { type: 'keyDown', text: key, key: key });
                await handler.cmd("Input.dispatchKeyEvent", { type: 'keyUp', text: key, key: key });
            } else {
                throw new Error(`Key '${key}' not supported.`);
            }
        });

        return `Pressed key: ${key}`;
    } catch (e) {
        return `Error pressing key ${key}: ${e.message}`;
    }
}