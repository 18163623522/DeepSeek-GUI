# 论文模式：Agent 检索会话化 UI 重设计与实现计划

> 状态：已实现（2026-09-26，分支 `codex/paper-research-stage`）。前置：`docs/work-paper-search-plan.zh-CN.md` 的 P1-P5 已合入 develop（`cad7d1adb`）。
>
> 与本计划的差异：
> - 舞台没有直接复用 `WriteAssistantPanel`，而是由 `PaperResearchStage` 组合时间线与标准输入框，props 通过 `WriteAssistantStageContext` 与右侧助手共用同一份。
> - 研究状态（Agent 标签、当前会话 ID）放在 write workspace store 的 `paperResearch`，而不是 paper-mode store，让 `paperModeView` 保持为 write store 上的纯选择器。
> - 窄窗口下（< 900px 隐藏会话栏，< 1100px 隐藏论文池）暂未提供下拉/抽屉替代入口。
> - “新增 N 篇”显示在工具卡片展开后的头部，而不是折叠摘要里（摘要保持为纯函数）。
> 目标读者：实现这一轮改动的开发者。文中的文件路径均相对仓库根目录。

## 1. 现状问题

当前“论文搜索 → Agent 检索”标签（`PaperAgentSearchPane.tsx`）的做法是：点击“Agent 深度搜索”后，把一段检索提示词通过 `composerBridge.submit` 发进**右侧助手面板当前绑定的会话**（论文模式下发现页绑定的是库级会话），再在搜索页里用一个简化的进度列表跟踪工具调用。实际使用中有这些问题：

| # | 问题 | 原因 |
|---|---|---|
| 1 | 页面一直停在“等待第一轮检索…” | 进度面板用“提交时全局 `blocks.length`”作为锚点（`anchorIndex`）。首次发送会新建库级会话并切换，`blocks` 被替换成更短的数组，`slice(anchorIndex)` 永远为空 |
| 2 | 看不到检索过程 | 只显示“工具名 + 查询词”一行，没有模型的思考、每轮返回了什么、为什么换关键词、子 Agent 在做什么 |
| 3 | 结果和对话分离 | 真正的对话在右侧面板（截图中是关闭状态），搜索页只有一个缩略进度；用户无法追问“只要 2023 年以后的”“去掉综述” |
| 4 | 没有检索历史 | 每次都塞进同一个库级会话，与“解读论文”“写笔记”等对话混在一起，无法回看某次检索 |
| 5 | 中间结果不可用 | 多轮检索累计上百篇候选，只有最后的 `paper_report` 能导入，中间命中的好论文无法直接挑选 |

结论：Agent 检索本质上是一段**多轮 Agent 会话**，应该像 Code 模式那样以会话时间线为主体呈现：用户问题 → 思考 → 工具调用卡片（带结果）→ 子 Agent → 最终清单，并且可以继续追问。

## 2. 设计目标

1. **会话即检索**：每次 Agent 检索是一个独立的 Work 会话（“检索会话”），完整复用 Code/Work 已有的时间线、流式输出、思考折叠、审批、用户输入、打断、排队消息和输入框。
2. **过程可读**：论文工具有专属卡片，一眼看到“查了什么、哪些来源成功、返回多少、代表性结果”，可展开完整列表。
3. **结果可用**：右侧“论文池”汇总本次会话所有检索命中的论文（去重），随时挑选、导入、导出，不必等最终报告。
4. **可追问、可回看**：底部输入框继续对话；左侧列出本文献库的检索历史。
5. **不重造轮子**：不新建第二套 SSE 投影；数据全部来自当前会话的 `ChatBlock[]`。

非目标：不改 Kun 的 agent loop；不改变“直接检索”标签的交互；不做跨文献库的检索历史。

## 3. 交互设计

### 3.1 整体布局（Agent 检索标签激活时）

中间编辑区整块变成“检索舞台”，右侧助手栏自动收起（因为舞台就是同一个助手会话，避免重复显示两份）。离开 Agent 标签时恢复右侧助手栏原来的开关状态。

