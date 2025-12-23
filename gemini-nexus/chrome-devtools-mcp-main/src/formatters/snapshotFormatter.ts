/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {TextSnapshot, TextSnapshotNode} from '../McpContext.js';

export function formatSnapshotNode(
  root: TextSnapshotNode,
  snapshot?: TextSnapshot,
  depth = 0,
): string {
  const chunks: string[] = [];

  if (depth === 0) {
    // Top-level content of the snapshot.
    if (
      snapshot?.verbose &&
      snapshot?.hasSelectedElement &&
      !snapshot.selectedElementUid
    ) {
      chunks.push(`Note: there is a selected element in the DevTools Elements panel but it is not included into the current a11y tree snapshot.
Get a verbose snapshot to include all elements if you are interested in the selected element.\n\n`);
    }
  }

  const attributes = getAttributes(root);
  const line =
    ' '.repeat(depth * 2) +
    attributes.join(' ') +
    (root.id === snapshot?.selectedElementUid
      ? ' [selected in the DevTools Elements panel]'
      : '') +
    '\n';
  chunks.push(line);

  for (const child of root.children) {
    chunks.push(formatSnapshotNode(child, snapshot, depth + 1));
  }

  return chunks.join('');
}

function getAttributes(serializedAXNodeRoot: TextSnapshotNode): string[] {
  const attributes = [`uid=${serializedAXNodeRoot.id}`];
  if (serializedAXNodeRoot.role) {
    // To match representation in DevTools.
    attributes.push(
      serializedAXNodeRoot.role === 'none'
        ? 'ignored'
        : serializedAXNodeRoot.role,
    );
  }
  if (serializedAXNodeRoot.name) {
    attributes.push(`"${serializedAXNodeRoot.name}"`);
  }

  const excluded = new Set([
    'id',
    'role',
    'name',
    'elementHandle',
    'children',
    'backendNodeId',
    'value',
    'description',
  ]);

  const booleanPropertyMap: Record<string, string> = {
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
    readonly: 'readonly',
  };

  // Optimization: Don't print value if it is identical to name (text)
  // This saves tokens for Select options where value often equals text label in AXTree
  const value = serializedAXNodeRoot.value;
  if (value !== undefined && value !== '') {
    if (String(value) !== serializedAXNodeRoot.name) {
      attributes.push(`value="${value}"`);
    }
  }

  const description = serializedAXNodeRoot.description;
  if (description) {
    attributes.push(`desc="${description}"`);
  }

  for (const attr of Object.keys(serializedAXNodeRoot).sort()) {
    if (excluded.has(attr)) {
      continue;
    }
    const val = (serializedAXNodeRoot as unknown as Record<string, unknown>)[
      attr
    ];
    if (typeof val === 'boolean') {
      if (booleanPropertyMap[attr]) {
        attributes.push(booleanPropertyMap[attr]);
      }
      if (val) {
        attributes.push(attr);
      }
    } else if (typeof val === 'string' || typeof val === 'number') {
      if (val !== '') {
        attributes.push(`${attr}="${val}"`);
      }
    }
  }
  return attributes;
}
