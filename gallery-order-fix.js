(() => {
  "use strict";

  let galleryOrderSaving = false;
  let pendingRemoteGallery = null;

  const originalApplyRemoteGallery = applyRemoteGallery;
  const originalRenderAdminGallery = renderAdminGallery;

  function normalizeLocalOrder() {
    state.gallery.forEach((item, index) => {
      item.order = index;
    });
  }

  function cloneOrder() {
    return state.gallery.map((item, index) => ({
      ...item,
      order: index
    }));
  }

  function injectGalleryOrderStyles() {
    if (document.getElementById("galleryOrderFixStyles")) return;

    const style = document.createElement("style");
    style.id = "galleryOrderFixStyles";
    style.textContent = `
      .gallery-order-guide{
        margin:0 0 14px;
        padding:12px 14px;
        border:1px solid var(--line);
        border-radius:14px;
        background:var(--surface2);
        color:var(--muted);
        font-size:12px;
        line-height:1.45
      }
      .gallery-order-guide strong{color:var(--text)}
      .gallery-position-control{
        display:flex;
        align-items:center;
        gap:7px;
        font-size:11px;
        color:var(--muted);
        font-weight:800
      }
      .gallery-position-control select{
        min-width:74px;
        border:1px solid var(--line);
        background:var(--surface2);
        color:var(--text);
        border-radius:10px;
        padding:7px 9px;
        outline:none
      }
      .gallery-order-saving{
        opacity:.68;
        pointer-events:none
      }
      .gallery-save-badge{
        display:inline-flex;
        align-items:center;
        gap:6px;
        margin-left:7px;
        font-size:10px;
        font-weight:850;
        color:var(--green)
      }
      .sortable-gallery-item .drag-hint{display:none!important}
      @media(max-width:760px){
        .gallery-order-actions{
          display:grid!important;
          grid-template-columns:1fr 1fr;
          width:100%;
          gap:8px!important
        }
        .gallery-position-control{
          grid-column:1/-1;
          justify-content:space-between;
          width:100%
        }
        .gallery-position-control select{min-width:110px}
        .gallery-order-actions .btn{
          width:100%;
          min-height:42px
        }
      }
    `;
    document.head.appendChild(style);
  }

  applyRemoteGallery = function(value) {
    if (galleryOrderSaving) {
      pendingRemoteGallery = value;
      return;
    }
    originalApplyRemoteGallery(value);
  };

  async function saveCurrentGalleryOrder(message) {
    if (galleryOrderSaving) return false;
    if (!currentAdminUser) {
      toast("Entre como administrador para reorganizar a galeria.");
      return false;
    }

    normalizeLocalOrder();
    const snapshot = cloneOrder();

    galleryOrderSaving = true;
    saveState();
    renderGallery();
    renderAdminGallery();

    try {
      await firebaseApi().saveGalleryOrder(snapshot);
      if (message) toast(message);
      return true;
    } catch (error) {
      console.error("Salvar ordem da galeria:", error);
      toast("Não foi possível salvar a nova ordem. Tente novamente.");
      return false;
    } finally {
      galleryOrderSaving = false;

      if (pendingRemoteGallery !== null) {
        const value = pendingRemoteGallery;
        pendingRemoteGallery = null;
        originalApplyRemoteGallery(value);
      } else {
        renderGallery();
        renderAdminGallery();
      }
    }
  }

  persistGallery = saveCurrentGalleryOrder;

  moveGalleryPhoto = async function(id, direction) {
    if (galleryOrderSaving) return;

    const index = state.gallery.findIndex(p => Number(p.id) === Number(id));
    if (index < 0) return;

    const target = index + Number(direction);
    if (target < 0 || target >= state.gallery.length) return;

    const previousOrder = state.gallery.slice();

    const [item] = state.gallery.splice(index, 1);
    state.gallery.splice(target, 0, item);

    const ok = await saveCurrentGalleryOrder(
      direction < 0 ? "Foto movida uma posição para cima." : "Foto movida uma posição para baixo."
    );

    if (!ok) {
      state.gallery = previousOrder;
      normalizeLocalOrder();
      renderGallery();
      renderAdminGallery();
    }
  };

  async function moveGalleryPhotoToPosition(id, newIndex) {
    if (galleryOrderSaving) return;

    const from = state.gallery.findIndex(p => Number(p.id) === Number(id));
    if (from < 0) return;

    const to = Math.max(0, Math.min(state.gallery.length - 1, Number(newIndex)));
    if (from === to) return;

    const previousOrder = state.gallery.slice();

    const [item] = state.gallery.splice(from, 1);
    state.gallery.splice(to, 0, item);

    const ok = await saveCurrentGalleryOrder(`Foto movida para a posição ${to + 1}.`);

    if (!ok) {
      state.gallery = previousOrder;
      normalizeLocalOrder();
      renderGallery();
      renderAdminGallery();
    }
  }

  moveGalleryPhotoTo = async function(draggedId, targetId) {
    if (galleryOrderSaving) return;

    const from = state.gallery.findIndex(p => Number(p.id) === Number(draggedId));
    const to = state.gallery.findIndex(p => Number(p.id) === Number(targetId));
    if (from < 0 || to < 0 || from === to) return;

    await moveGalleryPhotoToPosition(draggedId, to);
  };

  renderAdminGallery = function() {
    originalRenderAdminGallery();

    const list = document.getElementById("adminGalleryList");
    if (!list || !state.gallery.length) return;

    injectGalleryOrderStyles();

    if (!document.getElementById("galleryOrderGuide")) {
      const guide = document.createElement("div");
      guide.id = "galleryOrderGuide";
      guide.className = "gallery-order-guide";
      guide.innerHTML =
        "<strong>Organizar fotos:</strong> escolha diretamente a posição desejada " +
        "(1 = primeira foto). Os botões Subir/Descer movem somente uma posição. " +
        "Aguarde a confirmação antes de fazer outro movimento.";
      list.insertAdjacentElement("beforebegin", guide);
    }

    list.classList.toggle("gallery-order-saving", galleryOrderSaving);

    list.querySelectorAll(".sortable-gallery-item").forEach((item, index) => {
      const id = Number(item.dataset.galleryId);

      item.draggable = false;

      const actions = item.querySelector(".gallery-order-actions");
      if (!actions) return;

      if (!actions.querySelector(".gallery-position-control")) {
        const label = document.createElement("label");
        label.className = "gallery-position-control";

        const select = document.createElement("select");
        select.setAttribute("aria-label", "Mover foto para posição");

        state.gallery.forEach((_, pos) => {
          const option = document.createElement("option");
          option.value = String(pos);
          option.textContent = `Posição ${pos + 1}`;
          option.selected = pos === index;
          select.appendChild(option);
        });

        select.disabled = galleryOrderSaving;
        select.addEventListener("change", async () => {
          const desired = Number(select.value);
          select.disabled = true;
          await moveGalleryPhotoToPosition(id, desired);
        });

        const span = document.createElement("span");
        span.textContent = "Posição";

        label.append(span, select);
        actions.prepend(label);
      }

      actions.querySelectorAll("button,select").forEach(control => {
        if (galleryOrderSaving) control.disabled = true;
      });
    });

    if (galleryOrderSaving) {
      const guide = document.getElementById("galleryOrderGuide");
      if (guide && !guide.querySelector(".gallery-save-badge")) {
        const badge = document.createElement("span");
        badge.className = "gallery-save-badge";
        badge.textContent = "⏳ Salvando ordem...";
        guide.appendChild(badge);
      }
    } else {
      document.querySelector("#galleryOrderGuide .gallery-save-badge")?.remove();
    }
  };

  injectGalleryOrderStyles();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => renderAdminGallery(), { once: true });
  } else {
    renderAdminGallery();
  }
})();