```
┌──────────────┬──────────────────────────────────────────────┬────────────────────────┐
│ 检索会话      │  ◀ 直接检索 | ✦ Agent 检索        ⏱ 2:14  ■ 停止 │ 论文池            124  │
│ ＋ 新建检索   │  repository-level code agent 修复 issue        │ [全部 124][推荐 12][已入库 3]│
│              │  ● 检索中 · 第 5 轮 · 3 个来源失败              │ 🔍 筛选…   排序:相关度 ▾  │
│ ● 代码 Agent │ ─────────────────────────────────────────────  │ ☐ SWE-agent: Agent-Co… │
│   修复 issue │  👤 帮我找 2024 年以来仓库级代码 Agent …        │    2024 · NeurIPS · 5源 ×3│
│   2 分钟前   │                                                │ ☐ Agentless: Demystif… │
│ ○ 长上下文    │  ▸ 思考 · 已规划 4 组检索式                      │    2024 · arXiv · 3源 ×2 │
│   RAG 综述    │                                                │ ☑ OpenHands: An Open…  │
│   昨天       │  ┌ 🔎 检索  "repository-level code agent" ───┐  │    2024 · ICLR · 4源     │
│ ○ 扩散视频    │  │ arXiv 10 · OpenAlex 10 · 顶会 8 · S2 ✕    │  │  …                      │
│   3 天前     │  │ 26 篇 · 新增 19                            │  │                         │
│              │  │ 1. SWE-agent … 2024 NeurIPS   [导入]       │  │ ─────────────────────── │
│              │  │ 2. Agentless … 2024 arXiv     [导入]       │  │ 已选 1  [导入] [BibTeX]  │
│              │  │ 3. CodeR …     2024           [导入]       │  │        [发给助手]        │
│              │  │ 展开全部 26 篇 ▾                            │  │                         │
│              │  └────────────────────────────────────────────┘  │                         │
│              │  ┌ 🔗 引用扩展  SWE-agent 的被引 · 25 篇 ──────┐  │                         │
│              │  └────────────────────────────────────────────┘  │                         │
│              │  ┌ 👥 子 Agent · literature-researcher ×3 ────┐  │                         │
│              │  │ ✓ 基准与评测   ✓ 检索增强定位   ◌ 多智能体     │  │                         │
│              │  └────────────────────────────────────────────┘  │                         │
│              │  ┌ 📋 推荐论文清单 · 12 篇 ──────────────────┐   │                         │
│              │  │ （现有 PaperListCard，分组 + 优先级）       │   │                         │
│              │  └────────────────────────────────────────────┘  │                         │
│              │  这个方向目前主要分三条线……（总结 Markdown）       │                         │
│              │ ┌────────────────────────────────────────────┐   │                         │
│              │ │ 继续追问：只保留有开源代码的…        ⚙ 范围 ↑ │   │                         │
│              │ └────────────────────────────────────────────┘   │                         │
└──────────────┴──────────────────────────────────────────────┴────────────────────────┘
   220px 可折叠            中间：时间线 max-w 760px 居中                 320px 可折叠
```

- 窄窗口（< 1100px）：左侧会话栏折叠成顶部下拉；论文池变成右上角按钮打开的抽屉。
- 左右两栏的折叠状态存 localStorage（读写包 try/catch）。

### 3.2 新建检索（空状态）

```
                 ✦ Agent 文献检索
     描述你的研究问题，Agent 会拆解检索式、多轮检索、追引用并给出推荐清单

   ┌──────────────────────────────────────────────────────────────┐
   │ 2024 年以来，仓库级代码 Agent 自动修复 GitHub issue 的方法和基准    │
   │                                                                │
   │ [来源: arXiv, OpenAlex, S2, 顶会 ▾] [年份: 2024– ▾] [深度: 标准 ▾] ↑│
   └──────────────────────────────────────────────────────────────┘
      试试： 长上下文检索增强生成的评测   扩散模型视频生成的一致性
```

- **深度**三档：
  - 快速：约 2 轮检索，不追引用；
  - 标准：3-5 组检索式，并追踪 1-2 篇种子论文的引用；
  - 深度：拆成子方向，并行派出 `literature-researcher` 子 Agent。
- 深度写进检索简报，由模型遵循；GUI 不硬编码流程。
- 来源和年份默认继承“直接检索”标签的当前设置（复用 `paper-search-prefs.ts`）。
- 从“直接检索”结果页点“交给 Agent 继续”，会把当前查询和条件预填到这里。

