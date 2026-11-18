/** @jsxImportSource @opentui/solid */

import { Plugin, usePlugin } from "@opencode/plugin/tui"
import type { Context } from "@opencode/plugin/tui/context"
import { For, Show, createEffect, createMemo, createSignal, on, onCleanup } from "solid-js"

const pluginID = "opencode-question-index"
const commandOpen = `${pluginID}.open`
const defaultLimit = 6
const maxLimit = 20
const maxPreview = 72
const maxDialogTitle = 120
const jumpStepMs = 140
const jumpMaxSteps = 60
const messagePageSize = 200
const messageMaxPages = 20
const narrowTerminalWidth = 120

type Locale = "en" | "zh"

type Strings = {
  title: string
  all: string
  openCommand: string
  pickerTitle: string
  pickerPlaceholder: string
  noSession: string
  noQuestions: string
  readFailed: string
  notFound: string
}

const STRINGS: Record<Locale, Strings> = {
  en: {
    title: "Questions",
    all: "All",
    openCommand: "Open question index",
    pickerTitle: "All questions",
    pickerPlaceholder: "Search questions",
    noSession: "Open a session first.",
    noQuestions: "No questions in this session yet.",
    readFailed: "Could not read the session history.",
    notFound: "Message not found. It may have been reverted or compacted.",
  },
  zh: {
    title: "提问索引",
    all: "全部",
    openCommand: "打开提问索引",
    pickerTitle: "全部提问",
    pickerPlaceholder: "搜索提问",
    noSession: "请先打开一个会话。",
    noQuestions: "当前会话还没有可索引的提问。",
    readFailed: "读取会话记录失败。",
    notFound: "未找到该消息，可能已回滚或压缩。",
  },
}

type Item = {
  id: string
  sessionID: string
  created: number
  index: number
  title: string
  preview: string
}

type UserMessage = {
  id: string
  time: { created: number }
  text: string
}

type ClickEvent = {
  type: string
  button: number
  preventDefault?: () => void
  stopPropagation?: () => void
}

type RenderableLike = {
  id?: string
  y?: number
  isDestroyed?: boolean
  getChildren?: () => RenderableLike[]
  findDescendantById?: (id: string) => RenderableLike | undefined
  scrollBy?: (delta: number) => void
  scrollChildIntoView?: (child: RenderableLike | string) => void
}

const asLimit = (value: unknown) => {
  const parsed =
    typeof value === "string" && value.trim() !== ""
      ? Number(value)
      : typeof value === "number"
        ? value
        : defaultLimit
  if (!Number.isFinite(parsed)) return defaultLimit
  return Math.max(1, Math.min(maxLimit, Math.trunc(parsed)))
}

const asLocale = (value: unknown): Locale | "auto" => {
  if (typeof value !== "string") return "auto"
  const normalized = value.trim().toLowerCase()
  if (normalized === "en" || normalized === "zh") return normalized
  return "auto"
}

const detectLocale = (): Locale => {
  const raw =
    (typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().locale : "") ||
    process.env.LC_ALL ||
    process.env.LANG ||
    ""
  return raw.toLowerCase().startsWith("zh") ? "zh" : "en"
}

const resolveLocale = (value: unknown): Locale => {
  const configured = asLocale(value)
  return configured === "auto" ? detectLocale() : configured
}

const normalize = (value: string) => value.replace(/\s+/g, " ").trim()

const clip = (value: string, max: number) => {
  if (value.length <= max) return value
  return `${value.slice(0, Math.max(0, max - 3)).trimEnd()}...`
}

