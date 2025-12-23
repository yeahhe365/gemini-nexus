
// background/control/snapshot.js

/**
 * Handles Accessibility Tree generation and UID mapping.
 * Converts complex DOM structures into an LLM-friendly, token-efficient text tree.
 * Matches logic from Chrome DevTools MCP formatters.
 */
export class SnapshotManager {
    constructor(connection) {
        this.connection = connection;
        this.snapshotMap = new Map(); // Maps uid -> backendNodeId
        this.uidToAxNode = new Map(); // Maps uid -> AXNode (raw)
        this.uidToNodeId = new Map(); // Maps uid -> nodeId (AX ID)
        this.nodeIdToUid = new Map(); // Maps nodeId -> uid
        this.snapshotIdCount = 0;
        this.lastSnapshotNodes = []; // Store raw nodes for traversal
        
        // Listen to connection detach to clear state
        this.connection.onDetach(() => this.clear());
    }

    clear() {
        this.snapshotMap.clear();
        this.uidToAxNode.clear();
        this.uidToNodeId.clear();
        this.nodeIdToUid.clear();
        this.lastSnapshotNodes = [];
    }

    getBackendNodeId(uid) {
        return this.snapshotMap.get(uid);
    }

    getAXNode(uid) {
        return this.uidToAxNode.get(uid);
    }
    
    // Helper to get value from CDP AX property
    _getVal(prop) {
        return prop && prop.value;
    }

    /**
     * Traverses descendants of a node (skipping uninteresting intermediate nodes logic is implicitly handled by using the raw tree)
     * to find a node matching the predicate.
     */
    findDescendant(rootUid, predicate) {
        const rootNodeId = this.uidToNodeId.get(rootUid);
        if (!rootNodeId) return null;

        const queue = [rootNodeId];
        const visited = new Set();

        while (queue.length > 0) {
            const nodeId = queue.shift();
            if (visited.has(nodeId)) continue;
            visited.add(nodeId);

            const node = this.lastSnapshotNodes.find(n => n.nodeId === nodeId);
            if (!node) continue;

            // Check predicate if this node has a UID (is exposed)
            const uid = this.nodeIdToUid.get(nodeId);
            if (uid && uid !== rootUid) {
                if (predicate(node, uid)) {
                    return uid;
                }
            }

            if (node.childIds) {
                queue.push(...node.childIds);
            }
        }
        return null;
    }