### 3.3 时间线里的论文工具卡片

沿用 Code 模式的过程卡片样式：折叠态一行摘要，展开看详情。流式期间显示运行态。

| 工具 | 折叠态摘要 | 展开详情 |
|---|---|---|
| `paper_search` | `检索 "<query>" · 26 篇（新增 19）· arXiv 10 / OpenAlex 10 / 顶会 8 / S2 失败` | 来源状态条（失败项悬停看错误）+ 前 5 篇紧凑行，可“展开全部”；每行有标题、年份·venue、来源数、是否已在论文池出现，以及导入按钮 |
| `paper_citations` | `引用扩展 · <种子标题> 的参考文献 / 被引 · 25 篇` | 种子论文一行 + 结果列表（同上） |
| `paper_details` | `核实 3 篇论文` | 每篇的 TLDR、领域、引用数，未找到的标红 |
| `paper_report` | 直接渲染现有 `PaperListCard`（不折叠） | — |
| `delegate_task`（literature-researcher） | 现有子 Agent 卡片，额外显示子方向名 | 点击在右侧打开子会话（现有能力） |

- “新增 N”表示本次调用中第一次进入论文池的篇数，让用户看出检索是否还在带来新东西。
- 卡片里的论文行点击后：论文池滚动到该论文并高亮；再次点击打开详情侧栏（复用 `PaperSearchDetailPane`）。

### 3.4 论文池（右栏）

- 数据：当前检索会话所有 `paper_search` / `paper_citations` / `paper_details` 结果去重合并；`paper_report` 里的论文标“推荐”并带优先级。
- 标签页：全部 / 推荐 / 已入库；搜索框按标题、作者过滤；排序可选相关度、出现次数、年份、引用数。
- 每行显示：复选框、标题（两行截断）、年份·venue、来源数、“×N”表示被几轮检索命中；推荐的论文带 必读 / 推荐 / 可选 标记。
- 底部操作栏：已选 N 篇 → 批量导入（复用 `paperImportBatch` 与任务环）/ 复制 BibTeX / 发给助手（插入输入框，不自动发送）。
- 头部统计：`检索 8 次 · 候选 124 · 推荐 12 · 失败来源 S2`。

### 3.5 顶部状态条

- 左：会话标题（默认为用户问题，可重命名）。
- 状态胶囊：检索中（旋转）/ 已完成 / 已中断 / 出错。
- 右：已用时间、停止（调用现有打断）、更多菜单（重命名、归档、在右侧助手中打开）。

### 3.6 视觉规范

- 完全沿用 Code 时间线的字号、间距和卡片样式：不用 `compactCards`，时间线最大宽度 760px 居中。
- 论文卡片只用 `ds-*` 不透明 token 和 `accent-tint`，不写 `/NN` 透明度（Tailwind 会静默丢弃 var() 颜色的透明度写法）。
- 深色模式、900px 窄窗口都要验证。

## 4. 技术方案

### 4.1 检索会话 = 绑定虚拟资源的 Work 会话

复用 Work 模式“资源 → 会话”的绑定机制（`useWorkbenchWriteAssistantRuntime.ts` 里的 effect 根据 `paperConversationResourcePath` 解析资源路径，再用 `activeWriteThreadForWorkspace` 找到或清空当前会话）。

1. `src/renderer/src/paper/paper-conversation-scope.ts`
   - `PaperModeView` 增加 `'research'`。
   - `paperConversationResourcePath` 在 `view === 'research'` 时返回虚拟资源路径 `<libraryRoot>/.kun-research/<sessionId>`。这个目录不在磁盘上创建，只作为注册表的 key。
2. `src/renderer/src/paper/paper-view.ts`（`paperModeView`）：当焦点标签是 `discover:search` 且 `discover.searchTab === 'agent'` 时返回 `'research'`。
3. 新增 `src/renderer/src/paper/paper-research-sessions.ts`：
   - `newResearchSessionId()`：`rs-<base36 时间>-<随机>`。
   - `researchResourcePath(libraryRoot, sessionId)` / `researchSessionIdFromPath(path)`。
   - `listResearchSessions(libraryRoot, threads, registry)`：从 write-thread-registry 中取该库 `.kun-research/*` 资源绑定的会话，合并会话标题、状态、更新时间，按时间倒序。
