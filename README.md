# opencode-question-index

[![npm version](https://img.shields.io/npm/v/opencode-question-index.svg)](https://www.npmjs.com/package/opencode-question-index)
[![license](https://img.shields.io/npm/l/opencode-question-index.svg)](./LICENSE)

A searchable question index for the [OpenCode](https://opencode.ai) TUI session sidebar. It lists your previous prompts in the current session; click one to jump back to that message.

> **OpenCode V2 only.** The jump uses the TUI's internal renderer tree because V2 does not expose a public `scrollToMessage` API. It is best-effort and documented below.

## Features

- Adds a **Questions** section to the session sidebar.
- Shows recent prompts for the active session (default: 6).
- Collapse or expand the list from its title.
- **All** opens a searchable picker with every prompt in the session and timestamps.
- Click an entry to scroll the native transcript to that prompt.
- `/questions` and `/qindex` commands.
- Automatic Chinese or English UI.
- No telemetry, no network requests.

## Install

### npm

```sh
opencode plugin add opencode-question-index
```

OpenCode installs the package and adds it to `~/.config/opencode/cli.json`, because this is a TUI-only plugin. Restart the TUI if the sidebar does not appear.

### GitHub

```sh
opencode plugin add github:user-liu1/opencode-question-index
```

### Manual

Add the package to `~/.config/opencode/cli.json`:

```json
{
  "plugins": ["opencode-question-index"]
}
```

For a local checkout, use the directory path instead:

```json
{
  "plugins": ["/absolute/path/to/opencode-question-index"]
}
```

## Usage

1. Open a session.
2. The sidebar gets a **Questions** section with the most recent prompts.
3. Click an entry to jump to it in the transcript.
4. Click **All** to search the full list.
5. Run `/questions` or `/qindex` from the command palette for the same picker.

On narrow terminals, the sidebar closes after a jump so the message has room to render.

## Configuration

Pass options through the object form in `cli.json`:

```json
{
  "plugins": [
    {
      "package": "opencode-question-index",
      "options": {
        "limit": 6,
        "locale": "auto"
      }
    }
  ]
}
```

| Option | Values | Default | Description |
| --- | --- | --- | --- |
| `limit` | `1`-`20` | `6` | Number of prompts shown in the sidebar. |
| `locale` | `auto`, `en`, `zh` | `auto` | UI language. `auto` follows the system locale. |

## How the jump works

OpenCode V2 does not expose a public `scrollToMessage(messageID)` API. The plugin:

1. Looks for the rendered message node in the transcript and scrolls its container into view.
2. If the message is outside the virtualized window, dispatches OpenCode's built-in `session.last` and `session.message.user.previous` commands to walk the transcript until the message is mounted, then aligns it.

This is the same internal approach used by OpenCode's built-in `/timeline` command. If a message was reverted or removed by compaction, the plugin shows a warning instead of jumping.

## Compatibility

- OpenCode V2 (`>= 2.0.0`). Developed against `2.2.5`.
- TUI only; the package has no server part.
- The renderer traversal relies on internal TUI structures, so a future OpenCode release may change the behavior. The fallback navigation keeps the plugin usable when that happens.

## Privacy

The plugin has no telemetry, makes no network requests, and writes no files. It reads user messages from the local OpenCode server and renders them in your terminal. Nothing leaves your machine.

## Development

```sh
git clone https://github.com/user-liu1/opencode-question-index.git
cd opencode-question-index
npm install
npm run typecheck
npm run pack:check
```

To try a local checkout, point `cli.json` at the directory and restart the TUI:

```json
{
  "plugins": ["/absolute/path/to/opencode-question-index"]
}
```

## License

MIT. See [LICENSE](./LICENSE).
