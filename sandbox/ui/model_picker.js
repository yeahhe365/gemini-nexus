import { TemplateIcons } from './templates/icons.js';

const pickerControllers = new WeakMap();

export function abbreviateModelName(modelName) {
    return String(modelName || '')
        .replace(/^Gemini\s+/i, '')
        .replace(/\s+Preview\b/i, '')
        .replace(/\s+Latest\b/i, '')
        .trim();
}

function getPickerElements(select) {
    const wrapper = select?.closest?.('.model-select-wrapper');
    if (!wrapper) return null;

    const trigger = wrapper.querySelector('#model-picker-trigger');
    const current = wrapper.querySelector('.model-picker-current');
    const menu = wrapper.querySelector('#model-picker-menu');
    const listbox = wrapper.querySelector('#model-picker-listbox');

    if (!trigger || !current || !menu || !listbox) return null;

    return { wrapper, trigger, current, menu, listbox };
}

function getSelectedIndex(select) {
    if (!select) return -1;
    if (select.selectedIndex >= 0) return select.selectedIndex;
    if (select.options.length === 0) return -1;

    select.selectedIndex = 0;
    return 0;
}

function buildOptionRow(controller, option, index) {
    const { select, activeIndex } = controller;
    const isSelected = index === select.selectedIndex;
    const isActive = index === activeIndex;
    const row = document.createElement('button');
    row.type = 'button';
    row.id = `model-picker-option-${index}`;
    row.className = [
        'model-picker-option',
        isSelected ? 'is-selected' : '',
        isActive ? 'is-active' : '',
    ]
        .filter(Boolean)
        .join(' ');
    row.setAttribute('role', 'option');
    row.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    row.dataset.modelIndex = String(index);

    const copy = document.createElement('span');
    copy.className = 'model-picker-option-copy';

    const name = document.createElement('span');
    name.className = 'model-picker-option-name';
    name.textContent = option.text;
    name.title = option.text;

    const id = document.createElement('span');
    id.className = 'model-picker-option-id';
    id.textContent = option.value;
    id.title = option.value;

    copy.append(name, id);
    row.appendChild(copy);

    if (isSelected) {
        const check = document.createElement('span');
        check.className = 'model-picker-check';
        check.innerHTML = TemplateIcons.CHECK;
        row.appendChild(check);
    }

    row.addEventListener('click', () => controller.selectIndex(index));
    return row;
}

function createModelPickerController(select, elements) {
    const controller = {
        select,
        ...elements,
        isOpen: false,
        activeIndex: -1,

        sync() {
            const selectedIndex = getSelectedIndex(select);
            const selectedOption = selectedIndex >= 0 ? select.options[selectedIndex] : null;
            const selectedLabel = selectedOption?.text || '';

            this.current.textContent = abbreviateModelName(selectedLabel);
            this.trigger.disabled = select.disabled || select.options.length === 0;

            if (this.activeIndex < 0 || this.activeIndex >= select.options.length) {
                this.activeIndex = selectedIndex;
            }

            this.renderOptions();
            this.updateAria();
        },

        renderOptions() {
            const fragment = document.createDocumentFragment();
            [...select.options].forEach((option, index) => {
                fragment.appendChild(buildOptionRow(this, option, index));
            });
            this.listbox.replaceChildren(fragment);
        },

        updateAria() {
            this.trigger.setAttribute('aria-expanded', this.isOpen ? 'true' : 'false');
            if (this.isOpen && this.activeIndex >= 0) {
                this.trigger.setAttribute(
                    'aria-activedescendant',
                    `model-picker-option-${this.activeIndex}`
                );
            } else {
                this.trigger.removeAttribute('aria-activedescendant');
            }
            this.menu.hidden = !this.isOpen;
        },

        setOpen(isOpen) {
            this.isOpen = isOpen;
            if (isOpen) {
                this.activeIndex = getSelectedIndex(select);
            }
            this.sync();
        },

        toggle() {
            this.setOpen(!this.isOpen);
        },

        moveActive(step) {
            if (select.options.length === 0) {
                this.activeIndex = -1;
                return;
            }

            const startingIndex =
                this.activeIndex >= 0 ? this.activeIndex : getSelectedIndex(select);
            this.activeIndex =
                (startingIndex + step + select.options.length) % select.options.length;
            this.renderOptions();
            this.updateAria();
        },

        selectIndex(index) {
            if (index < 0 || index >= select.options.length) return;

            select.selectedIndex = index;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            this.setOpen(false);
        },

        handleKeyDown(keyboardEvent) {
            if (keyboardEvent.defaultPrevented) return;

            if (keyboardEvent.key === 'ArrowDown') {
                keyboardEvent.preventDefault();
                if (!this.isOpen) {
                    this.setOpen(true);
                    return;
                }
                this.moveActive(1);
                return;
            }

            if (keyboardEvent.key === 'ArrowUp') {
                keyboardEvent.preventDefault();
                if (!this.isOpen) {
                    this.setOpen(true);
                    return;
                }
                this.moveActive(-1);
                return;
            }

            if (keyboardEvent.key === 'Home' && this.isOpen) {
                keyboardEvent.preventDefault();
                this.activeIndex = 0;
                this.renderOptions();
                this.updateAria();
                return;
            }

            if (keyboardEvent.key === 'End' && this.isOpen) {
                keyboardEvent.preventDefault();
                this.activeIndex = select.options.length - 1;
                this.renderOptions();
                this.updateAria();
                return;
            }

            if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
                keyboardEvent.preventDefault();
                if (!this.isOpen) {
                    this.setOpen(true);
                    return;
                }
                this.selectIndex(this.activeIndex);
                return;
            }

            if (keyboardEvent.key === 'Escape' && this.isOpen) {
                keyboardEvent.preventDefault();
                this.setOpen(false);
            }
        },
    };

    controller.trigger.addEventListener('click', () => controller.toggle());
    controller.wrapper.addEventListener('keydown', (keyboardEvent) => {
        if (keyboardEvent.target?.closest?.('#web-thinking-toggle')) return;
        controller.handleKeyDown(keyboardEvent);
    });
    select.addEventListener('change', () => controller.sync());
    document.addEventListener('click', (clickEvent) => {
        if (!controller.isOpen) return;
        if (controller.wrapper.contains(clickEvent.target)) return;
        controller.setOpen(false);
    });

    return controller;
}

export function initModelPicker(select) {
    if (!select) return null;

    const existingController = pickerControllers.get(select);
    if (existingController) {
        existingController.sync();
        return existingController;
    }

    const elements = getPickerElements(select);
    if (!elements) return null;

    const controller = createModelPickerController(select, elements);
    pickerControllers.set(select, controller);
    controller.sync();
    return controller;
}

export function syncModelPicker(select) {
    if (!select) return false;

    const controller = pickerControllers.get(select) || initModelPicker(select);
    if (!controller) return false;

    controller.sync();
    return true;
}