4. `usePaperModeStore.discover` 增加 `activeResearchSessionId: string | null`（替代现在的 `agentSearch.anchorIndex`）。
   - 持久化到 localStorage（按库根目录分 key），重开应用后回到上次的检索会话。
   - 注册表本身已经持久化，会话列表不需要另存。

这样切换检索会话就只是改 `activeResearchSessionId`，现有 effect 会自动 `selectWriteThread`。实时流、审批、`user_input`、排队、打断全部是现成的。

### 4.2 启动一次检索

新增 `src/renderer/src/paper/paper-research-actions.ts`：

```ts
export async function startPaperResearch(input: {
  query: string
  sources: PaperSearchSource[]
  yearFrom?: number
  yearTo?: number
  depth: 'quick' | 'standard' | 'deep'
}): Promise<void>
```

步骤：

1. 生成 `sessionId`，计算资源路径。
2. `chatState.createWriteThread(libraryRoot, resourcePath, { title: query, titleAuto: false })`。这个接口已有，白板会话就是这么建的。
3. 设置 `activeResearchSessionId`，并等 `selectWriteThread` 完成。
   - 当前 effect 是异步选中；加一个 `awaitActiveThread(threadId, timeoutMs)` 小工具订阅 chat store，确认 `activeThreadId === threadId` 后再继续。
4. 调用 `sendWritePrompt(brief)`：通过 `composerBridge.submit`，现在它发往“当前绑定会话”，也就是刚选中的检索会话。
5. 失败处理：建会话失败或 3 秒内没切到目标会话时，提示错误并回滚 `activeResearchSessionId`。

检索简报（brief）改为“用户问题原文 + 一行结构化范围说明”。多轮检索的方法论只放在 Kun 的 Work 模式说明里（`kun/src/loop/work-mode.ts` 已有 Paper research 段落，补充深度三档的含义），不再在 i18n 里维护长提示词：

```
<用户问题>

[paper-research] depth=standard; sources=arxiv,openalex,semantic_scholar,venues; years=2024-
```

- Kun 侧在 Work 模式说明中解释 `[paper-research]` 行的含义。
- 这一行放在用户消息里，是动态内容，不影响稳定前缀和缓存命中。
- 删除 i18n key `writePaperSearchAgentPrompt` / `writePaperSearchAgentSources` / `writePaperSearchAgentYears`（7 种语言）。

### 4.3 助手“舞台模式”

问题：助手的全部 props（输入框状态、模型选择、附件、发送、打断等）在工作台层由 `useWorkbenchRightPanelSharedProps` 组装后传给 `WorkbenchRightPanel`；而检索页挂在编辑器分组深处（`PaperViewSurface`）。

方案：

1. `src/renderer/src/components/workbench/WriteAssistantStageContext.tsx`（新）：`WriteAssistantStageProvider` 在 `WorkbenchContent` 中用同一份 `write` props 提供 context；`useWriteAssistantStage()` 在检索页读取。
2. `useWriteWorkspaceStore` 增加 `assistantPresentation: 'rail' | 'stage'`：
   - Agent 检索标签可见时设为 `'stage'`，卸载或切走时恢复 `'rail'`。
   - `WorkbenchRightPanel` 在 `'stage'` 时不渲染 `WriteAssistantPanel`，保证同一时刻只有一个输入框实例，避免重复快捷键和焦点争抢。
   - 右侧栏在舞台模式下自动收起，离开时恢复原开关状态。
3. `src/renderer/src/components/paper/research/PaperResearchStage.tsx`（新）组合：
   - `LazyMessageTimeline`：不传 `compactCards`，时间线宽度 760；
   - `FloatingComposer`：props 来自 stage context；
   - 顶部状态条（3.5 节）。
   - 不直接复用 `WriteAssistantPanel`：它包含论文快捷操作、资源历史弹层、子会话返回条等右栏专属 UI，舞台只取时间线和输入框。
