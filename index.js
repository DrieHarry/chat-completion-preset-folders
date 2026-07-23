import { extension_settings } from '../../../extensions.js';
import { saveSettingsDebounced } from '../../../../script.js';

const EXTENSION_KEY = 'chat-completion-preset-folders';
const SELECTOR = '#settings_preset_openai';
const ROOT_ID = null;

const DEFAULT_SETTINGS = Object.freeze({
    version: 1,
    folders: {},
    assignments: {},
    uncategorizedCollapsed: false,
});

let nativeSelect = null;
let picker = null;
let pickerButton = null;
let pickerMenu = null;
let searchInput = null;
let selectObserver = null;
let managerOverlay = null;
let outsidePointerHandler = null;
let resizeHandler = null;
let isRendering = false;

function getSettings() {
    extension_settings[EXTENSION_KEY] ??= structuredClone(DEFAULT_SETTINGS);
    const settings = extension_settings[EXTENSION_KEY];
    settings.version ??= 1;
    settings.folders ??= {};
    settings.assignments ??= {};
    settings.uncategorizedCollapsed ??= false;
    return settings;
}

function persist() {
    saveSettingsDebounced();
}

function notify(message, title = 'Preset Folders') {
    if (window.toastr?.info) {
        window.toastr.info(message, title);
    } else {
        console.info(`[${title}] ${message}`);
    }
}

function getPresets() {
    if (!nativeSelect) return [];
    return Array.from(nativeSelect.options).map((option, index) => ({
        name: option.textContent?.trim() || option.text,
        value: option.value,
        index,
        selected: option.selected,
    }));
}

function selectedPreset() {
    return getPresets().find(preset => preset.selected) ?? null;
}

