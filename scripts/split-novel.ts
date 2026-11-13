// scripts/split-novel.ts
import fs from "node:fs/promises";
import path from "node:path";

// 原书路径与输出目录
const SOURCE_FILE =
  "C:\\Users\\86152\\Desktop\\sublime\\书籍\\赤心巡天 (情何以堪) (Z-Library).txt";
const OUTPUT_DIR = path.join(process.cwd(), "chapters");

// 匹配章节标题，如：第一章 xxx、第一百二十三章 xxx、第10章 xxx
const CHAPTER_HEADING_RE = /^第[零一二三四五六七八九十百千万两\d]+章(?:\s+.*)?$/;
// 匹配分卷/章节间的分隔线
const SEPARATOR_RE = /^-{6,}$/;

interface TocEntry {
  index: number;
  volume: string;
  title: string;
  file: string;
  charCount: number;
}

async function splitNovel() {
  console.log("📖 正在读取原著文件...");
  const raw = await fs.readFile(SOURCE_FILE, "utf-8");
  const lines = raw.split(/\r?\n/);

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const toc: TocEntry[] = [];
  let currentVolume = "未分卷";
  let currentTitle = "";
  let currentLines: string[] = [];
  let chapterIndex = 0;

  // 将当前缓存的章节写入磁盘
  const flushChapter = async () => {
    if (!currentTitle) return;

    // 去除末尾多余的分隔线与空行
    while (
      currentLines.length > 0 &&
      (currentLines[currentLines.length - 1].trim() === "" ||
        SEPARATOR_RE.test(currentLines[currentLines.length - 1].trim()))
    ) {
      currentLines.pop();
    }

    chapterIndex++;
    const fileName = `ch${String(chapterIndex).padStart(3, "0")}.txt`;
    const content = [currentTitle, "", ...currentLines].join("\n");

    await fs.writeFile(path.join(OUTPUT_DIR, fileName), content, "utf-8");
    toc.push({
      index: chapterIndex,
      volume: currentVolume,
      title: currentTitle,
      file: fileName,
      charCount: content.length,
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    // 1. 识别卷名：形如 "------------" -> 空行 -> "卷名" -> 空行 -> "------------"
    if (SEPARATOR_RE.test(trimmed)) {
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === "") j++;
      if (j < lines.length && !CHAPTER_HEADING_RE.test(lines[j].trim())) {
        let k = j + 1;
        while (k < lines.length && lines[k].trim() === "") k++;
        if (k < lines.length && SEPARATOR_RE.test(lines[k].trim())) {
          await flushChapter();
          currentTitle = "";
          currentLines = [];
          currentVolume = lines[j].trim();
          i = k;
          continue;
        }
      }
      continue;
    }

    // 2. 识别新章节标题
    if (CHAPTER_HEADING_RE.test(trimmed)) {
      await flushChapter();
      currentTitle = trimmed;
      currentLines = [];
      continue;
    }

    // 3. 累积正文内容
    if (currentTitle) {
      currentLines.push(lines[i]);
    }
  }

  // 落盘最后一章
  await flushChapter();

  // 写入总目录索引 toc.json
  await fs.writeFile(
    path.join(OUTPUT_DIR, "toc.json"),
    JSON.stringify(toc, null, 2),
    "utf-8"
  );

  console.log(`🎉 切分完成！共切分出 ${toc.length} 章，已全部保存至 chapters/ 目录。`);
  console.log(`📑 目录索引已生成：chapters/toc.json`);
}

splitNovel().catch((err) => {
  console.error("❌ 切分失败:", err);
});

