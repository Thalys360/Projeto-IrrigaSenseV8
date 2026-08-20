(() => {
  "use strict";

  const runtime = {
    1: { timer: null, unsubscribe: null, deadline: 0, total: 0, active: false },
    2: { timer: null, unsubscribe: null, deadline: 0, total: 0, active: false }
  };

  function injectStyles() {
    if (document.getElementById("manualTimerStyles")) return;

    const style = document.createElement("style");
    style.id = "manualTimerStyles";
    style.textContent = `
      .manual-timer-box{
        padding:14px 15px;
        border:1px solid var(--border);
        border-radius:16px;
        background:var(--surface2);
        display:grid;
        gap:9px
      }
      .manual-timer-top{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px
      }
      .manual-timer-label{
        font-size:.84rem;
        font-weight:800;
        color:var(--muted)
      }
      .manual-timer-value{
        font-size:1.65rem;
        line-height:1;
        font-weight:900;
        letter-spacing:.03em;
        font-variant-numeric:tabular-nums;
        color:var(--green)
      }
      .manual-timer-track{
        height:8px;
        border-radius:999px;
        overflow:hidden;
        background:rgba(128,128,128,.18)
      }
      .manual-timer-progress{
        height:100%;
        width:100%;
        border-radius:inherit;
        background:var(--green);
        transition:width .18s linear
      }
      .manual-timer-status{
        font-size:.84rem;
        color:var(--muted);
        font-weight:700
      }
      .manual-timer-box.waiting .manual-timer-value{
        font-size:1rem;
        color:var(--muted)
      }
      .manual-timer-box.done .manual-timer-value{
        font-size:1rem;
        color:var(--green)
      }
      .manual-timer-box.error .manual-timer-value{
        font-size:1rem;
        color:#b93737
      }
    `;
    document.head.appendChild(style);
  }

  function countdownElement(zone) {
    return document.getElementById(`countdown${zone}`);
  }

  function formatSeconds(seconds) {
    const s = Math.max(0, Math.ceil(Number(seconds) || 0));
    const minutes = Math.floor(s / 60);
    const rest = s % 60;
    return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
  }

  function renderWaiting(zone, text, kind = "waiting") {
    const el = countdownElement(zone);
    if (!el) return;

    el.innerHTML = `
      <div class="manual-timer-box ${kind}">
        <div class="manual-timer-top">
          <span class="manual-timer-label">Zona ${zone}</span>
          <strong class="manual-timer-value">${text}</strong>
        </div>
      </div>
    `;
  }

  function renderRunning(zone) {
    const state = runtime[zone];
    const el = countdownElement(zone);
    if (!el || !state.active) return;

    const remainingMs = Math.max(0, state.deadline - Date.now());
    const remainingSeconds = remainingMs / 1000;

    const percent = state.total > 0
      ? Math.max(0, Math.min(100, remainingSeconds / state.total * 100))
      : 0;

    el.innerHTML = `
      <div class="manual-timer-box">
        <div class="manual-timer-top">
          <span class="manual-timer-label">💧 Bomba ligada</span>
          <strong class="manual-timer-value">${formatSeconds(remainingSeconds)}</strong>
        </div>

        <div class="manual-timer-track" aria-hidden="true">
          <div class="manual-timer-progress" style="width:${percent}%"></div>
        </div>

        <div class="manual-timer-status">
          Irrigando • ${Math.ceil(remainingSeconds)} s restantes
        </div>
      </div>
    `;

    if (remainingMs <= 0) {
      clearInterval(state.timer);
      state.timer = null;
      state.active = false;
      renderWaiting(zone, "00:00 — aguardando confirmação", "waiting");
    }
  }

  function clearRuntime(zone, unsubscribe = false) {
    const state = runtime[zone];

    if (state.timer) clearInterval(state.timer);

    state.timer = null;
    state.deadline = 0;
    state.total = 0;
    state.active = false;

    if (unsubscribe && state.unsubscribe) {
      state.unsubscribe();
      state.unsubscribe = null;
    }
  }

  function startCountdown(zone, seconds) {
    const total = Math.max(1, Number(seconds) || 1);

    clearRuntime(zone, false);

    const state = runtime[zone];

    state.total = total;
    state.deadline = Date.now() + total * 1000;
    state.active = true;

    renderRunning(zone);

    state.timer = setInterval(
      () => renderRunning(zone),
      200
    );
  }

  function monitorCommand(api, id, zone, requestedSeconds) {
    const state = runtime[zone];

    if (state.unsubscribe) state.unsubscribe();

    renderWaiting(
      zone,
      "Enviado — aguardando ESP-01"
    );

    state.unsubscribe = api.listenCommand(id, command => {
      if (!command) return;

      const status = String(command.status || "").toLowerCase();

      if (status === "pendente") {
        if (!state.active) {
          setTimeout(
            () => renderWaiting(zone, "Aguardando ESP-01"),
            0
          );
        }
      }

      else if (status === "recebido") {
        if (!state.active) {
          setTimeout(
            () => renderWaiting(zone, "ESP-01 recebeu o comando"),
            0
          );
        }
      }

      else if (status === "executando") {
        const seconds =
          Number(command.restanteSegundos ?? requestedSeconds)
          || requestedSeconds;

        if (!state.active) {
          startCountdown(zone, seconds);
        } else {
          setTimeout(
            () => renderRunning(zone),
            0
          );
        }
      }

      else if (status === "concluido") {
        clearRuntime(zone, false);

        setTimeout(
          () => renderWaiting(zone, "✅ Irrigação concluída", "done"),
          0
        );

        if (state.unsubscribe) {
          state.unsubscribe();
          state.unsubscribe = null;
        }
      }

      else if (status === "erro") {
        clearRuntime(zone, false);

        setTimeout(
          () => renderWaiting(
            zone,
            `⚠️ ${command.erro || "Erro no dispositivo"}`,
            "error"
          ),
          0
        );
      }

      else if (status === "cancelado") {
        clearRuntime(zone, false);

        setTimeout(
          () => renderWaiting(zone, "⛔ Irrigação cancelada", "error"),
          0
        );
      }
    });
  }

  function installCommandWrapper() {
    const api = window.IrrigaFirebase;

    if (!api) {
      setTimeout(installCommandWrapper, 120);
      return;
    }

    if (api.__manualCountdownInstalled) return;

    api.__manualCountdownInstalled = true;

    const originalSendCommand =
      api.sendCommand.bind(api);

    api.sendCommand = async (
      zone,
      action,
      durationSeconds = 0
    ) => {
      const id = await originalSendCommand(
        zone,
        action,
        durationSeconds
      );

      const zoneNumber = Number(zone);
      const actionName =
        String(action || "").toUpperCase();

      if (
        (zoneNumber === 1 || zoneNumber === 2)
        && actionName === "IRRIGAR"
      ) {
        monitorCommand(
          api,
          id,
          zoneNumber,
          Number(durationSeconds) || 0
        );
      }

      else if (
        (zoneNumber === 1 || zoneNumber === 2)
        && actionName === "PARAR"
      ) {
        renderWaiting(
          zoneNumber,
          "⛔ Parada solicitada — aguardando Arduino",
          "error"
        );
      }

      return id;
    };
  }

  function init() {
    injectStyles();
    installCommandWrapper();
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      { once: true }
    );
  } else {
    init();
  }
})();
