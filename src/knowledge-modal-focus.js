import { useEffect } from 'react';

// The copied dialogs keep their existing actions; keyboard containment is local to this iframe.
export function useKnowledgeModalFocus() {
  useEffect(() => {
    let active = null, previous = null;
    const focusables = element => [...element.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]')].filter(node => node.getClientRects().length);
    const sync = () => {
      const next = [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].at(-1) || null;
      if (next === active) return;
      if (!next && previous?.isConnected) previous.focus();
      if (next) {
        window.parent.postMessage({ type:'knowledge-dialog-open' }, location.origin);
        if (!active) previous = document.activeElement;
        next.tabIndex = -1;
        if (!next.contains(document.activeElement)) (next.querySelector('[autofocus]') || focusables(next)[0] || next).focus();
      }
      active = next;
    };
    const key = event => {
      if (!active || event.key !== 'Tab') return;
      const nodes = focusables(active), first = nodes[0] || active, last = nodes.at(-1) || active;
      if (event.shiftKey && (document.activeElement === first || !active.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && (document.activeElement === last || !active.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    const observer = new MutationObserver(sync); observer.observe(document.body, { childList:true, subtree:true });
    document.addEventListener('keydown', key, true); sync();
    return () => { observer.disconnect(); document.removeEventListener('keydown', key, true); };
  }, []);
}
