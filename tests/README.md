# Tests

`npm ci` followed by `npm test` runs self-contained checks. An installed Edge is the default. Set `AB_BROWSER_PATH` to a browser executable, or `AB_BROWSER_CHANNEL` to an installed channel such as `chrome` or `msedge`. Profiles and screenshots stay under `work/`.

`standalone.cjs` generates a synthetic PDF in memory, uses actual PDF.js rendering, and tests file append/idempotence with real origin-private filesystem handles. It does not automate or bypass the OS directory permission prompt and never writes to a real Obsidian vault.

Additional historical layout tests require downloaded public-paper fixtures: `work/attention.html` (1706.03762v7), `work/embodied.html` (2610.22471v2, check the specific script input), and `work/hexashell.html` / `work/hexashell.pdf` (2610.23479v3). Those external paper files are not distributed in this repository. `AB_TEST_PDF` can override the PDF path in pdf-browser.cjs; `AB_TEST_OUTPUT` overrides screenshots. Inspect each script for its exact fixture filename before running it. No personal machine paths are required.
