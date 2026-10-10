export const FILM_DURATION = 28000;
export const CHAPTERS = [
  "品牌发现",
  "内容理解",
  "引用洞察",
  "跨模型对比",
  "可见性评估",
];
export function chapterAt(seconds: number) {
  return seconds < 5
    ? 0
    : seconds < 10
      ? 1
      : seconds < 15
        ? 2
        : seconds < 20
          ? 3
          : 4;
}
