
// background/control/dispatcher.js

/**
 * Maps string tool names to executable actions.
 * Decouples logic from the main ControlManager.
 */
export class ToolDispatcher {
    constructor(actions, snapshotManager) {
        this.actions = actions;
        this.snapshotManager = snapshotManager;
    }

    async dispatch(name, args) {
        switch (name) {
            // Navigation
            case 'navigate_page': return this.actions.navigatePage(args);
            case 'new_page': return this.actions.newPage(args);
            case 'close_page': return this.actions.closePage(args);
            case 'list_pages': return this.actions.listPages();
            case 'select_page': return this.actions.selectPage(args);

            // Interaction
            case 'click': return this.actions.clickElement(args);
            case 'drag_element': return this.actions.dragElement(args);
            case 'hover': return this.actions.hoverElement(args);
            case 'fill': return this.actions.fillElement(args);
            case 'fill_form': return this.actions.fillForm(args);
            case 'press_key': return this.actions.pressKey(args);
            case 'handle_dialog': return this.actions.input.handleDialog(args);
            case 'attach_file': return this.actions.attachFile(args);

            // Observation & Logic
            case 'take_screenshot': return this.actions.takeScreenshot(args);
            case 'take_snapshot': return this.snapshotManager.takeSnapshot(args);
            case 'wait_for': return this.actions.waitFor(args);
            case 'evaluate_script': return this.actions.evaluateScript(args);
            case 'run_javascript':
            case 'run_script':
                return this.actions.evaluateScript(args);

            // Emulation
            case 'emulate': return this.actions.emulate(args);
            case 'resize_page': return this.actions.resizePage(args);

            // Performance
            case 'performance_start_trace':
            case 'start_trace':
                return this.actions.startTrace(args);
            case 'performance_stop_trace':
            case 'stop_trace':
                return this.actions.stopTrace(args);
            case 'performance_analyze_insight':
                return this.actions.analyzeInsight(args);

            // Observability / Network
            case 'get_logs': return this.actions.observation.getLogs();
            case 'get_network_activity': return this.actions.observation.getNetworkActivity();
            case 'list_network_requests': return this.actions.observation.listNetworkRequests(args);
            case 'get_network_request': return this.actions.observation.getNetworkRequest(args);

            default:
                return `Error: Unknown tool '${name}'`;
        }
    }
}
