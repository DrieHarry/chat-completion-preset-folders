# Chat Completion Preset Folders for SillyTavern

A SillyTavern UI extension that replaces the flat **Chat Completion preset** selector with a searchable tree of collapsible folders.

## What changed in v1.2.0

- The preset dropdown now stays inside the AI Response Configuration drawer instead of being attached to the page body.
- Clicking, searching, expanding folders, choosing presets, or opening the folder manager no longer counts as an outside click that closes the drawer.
- Dropdown placement is still viewport-aware and opens above the button when there is not enough room below.
- All interface wording now uses **Folder** and **Folders**.

Existing folder assignments from earlier versions are preserved automatically.

## Display-only folder behavior

The folders created by this extension exist only in the interface and in SillyTavern extension settings.

The extension does **not**:

- Scan the SillyTavern root directory
- Read preset files or filesystem subfolders
- Create, rename, move, copy, or delete folders on disk
- Rewrite or move Chat Completion preset JSON files

Presets are read only from SillyTavern's existing `#settings_preset_openai` selector. Folder names, nesting, assignments, and collapsed states are saved only as extension settings metadata.

## How preset loading works

SillyTavern remains responsible for loading Chat Completion preset JSON files from its normal flat directory:

```text
SillyTavern/data/default-user/OpenAI Settings/
```

Keep every Chat Completion preset JSON file directly in that folder:

```text
OpenAI Settings/
├── Realistic - Balanced.json
├── Realistic - Slow Burn.json
├── Fantasy - Adventure.json
└── Utility - Summary.json
```

Do not create category folders such as `OpenAI Settings/Realistic/`. SillyTavern's native preset loader may ignore files placed inside those subfolders.

After SillyTavern loads the flat preset list, this extension groups those same entries into folders in the UI. Assigning a preset to `Realistic` changes only its display metadata; the JSON file stays exactly where it is.

## Features

- Collapsible folders
- Unlimited nested subfolders
- Searchable preset list
- Folder manager for assigning existing presets
- Persistent assignments and expanded/collapsed state
- Live synchronization when presets are created, imported, renamed, selected, or deleted
- In-drawer dropdown that keeps AI Response Configuration open
- No preset-file rewriting or movement
- No directory scanning or disk-folder management

## Install from GitHub

Repository URL:

```text
https://github.com/DrieHarry/chat-completion-preset-folders
```

1. Open SillyTavern.
2. Open the **Extensions** panel.
3. Select **Install extension**.
4. Paste the repository URL.
5. Confirm the installation.
6. Reload SillyTavern if the extension does not appear immediately.

## Update from GitHub

Open **Extensions**, find **Chat Completion Preset Folders**, and use the update option. Automatic update support is enabled in `manifest.json`; SillyTavern's server settings must also allow extension updates.

## Usage

1. Open the Chat Completion preset selector.
2. Select **Folders…**.
3. Create folders or nested subfolders.
4. Assign each existing preset to a folder.
5. Close the manager and expand or collapse folders in the replacement picker.

Deleting a folder never deletes a preset. Its assignments are moved to the parent folder or to **Uncategorized**.

## Stored data

The extension stores only UI metadata under:

```text
extension_settings["chat-completion-preset-folders"]
```

The stored metadata contains folder IDs, names, nesting, sort order, collapsed state, and preset-name assignments. It contains no preset JSON contents and no filesystem paths.

## Compatibility

The extension uses the native `#settings_preset_openai` control as its sole preset source and triggers the same `change` event as the stock UI. The replacement dropdown is mounted in the same drawer DOM tree as the native selector so SillyTavern keeps the AI Response Configuration panel open while it is used.

Other extensions that completely replace the AI Response Configuration interface may require selector or CSS adjustments.

## License

MIT License. See [LICENSE](LICENSE).
