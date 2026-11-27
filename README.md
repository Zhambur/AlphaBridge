# AlphaBridge

这是一个给 alphaXiv 用的本地浏览器插件（0.5.0），点开论文就能切到带公式和图表的双语阅读页，边读边用模型问论文，还能把划词批注存进 Obsidian。代码仓库在 https://github.com/Zhambur/AlphaBridge 。

## 安装

从 [Releases](https://github.com/Zhambur/AlphaBridge/releases/latest) 下载完整 ZIP，解压到固定目录。一个包就包含阅读、问答、笔记写入和 PDF 裁剪，不需要 Python 或本机桥接。

1. 打开 `edge://extensions` 或 `chrome://extensions`，开启“开发人员模式”，选择“加载解压缩的扩展程序”，加载解压后的 `extension` 文件夹。
2. 打开插件设置，填写模型接口地址、模型名和 API Key，保存并允许浏览器访问该接口。问答要求接口支持 `tools` 和 `tool_choice`。
3. 在设置页点“选择仓库并授权”，选择包含 `.obsidian` 的 Obsidian 仓库根目录。可填写笔记子目录，例如 `Reading/Papers`；留空则写入仓库根目录。修改后保存设置。
4. 刷新 alphaXiv 论文页，点右下角“双语原文”开始阅读。更新插件后先在扩展管理页重新加载，再刷新论文页。

模型、目录和密钥均由用户设置。目录需要通过浏览器选择并授权，输入路径本身不会授予访问权限。权限失效时在设置页重新授权即可。Windows Edge 已实测，Chrome 尚未完成全流程实测。详见 [SETUP.md](SETUP.md)。

## 使用

点论文页右下角“双语原文”，插件会抓 arXiv 或 ar5iv 的 HTML，在原句下面插中文译文，公式、表格、脚注和引用都留着。译文会缓存，换模型、地址或语言会另算；如果图容易错位，可用插件内置的 PDF.js 获取 PDF 原图替换，点“调整裁剪”能换页、拖框或输百分比改边界，也能切回 HTML。

划词时只冒出一个小“批注”按钮，点开后在右侧写内容并主动点保存，才会写进 `AlphaBridge-论文编号.md`；宽屏下双语阅读页正文会给抽屉让位，点正文、按 `Esc` 或点收起都会关掉，草稿能恢复或丢弃。重复保存同一条摘录不会重加，但重新划同样的字新建另一条还是会追加；原页面划词也能存，不过刷新后临时高亮不保证还能恢复。

点右上角“问 AI”开抽屉，划词会自动变成待发引用，取消划词就去掉。发问后模型自己调工具按 arXiv 编号翻摘要、目录和分段，读了哪几段下面会标出来，刷新页面聊天就没了。

## 限制

双语靠的是 HTML，不是对 PDF 逐页像素翻译；没 HTML 源就没法双语读，图里的字、表格格子、参考文献和公式都不会翻。问答不预送全文，也不看图片像素，回答时不一定读完了整篇；取文失败或接口不支持工具调用时会报错。在 alphaXiv 的 PDF 页面划词需要文本层，扫描件或纯图往往选不上。

## 开发

运行 `npm ci` 安装开发依赖，`npm test` 验证独立文件写入、PDF 渲染和原页面批注。测试默认使用 Edge，也可通过 `AB_BROWSER_PATH` 指定浏览器程序，或用 `AB_BROWSER_CHANNEL` 指定已安装的 Chrome/Edge 通道。测试文件写入浏览器隔离存储，不触碰真实笔记；系统目录选择窗口需手动授权。

`npm run package` 生成单一完整 ZIP，并检查个人路径和本机配置是否混入。`extension/local-defaults.json` 可用于本机默认值，不进入 Git 和发布包。历史论文版式回归脚本使用另行准备的论文素材，见 [tests/README.md](tests/README.md)。

## 第三方声明

- PDF.js 5.4.624：插件内的 PDF 渲染组件，许可证见 [PDF.js LICENSE](extension/vendor/pdfjs/LICENSE)。
- Marked 15.0.12：本地打包的 Markdown 解析器，许可证见 [marked-LICENSE.md](extension/vendor/marked-LICENSE.md)。
- DOMPurify 3.4.17：清理远端 HTML 用，许可证见 [DOMPurify-LICENSE](extension/vendor/DOMPurify-LICENSE)。
- arXiv HTML / ar5iv 样式（`ar5iv.0.9.1.min.css`、`arxiv-html-papers-theme-20260807.css`）与 STIX Two Math 字体来自 arXiv，用于还原论文排版与 MathML 显示。

论文原文与图表归原作者所有，插件仅在本地拉取供个人阅读。
