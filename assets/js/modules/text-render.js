/* Safe span rendering and selection-to-offset conversion. Text is always escaped; labels are drawn with CSS ::after so the DOM text stays identical to the original. */
(function (A) {
  const esc = A.util.esc, PAL = ['#ea005a', '#ff7aa9', '#c9c9ce', '#8a8a90', '#ff1f78', '#b3004a', '#ffd0e1', '#6e6e73'];
  const color = (L, l) => PAL[Math.max(0, L.indexOf(l)) % PAL.length];
  function html(text, spans, L, active) {
    let out = '', pos = 0;
    spans.slice().sort((a, b) => a.start - b.start).forEach(s => { if (s.start < pos) return; out += esc(text.slice(pos, s.start)) + '<mark tabindex="0" data-id="' + esc(s.id) + '" data-l="' + esc(s.label) + '"' + (s.id === active ? ' class="act"' : '') + ' style="--c:' + color(L, s.label) + '">' + esc(text.slice(s.start, s.end)) + '</mark>'; pos = s.end; });
    return out + esc(text.slice(pos));
  }
  const offsetOf = (root, node, off) => { const r = document.createRange(); r.selectNodeContents(root); r.setEnd(node, off); return r.toString().length; };
  function selection(root) {
    const s = getSelection(); if (!s.rangeCount || s.isCollapsed) return null; const r = s.getRangeAt(0); if (!root.contains(r.startContainer) || !root.contains(r.endContainer)) return null;
    let a = offsetOf(root, r.startContainer, r.startOffset), b = offsetOf(root, r.endContainer, r.endOffset); const t = root.textContent;
    while (a < b && /\s/.test(t[a])) a++; while (b > a && /\s/.test(t[b - 1])) b--;
    return a < b ? { start: a, end: b, text: t.slice(a, b) } : null;
  }
  A.textui = { html, selection, color };
})(window.Alphex);
