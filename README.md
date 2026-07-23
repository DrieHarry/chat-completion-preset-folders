# Chat Completion Preset Folders for SillyTavern

Adds a searchable replacement for SillyTavern's **Chat Completion preset** selector with:

- true collapsible folders;
- unlimited nested subfolders;
- a folder manager for assigning existing presets;
- persistent expanded/collapsed state;
- live synchronization when presets are created, imported, renamed, selected, or deleted;
- no rewriting of your preset JSON files.

## Important limitation

This is a UI organization extension. SillyTavern still loads Chat Completion preset JSON files from its normal **flat** `OpenAI Settings` directory. Move any JSON files that you placed inside filesystem subfolders back into:

```text
SillyTavern/data/default-user/OpenAI Settings/
```

The extension stores folder names and preset assignments in SillyTavern's extension settings. It does not move files on disk.

## Installation

### Per-user installation (recommended)

1. Stop SillyTavern.
2. Extract the folder named `chat-completion-preset-folders` into:

   ```text
   SillyTavern/data/default-user/extensions/
   ```

3. The final path should contain:

   ```text
   SillyTavern/data/default-user/extensions/chat-completion-preset-folders/manifest.json
   ```

4. Start SillyTavern and hard-refresh the browser (`Ctrl+F5`).

### All-users / older-layout installation

Place the folder in:

```text
SillyTavern/public/scripts/extensions/third-party/chat-completion-preset-folders/
```

Then restart SillyTavern and hard-refresh the page.

## Usage

1. Open **AI Response Configuration** and choose **Chat Completion**.
2. The ordinary preset dropdown is replaced by the folder picker.
3. Click **Folders…**.
4. Create root folders and subfolders.
5. Assign each preset using the dropdown beside its name.
6. Close the manager. Folder rows in the picker can now be expanded and collapsed.

## Uninstalling

Remove the extension folder and restart SillyTavern. Your preset files remain unchanged. The saved folder metadata can remain harmlessly in `settings.json` or be removed from the `extension_settings` section under the key:

```text
chat-completion-preset-folders
```

## Compatibility

Built against SillyTavern's current `release` branch in July 2026. The extension uses the native `#settings_preset_openai` control as its source of truth and triggers the same `change` event as the stock UI.

## License

MIT License. See `LICENSE`.
