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
        margin-top:10px;
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
        height:9px;
        border-radius:999px;
        overflow:hidden;
        background:rgba(128,128,128,.18)
      }
      .manual-timer-progress{
        height:100%;
        width:0%;
        border-radius:inherit;
        background:var(--green);
        transition:width .2s linear
      }
      .manual-timer-status{
        font-size:.84rem;
        color:var(--muted);
        font-weight:700
      }
      .manual-timer-box.waiting .manual-timer-value,
      .manual-timer-box.done .manual-timer-value,
      .manual-timer-box.error .manual-timer-value{
        font-size:.95rem;
        line-height:1.25;
        text-align:right
      }
      .manual-timer-box.error .manual-timer-value{color:#b93737}
      .manual-timer-box.done .manual-timer-value{color:var(--green)}
    `;
    document.head.appendChild(style);
  }

  function el(zone) {
    return document.getElementById(`countdown${zone}`);
  }

  function formatSeconds(seconds) {
    const s = Math.max(0, Math.ceil(Number(seconds) || 0));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }

  function renderIdle(zone) {
    const target = el(zone);
    if (!target) return;
    target.innerHTML = `
      <div class="manual-timer-box waiting">
        <div class="manual-timer-top">
          <span class="manual-timer-label">⏱️ Temporizador</span>
          <strong class="manual-timer-value">Pronta para irrigação</strong>
        </div>
        <div class="manual-timer-track">
          <div class="manual-timer-progress" style="width:0%"></div>
        </div>
        <div class="manual-timer-status">Escolha o tempo e toque em “Iniciar irrigação”.</div>
      </div>
    `;
  }

  function renderMessage(zone, text, kind = "waiting", sub = "") {
    const target = el(zone);
    if (!target) return;
    target.innerHTML = `
      <div class="manual-timer-box ${kind}">
        <div class="manual-timer-top">
          <span class="manual-timer-label">⏱️ Temporizador</span>
          <strong class="manual-timer-value">${text}</strong>
        </div>
        <div class="manual-timer-track">
          <div class="manual-timer-progress" style="width:0%"></div>
        </div>
        <div class="manual-timer-status">${sub || "Aguardando confirmação do sistema."}</div>
      </div>
    `;
  }

  function renderRunning(zone) {
    const s = runtime[zone];
    const target = el(zone);
    if (!target || !s.active) return;

    const remainingMs = Math.max(0, s.deadline - Date.now());
    const remainingSec = remainingMs / 1000;
    const elapsed = Math.max(0, s.total - remainingSec);
    const percent = s.total > 0
      ? Math.max(0, Math.min(100, elapsed / s.total * 100))
      : 0;

    target.innerHTML = `
      <div class="manual-timer-box">
        <div class="manual-timer-top">
          <span class="manual-timer-label">💧 Bomba ligada</span>
          <strong class="manual-timer-value">${formatSeconds(remainingSec)}</strong>
        </div>
        <div class="manual-timer-track">
          <div class="manual-timer-progress" style="width:${percent}%"></div>
        </div>
        <div class="manual-timer-status">
          Irrigando • ${Math.ceil(remainingSec)} s restantes
        </div>
      </div>
    `;

    if (remainingMs <= 0) {
      clearInterval(s.timer);
      s.timer = null;
      s.active = false;
      renderMessage(zone, "00:00", "waiting", "Tempo encerrado — aguardando confirmação do Arduino.");
    }
  }

  function clearTimer(zone) {
    const s = runtime[zone];
    if (s.timer) clearInterval(s.timer);
    s.timer = null;
    s.active = false;
    s.deadline = 0;
    s.total = 0;
  }

  function startTimer(zone, seconds) {
    clearTimer(zone);
    const total = Math.max(1, Number(seconds) || 1);
    const s = runtime[zone];
    s.total = total;
    s.deadline = Date.now() + total * 1000;
    s.active = true;
    renderRunning(zone);
    s.timer = setInterval(() => renderRunning(zone), 200);
  }

  function monitorCommand(api, commandId, zone, requestedSeconds) {
    const s = runtime[zone];

    if (s.unsubscribe) {
      s.unsubscribe();
      s.unsubscribe = null;
    }

    renderMessage(
      zone,
      "Comando enviado",
      "waiting",
      "Aguardando o ESP-01 receber o pedido."
    );

    s.unsubscribe = api.listenCommand(commandId, cmd => {
      if (!cmd) return;
      const status = String(cmd.status || "").toLowerCase();

      if (status === "pendente") {
        if (!s.active) {
          setTimeout(() => renderMessage(
            zone,
            "Pendente",
            "waiting",
            "Aguardando o ESP-01."
          ), 0);
        }
      }

      else if (status === "recebido") {
        if (!s.active) {
          setTimeout(() => renderMessage(
            zone,
            "ESP-01 recebeu",
            "waiting",
            "Aguardando o Arduino ligar a bomba."
          ), 0);
        }
      }

      else if (status === "executando") {
        const seconds = Number(cmd.restanteSegundos ?? requestedSeconds) || requestedSeconds;
        if (!s.active) startTimer(zone, seconds);
      }

      else if (status === "concluido") {
        clearTimer(zone);
        setTimeout(() => renderMessage(
          zone,
          "✅ Concluída",
          "done",
          "Irrigação finalizada e confirmada."
        ), 0);

        if (s.unsubscribe) {
          s.unsubscribe();
          s.unsubscribe = null;
        }
      }

      else if (status === "erro") {
        clearTimer(zone);
        setTimeout(() => renderMessage(
          zone,
          "⚠️ Erro",
          "error",
          cmd.erro || "O dispositivo informou uma falha."
        ), 0);
      }

      else if (status === "cancelado") {
        clearTimer(zone);
        setTimeout(() => renderMessage(
          zone,
          "⛔ Cancelada",
          "error",
          "A irrigação foi cancelada."
        ), 0);
      }
    });
  }

  function installWrapper() {
    const api = window.IrrigaFirebase;

    if (!api) {
      setTimeout(installWrapper, 150);
      return;
    }

    if (api.__manualCountdownV2) return;
    api.__manualCountdownV2 = true;

    const original = api.sendCommand.bind(api);

    api.sendCommand = async (zone, action, durationSeconds = 0) => {
      const id = await original(zone, action, durationSeconds);

      const z = Number(zone);
      const act = String(action || "").toUpperCase();

      if ((z === 1 || z === 2) && act === "IRRIGAR") {
        monitorCommand(api, id, z, Number(durationSeconds) || 0);
      }

      if ((z === 1 || z === 2) && act === "PARAR") {
        clearTimer(z);
        renderMessage(
          z,
          "⛔ Parada enviada",
          "error",
          "Aguardando confirmação do Arduino."
        );
      }

      return id;
    };
  }

  function init() {
    injectStyles();
    renderIdle(1);
    renderIdle(2);
    installWrapper();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
