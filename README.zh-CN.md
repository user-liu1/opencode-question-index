# opencode-question-index

[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

一个给 [OpenCode](https://opencode.ai) TUI 会话侧边栏用的可搜索提问索引。它列出当前会话里你之前提过的问题，点一下即可跳回对应的消息位置。

> **仅支持 OpenCode V2。** V2 没有公开的 `scrollToMessage` API，跳转依赖 TUI 内部的渲染树，属于尽力而为，下面有详细说明。

## 功能

- 在会话侧边栏增加 **提问索引** 区块。
- 显示当前会话最近的提问（默认 6 条）。
- 点击标题可折叠或展开。
- **全部** 打开带搜索和时间戳的完整提问列表。
- 点击条目，主对话区滚动到对应提问。
- 提供 `/questions` 和 `/qindex` 命令。
- 根据系统语言自动显示中文或英文。
- 无遥测、无网络请求。

## 安装

> 暂未发布到 npm。请直接从 GitHub 安装，或使用本地目录。

### GitHub

```sh
opencode plugin add github:user-liu1/opencode-question-index
```

这是纯 TUI 插件，OpenCode 会自动把它写进 `~/.config/opencode/cli.json`。如果侧边栏没有出现，重启一次 TUI。

### 手动安装

先克隆仓库，再在 `~/.config/opencode/cli.json` 里指向该目录：

```sh
git clone https://github.com/user-liu1/opencode-question-index.git
```

```json
{
  "plugins": ["C:/path/to/opencode-question-index"]
}
```

## 使用

1. 打开一个会话。
2. 侧边栏出现 **提问索引**，列出最近的提问。
3. 点击条目跳转到对应消息。
4. 点击 **全部** 搜索完整列表。
5. 也可以运行 `/questions` 或 `/qindex`。

终端较窄时，跳转后侧边栏会自动收起，给消息留出显示空间。

## 配置

在 `cli.json` 里用对象形式传选项：

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

| 选项 | 取值 | 默认 | 说明 |
| --- | --- | --- | --- |
| `limit` | `1`-`20` | `6` | 侧边栏显示的提问条数。 |
| `locale` | `auto`、`en`、`zh` | `auto` | 界面语言，`auto` 跟随系统语言。 |

## 跳转原理

OpenCode V2 没有公开的 `scrollToMessage(messageID)` API。插件的做法是：

1. 在对话区找到已经渲染的消息节点，把它的滚动容器滚到对应位置。
2. 如果消息在虚拟化窗口之外，就调用 OpenCode 内置的 `session.last` 和 `session.message.user.previous` 命令向前走，直到消息被渲染出来，再对齐。

这和 OpenCode 内置 `/timeline` 命令使用的是同一套内部机制。如果消息已被回滚或压缩删除，插件会给出提示，不会跳到错误位置。

## 兼容性

- OpenCode V2（`>= 2.0.0`），基于 `2.2.5` 开发。
- 纯 TUI 插件，没有 server 部分。
- 跳转依赖 TUI 内部结构，未来的 OpenCode 版本可能调整；届时插件会退回内置导航，仍可使用。

## 隐私

插件没有遥测、不发网络请求、不写文件。它只从本地 OpenCode 服务读取用户消息并显示在终端里，数据不会离开你的机器。

## 开发

```sh
git clone https://github.com/user-liu1/opencode-question-index.git
cd opencode-question-index
npm install
npm run typecheck
npm run pack:check
```

本地调试时，把 `cli.json` 的 `plugins` 指向该目录并重启 TUI 即可。

## 许可证

MIT，详见 [LICENSE](./LICENSE)。
