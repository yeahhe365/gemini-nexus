// background/control/actions/input/keyboard.js
import { BaseActionHandler } from '../base.js';
import { handleFillElement } from './keyboard/fill.js';
import { handlePressKey } from './keyboard/press.js';

export class KeyboardActions extends BaseActionHandler {
    
    async fillElement(args) {
        return handleFillElement(this, args);
    }

    async pressKey(args) {
        return handlePressKey(this, args);
    }
}