const firstLine = (value: string) =>
  value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) ?? ""

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const formatTime = (time: number, locale: Locale) => {
  if (!Number.isFinite(time)) return "--:--"
  return new Date(time).toLocaleTimeString(locale === "zh" ? "zh-CN" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * The session view keeps only a window of messages in the client store, so a
 * long turn can leave no user message loaded at all. Ask the server for the
 * user messages instead and keep them newest first.
 */
const loadItems = async (context: Context, sessionID: string) => {
  const collected: UserMessage[] = []
  let cursor: string | undefined

  for (let page = 0; page < messageMaxPages; page += 1) {
    const response = await context.client.message.list({
      sessionID,
      type: "user",
      limit: messagePageSize,
      ...(cursor ? { cursor } : { order: "desc" as const }),
    })

    for (const message of response.data) {
      if (message.type !== "user") continue
      const body = message.text.trim()
      if (!body) continue
      collected.push({ id: message.id, time: message.time, text: body })
    }

    const next = response.cursor?.next
    if (!next) break
    cursor = next
  }

  const seen = new Set<string>()
  const unique = collected.filter((message) => {
    if (seen.has(message.id)) return false
    seen.add(message.id)
    return true
  })
  unique.sort((left, right) => right.time.created - left.time.created)

  const total = unique.length
  return unique.map((message, position): Item => {
    const title = firstLine(message.text)
    return {
      id: message.id,
      sessionID,
      created: message.time.created,
      index: total - position,
      title,
      preview: clip(normalize(title), maxPreview),
    }
  })
}

const onPrimaryClick = (callback: () => void) => (event: ClickEvent) => {
  if (event.type !== "up" || event.button !== 0) return
  event.preventDefault?.()
  event.stopPropagation?.()
  callback()
}

const getChildren = (node: RenderableLike) => {
  try {
    return node.getChildren?.() ?? []
  } catch {
    return []
  }
}

const ownsChild = (node: RenderableLike, target: RenderableLike) => {
  const children = getChildren(node)
  if (children.includes(target)) return true
  return children.some((child) => child.id !== undefined && child.id === target.id)
}

const findScrollForChild = (root: RenderableLike, target: RenderableLike) => {
  const stack = [root]
  const seen = new Set<RenderableLike>()

  while (stack.length > 0) {
    const node = stack.pop()!
    if (seen.has(node)) continue
    seen.add(node)
    if (typeof node.scrollBy === "function" || typeof node.scrollChildIntoView === "function") {
      if (ownsChild(node, target)) return node
    }
    stack.push(...getChildren(node))
  }

  return undefined
}

/**
 * Renderables are virtualized: messages outside the rendered window do not
 * exist in the tree, so a direct id lookup only works for what is already
 * mounted. When the target is not mounted, walk the transcript with the
 * host's own navigation commands until it renders, then align it.
 */
const alignToMessage = (context: Context, messageID: string) => {
  try {
    const root = context.renderer.root as unknown as RenderableLike
    const child = root.findDescendantById?.(messageID)
    if (!child || child.isDestroyed) return false

    const scroll = findScrollForChild(root, child)
    if (!scroll || scroll.isDestroyed) return false

    if (typeof scroll.scrollChildIntoView === "function") {
      scroll.scrollChildIntoView(child)
      return true
    }

    if (
      typeof scroll.scrollBy === "function" &&
      typeof child.y === "number" &&
      typeof scroll.y === "number"
    ) {
      scroll.scrollBy(child.y - scroll.y - 1)
      return true
    }

    return false
  } catch {
    return false
  }
}

const jumpToMessage = async (context: Context, messageID: string) => {
  if (alignToMessage(context, messageID)) return true

  try {
    context.keymap.dispatch("session.last")
  } catch {
    return false
  }

  await sleep(250)
  if (alignToMessage(context, messageID)) return true

  for (let step = 0; step < jumpMaxSteps; step += 1) {
    try {
      context.keymap.dispatch("session.message.user.previous")
    } catch {
      return false
    }
    await sleep(jumpStepMs)
    if (alignToMessage(context, messageID)) return true
  }

  return false
}

const closeOverlay = (context: Context) => {
  const width = (context.renderer as unknown as { width?: number }).width
  if (typeof width !== "number" || width > narrowTerminalWidth) return
  setTimeout(() => {
    try {
      context.keymap.dispatch("session.sidebar.toggle")
    } catch {}
  }, 0)
}

const currentSessionID = (context: Context) => {
  const route = context.ui.router.current()
  return route.type === "session" ? route.sessionID : undefined
}

const toast = (
  context: Context,
  strings: Strings,
  message: string,
  variant: "warning" | "error" = "warning",
) => {
  context.ui.toast.show({
    variant,
    title: strings.title,
    message,
  })
}

const jump = async (context: Context, strings: Strings, messageID: string) => {
  const ok = await jumpToMessage(context, messageID)
  if (!ok) {
    toast(context, strings, strings.notFound)
    return
  }
  closeOverlay(context)
}

const openPicker = async (context: Context, strings: Strings, locale: Locale, sessionID?: string) => {
  if (!sessionID) {
    toast(context, strings, strings.noSession)
    return
  }

  let items: Item[] = []
  try {
    items = await loadItems(context, sessionID)
  } catch {
    toast(context, strings, strings.readFailed, "error")
    return
  }

  if (items.length === 0) {
    toast(context, strings, strings.noQuestions)
    return
  }

  const selected = await context.ui.dialog.select<Item>({
    title: strings.pickerTitle,
    placeholder: strings.pickerPlaceholder,
    options: items.map((item) => ({
      title: clip(normalize(item.title), maxDialogTitle),
      value: item,
      description: `#${item.index}`,
      footer: formatTime(item.created, locale),
    })),
  })

  if (!selected) return
  await jump(context, strings, selected.id)
}

function Sidebar(props: { sessionID: string; limit: number; locale: Locale; strings: Strings }) {
  const context = usePlugin()
  const [collapsed, setCollapsed] = createSignal(false)
  const [items, setItems] = createSignal<Item[]>([])
  let timer: ReturnType<typeof setTimeout> | undefined
  let disposed = false

  const refresh = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(async () => {
      try {
        const next = await loadItems(context, props.sessionID)
        if (!disposed) setItems(next)
      } catch {}
    }, 150)
  }

  const stop = context.data.listen((event) => {
    const sessionID = (event.details as { data?: { sessionID?: string } }).data?.sessionID
    if (sessionID === props.sessionID) refresh()
  })

  refresh()
  const interval = setInterval(refresh, 4000)

  onCleanup(() => {
    disposed = true
    stop()
    clearInterval(interval)
    if (timer) clearTimeout(timer)
  })

  createEffect(
    on(
      () => props.sessionID,
      () => setCollapsed(false),
      { defer: true },
    ),
  )

  const visible = createMemo(() => items().slice(0, props.limit))

  return (
    <Show when={items().length > 0}>
      <box flexDirection="column">
        <box flexDirection="row" justifyContent="space-between">
          <box
            flexDirection="row"
            gap={1}
            onMouseUp={onPrimaryClick(() => {
              if (items().length > 2) setCollapsed((value) => !value)
            })}
          >
            <Show when={items().length > 2}>
              <text fg={context.theme.text.base}>{collapsed() ? "▶" : "▼"}</text>
            </Show>
            <text fg={context.theme.text.base}>
              <b>{props.strings.title}</b>
            </text>
          </box>
          <text
            fg={context.theme.text.muted}
            onMouseUp={onPrimaryClick(() => {
              void openPicker(context, props.strings, props.locale, props.sessionID)
            })}
          >
            {props.strings.all}
          </text>
        </box>
        <Show when={!collapsed()}>
          <For each={visible()}>
            {(item) => (
              <box
                flexDirection="row"
                gap={1}
                onMouseUp={onPrimaryClick(() => {
                  void jump(context, props.strings, item.id)
                })}
              >
                <text fg={context.theme.text.muted} flexShrink={0}>
                  #{item.index}
                </text>
                <text fg={context.theme.text.base} truncate>
                  {item.preview}
                </text>
              </box>
            )}
          </For>
        </Show>
      </box>
    </Show>
  )
}

export default Plugin.define({
  id: pluginID,
  setup(context) {
    const limit = asLimit(context.options?.limit)
    const locale = resolveLocale(context.options?.locale)
    const strings = STRINGS[locale]

    context.ui.slot({
      append: "sidebar.content",
      render: ({ sessionID }) => (
        <Sidebar sessionID={sessionID} limit={limit} locale={locale} strings={strings} />
      ),
    })

    context.keymap.layer(() => ({
      mode: "global",
      priority: 10,
      commands: [
        {
          id: commandOpen,
          title: strings.openCommand,
          group: "Plugin",
          palette: true,
          slash: { name: "questions", aliases: ["qindex"] },
          run() {
            void openPicker(context, strings, locale, currentSessionID(context))
          },
        },
      ],
    }))
  },
})