4. 子会话：`onOpenChildThread` 在舞台模式下打开右侧抽屉查看子会话，复用 `WriteAssistantPanel` 现有的子会话加载逻辑。实现时把它抽成 `useChildThreadViewer` hook，供两处共用。

### 4.4 论文工具专属卡片

在 `src/renderer/src/components/chat/message-timeline-process-detail.tsx` 的 `getProcessDetail` 中为论文工具返回新的 detail 类型，web_search 的来源列表就是这么接入的：

```ts
| { kind: 'paper-search'; meta: RendererPaperSearchMeta; newCount?: number }
| { kind: 'paper-citations'; meta: RendererPaperSearchMeta; seedTitle?: string }
| { kind: 'paper-details'; papers: PaperSearchCardHit[]; missing: string[] }
```

- 新文件 `src/renderer/src/components/chat/PaperToolDetail.tsx` 负责渲染（该文件已 509 行，不要继续往里堆）。
- `meta.paperSearch` / `meta.paperDetails` 已由 `kun-mapper-tools.ts` 挂到 ToolBlock 上，直接用 `paper-list-adapter.ts` 的解析函数，不需要改 Kun。
- 折叠态摘要文案由 `builtInToolLabel` 增加 `paper_search` / `paper_citations` / `paper_details` / `paper_report` 分支生成。
- “新增 N”需要知道之前出现过哪些论文，由 4.5 的池子计算后通过 context 传入卡片，卡片本身保持无状态。
- 这些卡片在右侧助手栏（紧凑模式）同样生效，只是默认折叠；这一点同时完成了上一份计划 P1.3 第 6 条。

### 4.5 论文池数据

新增 `src/renderer/src/paper/paper-research-pool.ts`（纯函数，可单测）：

```ts
export type ResearchPoolEntry = PaperSearchCardHit & {
  key: string            // 与引擎合并规则一致：doi > arxiv > cool > 标题 key
  hits: number           // 被多少次工具调用命中
  firstBlockId: string   // 首次出现的工具卡片，用于点击定位
  recommended?: { priority?: PaperReportPriority; reason: string; group?: string }
}

export function buildResearchPool(blocks: ChatBlock[]): {
  entries: ResearchPoolEntry[]
  newCountByBlock: Record<string, number>
  stats: { searches: number; candidates: number; recommended: number; failedSources: PaperSearchSource[] }
}
```

- 遍历时按时间顺序合并，同一论文取信息最全的字段，规则与引擎 `mergeInto` 一致：摘要取更长的，引用数取最大值。
- 标题模糊合并：直接复用引擎的 `titleTokens` / `jaccardSimilarity`（`src/shared/paper/paper-search.ts` 再导出一个纯函数入口，避免渲染层直接引用 kun 内部文件）。
- 子 Agent 的检索结果不在父会话的 `blocks` 里。父会话只能拿到子 Agent 的文字汇报；子会话的论文在最终 `paper_report` 中会被引用。第一版论文池只统计父会话自身的工具调用，并在池头提示“子 Agent 结果以推荐清单为准”。
- `useResearchPool()` hook：`useMemo(() => buildResearchPool(blocks), [blocks])`。blocks 在流式期间频繁变化，但论文工具块数量少，计算只遍历 tool / paper-list 块，成本可忽略。
- 已入库判断复用 `ImportButton` 的四路匹配（arXiv / papers.cool id / DOI / 标题）。

### 4.6 左侧检索会话列表

- `src/renderer/src/components/paper/research/PaperResearchSessionList.tsx`（新）：数据来自 `listResearchSessions`。
- 条目：标题、状态点（运行中 / 完成 / 出错，复用 `writeThreadActivity`）、相对时间。
- 右键或悬停菜单：重命名、归档，复用 `useWriteResourceConversationHistory` 中已有的 `renameConversation` / `archiveConversation` 逻辑，把它们抽成可传入资源 scope 的函数。
- “＋ 新建检索”：清空 `activeResearchSessionId`，显示 3.2 节的空状态。

### 4.7 删除和替换的旧实现

- 删除 `PaperAgentSearchPane.tsx` 及 `discover.agentSearch`（含 `anchorIndex`）。
- `PaperSearchView.tsx`：Agent 标签改为渲染 `PaperResearchView`（会话列表 + 舞台 + 论文池）；`runAgentSearch` 改为调用 `startPaperResearch`。
- “Agent 深度搜索”按钮在“直接检索”标签里改名为“交给 Agent 继续”，行为是切到 Agent 标签并预填。

