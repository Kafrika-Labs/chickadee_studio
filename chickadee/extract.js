// Evaluated independently in every frame, including cross-origin frames.
({limit = 20000, textLimit = 20000, contentSelector = null} = {}) => {
  const ignored = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'HEAD', 'TITLE', 'TEXTAREA']);
  const blockTags = new Set(['BODY','DIV','P','ARTICLE','SECTION','MAIN','HEADER','FOOTER','NAV','ASIDE',
    'H1','H2','H3','H4','H5','H6','LI','UL','OL','TABLE','TR','TD','TH','FORM','FIGURE','PRE','BLOCKQUOTE','BR','HR']);
  const all = [...document.querySelectorAll('body, body *')];
  const ids = new Map(all.map((e, i) => [e, i]));
  const styleCache = new WeakMap();
  const appearanceCache = new WeakMap();
  const selectorCache = new WeakMap();
  const contentRoots = contentSelector ? [...document.querySelectorAll(contentSelector)] : null;
  const style = e => {
    if (!styleCache.has(e)) styleCache.set(e, getComputedStyle(e));
    return styleCache.get(e);
  };
  function selector(el, frame = false) {
    if (!frame && selectorCache.has(el)) return selectorCache.get(el);
    const parts = [];
    for (let node = el; node; node = node.parentElement) {
      let part = CSS.escape(node.tagName.toLowerCase());
      const classes = [...node.classList].map(c => '.' + CSS.escape(c)).join('');
      part += classes;
      const siblings = node.parentElement ? [...node.parentElement.children].filter(n => n.tagName === node.tagName) : [node];
      if (!classes || siblings.filter(n => n.matches(part)).length > 1) {
        part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
      }
      parts.unshift(part);
      const path = parts.join(' > ');
      if (document.querySelectorAll(path).length === 1) break;
    }
    let path = parts.join(' > ');
    if (!frame) selectorCache.set(el, path);
    if (frame && el.hasAttribute('src')) {
      // Absolute src keeps frame locations consistent; nth-of-type disambiguates
      // duplicate frames. Resolve relative attributes before replaying this.
      path += `[src=${JSON.stringify(el.src)}]`;
    }
    return path;
  }
  function rgba(value) {
    const match = value.match(/^rgba?\(([^)]+)\)$/);
    if (!match) return null;
    const values = match[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return values.length === 3 ? [...values, 1] : values;
  }
  function appearance(el) {
    if (appearanceCache.has(el)) return appearanceCache.get(el);
    const cs = style(el);
    let alpha = 1, hidden = false, clipped = false, fixed = false;
    const hidingAncestors = [];
    for (let parent = el; parent; parent = parent.parentElement) {
      const ps = style(parent);
      alpha *= Number(ps.opacity);
      hidden ||= ps.display === 'none';
      fixed ||= ps.position === 'fixed';
      const pr = parent.getBoundingClientRect();
      const tinyClip = (['hidden', 'clip'].includes(ps.overflowX) && pr.width <= 1) ||
        (['hidden', 'clip'].includes(ps.overflowY) && pr.height <= 1);
      clipped ||= tinyClip;
      if (hidingAncestors.length < 20 && (ps.display === 'none' || Number(ps.opacity) < 1 || tinyClip)) {
        hidingAncestors.push({location: selector(parent), display: ps.display, opacity: ps.opacity,
          width: ps.width, height: ps.height, overflow_x: ps.overflowX, overflow_y: ps.overflowY});
      }
    }
    const color = rgba(cs.color);
    let background = [255, 255, 255, 1], imageBackground = false;
    for (let parent = el; parent; parent = parent.parentElement) {
      imageBackground ||= style(parent).backgroundImage !== 'none';
      const bg = rgba(style(parent).backgroundColor);
      if (bg && bg[3] >= 0.99) { background = bg; break; }
    }
    const sameColor = !imageBackground && color && color[3] > 0.99 && color.slice(0, 3).every((v, i) => Math.abs(v - background[i]) < 1);
    const transparent = alpha <= 0.01 || (color && color[3] <= 0.01) || !!sameColor;
    const rect = el.getBoundingClientRect();
    // Scrolling puts normal content above the viewport. Compare non-fixed
    // elements with the document origin so this is not an evasion signal.
    const dx = fixed ? 0 : scrollX, dy = fixed ? 0 : scrollY;
    const outside = (rect.width > 0 || rect.height > 0) && (rect.right + dx <= 0 || rect.bottom + dy <= 0 ||
      (['absolute', 'fixed'].includes(cs.position) && rect.left + dx > innerWidth + 2000) ||
      (fixed && rect.top > innerHeight + 2000));
    const offscreen = hidden || clipped || ['hidden', 'collapse'].includes(cs.visibility) || parseFloat(cs.fontSize) <= 1 || outside;
    const reasons = [];
    if (alpha <= .01) reasons.push('요소/조상 opacity <= 0.01');
    if (color && color[3] <= .01) reasons.push('글자색 alpha <= 0.01');
    if (sameColor) reasons.push('단색 배경과 글자색 일치');
    if (hidden) reasons.push('요소/조상 display:none');
    if (clipped) reasons.push('요소/조상 0~1px 상자와 overflow:hidden/clip');
    if (['hidden', 'collapse'].includes(cs.visibility)) reasons.push('visibility:' + cs.visibility);
    if (parseFloat(cs.fontSize) <= 1) reasons.push('font-size <= 1px');
    if (outside) reasons.push('문서 원점 밖 또는 멀리 배치한 고정/절대 좌표');
    const result = {transparent: !!transparent, offscreen: !!offscreen, reasons,
      style: {color: cs.color, background: cs.backgroundColor, effective_opacity: alpha,
        font_size: cs.fontSize, display: cs.display, visibility: cs.visibility,
        position: cs.position, rect: {x:rect.x, y:rect.y, width:rect.width, height:rect.height},
        document_rect: {x:rect.x + scrollX, y:rect.y + scrollY, width:rect.width, height:rect.height},
        scroll: {x:scrollX, y:scrollY}, hiding_ancestors: hidingAncestors,
        viewport: {width:innerWidth, height:innerHeight}}};
    appearanceCache.set(el, result);
    return result;
  }
  const elements = [];
  const commentScope = '[data-comment-id], [data-reply-id], [itemprop="comment"], .comment, .comment-item, .comment_item, .comment-contents, .reply, .reply-item, .reply_item';
  const contentScope = commentScope + ', [role="article"], article, [data-post-id]';
  // Common CMS article bodies are often divs, not semantic article elements.
  // Keep site-wide wrappers out: they also contain navigation and sharing UI.
  const articleBody = contentScope + ', [itemprop="articleBody"], .post-content, .entry-content, .board-content, .board-view-content, .view-content, .viewCont, .view-con, .view_cont, .ViewBoxContent, #boardcontentDs, #dataContentArea';
  const sourceRole = el => {
    if (el.closest(commentScope)) return 'comment';
    if (el.closest('.post-title,.board-title,.entry-title,.article-title,[data-role="title"],[itemprop="headline"]') ||
        (el.closest('h1') && el.closest('article,[role="article"],[data-post-id]'))) return 'title';
    return el.closest('h1,h2,h3,h4,h5,h6') ? 'heading' : 'body';
  };
  const isInterfaceImage = el => !!el.closest('nav,[role="navigation"],[role="search"],.logo,.brand,.site-logo,.brand-logo,.shareWrap,.share-wrap,.sns-share,.sns_share,[data-role="share"]') ||
    (!!el.closest('header,footer') && !el.closest(articleBody)) ||
    el.getAttribute('aria-hidden') === 'true' || el.getAttribute('role') === 'presentation' ||
    (!el.closest(contentScope) && !!el.closest('h1,h2,h3,h4,h5,h6') && el.getAttribute('alt') === '');
  // Build text from DOM text nodes, excluding executable/style source. Also
  // aggregate actual text-owner visibility: a white parent must not make a
  // black, explicitly styled child look like hidden text.
  const textInfo = new Map();
  for (const el of [...all].reverse()) {
    if (ignored.has(el.tagName)) { textInfo.set(el, {text: '', direct: '', breaks: [], count: 0, transparent: true, offscreen: true, reasons: []}); continue; }
    let text = '', direct = '';
    let count = 0, transparent = true, offscreen = true;
    const reasons = new Set();
    const breaks = new Set();
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) { text += node.textContent; direct += node.textContent; }
      else if (node.nodeType === Node.ELEMENT_NODE) {
        const child = textInfo.get(node);
        if (child) {
          const offset = text.length;
          const block = blockTags.has(node.tagName) || /^(block|flex|grid|table|list-item)/.test(style(node).display);
          if (block) breaks.add(offset);
          child.breaks.forEach(p => breaks.add(offset + p));
          text = (text + child.text).slice(0, textLimit + 1);
          if (block) breaks.add(text.length);
          count += child.count; transparent &&= child.transparent; offscreen &&= child.offscreen;
          child.reasons.forEach(r => reasons.add(r));
        }
      }
    }
    if (direct.trim()) {
      const own = appearance(el);
      count++; transparent &&= own.transparent; offscreen &&= own.offscreen;
      own.reasons.forEach(r => reasons.add(r));
    }
    textInfo.set(el, {text, direct, breaks:[...breaks].filter(p=>p>0 && p<text.length), count, transparent, offscreen, reasons:[...reasons]});
  }
  let truncated = false;
  for (const el of all) {
    if (ignored.has(el.tagName) || el.closest('script, style, noscript, template, textarea')) continue;
    if (contentRoots && !contentRoots.some(root => root === el || root.contains(el))) continue;
    const info = textInfo.get(el);
    const text = info.text;
    if (!text.trim()) continue;
    const direct = info.direct;
    if (text.length > textLimit) {
      if (direct.trim()) truncated = true;
      continue;
    }
    if (elements.length >= limit) { truncated = true; break; }
    const visibility = {transparent: info.count > 0 && info.transparent,
      offscreen: info.count > 0 && info.offscreen};
    const scope = el.closest(contentScope);
    const anchor = el.closest('a[href]');
    let relatedContentUrl = null;
    if (anchor) {
      try {
        const target = new URL(anchor.href);
        target.hash = '';
        if (/^https?:$/.test(target.protocol) && target.origin === location.origin && target.href !== location.href.split('#')[0]) relatedContentUrl = target.href;
      } catch (_) { /* Malformed links must not prevent text extraction. */ }
    }
    elements.push({node_id: ids.get(el), parent_id: ids.get(el.parentElement) ?? null,
      location: selector(el), text, direct_text: direct, reasons: info.reasons,
      text_breaks: info.breaks,
      content_scope: scope ? selector(scope) : null,
      source_role: sourceRole(el),
      nested_content_scopes: scope === el ? el.querySelectorAll(contentScope).length : 0,
      link_targets: [...new Set((scope === el ? [...el.querySelectorAll('a[href]')].slice(0, 20) :
        anchor ? [anchor] : []).map(a => a.href).filter(href => /^https?:/.test(href)))],
      related_content_url: relatedContentUrl,
      computed_style: appearance(el).style, ...visibility});
  }
  const links = new Set();
  let linksTruncated = false;
  function addLink(value) {
    if (!value || value.length > 8192) return;
    try {
      const url = new URL(value, document.baseURI);
      if (!['http:', 'https:'].includes(url.protocol)) return;
      url.hash = '';
      if (links.size >= limit && !links.has(url.href)) { linksTruncated = true; return; }
      links.add(url.href);
    } catch (_) { /* Invalid DOM link, no navigation or code execution. */ }
  }
  for (const el of document.querySelectorAll('a[href], [data-href], [data-url], [data-link], [onclick]')) {
    if (el.matches('a[href]')) addLink(el.getAttribute('href'));
    for (const attribute of ['data-href', 'data-url', 'data-link']) addLink(el.getAttribute(attribute));
    // Only literal location assignments/calls. Never evaluate onclick source,
    // guess route arguments, click a form, or invoke arbitrary functions.
    const handler = el.getAttribute('onclick') || '';
    const literal = handler.match(/^\s*(?:(?:window\.|document\.)?location(?:\.href)?\s*=\s*(['"])([^'"\\\r\n]+)\1|(?:window\.)?location\.(?:assign|replace)\(\s*(['"])([^'"\\\r\n]+)\3\s*\))\s*;?\s*(?:return\s+false\s*;?)?\s*$/);
    if (literal) addLink(literal[2] || literal[4]);
  }
  const images = [];
  const uniqueImageSources = new Set();
  let imageReferenceBytes = 0;
  let imagesTruncated = false;
  const imageContent = el => !!el.closest(articleBody);
  const imageElements = all.slice(0, 5000).sort((a, b) => Number(imageContent(b)) - Number(imageContent(a)));
  for (const el of imageElements) {
    if (contentRoots && !contentRoots.some(root => root === el || root.contains(el))) continue;
    const sources = el.tagName === 'IMG' ? [el.currentSrc || el.src || el.getAttribute('data-src')] : [];
    for (const match of style(el).backgroundImage.matchAll(/url\(["']?([^"')]+)["']?\)/g)) sources.push(match[1]);
    for (const src of sources) {
      if (!src) continue;
      if (src.length > 2800000 || images.length >= 500 ||
          (!uniqueImageSources.has(src) && uniqueImageSources.size >= 50) ||
          imageReferenceBytes + src.length > 6000000) { imagesTruncated = true; continue; }
      uniqueImageSources.add(src);
      imageReferenceBytes += src.length;
      const box = el.getBoundingClientRect();
      const inContent = imageContent(el);
      // UI sprites and small navigation icons are not content photographs.
      // Large banners and hidden/offscreen elements remain analysis targets.
      const visible = !appearance(el).transparent && !appearance(el).offscreen;
      const interfaceImage = !inContent && visible && box.width > 0 && box.height > 0 &&
        ((el.tagName !== 'IMG' && ['inline', 'inline-block'].includes(style(el).display) && Math.max(box.width, box.height) <= 96) ||
         (!!el.closest('nav, [role="navigation"], button, [role="button"]') && Math.max(box.width, box.height) <= 96) ||
         (el.tagName === 'IMG' && /^(?:.*\s)?(?:logo|로고)$/i.test(el.alt.trim()) && Math.max(box.width, box.height) <= 240));
      const interfaceRole = interfaceImage || isInterfaceImage(el) ||
        (el.tagName !== 'IMG' && !inContent && !el.closest('a[href]'));
      images.push({source_url: src, location: selector(el), computed_style: appearance(el).style,
        source_role: sourceRole(el),
        interface_image: interfaceRole,
        image_role: interfaceRole ? 'interface' : inContent ? 'content' : 'unspecified',
        transparent: appearance(el).transparent, offscreen: appearance(el).offscreen,
        link_targets: el.closest('a[href]') ? [el.closest('a[href]').href] : [],
        source_type: el.tagName === 'IMG' ? 'img' : 'background'});
    }
  }
  return {elements, images, images_truncated: imagesTruncated, truncated, links: [...links], links_truncated: linksTruncated,
    content_roots_matched: contentRoots ? contentRoots.length : null};
}
