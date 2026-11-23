(function () {
  'use strict';
  if (window.__fnaioQuote) return;
  window.__fnaioQuote = true;

  var surface = function () { return document.querySelector('[data-text-interaction-surface]'); };
  var sourceOf = function (node) {
    var element = node && node.nodeType === 1 ? node : (node ? node.parentElement : null);
    return element ? element.closest('[data-text-interaction-source]') : null;
  };
  var selected = function () {
    var sel = window.getSelection();
    if (sel === null || sel.isCollapsed || sel.rangeCount !== 1) return null;
    var range = sel.getRangeAt(0);
    var start = sourceOf(range.startContainer);
    if (start === null || start !== sourceOf(range.endContainer)) return null;
    var el = surface();
    if (el === null || el.parentElement === null || !el.parentElement.contains(start)) return null;
    if (range.toString().trim() === '') return null;
    return { range: range, selection: sel };
  };
  var active = function () {
    var el = surface();
    if (el === null || el.querySelector('button') === null) return false;
    var style = window.getComputedStyle(el);
    return style.visibility !== 'hidden' && style.display !== 'none';
  };
  var same = function (a, b) {
    return a !== null && b !== null && a.startContainer === b.startContainer
      && a.startOffset === b.startOffset && a.endContainer === b.endContainer && a.endOffset === b.endOffset;
  };

  var synthetic = false;
  var dispatch = function (target, event) {
    synthetic = true;
    try { target.dispatchEvent(event); } finally { synthetic = false; }
  };
  var dispatchSelection = function () { dispatch(document, new Event('selectionchange')); };

  var lastDown = 0;
  var lastNudge = 0;
  var suppressed = null;
  var attempts = 0;
  var lastRange = null;
  var poll = 0;

  var stopPoll = function () {
    if (poll !== 0) { window.clearInterval(poll); poll = 0; }
  };
  var ensurePoll = function () {
    if (poll !== 0) return;
    poll = window.setInterval(function () {
      if (selected() === null) { stopPoll(); return; }
      check();
    }, 650);
  };

  var forceShow = function () {
    var info = selected();
    if (info === null || active()) return;
    var now = performance.now();
    if (now - lastNudge < 500) return;
    lastNudge = now;
    var range = info.range;
    var sel = info.selection;
    try {
      var target = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement;
      if (target !== null && typeof PointerEvent !== 'undefined') {
        var base = { bubbles: true, cancelable: true, composed: true, pointerType: 'touch', isPrimary: true };
        dispatch(target, new PointerEvent('pointerdown', Object.assign({ button: 0, buttons: 1 }, base)));
        dispatch(document, new PointerEvent('pointerup', Object.assign({ button: 0, buttons: 0 }, base)));
      }
    } catch (error) { }
    var nudged = null;
    try {
      if (range.endContainer.nodeType === 3 && range.endOffset < range.endContainer.data.length) {
        nudged = range.cloneRange();
        nudged.setEnd(range.endContainer, range.endOffset + 1);
      } else if (range.startContainer.nodeType === 3 && range.startOffset > 0) {
        nudged = range.cloneRange();
        nudged.setStart(range.startContainer, range.startOffset - 1);
      }
    } catch (error) { nudged = null; }
    try {
      if (nudged !== null) {
        sel.removeAllRanges();
        sel.addRange(nudged);
        dispatchSelection();
      } else {
        sel.collapseToEnd();
        dispatchSelection();
      }
    } catch (error) { }
    try {
      sel.removeAllRanges();
      sel.addRange(range);
      dispatchSelection();
    } catch (error) { }
  };

  var check = function () {
    if (performance.now() - lastDown < 450) return;
    var info = selected();
    if (info === null || active()) return;
    if (suppressed !== null && same(suppressed, info.range)) return;
    if (attempts >= 3) return;
    attempts++;
    forceShow();
  };
  var later = function (delay) { window.setTimeout(check, delay); };

  document.addEventListener('selectionchange', function () {
    if (synthetic) return;
    var info = selected();
    if (info === null) {
      attempts = 0;
      lastRange = null;
      stopPoll();
      return;
    }
    if (lastRange !== null && !same(lastRange, info.range) && performance.now() - lastNudge > 900) {
      attempts = 0;
      suppressed = null;
    }
    lastRange = info.range.cloneRange();
    ensurePoll();
    later(360);
  }, true);

  document.addEventListener('pointerdown', function (event) {
    if (synthetic) return;
    lastDown = performance.now();
    attempts = 0;
    var el = surface();
    if (el !== null && el.contains(event.target)) return;
    if (active()) {
      var info = selected();
      suppressed = info === null ? null : info.range.cloneRange();
      stopPoll();
    }
  }, true);

  document.addEventListener('pointerup', function () { if (!synthetic) later(140); }, true);
  document.addEventListener('touchend', function () { if (!synthetic) later(140); }, true);
  document.addEventListener('pointercancel', function (event) {
    if (!synthetic) {
      if (active() && selected() !== null) event.stopImmediatePropagation();
      later(140);
    }
  }, true);
  document.addEventListener('contextmenu', function (event) {
    if (!synthetic) {
      if (active() && selected() !== null) event.stopImmediatePropagation();
      later(140);
    }
  }, true);
  window.addEventListener('blur', function (event) {
    if (!synthetic) {
      if (active() && selected() !== null) event.stopImmediatePropagation();
      later(160);
    }
  }, true);
})();
