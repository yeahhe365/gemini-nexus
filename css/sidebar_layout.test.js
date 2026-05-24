import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const readCss = (file) => readFile(new URL(`./${file}`, import.meta.url), 'utf8');

describe('sidebar layout styles', () => {
    it('keeps the fullscreen sidebar dense and AMC-like instead of pill-heavy', async () => {
        const sidebarCss = await readCss('sidebar.css');

        expect(sidebarCss).toMatch(/\.sidebar\s*{[^}]*width:\s*16\.2rem/s);
        expect(sidebarCss).toMatch(
            /\.sidebar\s*{[^}]*border-right:\s*1px solid var\(--border-color\)/s
        );
        expect(sidebarCss).toMatch(/\.sidebar-actions\s*{[^}]*gap:\s*4px/s);
        expect(sidebarCss).toMatch(/\.sidebar-action-row\s*{[^}]*height:\s*32px/s);
        expect(sidebarCss).toMatch(/\.history-item\s*{[^}]*border-radius:\s*8px/s);
        expect(sidebarCss).toMatch(
            /body\.layout-wide\.sidebar-collapsed\s+\.sidebar-expanded-pane\s*{[^}]*opacity:\s*0/s
        );
        expect(sidebarCss).toMatch(
            /body\.layout-wide\.sidebar-collapsed\s+\.collapsed-sidebar-rail\s*{[^}]*display:\s*flex/s
        );
        expect(sidebarCss).toMatch(/\.collapsed-sidebar-button\s*{[^}]*width:\s*40px/s);
        expect(sidebarCss).toMatch(/\.history-menu-trigger\s*{[^}]*opacity:\s*0/s);
        expect(sidebarCss).toMatch(/\.history-item-menu\s*{[^}]*position:\s*absolute/s);
        expect(sidebarCss).toMatch(/\.collapsed-recent-popover\s*{[^}]*position:\s*fixed/s);
        expect(sidebarCss).toMatch(/\.collapsed-recent-popover\s*{[^}]*z-index:\s*9999/s);
        expect(sidebarCss).toMatch(/\.sidebar-history\s*{[^}]*cursor:\s*ew-resize/s);
        expect(sidebarCss).toMatch(/\.collapsed-sidebar-rail\s*{[^}]*cursor:\s*ew-resize/s);
        expect(sidebarCss).not.toContain('text-transform: uppercase');
        expect(sidebarCss).not.toContain('border-radius: 20px');
    });
});