    async takeSnapshot(args = {}) {
        const verbose = args.verbose === true;

        // Ensure domains are enabled
        await this.connection.sendCommand("DOM.enable");
        await this.connection.sendCommand("Accessibility.enable");
        
        // Get the full accessibility tree from CDP
        const { nodes } = await this.connection.sendCommand("Accessibility.getFullAXTree");
        this.lastSnapshotNodes = nodes;
        
        // Setup new snapshot ID generation
        this.snapshotIdCount++;
        const currentSnapshotPrefix = this.snapshotIdCount;
        let nodeCounter = 0;
        this.snapshotMap.clear();
        this.uidToAxNode.clear();
        this.uidToNodeId.clear();
        this.nodeIdToUid.clear();

        // Identify Root: Node that is not a child of any other node
        const allChildIds = new Set(nodes.flatMap(n => n.childIds || []));
        const root = nodes.find(n => !allChildIds.has(n.nodeId));
        
        if (!root) return "Error: Could not find root of A11y tree.";

        // --- Helpers ---
        const getVal = this._getVal;
        const escapeStr = (str) => {
            const s = String(str);
            // Only quote if necessary (contains spaces or special chars)
            if (/^[\w-]+$/.test(s)) return s;
            return `"${s.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
        };

        // Mappings for boolean capabilities (property name) -> attribute name
        // Aligned with chrome-devtools-mcp snapshotFormatter.ts
        const booleanPropertyMap = {
            disabled: 'disableable',
            expanded: 'expandable',
            focused: 'focusable',
            selected: 'selectable',
            checked: 'checkable',
            pressed: 'pressable',
            editable: 'editable',
            multiselectable: 'multiselectable',
            modal: 'modal',
            required: 'required',
            readonly: 'readonly'
        };

        // Properties to exclude from generic attribute listing
        const excludedProps = new Set([
            'id', 'role', 'name', 'elementHandle', 'children', 'backendNodeId', 'value', 'parentId',
            'description' // Explicitly handled in fixed order
        ]);

        const isInteresting = (node) => {
            if (node.ignored) return false;
            const role = getVal(node.role);
            const name = getVal(node.name);
            
            // Skip purely structural/generic roles unless they have a specific name
            if (role === 'generic' || role === 'StructuralContainer' || role === 'div' || role === 'text' || role === 'none' || role === 'presentation') {
                 if (name && name.trim().length > 0) return true;
                 return false; 
            }
            return true;
        };

        // --- Recursive Formatter ---
        const formatNode = (node, depth = 0) => {
            const interesting = isInteresting(node);
            // In verbose mode, show everything. In default mode, prune uninteresting nodes.
            const shouldPrint = verbose || interesting;

            let line = '';

            if (shouldPrint) {
                // 1. Assign Stable UID
                nodeCounter++;
                const uid = `${currentSnapshotPrefix}_${nodeCounter}`;
                
                if (node.backendDOMNodeId) {
                    this.snapshotMap.set(uid, node.backendDOMNodeId);
                }
                
                this.uidToAxNode.set(uid, node);
                this.uidToNodeId.set(uid, node.nodeId);
                this.nodeIdToUid.set(node.nodeId, uid);

                // 2. Extract Core Attributes
                let role = getVal(node.role);
                // Label ignored nodes in verbose mode (in non-verbose they are skipped)
                if (node.ignored) role = 'ignored';
                
                const name = getVal(node.name);
                let value = getVal(node.value);
                const description = getVal(node.description);

                let parts = [`uid=${uid}`];
                if (role) parts.push(role);
                if (name) parts.push(escapeStr(name));
                
                // Optimization (from MCP): Don't print value if it is identical to name (text)
                // This saves tokens for Select options where value often equals text label in AXTree
                if (value !== undefined && value !== "") {
                    if (String(value) !== name) {
                        parts.push(`value=${escapeStr(value)}`);
                    }
                }
                
                if (description) parts.push(`desc=${escapeStr(description)}`);

                // 3. Process Properties
                if (node.properties) {
                    const propsMap = {};
                    for (const p of node.properties) {
                        propsMap[p.name] = getVal(p.value);
                    }

                    const sortedKeys = Object.keys(propsMap).sort();

                    for (const key of sortedKeys) {
                        if (excludedProps.has(key)) continue;
                        
                        const val = propsMap[key];
                        
                        if (typeof val === 'boolean') {
                            // Check if this boolean property maps to a capability (e.g. focused -> focusable)
                            if (key in booleanPropertyMap) {
                                parts.push(booleanPropertyMap[key]);
                            }
                            // If true, also print the state name itself (e.g. focused)
                            if (val === true) {
                                parts.push(key);
                            }
                        } else if (val !== undefined && val !== "") {
                            // Optimization: skip value in properties too if redundant
                            if (key === 'value' && String(val) === name) continue;
                            parts.push(`${key}=${escapeStr(val)}`);
                        }
                    }
                }

                line = ' '.repeat(depth * 2) + parts.join(' ') + '\n';
            }

            // 4. Process Children
            // Flatten hierarchy: if node is skipped, children stay at current depth
            const nextDepth = shouldPrint ? depth + 1 : depth;

            if (node.childIds) {
                for (const childId of node.childIds) {
                    const child = nodes.find(n => n.nodeId === childId);
                    if (child) {
                        line += formatNode(child, nextDepth);
                    }
                }
            }
            return line;
        };

        const snapshotText = formatNode(root);
        return snapshotText;
    }
}
