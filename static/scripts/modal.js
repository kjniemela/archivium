if (!window.createElement) throw 'domUtils.js not loaded!';

(function() {
  const modals = {};
  const anchor = new Promise((resolve) => {
    window.addEventListener('load', () => {
      resolve(document.querySelector('#modal-anchor'));
    });
  });

  async function modal(id, children, show=false) {
    if (id in modals) removeModal(id);
    if (!(children instanceof Array)) children = [children];
    const newModal = createElement('div', { attrs: {
      id,
      onclick: () => hideModal(id),
    }, classList: ['modal', 'hidden'], children: [
      createElement('div', { classList: ['modal-content'], attrs: {onclick: (e) => e.stopPropagation()}, children }),
    ] });
    modals[id] = newModal;
    if (show) showModal(id);
    (await anchor).appendChild(newModal);
    return newModal;
  }

  function showModal(id) {
    modals[id].classList.remove('hidden');
  }

  function hideModal(id) {
    modals[id].classList.add('hidden');
  }

  function removeModal(id) {
    modals[id].remove();
  }

  async function loadModal(id, show=false) {
    const modalEl = document.getElementById(id);
    modalEl.classList.add('modal', 'hidden');
    modalEl.addEventListener('click', () => hideModal(id));
    const content = [...modalEl.children];
    replaceContent(id, content);
    modals[id] = modalEl;
    (await anchor).appendChild(modalEl);
    if (show) showModal(id);
    return modalEl;
  }

  function replaceContent(id, content) {
    console.log(id, content)
    const modalEl = document.getElementById(id);
    modalEl.innerHTML = '';
    if (!(content instanceof Array)) content = [content];
    modalEl.appendChild(createElement('div', { classList: ['modal-content'], attrs: {onclick: (e) => e.stopPropagation()}, children: content }));
  }

  window.modal = modal;
  window.showModal = showModal;
  window.hideModal = hideModal;
  window.removeModal = removeModal;
  window.loadModal = loadModal;
  window.replaceContent = replaceContent;
})();