function newId() {
    return globalThis.crypto?.randomUUID?.() ?? `folder-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeFolderGraph() {
    const settings = getSettings();
    let changed = false;

    for (const [id, folder] of Object.entries(settings.folders)) {
        if (!folder || typeof folder !== 'object') {
            delete settings.folders[id];
            changed = true;
            continue;
        }

        folder.id = id;
        folder.name = String(folder.name || 'Untitled Folder').trim() || 'Untitled Folder';
        folder.parentId = folder.parentId && settings.folders[folder.parentId] ? folder.parentId : ROOT_ID;
        folder.collapsed = Boolean(folder.collapsed);
        folder.order = Number.isFinite(folder.order) ? folder.order : Date.now();
    }

    // Break accidental cycles caused by hand-edited settings.
    for (const folder of Object.values(settings.folders)) {
        const visited = new Set([folder.id]);
        let cursor = folder.parentId;
        while (cursor) {
            if (visited.has(cursor)) {
                folder.parentId = ROOT_ID;
                changed = true;
                break;
            }
            visited.add(cursor);
            cursor = settings.folders[cursor]?.parentId ?? ROOT_ID;
        }
    }

    if (changed) persist();
}

function pruneAssignments() {
    const settings = getSettings();
    const presetNames = new Set(getPresets().map(preset => preset.name));
    let changed = false;

    for (const [presetName, folderId] of Object.entries(settings.assignments)) {
        if (!presetNames.has(presetName)) {
            delete settings.assignments[presetName];
            changed = true;
            continue;
        }
        if (folderId && !settings.folders[folderId]) {
            delete settings.assignments[presetName];
            changed = true;
        }
    }

    if (changed) persist();
}

function folderChildren(parentId) {
    const settings = getSettings();
    return Object.values(settings.folders)
        .filter(folder => (folder.parentId ?? ROOT_ID) === parentId)
        .sort((a, b) => (a.order - b.order) || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

function folderPath(folderId) {
    const settings = getSettings();
    const parts = [];
    const seen = new Set();
    let cursor = folderId;

    while (cursor && settings.folders[cursor] && !seen.has(cursor)) {
        seen.add(cursor);
        parts.unshift(settings.folders[cursor].name);
        cursor = settings.folders[cursor].parentId;
    }

    return parts.join(' / ');
}

function folderDepth(folderId) {
    const settings = getSettings();
    let depth = 0;
    let cursor = settings.folders[folderId]?.parentId;
    const seen = new Set();
    while (cursor && settings.folders[cursor] && !seen.has(cursor)) {
        seen.add(cursor);
        depth += 1;
        cursor = settings.folders[cursor].parentId;
    }
    return depth;
}

function presetsInFolder(folderId) {
    const settings = getSettings();
    return getPresets().filter(preset => (settings.assignments[preset.name] ?? ROOT_ID) === folderId);
}

function descendantPresetCount(folderId) {
    let count = presetsInFolder(folderId).length;
    for (const child of folderChildren(folderId)) {
        count += descendantPresetCount(child.id);
    }
    return count;
}

function hasSearchMatch(folderId, query) {
    const normalized = query.toLocaleLowerCase();
    const settings = getSettings();
    const folder = settings.folders[folderId];
    if (!folder) return false;
    if (folder.name.toLocaleLowerCase().includes(normalized)) return true;
    if (presetsInFolder(folderId).some(preset => preset.name.toLocaleLowerCase().includes(normalized))) return true;
    return folderChildren(folderId).some(child => hasSearchMatch(child.id, query));
}

function makeButton(className, text, title) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = text;
    if (title) button.title = title;
    return button;
}

function createPresetRow(preset, query = '') {
    if (query && !preset.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())) return null;

    const row = makeButton('ccpf-preset-row', '', `Select ${preset.name}`);
    row.dataset.value = preset.value;
    row.dataset.presetName = preset.name;
    row.setAttribute('role', 'option');
    row.setAttribute('aria-selected', String(preset.selected));

    const marker = document.createElement('span');
    marker.className = 'ccpf-preset-marker';
    marker.textContent = preset.selected ? '●' : '○';

    const name = document.createElement('span');
    name.className = 'ccpf-preset-name';
    name.textContent = preset.name;

    row.append(marker, name);
    row.addEventListener('click', () => {
        nativeSelect.value = preset.value;
        nativeSelect.dispatchEvent(new Event('change', { bubbles: true }));
        updateButtonLabel();
        closePicker();
    });
    return row;
}

function renderFolderNode(folder, container, query = '', depth = 0) {
    const settings = getSettings();
    if (query && !hasSearchMatch(folder.id, query)) return;

    const folderBlock = document.createElement('div');
    folderBlock.className = 'ccpf-folder-block';
    folderBlock.dataset.folderId = folder.id;

    const row = makeButton('ccpf-folder-row', '', folderPath(folder.id));
    row.style.setProperty('--ccpf-depth', String(depth));
    row.setAttribute('aria-expanded', String(query ? true : !folder.collapsed));

    const chevron = document.createElement('span');
    chevron.className = 'ccpf-chevron';
    chevron.textContent = query || !folder.collapsed ? '▾' : '▸';

    const icon = document.createElement('span');
    icon.className = 'ccpf-folder-icon';
    icon.textContent = query || !folder.collapsed ? '📂' : '📁';

    const label = document.createElement('span');
    label.className = 'ccpf-folder-name';
    label.textContent = folder.name;

    const count = document.createElement('span');
    count.className = 'ccpf-folder-count';
    count.textContent = String(descendantPresetCount(folder.id));

    row.append(chevron, icon, label, count);
    row.addEventListener('click', () => {
        folder.collapsed = !folder.collapsed;
        persist();
        renderPickerTree(searchInput?.value || '');
    });

    folderBlock.append(row);

    const contents = document.createElement('div');
    contents.className = 'ccpf-folder-contents';
    contents.hidden = !query && folder.collapsed;

    for (const child of folderChildren(folder.id)) {
        renderFolderNode(child, contents, query, depth + 1);
    }

    for (const preset of presetsInFolder(folder.id)) {
        const presetRow = createPresetRow(preset, query);
        if (presetRow) {
            presetRow.style.setProperty('--ccpf-depth', String(depth + 1));
            contents.append(presetRow);
        }
    }

    folderBlock.append(contents);
    container.append(folderBlock);
}

function renderUncategorized(container, query = '') {
    const settings = getSettings();
    const presets = presetsInFolder(ROOT_ID).filter(preset => !query || preset.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
    if (query && presets.length === 0) return;

    const block = document.createElement('div');
    block.className = 'ccpf-folder-block ccpf-uncategorized';

    const row = makeButton('ccpf-folder-row', '', 'Uncategorized presets');
    row.setAttribute('aria-expanded', String(query ? true : !settings.uncategorizedCollapsed));

    const chevron = document.createElement('span');
    chevron.className = 'ccpf-chevron';
    chevron.textContent = query || !settings.uncategorizedCollapsed ? '▾' : '▸';

    const icon = document.createElement('span');
    icon.className = 'ccpf-folder-icon';
    icon.textContent = '🗂️';

    const label = document.createElement('span');
    label.className = 'ccpf-folder-name';
    label.textContent = 'Uncategorized';

    const count = document.createElement('span');
    count.className = 'ccpf-folder-count';
    count.textContent = String(presetsInFolder(ROOT_ID).length);

    row.append(chevron, icon, label, count);
    row.addEventListener('click', () => {
        settings.uncategorizedCollapsed = !settings.uncategorizedCollapsed;
        persist();
        renderPickerTree(searchInput?.value || '');
    });

    const contents = document.createElement('div');
    contents.className = 'ccpf-folder-contents';
    contents.hidden = !query && settings.uncategorizedCollapsed;
    for (const preset of presets) {
        const presetRow = createPresetRow(preset, query);
        if (presetRow) contents.append(presetRow);
    }

    block.append(row, contents);
    container.append(block);
}

function renderPickerTree(query = '') {
    if (!pickerMenu || isRendering) return;
    isRendering = true;
    try {
        normalizeFolderGraph();
        pruneAssignments();
        const tree = pickerMenu.querySelector('.ccpf-tree');
        tree.replaceChildren();

        for (const folder of folderChildren(ROOT_ID)) {
            renderFolderNode(folder, tree, query.trim(), 0);
        }
        renderUncategorized(tree, query.trim());

        if (!tree.children.length) {
            const empty = document.createElement('div');
            empty.className = 'ccpf-empty';
            empty.textContent = query ? 'No presets match your search.' : 'No Chat Completion presets found.';
            tree.append(empty);
        }
    } finally {
        isRendering = false;
    }
}

function updateButtonLabel() {
    if (!pickerButton) return;
    const current = selectedPreset();
    const label = pickerButton.querySelector('.ccpf-picker-label');
    if (label) label.textContent = current?.name || 'Choose preset';
    pickerButton.title = current ? `Current preset: ${current.name}` : 'Choose Chat Completion preset';
}

function positionPicker() {
    if (!pickerMenu || !pickerButton || pickerMenu.hidden) return;
    const rect = pickerButton.getBoundingClientRect();
    const viewportPadding = 8;
    const width = Math.min(Math.max(rect.width, 300), window.innerWidth - viewportPadding * 2);
    pickerMenu.style.width = `${width}px`;
    pickerMenu.style.left = `${Math.min(Math.max(viewportPadding, rect.left), window.innerWidth - width - viewportPadding)}px`;

    const estimatedHeight = Math.min(480, window.innerHeight * 0.7);
    const roomBelow = window.innerHeight - rect.bottom - viewportPadding;
    const openAbove = roomBelow < Math.min(estimatedHeight, 260) && rect.top > roomBelow;
    pickerMenu.classList.toggle('ccpf-open-above', openAbove);
    pickerMenu.style.top = openAbove ? 'auto' : `${rect.bottom + 4}px`;
    pickerMenu.style.bottom = openAbove ? `${window.innerHeight - rect.top + 4}px` : 'auto';
}

function openPicker() {
    if (!pickerMenu) return;
    pickerMenu.hidden = false;
    pickerButton?.setAttribute('aria-expanded', 'true');
    searchInput.value = '';
    renderPickerTree();
    positionPicker();
    requestAnimationFrame(() => searchInput?.focus());
}

function closePicker() {
    if (!pickerMenu) return;
    pickerMenu.hidden = true;
    pickerButton?.setAttribute('aria-expanded', 'false');
}

function togglePicker() {
    if (pickerMenu?.hidden) openPicker(); else closePicker();
}

function nextFolderOrder(parentId) {
    const siblings = folderChildren(parentId);
    return siblings.length ? Math.max(...siblings.map(folder => folder.order)) + 1 : 0;
}

function createFolder(parentId = ROOT_ID) {
    const parentName = parentId ? getSettings().folders[parentId]?.name : 'root';
    const name = window.prompt(`New folder name (inside ${parentName}):`, 'New Folder');
    if (!name?.trim()) return;

    const settings = getSettings();
    const id = newId();
    settings.folders[id] = {
        id,
        name: name.trim(),
        parentId,
        collapsed: false,
        order: nextFolderOrder(parentId),
    };
    persist();
    renderPickerTree(searchInput?.value || '');
    renderManager();
}

function renameFolder(folderId) {
    const folder = getSettings().folders[folderId];
    if (!folder) return;
    const name = window.prompt('Rename folder:', folder.name);
    if (!name?.trim() || name.trim() === folder.name) return;
    folder.name = name.trim();
    persist();
    renderPickerTree(searchInput?.value || '');
    renderManager();
}

function deleteFolder(folderId) {
    const settings = getSettings();
    const folder = settings.folders[folderId];
    if (!folder) return;
    const destinationName = folder.parentId ? settings.folders[folder.parentId]?.name : 'Uncategorized';
    const confirmed = window.confirm(`Delete “${folder.name}”? Its presets and subfolders will move to ${destinationName}.`);
    if (!confirmed) return;

    for (const child of folderChildren(folderId)) {
        child.parentId = folder.parentId ?? ROOT_ID;
        child.order = nextFolderOrder(child.parentId);
    }
    for (const [presetName, assignedFolderId] of Object.entries(settings.assignments)) {
        if (assignedFolderId === folderId) {
            if (folder.parentId) settings.assignments[presetName] = folder.parentId;
            else delete settings.assignments[presetName];
        }
    }
    delete settings.folders[folderId];
    persist();
    renderPickerTree(searchInput?.value || '');
    renderManager();
}

function flattenFolders() {
    const result = [];
    const walk = (parentId, depth) => {
        for (const folder of folderChildren(parentId)) {
            result.push({ folder, depth });
            walk(folder.id, depth + 1);
        }
    };
    walk(ROOT_ID, 0);
    return result;
}

function renderManagerFolderTree(container) {
    container.replaceChildren();
    const folders = flattenFolders();
    if (!folders.length) {
        const empty = document.createElement('div');
        empty.className = 'ccpf-manager-empty';
        empty.textContent = 'No folders yet. Create a root folder to begin.';
        container.append(empty);
        return;
    }

    for (const { folder, depth } of folders) {
        const row = document.createElement('div');
        row.className = 'ccpf-manager-folder-row';
        row.style.setProperty('--ccpf-depth', String(depth));

        const name = document.createElement('span');
        name.className = 'ccpf-manager-folder-name';
        name.textContent = folder.name;
        name.title = folderPath(folder.id);

        const count = document.createElement('span');
        count.className = 'ccpf-manager-count';
        count.textContent = String(descendantPresetCount(folder.id));

        const add = makeButton('menu_button ccpf-icon-button', '+', 'Add subfolder');
        add.addEventListener('click', () => createFolder(folder.id));

        const rename = makeButton('menu_button ccpf-icon-button', '✎', 'Rename folder');
        rename.addEventListener('click', () => renameFolder(folder.id));

        const remove = makeButton('menu_button ccpf-icon-button', '×', 'Delete folder');
        remove.addEventListener('click', () => deleteFolder(folder.id));

        row.append(name, count, add, rename, remove);
        container.append(row);
    }
}

function createFolderSelect(presetName) {
    const settings = getSettings();
    const select = document.createElement('select');
    select.className = 'text_pole ccpf-assignment-select';
    select.setAttribute('aria-label', `Folder for ${presetName}`);

    const uncategorized = document.createElement('option');
    uncategorized.value = '';
    uncategorized.textContent = 'Uncategorized';
    select.append(uncategorized);

    for (const { folder, depth } of flattenFolders()) {
        const option = document.createElement('option');
        option.value = folder.id;
        option.textContent = `${'› '.repeat(depth)}${folder.name}`;
        select.append(option);
    }

    select.value = settings.assignments[presetName] || '';
    select.addEventListener('change', () => {
        if (select.value) settings.assignments[presetName] = select.value;
        else delete settings.assignments[presetName];
        persist();
        renderPickerTree(searchInput?.value || '');
        renderManagerFolderTree(managerOverlay.querySelector('.ccpf-manager-folders'));
    });
    return select;
}

function renderManagerPresetList(container, query = '') {
    container.replaceChildren();
    const normalized = query.trim().toLocaleLowerCase();
    const presets = getPresets().filter(preset => !normalized || preset.name.toLocaleLowerCase().includes(normalized));

    for (const preset of presets) {
        const row = document.createElement('div');
        row.className = 'ccpf-manager-preset-row';

        const name = document.createElement('span');
        name.className = 'ccpf-manager-preset-name';
        name.textContent = preset.name;
        name.title = preset.name;

        row.append(name, createFolderSelect(preset.name));
        container.append(row);
    }

    if (!presets.length) {
        const empty = document.createElement('div');
        empty.className = 'ccpf-manager-empty';
        empty.textContent = 'No matching presets.';
        container.append(empty);
    }
}

function renderManager() {
    if (!managerOverlay?.isConnected) return;
    const folderContainer = managerOverlay.querySelector('.ccpf-manager-folders');
    const presetContainer = managerOverlay.querySelector('.ccpf-manager-presets');
    const filter = managerOverlay.querySelector('.ccpf-manager-search')?.value || '';
    renderManagerFolderTree(folderContainer);
    renderManagerPresetList(presetContainer, filter);
}

function openManager() {
    closePicker();
    if (managerOverlay?.isConnected) return;

    managerOverlay = document.createElement('div');
    managerOverlay.className = 'ccpf-modal-backdrop';
    managerOverlay.setAttribute('role', 'presentation');

    const modal = document.createElement('section');
    modal.className = 'ccpf-manager-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'ccpf-manager-title');

    const header = document.createElement('header');
    header.className = 'ccpf-manager-header';
    const titleWrap = document.createElement('div');
    const title = document.createElement('h3');
    title.id = 'ccpf-manager-title';
    title.textContent = 'Chat Completion Preset Folders';
    const subtitle = document.createElement('p');
    subtitle.textContent = 'Folders are UI metadata. Your preset JSON files stay in SillyTavern’s normal flat directory.';
    titleWrap.append(title, subtitle);
    const close = makeButton('menu_button ccpf-modal-close', '×', 'Close');
    header.append(titleWrap, close);

    const toolbar = document.createElement('div');
    toolbar.className = 'ccpf-manager-toolbar';
    const addRoot = makeButton('menu_button', '+ New root folder');
    const expandAll = makeButton('menu_button', 'Expand all');
    const collapseAll = makeButton('menu_button', 'Collapse all');
    toolbar.append(addRoot, expandAll, collapseAll);

    const body = document.createElement('div');
    body.className = 'ccpf-manager-body';

    const folderPane = document.createElement('section');
    folderPane.className = 'ccpf-manager-pane';
    const folderHeading = document.createElement('h4');
    folderHeading.textContent = 'Folders';
    const folders = document.createElement('div');
    folders.className = 'ccpf-manager-folders';
    folderPane.append(folderHeading, folders);

    const presetPane = document.createElement('section');
    presetPane.className = 'ccpf-manager-pane ccpf-manager-preset-pane';
    const presetHeading = document.createElement('h4');
    presetHeading.textContent = 'Assign presets';
    const filter = document.createElement('input');
    filter.type = 'search';
    filter.className = 'text_pole ccpf-manager-search';
    filter.placeholder = 'Filter presets…';
    const presets = document.createElement('div');
    presets.className = 'ccpf-manager-presets';
    presetPane.append(presetHeading, filter, presets);

    body.append(folderPane, presetPane);
    modal.append(header, toolbar, body);
    managerOverlay.append(modal);
    document.body.append(managerOverlay);

    const closeManager = () => {
        managerOverlay?.remove();
        managerOverlay = null;
        pickerButton?.focus();
    };

    close.addEventListener('click', closeManager);
    managerOverlay.addEventListener('mousedown', event => {
        if (event.target === managerOverlay) closeManager();
    });
    addRoot.addEventListener('click', () => createFolder(ROOT_ID));
    expandAll.addEventListener('click', () => {
        for (const folder of Object.values(getSettings().folders)) folder.collapsed = false;
        getSettings().uncategorizedCollapsed = false;
        persist();
        renderPickerTree(searchInput?.value || '');
        renderManager();
    });
    collapseAll.addEventListener('click', () => {
        for (const folder of Object.values(getSettings().folders)) folder.collapsed = true;
        getSettings().uncategorizedCollapsed = true;
        persist();
        renderPickerTree(searchInput?.value || '');
        renderManager();
    });
    filter.addEventListener('input', () => renderManagerPresetList(presets, filter.value));
    modal.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeManager();
    });

    renderManager();
    requestAnimationFrame(() => filter.focus());
}

function buildPicker() {
    picker = document.createElement('div');
    picker.className = 'ccpf-picker';

    pickerButton = makeButton('text_pole ccpf-picker-button', '');
    pickerButton.setAttribute('aria-haspopup', 'listbox');
    pickerButton.setAttribute('aria-expanded', 'false');

    const label = document.createElement('span');
    label.className = 'ccpf-picker-label';
    const arrow = document.createElement('span');
    arrow.className = 'ccpf-picker-arrow';
    arrow.textContent = '▾';
    pickerButton.append(label, arrow);

    pickerMenu = document.createElement('div');
    pickerMenu.className = 'ccpf-menu';
    pickerMenu.hidden = true;
    pickerMenu.setAttribute('role', 'listbox');

    const header = document.createElement('div');
    header.className = 'ccpf-menu-header';
    searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.className = 'text_pole ccpf-search';
    searchInput.placeholder = 'Search Chat Completion presets…';
    searchInput.setAttribute('aria-label', 'Search Chat Completion presets');
    const manage = makeButton('menu_button ccpf-manage-button', 'Folders…', 'Manage preset folders');
    header.append(searchInput, manage);

    const tree = document.createElement('div');
    tree.className = 'ccpf-tree';
    pickerMenu.append(header, tree);

    picker.append(pickerButton);
    document.body.append(pickerMenu);

    pickerButton.addEventListener('click', togglePicker);
    searchInput.addEventListener('input', () => renderPickerTree(searchInput.value));
    manage.addEventListener('click', openManager);
    pickerMenu.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            closePicker();
            pickerButton.focus();
        }
    });

    outsidePointerHandler = event => {
        if (pickerMenu?.hidden) return;
        if (!picker.contains(event.target) && !pickerMenu.contains(event.target)) closePicker();
    };
    resizeHandler = () => positionPicker();
    document.addEventListener('pointerdown', outsidePointerHandler, true);
    window.addEventListener('resize', resizeHandler, { passive: true });
    window.addEventListener('scroll', resizeHandler, true);
}

function hideNativeControl() {
    nativeSelect.classList.add('ccpf-native-select');
    nativeSelect.setAttribute('aria-hidden', 'true');
    nativeSelect.tabIndex = -1;

    const possibleSelect2 = nativeSelect.nextElementSibling;
    if (possibleSelect2?.classList.contains('select2-container')) {
        possibleSelect2.classList.add('ccpf-native-select2');
    }
}

function mount() {
    nativeSelect = document.querySelector(SELECTOR);
    if (!nativeSelect || document.querySelector('.ccpf-picker')) return false;

    normalizeFolderGraph();
    pruneAssignments();
    buildPicker();
    hideNativeControl();

    const select2 = nativeSelect.nextElementSibling?.classList.contains('select2-container')
        ? nativeSelect.nextElementSibling
        : null;
    (select2 || nativeSelect).insertAdjacentElement('afterend', picker);

    nativeSelect.addEventListener('change', () => {
        updateButtonLabel();
        renderPickerTree(searchInput?.value || '');
    });

    selectObserver = new MutationObserver(() => {
        hideNativeControl();
        pruneAssignments();
        updateButtonLabel();
        renderPickerTree(searchInput?.value || '');
        if (managerOverlay?.isConnected) renderManager();
    });
    selectObserver.observe(nativeSelect, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['selected', 'label', 'value'],
        characterData: true,
    });

    updateButtonLabel();
    renderPickerTree();
    registerPresetEvents();
    return true;
}

function registerPresetEvents() {
    const context = window.SillyTavern?.getContext?.();
    const eventSource = context?.eventSource;
    const eventTypes = context?.event_types;
    if (!eventSource || !eventTypes) return;

    if (eventTypes.PRESET_RENAMED) {
        eventSource.on(eventTypes.PRESET_RENAMED, data => {
            if (data?.apiId !== 'openai') return;
            const settings = getSettings();
            if (Object.hasOwn(settings.assignments, data.oldName)) {
                settings.assignments[data.newName] = settings.assignments[data.oldName];
                delete settings.assignments[data.oldName];
                persist();
            }
        });
    }

    if (eventTypes.PRESET_DELETED) {
        eventSource.on(eventTypes.PRESET_DELETED, data => {
            if (data?.apiId !== 'openai') return;
            const settings = getSettings();
            if (Object.hasOwn(settings.assignments, data.name)) {
                delete settings.assignments[data.name];
                persist();
            }
        });
    }
}

function teardown() {
    selectObserver?.disconnect();
    selectObserver = null;
    picker?.remove();
    pickerMenu?.remove();
    managerOverlay?.remove();
    if (outsidePointerHandler) document.removeEventListener('pointerdown', outsidePointerHandler, true);
    if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler);
        window.removeEventListener('scroll', resizeHandler, true);
    }
    if (nativeSelect) {
        nativeSelect.classList.remove('ccpf-native-select');
        nativeSelect.removeAttribute('aria-hidden');
        nativeSelect.tabIndex = 0;
        nativeSelect.nextElementSibling?.classList.remove('ccpf-native-select2');
    }
}

jQuery(() => {
    getSettings();

    if (mount()) {
        notify('Nested preset folders are ready. Use “Folders…” in the preset picker to organize them.');
        return;
    }

    const pageObserver = new MutationObserver(() => {
        if (mount()) pageObserver.disconnect();
    });
    pageObserver.observe(document.body, { childList: true, subtree: true });

    // Avoid observing forever on an incompatible page/build.
    window.setTimeout(() => pageObserver.disconnect(), 30000);
});

window.addEventListener('beforeunload', teardown, { once: true });
