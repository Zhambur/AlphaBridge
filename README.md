# AlphaBridge

一个给 alphaXiv 用的本地浏览器插件（v0.5.1）。打开论文可以直接切到带公式和图表的双语阅读页，边看边问 AI，顺手把划词批注直接写进本地 Obsidian 仓库。

代码仓库：[https://github.com/Zhambur/AlphaBridge](https://github.com/Zhambur/AlphaBridge)

## 安装与配置

从 [Releases](https://github.com/Zhambur/AlphaBridge/releases/latest) 下载最新的 ZIP 包，解压到一个**固定目录**（别放临时文件夹，删了插件就失效了）。阅读、问答、写笔记、PDF 裁剪全都在这一个包里，不需要装 Python，也不用跑本地桥接服务。

1. **加载插件**：打开 `edge://extensions` 或 `chrome://extensions`，打开右上角「开发人员模式」，点「加载解压缩的扩展程序」，选中解压出来的 `extension` 文件夹。
2. **配置模型**：打开插件设置页，填好接口地址、模型名和 API Key，保存并允许浏览器访问该域名。*注：问答功能依赖 Function Calling，接口必须支持 `tools` 和 `tool_choice`。*
3. **绑定 Obsidian**：在设置页点「选择仓库并授权」，选中包含 `.obsidian` 的仓库根目录。下面可以填个子目录（比如 `Reading/Papers`），留空就直接写进根目录。改完记得保存。
4. **开始使用**：刷新 alphaXiv 论文页，点右下角的「双语原文」即可。

> **几点说明**
>
> - 目录权限必须通过浏览器的弹窗手动授权，光填路径没用；如果哪天权限掉了，回设置页重新授权一下就行。
> - 更新插件后，记得先去扩展管理页点一下「重新加载」，再刷新论文页。
> - 目前在 Windows Edge 上跑通了全流程，Chrome 还没做完完整测试。更多配置细节见 [SETUP.md](SETUP.md)。

## 怎么用

### 双语阅读与图表裁剪

- 点论文页右下角「双语原文」，插件会自动拉取 arXiv / ar5iv 的 HTML 源码，在原句下方插入中文译文，保留原有的公式、表格、脚注和引用。
- 译文会在本地缓存；如果换了模型、接口地址或目标语言，会重新翻译。
- HTML 里的配图偶尔会错位，遇到这种情况可以直接调用内置的 PDF.js 抓 PDF 原图来替换。点「调整裁剪」支持翻页、拖框或输入百分比微调边界，不满意也能随时切回 HTML 原图。

### 划词批注进 Obsidian

- 划选文字时会弹出一个「批注」小按钮，点开在右侧抽屉里写完笔记，点保存就会写入 `AlphaBridge-论文编号.md`。
- 宽屏下正文会自动给右侧抽屉让位；点正文空白处、按 `Esc` 或点收起就能关掉，没保存的草稿可以恢复或丢弃。
- 同一条摘录重复点保存不会重复写入；但如果你重新划选同一段字新建批注，还是会追加一条。
- 在 alphaXiv 原页面也能划词存笔记，不过刷新后页面上的临时高亮不一定能恢复。

### 边读边问 AI

- 点右上角「问 AI」打开对话抽屉。划选文字会自动带入作为引用，取消划选就会自动移除。
- 提问后，模型会自己调工具按 arXiv 编号去查摘要、目录和具体段落，回答下方会标出它实际读了哪几段。
- 聊天记录只在当前页面有效，刷新就没了。

## 已知限制

- **依赖 HTML 源**：双语阅读是基于 HTML 做的，不是逐页翻译 PDF。如果论文没有对应的 HTML 源就没法用；另外图片里的字、表格内容、参考文献和公式都不会翻译。
- **按需读取**：AI 问答不会把全文一次性塞进上下文，也看不见图片内容，回答时未必读完了整篇论文。如果拉取正文失败，或者模型接口不支持工具调用，会直接报错。
- **PDF 划词限制**：在 alphaXiv 原生 PDF 页划词依赖文本层，遇到扫描件或纯图 PDF 通常选不上。

## 本地开发

```bash
# 安装开发依赖
npm ci

# 运行测试（覆盖独立文件写入、PDF 渲染和原页面批注）
npm test
```

- 测试默认调用 Edge，也可以通过环境变量 `AB_BROWSER_PATH` 指定浏览器路径，或用 `AB_BROWSER_CHANNEL` 指定已安装的 Chrome/Edge 通道。
- 测试文件只写进浏览器的隔离存储，不会动你的真实笔记；跑测试时弹出的系统目录选择窗口需要手动点授权。
- 运行 `npm run package` 会打包成单一 ZIP，并自动检查有没有混入个人路径或本机配置。
- 本机调试默认值可以写在 `extension/local-defaults.json` 里，这个文件不会进 Git 也不会进发布包。
- 历史论文版式回归测试需要另行准备素材，具体看 [tests/README.md](tests/README.md)。

## 第三方声明

- **PDF.js 5.4.624**：内置 PDF 渲染组件（许可证见 [PDF.js LICENSE](extension/vendor/pdfjs/LICENSE)）
- **Marked 15.0.12**：本地打包的 Markdown 解析器（许可证见 [marked-LICENSE.md](extension/vendor/marked-LICENSE.md)）
- **DOMPurify 3.4.17**：用于清理远端拉取的 HTML（许可证见 [DOMPurify-LICENSE](extension/vendor/DOMPurify-LICENSE)）
- **arXiv HTML / ar5iv 样式与字体**：使用 `ar5iv.0.9.1.min.css`、`arxiv-html-papers-theme-20260807.css` 及 STIX Two Math 字体还原论文排版与 MathML 显示。

论文原文与图表版权归原作者所有，本插件仅在本地拉取供个人阅读使用。
