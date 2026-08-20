/* Prevent chat message flashes while Firestore re-renders the message list. */
(() => {
  const innerHTMLDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML");
  const originalAppendChild = Node.prototype.appendChild;
  const states = new WeakMap();

  if (!innerHTMLDescriptor || !innerHTMLDescriptor.get || !innerHTMLDescriptor.set) return;

  function getState(el) {
    let state = states.get(el);
    if (!state) {
      state = { pending: false, fragment: null, typingIndicator: null, restoreScheduled: false };
      states.set(el, state);
    }
    return state;
  }

  function finishRender(el, state) {
    if (!state.pending) return;
    state.restoreScheduled = false;

    const wasNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    const oldTyping = el.querySelector("#typingIndicator");

    while (el.firstChild) el.removeChild(el.firstChild);
    originalAppendChild.call(el, state.fragment);

    // Keep the typing indicator alive; app.js currently clears it during a render.
    if (oldTyping) originalAppendChild.call(el, oldTyping);

    state.pending = false;
    state.fragment = null;

    requestAnimationFrame(() => {
      if (wasNearBottom) el.scrollTop = el.scrollHeight;
    });
  }

  Object.defineProperty(Element.prototype, "innerHTML", {
    configurable: innerHTMLDescriptor.configurable,
    enumerable: innerHTMLDescriptor.enumerable,
    get: innerHTMLDescriptor.get,
    set(value) {
      if (this.id === "messages" && value === "") {
        const state = getState(this);

        // Start an atomic render. Keep the old messages visible until all new
        // message nodes have been appended by app.js in the same task.
        state.pending = true;
        state.fragment = document.createDocumentFragment();
        state.typingIndicator = this.querySelector("#typingIndicator");

        if (!state.restoreScheduled) {
          state.restoreScheduled = true;
          queueMicrotask(() => finishRender(this, state));
        }
        return;
      }

      innerHTMLDescriptor.set.call(this, value);
    }
  });

  Node.prototype.appendChild = function(node) {
    if (this.nodeType === Node.ELEMENT_NODE && this.id === "messages") {
      const state = states.get(this);
      if (state?.pending && state.fragment && node !== state.typingIndicator) {
        state.fragment.appendChild(node);
        return node;
      }
    }
    return originalAppendChild.call(this, node);
  };
})();
