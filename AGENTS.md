# NovelWiki (网文设定集与知识图谱系统) - 架构与开发军规

## 1. 项目愿景与设计哲学
NovelWiki 是一个专为百万字长篇网文设计的、具有**断点续跑能力**、**单页 Worker 沙箱隔离**和**原著行级证据锚定（Claims & Evidence）**的 Agent 驱动知识图谱系统。
本项目的核心架构深度借鉴了 OpenWiki，用于解决长篇小说在传统 RAG 下的信息丢失、长上下文爆炸以及 AI 幻觉问题。

## 2. 核心架构三层流（不可随意更改的架构边界）
1. **Chapter Ledger (章节账本)**：轻量级流水线，按章提取摘要、登场人物、关键事件与境界变化（存储于 `ledger/`）。
2. **Planner Agent (总览规划)**：阅读全书纲要与账本目录，通过严格的 `submit_novel_plan` 工具输出 Markdown 词条树，落盘至持久化状态机 `.novel-run.json`。
3. **Page Worker (单页撰写)**：针对人物志、宗门、战力、伏笔等词条，每次启动一个全新无记忆污染的 Agent，沙箱限制仅能写入分配的页面，并强制调用 `submit_lore_page` 提交带原文行号引用的设定。

## 3. 关键目录结构
novel-wiki/
├── chapters/              # 原始小说正文文本 (如 vol01/ch001.txt)
├── ledger/                # 阶段1提取的轻量章节账本 (ch001.json...)
├── wiki/                  # 生成的最终 Markdown 词条设定集
│   ├── characters/        # 人物志
│   ├── factions/          # 势力与门派
│   ├── systems/           # 战力境界与功法体系
│   └── plot/              # 剧情伏笔与重大时间线
├── .novel-run.json        # 持久化状态机（当前阶段、页面队列与处理状态）
└── src/                   # 核心 TypeScript 源码
    ├── types.ts           # 核心数据模型与状态机类型
    ├── state.ts           # 持久化状态机的读写与流转
    ├── planner/           # 规划器 Agent
    ├── worker/            # 单页沙箱 Worker
    └── runner.ts          # 总调度与断点恢复状态机

## 4. 给开发 Agent 的行为守则 (Agent Rules)
1. **One Fresh Agent Per Page**：严禁在一个长会话中一次性写完所有文档，每个 Wiki 页面必须通过全新的隔离上下文编写。
2. **Action-as-Completion**：模型结束任务的唯一标志是成功调用对应的提交工具（`submit_novel_plan` 或 `submit_lore_page`），禁止仅靠文字输出直接结束。
3. **No Unanchored Facts**：所有写入 Wiki 的设定陈述，必须伴随原著行级证据引用（格式如：`novel://vol01/ch015.txt#L40-L60`）。
4. **Durable State First**：所有状态变更优先记录至 `.novel-run.json`，确保进程随时崩溃随时可精准恢复。