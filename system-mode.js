import {
  ref, onValue, update, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-database.js";

const fb = window.IrrigaFirebase;
if (!fb) throw new Error("IrrigaFirebase indisponível");

const MODE_PATH = "irrigasense/sistema/config";
const schedulePath = zone => `irrigasense/zonas/zona${zone}/config/programacao`;

let currentMode = "automatico";
let schedules = {1:false,2:false};
let busy = false;

function notify(message, type="info") {
  const toast = document.getElementById("toast");
  if (toast) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toast._systemModeTimer);
    toast._systemModeTimer = setTimeout(() => toast.classList.remove("show"), 3000);
    return;
  }
  if (type === "error") console.error(message); else console.log(message);
}

function isAdmin() {
  return !!fb.isAdminUser?.(fb.auth?.currentUser);
}

function injectStyles() {
  if (document.getElementById("systemModeStyles")) return;
  const style = document.createElement("style");
  style.id = "systemModeStyles";
  style.textContent = `
    .mode-control-card{margin:0 0 18px;background:var(--surface);border:1px solid var(--line);border-radius:23px;padding:22px;box-shadow:var(--shadow)}
    .mode-control-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:17px}
    .mode-control-head h3{margin:3px 0 4px;font-size:22px}.mode-control-head p{margin:0;color:var(--muted);font-size:12px;max-width:700px}
    .mode-current{display:inline-flex;align-items:center;gap:7px;padding:8px 11px;border:1px solid var(--line);border-radius:999px;font-size:11px;font-weight:850;white-space:nowrap}
    .mode-current.auto{color:var(--green);background:var(--green-soft)}.mode-current.manual{color:#8a6318;background:#fff3da}
    .mode-choice-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .mode-choice{border:1px solid var(--line);background:var(--surface2);color:var(--text);border-radius:17px;padding:16px;text-align:left;display:flex;gap:12px;align-items:flex-start;transition:.18s}
    .mode-choice:hover{transform:translateY(-1px);border-color:var(--green)}.mode-choice.active{border:2px solid var(--green);background:var(--green-soft)}
    .mode-choice:disabled{opacity:.55;cursor:not-allowed;transform:none}.mode-choice-icon{font-size:24px;line-height:1}.mode-choice strong{display:block;font-size:15px}.mode-choice small{display:block;color:var(--muted);margin-top:2px}
    .schedule-mode-box{margin-top:15px;padding:15px;border-radius:17px;background:var(--surface2);border:1px solid var(--line)}
    .schedule-mode-title{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:10px}.schedule-mode-title strong{font-size:14px}.schedule-mode-title small{color:var(--muted)}
    .schedule-zone-list{display:grid;grid-template-columns:1fr 1fr;gap:10px}.schedule-zone-row{display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:11px 13px}
    .schedule-zone-row span{display:flex;flex-direction:column}.schedule-zone-row small{color:var(--muted)}
    .schedule-toggle{border:0;border-radius:999px;padding:7px 11px;font-size:11px;font-weight:850;background:#f4e5e5;color:#914545}.schedule-toggle.on{background:var(--green-soft);color:var(--green)}.schedule-toggle:disabled{opacity:.55;cursor:not-allowed}
    .mode-note{margin-top:12px;font-size:11px;color:var(--muted)}
    @media(max-width:760px){.mode-control-head{flex-direction:column}.mode-choice-grid,.schedule-zone-list{grid-template-columns:1fr}.mode-current{white-space:normal}}
  `;
  document.head.appendChild(style);
}

