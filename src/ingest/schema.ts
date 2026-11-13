// src/ingest/schema.ts
import { z } from "zod";

/**
 * 章节中出场或提及的角色信息
 */
export const LedgerCharacterSchema = z.object({
  name: z.string().trim().min(1, "角色名不能为空"),
  action: z.string().trim().min(1, "角色动态或行为简述不能为空"),
  statusChange: z.string().trim().optional(), // 如 "重伤濒死"、"道脉尽碎"、"死亡"
});

/**
 * 单章事实账本（Chapter Ledger）契约定义
 * chapter：章节序号

  
title：章节标题
summary：100字左右的核心剧情客观摘要
characters：登场人物、动作及状态演变（如“濒死”、“突破”、“被杀”）
factions：宗门、国家、世家等势力  
systems：修炼境界、道法功法、宝物、天地异象
significantEvents：重大剧情转折点  
foreshadowing：未解伏笔与线索
 */
export const ChapterLedgerSchema = z.object({
  chapter: z.number().int().positive("章节序号必须为正整数"),
  title: z.string().trim().min(1, "章节标题不能为空"),
  summary: z.string().trim().min(10, "本章核心剧情摘要不少于10字"),
  characters: z.array(LedgerCharacterSchema).default([]),
  factions: z.array(z.string().trim().min(1)).default([]),
  systems: z.array(z.string().trim().min(1)).default([]),
  significantEvents: z.array(z.string().trim().min(1)).default([]),
  foreshadowing: z.array(z.string().trim().min(1)).default([]),

  //为仿写和创作引擎预留的节拍与文风字段（可选）
  narrativeBeat: z.string().trim().optional(), //叙事节拍（如：蓄势、转折、决战、余韵）
  styleHighlights: z.array(z.string().trim()).default([]), //原著文风特色金句/比喻
});

export type LedgerCharacter = z.infer<typeof LedgerCharacterSchema>;
export type ChapterLedger = z.infer<typeof ChapterLedgerSchema>;

