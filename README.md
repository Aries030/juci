# 剧词

用你在看的剧背雅思单词。线上地址：https://aries030.github.io/juci/

- React 19 + Vite + Tailwind CSS v4
- 组件来自 [coss ui](https://coss.com/ui)（基于 Base UI），放在 `src/components/ui/`
- 图标：[Reicon](https://reicon.dev)
- 推送到 `main` 后由 GitHub Actions 自动构建并发布到 GitHub Pages（`.github/workflows/deploy.yml`）

```bash
npm install
npm run dev
```

词库在 `src/data/shows.ts`。Clarkson's Farm 的例句是剧中原句并标注季/集；学习进度按词的顺序保存在浏览器里，新增词请加在末尾。
