# Chat Completion Preset Folders for SillyTavern

A SillyTavern UI extension that replaces the flat **Chat Completion preset** selector with a searchable folder tree.

## Features

- Collapsible folders
- Unlimited nested subfolders
- Searchable preset list
- Folder manager for assigning existing presets
- Persistent folder assignments and expanded/collapsed state
- Live synchronization when presets are created, imported, renamed, selected, or deleted
- Does not rewrite or move preset JSON files

## Important limitation

This extension organizes presets in the UI only. SillyTavern still loads Chat Completion preset JSON files from its normal flat directory:

```text
SillyTavern/data/default-user/OpenAI Settings/
```

Move any preset JSON files placed in filesystem subfolders back into that directory. Folder names and assignments are stored in SillyTavern's extension settings rather than as folders on disk.

## Install from GitHub

Installation URL:

```text
https://github.com/DrieHarry/chat-completion-preset-folders
```

To install it in SillyTavern:

1. Open SillyTavern.
2. Open the **Extensions** panel from the top bar.
3. Select **Install extension**.
4. Paste the GitHub repository URL.
5. Confirm the installation.
6. Reload the SillyTavern page if the extension does not appear immediately.

## Compatibility

Built for SillyTavern's `release` branch as of July 2026. The extension uses the native `#settings_preset_openai` control as its source of truth and triggers the same `change` event as the stock UI.

Other extensions that substantially replace the AI Response Configuration interface may require CSS or selector adjustments.

## License

MIT License. See [LICENSE](LICENSE).