### 4.8 依赖的前置修复（来自上一轮 review）

这些不修，新 UI 会直接暴露问题：

1. **Agent SDK 路径丢 `meta`**：`kun/src/runtime/agent-sdk/agent-sdk-runtime-factory-tools.ts:245` 只回传 `output` / `isError`。需要确认 SDK 路径写入 turn store 的 tool_result 条目带上 `result.item.meta`（在 `sdk-event-mapper` 合成 tool_result 时按 callId 取回 LocalToolHost 的结果 meta），否则订阅引擎下工具卡片和推荐清单都不显示。
2. **搜索页全局快捷键**：`PaperSearchResults.tsx:211` / `PaperSearchView.tsx:83` 改为仅在本视图所在分组聚焦时生效（检查 `editorLayout.focusedGroupId` 和容器 `contains(document.activeElement)`），否则舞台模式下会抢时间线和输入框的方向键。
3. **`paper_report` 核验范围**：`PaperSeenStore` 改为按根会话 id 分桶（子 Agent 用父会话 id），否则别的检索会话搜到的论文也会被判为“已验证”。
4. **OpenReview 连接器**：参数改为 `source=forum`，连字符替换为空格（实测修复前 CS 查询返回 0 条）。

## 5. 文件清单

| 类型 | 路径 | 说明 |
|---|---|---|
| 新增 | `src/renderer/src/paper/paper-research-sessions.ts` | 会话 id、资源路径、会话列表 |
| 新增 | `src/renderer/src/paper/paper-research-actions.ts` | `startPaperResearch`、`awaitActiveThread` |
| 新增 | `src/renderer/src/paper/paper-research-pool.ts` | 论文池纯函数 |
| 新增 | `src/renderer/src/components/paper/research/PaperResearchView.tsx` | 三栏容器、响应式、折叠状态 |
| 新增 | `src/renderer/src/components/paper/research/PaperResearchStage.tsx` | 状态条 + 时间线 + 输入框 |
| 新增 | `src/renderer/src/components/paper/research/PaperResearchEmpty.tsx` | 新建检索空状态（范围、深度、示例） |
| 新增 | `src/renderer/src/components/paper/research/PaperResearchSessionList.tsx` | 左侧会话列表 |
| 新增 | `src/renderer/src/components/paper/research/PaperResearchPool.tsx` | 右侧论文池 |
| 新增 | `src/renderer/src/components/chat/PaperToolDetail.tsx` | 论文工具过程卡片 |
| 新增 | `src/renderer/src/components/workbench/WriteAssistantStageContext.tsx` | 舞台模式 props 共享 |
| 新增 | `src/renderer/src/components/write/useChildThreadViewer.ts` | 子会话查看逻辑抽取 |
| 修改 | `src/renderer/src/paper/paper-conversation-scope.ts`、`paper-view.ts` | `'research'` 视图与资源路径 |
| 修改 | `src/renderer/src/paper/paper-mode-store.ts` | `activeResearchSessionId`，删除 `agentSearch` |
| 修改 | `src/renderer/src/write/write-workspace-store*.ts` | `assistantPresentation` |
| 修改 | `src/renderer/src/components/workbench/WorkbenchContent.tsx`、`WorkbenchRightPanel.tsx` | Provider 注入、舞台模式隐藏右栏助手 |
| 修改 | `src/renderer/src/components/chat/message-timeline-process-detail.tsx` | 论文工具 detail 分支与标签 |
| 修改 | `src/renderer/src/components/write/WriteAssistantPanel.tsx` | 改用 `useChildThreadViewer` |
| 修改 | `src/renderer/src/components/paper/discover/PaperSearchView.tsx` | Agent 标签接入新视图 |
| 删除 | `src/renderer/src/components/paper/discover/PaperAgentSearchPane.tsx` | 被替代 |
| 修改 | `kun/src/loop/work-mode.ts` | `[paper-research]` 范围行与深度说明 |
| 修改 | `src/shared/paper/paper-search.ts` | 导出标题模糊匹配纯函数 |
| 修改 | 7 种语言 `common/paper.json` | 新增舞台、论文池、会话列表文案；删除旧长提示词 |

