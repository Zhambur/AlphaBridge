# AlphaBridge

alphaXiv 本地浏览器插件（v0.5.1）：HTML 双语阅读、AI 问答、划词批注直写 Obsidian。单包即用，无需 Python 或本地桥接。

仓库：[https://github.com/Zhambur/AlphaBridge](https://github.com/Zhambur/AlphaBridge)

## 安装

1. 从 [Releases](https://github.com/Zhambur/AlphaBridge/releases/latest) 下载 ZIP，解压到固定目录。
2. 打开 `edge://extensions` 或 `chrome://extensions` → 开启「开发人员模式」→ 加载 `extension` 目录。
3. 设置页填入接口地址、模型名和 API Key（问答需支持 `tools` / `tool_choice`），保存并允许访问该域名。
4. 点击「选择仓库并授权」，选中含 `.obsidian` 的根目录（可选填子目录，如 `Reading/Papers`）并保存。
5. 刷新 alphaXiv 论文页，点右下角「双语原文」开始使用。

> 目录权限需经浏览器弹窗授权（失效时重授即可）；更新后需先重载扩展再刷新页面。Windows Edge 已全流程实测，Chrome 待完整验证。详见 [SETUP.md](SETUP.md)。

## 使用

- **双语阅读**：拉取 arXiv/ar5iv HTML 原文插译，保留公式、表格、脚注与引用；译文本地缓存（换模型/接口/语言会重算）。配图错位时可用内置 PDF.js 抓 PDF 原图替换，支持翻页、拖框/百分比微调裁剪及切回 HTML。
- **批注进 Obsidian**：划词点「批注」，右侧抽屉保存后写入 `AlphaBridge-论文编号.md`（宽屏正文自动让位，支持草稿恢复）。同条摘录防重，重新划词会追加；原页划词可存但刷新不保证恢复高亮。
- **问 AI**：点右上角「问 AI」开抽屉，划词自动带入为引用。模型按需调工具读取摘要、目录与分段，并标注实际读取的段落；聊天记录刷新即清空。

## 限制

- 依赖 HTML 源（非 PDF 逐页翻译），无 HTML 源不可用；图内文字、表格、参考文献及公式不翻译。
- AI 不预送全文、不看图片像素；取文失败或接口不支持工具调用会报错。
- 原生 PDF 页划词依赖文本层，扫描件或纯图通常选不上。

## 开发

```bash
npm ci          # 安装开发依赖
npm test        # 运行测试（默认 Edge，可用 AB_BROWSER_PATH / AB_BROWSER_CHANNEL 指定）
npm run package # 打包单一 ZIP，并校验无个人路径或本机配置混入
```

测试写入浏览器隔离存储，不触碰真实笔记（系统目录弹窗需手动授权）。本机默认值可写进 `extension/local-defaults.json`（不入 Git 和发布包）；版式回归测试见 [tests/README.md](tests/README.md)。

## 第三方声明

内置 PDF.js 5.4.624、Marked 15.0.12、DOMPurify 3.4.17（许可证见 [PDF.js LICENSE](extension/vendor/pdfjs/LICENSE)、[marked-LICENSE.md](extension/vendor/marked-LICENSE.md)、[DOMPurify-LICENSE](extension/vendor/DOMPurify-LICENSE)）；排版使用 arXiv/ar5iv CSS 与 STIX Two Math 字体。论文原文与图表版权归原作者所有，插件仅本地拉取供个人阅读。