function injectCard() {
  if (document.getElementById("systemModeControl")) return;
  const panel = document.getElementById("view-painel");
  if (!panel) return;
  const intro = panel.querySelector(".page-intro");

  const card = document.createElement("section");
  card.id = "systemModeControl";
  card.className = "mode-control-card";
  card.innerHTML = `
    <div class="mode-control-head">
      <div>
        <span class="kicker">Operação do sistema</span>
        <h3>Modo do IrrigaSense</h3>
        <p>Escolha como o Arduino deve operar. A irrigação programada funciona dentro do modo Automático.</p>
      </div>
      <span id="modeCurrentBadge" class="mode-current auto">🤖 Automático</span>
    </div>

    <div class="mode-choice-grid">
      <button id="modeAutoButton" class="mode-choice active" type="button">
        <span class="mode-choice-icon">🤖</span>
        <span><strong>Automático</strong><small>O Arduino decide pela umidade e também executa horários programados ativos.</small></span>
      </button>
      <button id="modeManualButton" class="mode-choice" type="button">
        <span class="mode-choice-icon">🎮</span>
        <span><strong>Manual</strong><small>Suspende decisões automáticas e horários. As bombas ficam sob controle do usuário.</small></span>
      </button>
    </div>

    <div class="schedule-mode-box">
      <div class="schedule-mode-title">
        <div><strong>⏰ Irrigação programada</strong><br><small>Ative ou pause os horários sem apagar a configuração salva.</small></div>
        <span id="scheduleGlobalStatus" class="pill warning">Aguardando</span>
      </div>
      <div class="schedule-zone-list">
        <div class="schedule-zone-row"><span><strong>Zona 1</strong><small id="scheduleZoneText1">Carregando...</small></span><button id="scheduleToggle1" class="schedule-toggle" type="button">Desativada</button></div>
        <div class="schedule-zone-row"><span><strong>Zona 2</strong><small id="scheduleZoneText2">Carregando...</small></span><button id="scheduleToggle2" class="schedule-toggle" type="button">Desativada</button></div>
      </div>
    </div>
    <div id="modeSecurityNote" class="mode-note">🔐 Alterações exigem acesso de administrador.</div>
  `;

  if (intro?.nextSibling) panel.insertBefore(card, intro.nextSibling);
  else panel.appendChild(card);

  document.getElementById("modeAutoButton")?.addEventListener("click", () => changeMode("automatico"));
  document.getElementById("modeManualButton")?.addEventListener("click", () => changeMode("manual"));
  document.getElementById("scheduleToggle1")?.addEventListener("click", () => toggleSchedule(1));
  document.getElementById("scheduleToggle2")?.addEventListener("click", () => toggleSchedule(2));
}

function setBusy(value) {
  busy = value;
  ["modeAutoButton","modeManualButton","scheduleToggle1","scheduleToggle2"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = value;
  });
}

function updateExistingModeIndicators() {
  const automatic = currentMode !== "manual";
  const heroMode = document.querySelector(".floating-card.f3 strong");
  const heroSub = document.querySelector(".floating-card.f3 span");
  if (heroMode) heroMode.textContent = automatic ? "Automático" : "Manual";
  if (heroSub) heroSub.textContent = automatic ? "Controle local ativo" : "Controle pelo usuário";

  const panelModePill = document.querySelector("#view-painel .inline-pills .pill.success");
  if (panelModePill) panelModePill.textContent = automatic ? "🤖 Automático" : "🎮 Manual";
}

function render() {
  const automatic = currentMode !== "manual";
  const badge = document.getElementById("modeCurrentBadge");
  const autoBtn = document.getElementById("modeAutoButton");
  const manualBtn = document.getElementById("modeManualButton");

  if (badge) {
    badge.className = `mode-current ${automatic ? "auto" : "manual"}`;
    badge.textContent = automatic ? "🤖 Automático" : "🎮 Manual";
  }
  autoBtn?.classList.toggle("active", automatic);
  manualBtn?.classList.toggle("active", !automatic);

  for (const zone of [1,2]) {
    const enabled = !!schedules[zone];
    const button = document.getElementById(`scheduleToggle${zone}`);
    const text = document.getElementById(`scheduleZoneText${zone}`);
    if (button) {
      button.className = `schedule-toggle ${enabled ? "on" : ""}`;
      button.textContent = enabled ? "Ativada" : "Desativada";
      button.setAttribute("aria-pressed", String(enabled));
    }
    if (text) {
      if (!automatic && enabled) text.textContent = "Configurada • pausada no modo Manual";
      else if (enabled) text.textContent = "Horários ativos";
      else text.textContent = "Horários pausados";
    }
  }

  const global = document.getElementById("scheduleGlobalStatus");
  const activeCount = Number(schedules[1]) + Number(schedules[2]);
  if (global) {
    if (!automatic && activeCount) {
      global.className = "pill warning";
      global.textContent = "Pausada pelo modo Manual";
    } else if (activeCount === 2) {
      global.className = "pill success";
      global.textContent = "2 zonas ativas";
    } else if (activeCount === 1) {
      global.className = "pill success";
      global.textContent = "1 zona ativa";
    } else {
      global.className = "pill warning";
      global.textContent = "Desativada";
    }
  }

  const note = document.getElementById("modeSecurityNote");
  if (note) note.textContent = isAdmin()
    ? "🔓 Administrador autenticado — controles liberados."
    : "🔐 Entre no Painel do Administrador para alterar o modo ou a programação.";

  updateExistingModeIndicators();
}

