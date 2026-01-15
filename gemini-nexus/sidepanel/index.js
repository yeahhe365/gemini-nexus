
// sidepanel/index.js - Bridge between Sandbox and Background
import { FrameManager } from './core/frame.js';
import { StateManager } from './core/state.js';
import { MessageBridge } from './core/bridge.js';

// Initialize Core Components
const frameManager = new FrameManager();
const stateManager = new StateManager(frameManager);
const messageBridge = new MessageBridge(frameManager, stateManager);

// Start Lifecycle (async to handle PIP window theme waiting)
(async () => {
    await frameManager.init();
    stateManager.init();
    messageBridge.init();
})();
