(() => {
  "use strict";

  const runtime = {
    1: { timer: null, unsubscribe: null, deadline: 0, total: 0, active: false },
    2: { timer: null, unsubscribe: null, deadline: 0, total: 0, active: false }
  };

  function injectStyles() {
    if (document.getElementById("manualTimerStylesV3")) return;

    const style = document.createElement("style");
    style.id = "manualTimerStylesV3";
    style.textContent = `
      .manual-timer-host{margin-top:10px}
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
      .manual-timer-box.error .manual-timer-value{color:#b93737}
      .manual-timer-box.done .manual-timer-value{color:var(--green)}
    `;
    document.head.appendChild(style);
  }

  function originalCountdown(zone) {
    return document.getElementById(`countdown${zone}`);
  }

  function host(zone) {
    let target = document.getElementById(`manualTimerHost${zone}`);
    if (target) return target;

    const original = originalCountdown(zone);
    if (!original) return null;

    // O app.js antigo continua escrevendo em countdown1/countdown2.
    // Escondemos esse texto e usamos um painel separado, que ele não consegue apagar.
    original.style.display = "none";

    target = document.createElement("div");
    target.id = `manualTimerHost${zone}`;
    target.className = "manual-timer-host";
    original.insertAdjacentElement("afterend", target);
    return target;
  }

  function formatSeconds(seconds) {
    const s = Math.max(0, Math.ceil(Number(seconds) || 0));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }

  function render(zone, value, status, percent = 0, kind = "waiting", label = "⏱️ Temporizador") {
    const target = host(zone);
    if (!target) return;

    target.innerHTML = `
      <div class="manual-timer-box ${kind}">
        <div class="manual-timer-top">
          <span class="manual-timer-label">${label}</span>
          <strong class="manual-timer-value">${value}</strong>
        </div>
        <div class="manual-timer-track">
          <div class="manual-timer-progress" style="width:${Math.max(0, Math.min(100, percent))}%"></div>
        </div>
        <div class="manual-timer-status">${status}</div>
      </div>
    `;
  }

  function renderIdle(zone) {
    render(
      zone,
      "--:--",
      "Escolha o tempo e toque em “Iniciar irrigação”."
    );
  }

  function renderWaiting(zone, seconds, message) {
    render(zone, formatSeconds(seconds), message, 0, "waiting");
  }

  function clearTimer(zone, keepTotal = false) {
    const s = runtime[zone];

    if (s.timer) clearInterval(s.timer);

    s.timer = null;
    s.active = false;
    s.deadline = 0;

    if (!keepTotal) s.total = 0;
  }

  function renderRunning(zone) {
    const s = runtime[zone];
    if (!s.active) return;

    const remainingMs = Math.max(0, s.deadline - Date.now());
    const remainingSec = remainingMs / 1000;
    const elapsed = Math.max(0, s.total - remainingSec);

    const percent = s.total > 0
      ? Math.max(0, Math.min(100, (elapsed / s.total) * 100))
      : 0;

    render(
      zone,
      formatSeconds(remainingSec),
      `Irrigando • ${Math.ceil(remainingSec)} s restantes`,
      percent,
      "running",
      "💧 Bomba ligada"
    );

    if (remainingMs <= 0) {
      clearTimer(zone, true);

      render(
        zone,
        "00:00",
        "Tempo encerrado — aguardando confirmação final do Arduino.",
        100,
        "waiting"
      );
    }
  }

  function startTimer(zone, seconds) {
    const s = runtime[zone];

    // Se já começou quando chegou o status "recebido",
    // não reinicia quando chegar "executando".
    if (s.active) {
      renderRunning(zone);
      return;
    }

    clearTimer(zone);

    const total = Math.max(1, Number(seconds) || 1);

    s.total = total;
    s.deadline = Date.now() + total * 1000;
    s.active = true;

    renderRunning(zone);

    s.timer = setInterval(() => {
      renderRunning(zone);
    }, 200);
  }

  function stopListener(zone) {
    const s = runtime[zone];

    if (s.unsubscribe) {
      s.unsubscribe();
      s.unsubscribe = null;
    }
  }

  function prepareCommand(zone, seconds) {
    stopListener(zone);
    clearTimer(zone);

    const total = Math.max(1, Number(seconds) || 1);
    runtime[zone].total = total;

    // O temporizador aparece ANTES de esperar Firebase/ESP.
    renderWaiting(
      zone,
      total,
      "Enviando comando ao Firebase…"
    );
  }

  function monitorCommand(api, commandId, zone, requestedSeconds) {
    const s = runtime[zone];

    stopListener(zone);

    renderWaiting(
      zone,
      requestedSeconds,
      "Comando enviado — aguardando o ESP-01."
    );

    s.unsubscribe = api.listenCommand(commandId, cmd => {
      if (!cmd) return;

      const status = String(cmd.status || "").toLowerCase();

      if (status === "pendente") {
        if (!s.active) {
          renderWaiting(
            zone,
            requestedSeconds,
            "Pendente — aguardando o ESP-01."
          );
        }
      }

      else if (status === "recebido") {
        // Na V4.2 o ESP manda o CMD ao Arduino antes de marcar "recebido".
        // Então a contagem começa aqui e não fica esperando o Firebase registrar EXECUTANDO.
        startTimer(zone, requestedSeconds);
      }

      else if (status === "executando") {
        const seconds =
          Number(cmd.restanteSegundos ?? requestedSeconds) ||
          requestedSeconds;

        startTimer(zone, seconds);
      }

      else if (status === "concluido") {
        clearTimer(zone, true);

        render(
          zone,
          "00:00",
          "✅ Irrigação finalizada e confirmada.",
          100,
          "done"
        );

        stopListener(zone);
      }

      else if (status === "erro") {
        clearTimer(zone, true);

        render(
          zone,
          "ERRO",
          cmd.erro || "O dispositivo informou uma falha.",
          0,
          "error",
          "⚠️ Temporizador"
        );

        stopListener(zone);
      }

      else if (status === "cancelado") {
        clearTimer(zone, true);

        render(
          zone,
          "PARADA",
          "Irrigação cancelada.",
          0,
          "error",
          "⛔ Temporizador"
        );

        stopListener(zone);
      }
    });
  }

  function installWrapper() {
    const api = window.IrrigaFirebase;

    if (!api) {
      setTimeout(installWrapper, 150);
      return;
    }

    if (api.__manualCountdownV3) return;
    api.__manualCountdownV3 = true;

    const originalSendCommand = api.sendCommand.bind(api);

    api.sendCommand = async (zone, action, durationSeconds = 0) => {
      const z = Number(zone);
      const act = String(action || "").toUpperCase();
      const duration = Math.max(0, Number(durationSeconds) || 0);

      if ((z === 1 || z === 2) && act === "IRRIGAR") {
        prepareCommand(z, duration);
      }

      if ((z === 1 || z === 2) && act === "PARAR") {
        clearTimer(z, true);

        render(
          z,
          "PARANDO",
          "Enviando parada imediata…",
          0,
          "error",
          "⛔ Temporizador"
        );
      }

      try {
        const id = await originalSendCommand(zone, action, durationSeconds);

        if ((z === 1 || z === 2) && act === "IRRIGAR") {
          monitorCommand(api, id, z, duration);
        }

        if ((z === 1 || z === 2) && act === "PARAR") {
          render(
            z,
            "PARANDO",
            "Parada enviada — aguardando confirmação do Arduino.",
            0,
            "error",
            "⛔ Temporizador"
          );
        }

        return id;
      }

      catch (error) {
        if (z === 1 || z === 2) {
          clearTimer(z, true);

          render(
            z,
            "ERRO",
            "Não foi possível enviar o comando ao Firebase.",
            0,
            "error",
            "⚠️ Temporizador"
          );
        }

        throw error;
      }
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
