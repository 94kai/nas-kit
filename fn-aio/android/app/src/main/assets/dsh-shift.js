(function () {
  'use strict';
  if (window.__fnaioShift) return;
  window.__fnaioShift = true;

  var SHIFT = 96;
  var frame = 0;

  function surface() {
    return document.querySelector('[data-text-interaction-surface]');
  }

  function selectionBox() {
    var selection = window.getSelection();
    if (selection === null || selection.isCollapsed || selection.rangeCount !== 1) return null;
    var range = selection.getRangeAt(0);
    var start = range.startContainer;
    var end = range.endContainer;
    var startElement = start.nodeType === 1 ? start : start.parentElement;
    var endElement = end.nodeType === 1 ? end : end.parentElement;
    if (startElement === null || endElement === null) return null;
    if (startElement.closest('[data-text-interaction-source]') === null
      || startElement.closest('[data-text-interaction-source]') !== endElement.closest('[data-text-interaction-source]')) return null;
    var box = range.getBoundingClientRect();
    return box.height === 0 ? null : box;
  }

  function place() {
    frame = 0;
    var el = surface();
    if (el === null) return;
    var box = selectionBox();
    if (box === null) {
      el.style.transform = '';
      el.__fnaioShift = 0;
      return;
    }
    if (el.offsetHeight === 0 || el.offsetParent === null) return;
    var parent = el.offsetParent;
    var top = parent.getBoundingClientRect().top + parent.clientTop + el.offsetTop;
    var bottom = top + el.offsetHeight;
    var scroll = null;
    for (var node = el.parentElement; node !== null; node = node.parentElement) {
      if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(node).overflowY)) {
        scroll = node.getBoundingClientRect();
        break;
      }
    }
    var roomAbove = top - (scroll === null ? 0 : scroll.top);
    var shift = bottom <= box.top + 6
      ? (roomAbove >= SHIFT + 6 ? -SHIFT : SHIFT)
      : top >= box.bottom - 6 ? SHIFT : 0;
    var previous = el.__fnaioShift || 0;
    if (shift === previous) return;
    el.__fnaioShift = shift;
    el.style.transform = shift === 0 ? '' : 'translateY(' + shift + 'px)';
  }

  function schedule() {
    if (frame === 0) frame = requestAnimationFrame(place);
  }

  document.addEventListener('selectionchange', schedule, true);
  document.addEventListener('pointerup', schedule, true);
  document.addEventListener('touchend', schedule, true);
  window.addEventListener('resize', schedule);
  schedule();
})();