async function waitForCommand(commandId, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    let finished = false;
    let unsubscribe = null;
    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      try { unsubscribe?.(); } catch (_) {}
      reject(new Error("TIMEOUT"));
    }, timeoutMs);

    unsubscribe = fb.listenCommand(commandId, command => {
      if (finished || !command) return;
      const status = String(command.status || "").toLowerCase();
      if (["concluido","concluído","done"].includes(status)) {
        finished = true;
        clearTimeout(timer);
        try { unsubscribe?.(); } catch (_) {}
        resolve(command);
      } else if (["erro","error","falhou"].includes(status)) {
        finished = true;
        clearTimeout(timer);
        try { unsubscribe?.(); } catch (_) {}
        reject(new Error("COMMAND_ERROR"));
      }
    });
  });
}

async function changeMode(mode) {
  if (busy) return;
  if (!isAdmin()) {
    notify("Entre no Painel do Administrador para alterar o modo.", "error");
    return;
  }
  if (mode === currentMode) {
    notify(`O sistema já está no modo ${mode === "automatico" ? "Automático" : "Manual"}.`);
    return;
  }

  setBusy(true);
  try {
    const action = mode === "automatico" ? "MODO_AUTO" : "MODO_MANUAL";
    notify(`Enviando modo ${mode === "automatico" ? "Automático" : "Manual"} ao ESP...`);
    const commandId = await fb.sendCommand(1, action, 0);
    await waitForCommand(commandId);
    notify(`Modo ${mode === "automatico" ? "Automático" : "Manual"} confirmado pelo sistema.`);
  } catch (error) {
    console.error("Alteração de modo:", error);
    notify(error?.message === "TIMEOUT" ? "O ESP não confirmou a troca de modo a tempo." : "Não foi possível alterar o modo.", "error");
  } finally {
    setBusy(false);
  }
}

async function toggleSchedule(zone) {
  if (busy) return;
  if (!isAdmin()) {
    notify("Entre no Painel do Administrador para alterar a programação.", "error");
    return;
  }

  setBusy(true);
  const next = !schedules[zone];
  try {
    await update(ref(fb.db, schedulePath(zone)), {
      ativa: next,
      atualizadoEm: serverTimestamp()
    });
    notify(`Irrigação programada da Zona ${zone} ${next ? "ativada" : "desativada"}.`);
  } catch (error) {
    console.error("Programação:", error);
    notify("Não foi possível alterar a programação.", "error");
  } finally {
    setBusy(false);
  }
}

function startListeners() {
  onValue(ref(fb.db, MODE_PATH), snap => {
    const mode = String(snap.val()?.modo || "automatico").toLowerCase();
    currentMode = mode === "manual" ? "manual" : "automatico";
    render();
  });

  for (const zone of [1,2]) {
    onValue(ref(fb.db, schedulePath(zone)), snap => {
      schedules[zone] = !!snap.val()?.ativa;
      render();
    });
  }

  fb.listenAuth?.(() => render());
}

injectStyles();
injectCard();
startListeners();
render();
