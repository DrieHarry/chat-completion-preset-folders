# Chat Completion Preset Folders for SillyTavern

A SillyTavern UI extension that replaces the flat **Chat Completion preset** selector with a searchable tree of **virtual, collapsible folders**.

## What changed in v1.1.0

This release enforces display-only folders:

- The extension does **not** scan the SillyTavern root directory.
- The extension does **not** read preset files or filesystem subfolders.
- The extension does **not** create, rename, move, copy, or delete folders on disk.
- Presets are read only from SillyTavern's existing `#settings_preset_openai` selector.
- Folder names, nesting, assignments, and collapsed states are saved only as extension settings metadata.

Existing virtual-folder assignments from v1.0.x are preserved automatically.

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

After SillyTavern loads the flat preset list, this extension groups those same entries into virtual folders in the UI. Assigning a preset to `Realistic` changes only the display metadata; the JSON file stays exactly where it is.

## Features

- Collapsible virtual folders
- Unlimited nested virtual subfolders
- Searchable preset list
- Folder manager for assigning existing presets
- Persistent assignments and expanded/collapsed state
- Live synchronization when presets are created, imported, renamed, selected, or deleted
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
2. Select **Virtual folders…**.
3. Create virtual folders or nested virtual subfolders.
4. Assign each existing preset to a virtual folder.
5. Close the manager and expand or collapse folders in the replacement picker.

Deleting a virtual folder never deletes a preset. Its assignments are moved to the parent virtual folder or to **Uncategorized**.

## Stored data

The extension stores only UI metadata under:

```text
extension_settings["chat-completion-preset-folders"]
```

The stored metadata contains virtual folder IDs, names, nesting, sort order, collapsed state, and preset-name assignments. It contains no preset JSON contents and no filesystem paths.

## Compatibility

The extension uses the native `#settings_preset_openai` control as its sole preset source and triggers the same `change` event as the stock UI. Other extensions that completely replace the AI Response Configuration interface may require selector or CSS adjustments.

## License

MIT License. See [LICENSE](LICENSE).
