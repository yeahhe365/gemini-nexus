// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatController } from './chat.js';

vi.mock('../render/clipboard.js', () => ({
    copyToClipboard: vi.fn()
}));

vi.mock('../core/i18n.js', () => ({
    t: (key) => key
}));

function setScrollMetrics(element, { scrollHeight, clientHeight, scrollTop }) {
    Object.defineProperty(element, 'scrollHeight', {
        configurable: true,
        value: scrollHeight
    });
    Object.defineProperty(element, 'clientHeight', {
        configurable: true,
        value: clientHeight
    });
    Object.defineProperty(element, 'scrollTop', {
        configurable: true,
        writable: true,
        value: scrollTop
    });
}

function createController() {
    const historyDiv = document.createElement('div');
    historyDiv.scrollTo = vi.fn(({ top }) => {
        historyDiv.scrollTop = top;
    });

    const controller = new ChatController({
        historyDiv,
        inputFn: document.createElement('textarea'),
        sendBtn: document.createElement('button'),
        statusDiv: document.createElement('div')
    });

    return { controller, historyDiv };
}

describe('ChatController streaming scroll following', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
            callback();
            return 1;
        });
    });

    it('keeps following the bottom while streamed content grows', () => {
        const { controller, historyDiv } = createController();
        setScrollMetrics(historyDiv, {
            scrollHeight: 1000,
            clientHeight: 400,
            scrollTop: 600
        });

        controller.handleHistoryScroll();
        setScrollMetrics(historyDiv, {
            scrollHeight: 1300,
            clientHeight: 400,
            scrollTop: 600
        });
        controller.followStreamingContent();

        expect(historyDiv.scrollTo).toHaveBeenCalledWith({
            top: 1300,
            behavior: 'instant'
        });
    });

    it('stops following when the user scrolls away from the bottom', () => {
        const { controller, historyDiv } = createController();
        setScrollMetrics(historyDiv, {
            scrollHeight: 1000,
            clientHeight: 400,
            scrollTop: 300
        });

        controller.handleHistoryScroll();
        setScrollMetrics(historyDiv, {
            scrollHeight: 1300,
            clientHeight: 400,
            scrollTop: 300
        });
        controller.followStreamingContent();

        expect(historyDiv.scrollTo).not.toHaveBeenCalled();
    });
});
