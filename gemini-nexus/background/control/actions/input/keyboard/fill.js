// background/control/actions/input/keyboard/fill.js

export async function handleFillElement(handler, { uid, value }) {
    const objectId = await handler.getObjectIdFromUid(uid);
    
    await handler.waitHelper.execute(async () => {
        // 1. Focus element and detect type
        const info = await handler.cmd("Runtime.callFunctionOn", {
            objectId: objectId,
            functionDeclaration: `function() { 
                this.focus();
                return {
                    tagName: this.tagName,
                    isContentEditable: this.isContentEditable
                };
            }`,
            returnByValue: true
        });

        const { tagName } = info.result.value || {};
        const isSelect = tagName === 'SELECT';

        if (isSelect) {
            await handleSelect(handler, objectId, uid, value);
        } else {
            await handleInput(handler, objectId, value);
        }
    });

    return `Filled element ${uid}`;
}

async function handleSelect(handler, objectId, uid, value) {
    // MCP Enhancement: Use AXTree to find the option instead of JS loop injection
    // This reduces context switching overhead and improves reliability
    const axNode = handler.snapshotManager.getAXNode(uid);
    
    // Helper to safely get value from AX prop
    const getVal = (prop) => prop && prop.value;
    const isCombobox = axNode && (getVal(axNode.role) === 'combobox' || getVal(axNode.role) === 'PopUpButton');

    if (isCombobox) {
        // Find option node node in snapshot with matching text (name)
        const optionUid = handler.snapshotManager.findDescendant(uid, (node) => {
            const role = getVal(node.role);
            const name = getVal(node.name);
            // Match role 'option' and name equals value
            // Or if name matches, assume it's the right option
            return (role === 'option' || role === 'MenuListOption') && name === value;
        });

        if (optionUid) {
            // Found the option in the tree!
            const optionBackendId = handler.snapshotManager.getBackendNodeId(optionUid);
            if (optionBackendId) {
                try {
                    const { object: optionObj } = await handler.cmd("DOM.resolveNode", { backendNodeId: optionBackendId });
                    if (optionObj) {
                        // Set the select value to this option's value
                        await handler.cmd("Runtime.callFunctionOn", {
                            objectId: objectId,
                            arguments: [{ objectId: optionObj.objectId }],
                            functionDeclaration: `function(option) {
                                if (option && !option.disabled) {
                                    this.value = option.value;
                                    this.dispatchEvent(new Event('input', { bubbles: true })); 
                                    this.dispatchEvent(new Event('change', { bubbles: true })); 
                                }
                            }`
                        });
                        return; // Success
                    }
                } catch (e) {
                    // Fallback if resolution fails
                    console.warn("AXTree option resolution failed, falling back to JS", e);
                }
            }
        }
    }

    // Fallback: Robust JS Simulation if AXTree lookup failed
    await handler.cmd("Runtime.callFunctionOn", {
        objectId: objectId,
        functionDeclaration: `function(val) { 
            let found = false;
            // 1. Try matching by value
            for (let i = 0; i < this.options.length; i++) {
                if (this.options[i].value === val) {
                    this.selectedIndex = i;
                    found = true;
                    break;
                }
            }
            // 2. Try matching by visible text
            if (!found) {
                for (let i = 0; i < this.options.length; i++) {
                    if (this.options[i].text === val) {
                        this.selectedIndex = i;
                        found = true;
                        break;
                    }
                }
            }
            // 3. Fallback
            if (!found) this.value = val;
            
            // Dispatch standard events
            this.dispatchEvent(new Event('input', { bubbles: true })); 
            this.dispatchEvent(new Event('change', { bubbles: true })); 
            this.dispatchEvent(new Event('click', { bubbles: true }));
        }`,
        arguments: [{ value: value }]
    });
}

async function handleInput(handler, objectId, value) {
    // For Inputs / Textareas / ContentEditable
    // Use Trusted CDP Input Events for maximum compatibility (React, etc.)

    // 1. Select All Text
    await handler.cmd("Runtime.callFunctionOn", {
        objectId: objectId,
        functionDeclaration: `function() {
            this.focus();
            if (this.select) {
                this.select();
            } else if (window.getSelection) {
                const range = document.createRange();
                range.selectNodeContents(this);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
            }
        }`
    });

    // 2. Clear (Backspace)
    // Sending key events ensures frameworks detect the deletion
    await handler.cmd("Input.dispatchKeyEvent", { 
        type: 'keyDown', 
        windowsVirtualKeyCode: 8, 
        nativeVirtualKeyCode: 8, 
        key: 'Backspace', 
        code: 'Backspace' 
    });
    await handler.cmd("Input.dispatchKeyEvent", { 
        type: 'keyUp', 
        windowsVirtualKeyCode: 8, 
        nativeVirtualKeyCode: 8, 
        key: 'Backspace', 
        code: 'Backspace' 
    });

    // 3. Type New Value
    // Input.insertText simulates typing (fires input events automatically)
    if (value) {
        await handler.cmd("Input.insertText", { text: value });
    }
    
    // 4. Dispatch Change (often only fired on blur by browsers)
    await handler.cmd("Runtime.callFunctionOn", {
        objectId: objectId,
        functionDeclaration: `function() {
            this.dispatchEvent(new Event('change', { bubbles: true }));
        }`
    });
}