/* Model Markdown is untrusted. Sanitize before inserting into the reader. */
globalThis.ABChatMarkdown = (() => {
  function render(target, text) {
    const parsed = marked.parse(text, {gfm: true, breaks: true, async: false});
    const fragment = DOMPurify.sanitize(parsed, {
      RETURN_DOM_FRAGMENT: true,
      ALLOWED_TAGS: ['p','br','hr','h1','h2','h3','h4','h5','h6','strong','em','del','blockquote','ul','ol','li','pre','code','a','table','thead','tbody','tr','th','td'],
      ALLOWED_ATTR: ['href','title','start','colspan','rowspan','align'],
      ALLOW_DATA_ATTR: false, ALLOW_ARIA_ATTR: false
    });
    for (const link of fragment.querySelectorAll('a')) {
      const href = link.getAttribute('href') || '';
      if (!/^(https?:\/\/|mailto:)/i.test(href)) link.removeAttribute('href');
      else { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
    }
    for (const table of fragment.querySelectorAll('table')) {
      const wrapper = document.createElement('div');
      wrapper.className = 'chat-table-scroll'; wrapper.tabIndex = 0;
      wrapper.setAttribute('role','region'); wrapper.setAttribute('aria-label','回答中的表格');
      table.replaceWith(wrapper); wrapper.append(table);
    }
    target.classList.add('chat-markdown'); target.replaceChildren(fragment);
  }
  return {render};
})();