所有文件保持 700 行以内。`PaperSearchView.tsx` 目前已接近上限，Agent 部分必须拆出去。

## 6. 实施步骤与验收

### S1 前置修复（0.5 天）

- 完成 4.8 的 4 项。
- 验收：
  - 订阅引擎下 `paper_report` 能渲染卡片；
  - 搜索页和 PDF 分栏时，PDF 方向键正常；
  - OpenReview 查询 `repository-level code agent` 返回结果。

### S2 检索会话基础（1 天）

- 4.1、4.2：虚拟资源路径、会话列表、`startPaperResearch`。
- 验收：
  - 发起检索后新会话出现在列表，标题为问题原文；
  - 右侧助手（临时保持 rail 模式）显示的就是这个会话；
  - 切换会话列表条目时右侧会话随之切换；
  - 重启应用后列表和上次选中项恢复；
  - 普通文献库对话不受影响。
- 单测：`paper-research-sessions` 的路径编解码和列表合并；`paperConversationResourcePath` 的 research 分支。

### S3 舞台模式（1 天）

- 4.3：context、`assistantPresentation`、`PaperResearchStage`、子会话抽屉。
- 验收：
  - Agent 标签下时间线在中间实时流式显示（思考、工具、回答），输入框可追问，停止按钮可打断；
  - 右侧助手栏自动收起，离开后恢复；
  - 同一时刻 DOM 中只有一个 FloatingComposer；
  - 审批和 `user_input` 面板在舞台里正常出现。

### S4 论文工具卡片（1 天）

- 4.4。
- 验收：
  - 四种论文工具在舞台和右侧助手中都显示专属卡片；
  - 失败来源悬停显示错误；
  - 展开列表可导入；
  - 事件重放（刷新后）卡片内容完整。
- 单测：`getProcessDetail` 对四种工具的分支；卡片渲染快照（成功、部分失败、全部失败、空结果）。

### S5 论文池（1 天）

- 4.5 + 3.4。
- 验收：
  - 多轮检索后池中数量等于去重后的候选数；
  - 推荐论文带优先级；
  - 点击卡片中的论文，池内定位高亮；
  - 批量导入、BibTeX、发给助手可用；
  - 已入库状态正确。
- 单测：`buildResearchPool` 覆盖去重（DOI / arXiv / 标题模糊）、`newCountByBlock`、推荐合并、失败来源统计。

### S6 空状态、会话列表交互与收尾（1 天）

- 3.2、3.5、4.6、4.7；删除旧组件和 i18n key；7 种语言补齐。
- 验收：
  - 深度三档都能跑通，其中“深度”会派出子 Agent；
  - 从直接检索“交给 Agent 继续”预填正确；
  - 重命名和归档可用；
  - 窄窗口、深色模式布局正确。

每步都要跑：`npm run typecheck`、相关 vitest、`npm run lint`、`npm run check:file-lines`；S1 和 S6 额外跑 `npm run build:kun`。之后重启 `npm run dev`，在论文模式实际走一遍并截图留证。

## 7. 风险与对策

| 风险 | 对策 |
|---|---|
| 切换资源导致的异步选中与发送竞态 | `awaitActiveThread` 确认后再发送；超时回滚并提示 |
| 舞台模式与右侧栏两个助手实例争抢输入框 | 用 `assistantPresentation` 保证单实例；加测试断言 DOM 中只有一个 FloatingComposer |
| 虚拟资源路径被当成真实文件处理（文件树、最近文件、@ 提及） | 路径放在 `.kun-research/` 下，注册表写入前统一识别；文件树和提及逻辑过滤该前缀，并补单测 |
| 论文池随 blocks 频繁重算 | 只遍历工具块；以工具块 id + 状态为依赖做记忆化 |
| 子 Agent 结果不在父会话 blocks 中 | 第一版以 `paper_report` 为准并在池头说明；后续可订阅子会话事件补齐 |
| 订阅引擎（Agent SDK）与原生引擎行为不一致 | S1 先修 meta 透传；验收时两种引擎各跑一次 |
