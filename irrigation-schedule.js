(() => {
  "use strict";

  const DURATION_OPTIONS = [5, 10, 15, 20, 25, 30, 45, 60];
  const DAY_LABELS = [
    { value: 1, short: "Seg" },
    { value: 2, short: "Ter" },
    { value: 3, short: "Qua" },
    { value: 4, short: "Qui" },
    { value: 5, short: "Sex" },
    { value: 6, short: "Sáb" },
    { value: 0, short: "Dom" }
  ];

  const scheduleState = {
    1: null,
    2: null
  };

  const zoneMeta = {
    1: { name: "Zona 1", min: 50 },
    2: { name: "Zona 2", min: 50 }
  };

  let currentAdmin = null;
  let initialized = false;

  function fb() {
    return window.IrrigaFirebase || null;
  }

  function notify(message) {
    const el = document.getElementById("toast");
    if (!el) {
      console.info(message);
      return;
    }
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(el._scheduleTimer);
    el._scheduleTimer = setTimeout(() => el.classList.remove("show"), 3200);
  }

  function clamp(n, min, max) {
    const value = Number(n);
    if (!Number.isFinite(value)) return min;
    return Math.max(min, Math.min(max, value));
  }

  function defaultSchedule(zone) {
    return {
      enabled: false,
      mode: "inteligente",
      threshold: clamp(zoneMeta[zone].min, 0, 100),
      durationSeconds: 5,
      minIntervalMinutes: 60,
      days: [0, 1, 2, 3, 4, 5, 6],
      times: [
        { id: "manha", time: "06:00", enabled: true },
        { id: "tarde", time: "17:30", enabled: true }
      ]
    };
  }

  function normalizeTimes(raw) {
    const values = Array.isArray(raw)
      ? raw
      : (raw && typeof raw === "object" ? Object.values(raw) : []);

    const result = values
      .filter(Boolean)
      .map((item, index) => {
        const time = /^\d{2}:\d{2}$/.test(String(item.horario || item.time || ""))
          ? String(item.horario || item.time)
          : "06:00";
        return {
          id: String(item.id || `h${index + 1}`),
          time,
          enabled: item.ativo !== undefined ? !!item.ativo : (item.enabled !== false)
        };
      });

    return result.length ? result.slice(0, 8) : defaultSchedule(1).times;
  }

  function normalizeSchedule(raw, zone) {
    if (!raw || typeof raw !== "object") return defaultSchedule(zone);

    const daysRaw = raw.diasSemana || raw.days;
    const days = Array.isArray(daysRaw)
      ? [...new Set(daysRaw.map(Number).filter(v => v >= 0 && v <= 6))]
      : [0, 1, 2, 3, 4, 5, 6];

    const requestedDuration = Number(raw.duracaoMaximaSegundos ?? raw.durationSeconds ?? 5);
    const durationSeconds = DURATION_OPTIONS.includes(requestedDuration) ? requestedDuration : 5;

    return {
      enabled: raw.ativa !== undefined ? !!raw.ativa : !!raw.enabled,
      mode: String(raw.modo || raw.mode || "inteligente") === "fixa" ? "fixa" : "inteligente",
      threshold: clamp(raw.limiteUmidade ?? raw.threshold ?? zoneMeta[zone].min, 0, 100),
      durationSeconds,
      minIntervalMinutes: clamp(raw.intervaloMinimoMinutos ?? raw.minIntervalMinutes ?? 60, 10, 720),
      days: days.length ? days : [0, 1, 2, 3, 4, 5, 6],
      times: normalizeTimes(raw.horarios || raw.times)
    };
  }

  function payloadFor(zone) {
    const s = scheduleState[zone] || defaultSchedule(zone);
    return {
      ativa: !!s.enabled,
      modo: s.mode === "fixa" ? "fixa" : "inteligente",
      verificarUmidade: s.mode !== "fixa",
      limiteUmidade: clamp(s.threshold, 0, 100),
      duracaoMaximaSegundos: Number(s.durationSeconds),
      intervaloMinimoMinutos: clamp(s.minIntervalMinutes, 10, 720),
      diasSemana: [...s.days].sort((a, b) => a - b),
      horarios: s.times.map((item, index) => ({
        id: String(item.id || `h${index + 1}`),
        horario: item.time,
        ativo: item.enabled !== false
      }))
    };
  }

  function injectStyles() {
    if (document.getElementById("scheduleStyles")) return;
    const style = document.createElement("style");
    style.id = "scheduleStyles";
    style.textContent = `
      .schedule-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px}
      .schedule-card{display:flex;flex-direction:column;gap:16px}
      .schedule-card .config-title{margin-bottom:0}
      .schedule-switch{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 16px;border:1px solid var(--border);border-radius:16px;background:var(--surface2)}
      .schedule-switch strong{display:block}
      .schedule-switch small{display:block;margin-top:4px;color:var(--muted)}
      .schedule-switch input{width:22px;height:22px;accent-color:var(--green)}
      .schedule-days{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
      .schedule-day{position:relative}
      .schedule-day input{position:absolute;opacity:0;pointer-events:none}
      .schedule-day span{display:grid;place-items:center;min-width:46px;height:38px;padding:0 9px;border:1px solid var(--border);border-radius:12px;background:var(--surface);font-weight:700;font-size:.82rem;cursor:pointer;transition:.2s ease}
      .schedule-day input:checked+span{background:var(--green);border-color:var(--green);color:#fff}
      .schedule-times{display:grid;gap:9px}
      .schedule-time-row{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;padding:10px;border:1px solid var(--border);border-radius:14px;background:var(--surface2)}
      .schedule-time-row input[type="checkbox"]{width:19px;height:19px;accent-color:var(--green)}
      .schedule-time-row input[type="time"]{margin:0}
      .schedule-time-row .remove-time{width:38px;height:38px;border:0;border-radius:10px;background:rgba(185,55,55,.1);color:#b93737;cursor:pointer;font-size:1.1rem}
      .schedule-actions{display:flex;gap:10px;flex-wrap:wrap}
      .schedule-mode-note{padding:12px 14px;border-radius:14px;font-size:.9rem;line-height:1.45}
      .schedule-mode-note.smart{background:rgba(21,145,94,.09);border:1px solid rgba(21,145,94,.2)}
      .schedule-mode-note.fixed{background:rgba(208,161,38,.12);border:1px solid rgba(208,161,38,.28)}
      .schedule-summary{display:flex;flex-wrap:wrap;gap:8px}
      .schedule-summary span{padding:8px 10px;border-radius:999px;background:var(--surface2);border:1px solid var(--border);font-size:.82rem;font-weight:700}
      .schedule-auth-note{margin-bottom:18px}
      .schedule-help{margin-top:22px}
      @media(max-width:900px){.schedule-grid{grid-template-columns:1fr}}
      @media(max-width:520px){.schedule-time-row{grid-template-columns:auto 1fr auto}.schedule-day span{min-width:42px}.schedule-actions .btn{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function injectNavigation() {
    if (document.querySelector('.nav-item[data-view="programacao"]')) return;
    const nav = document.getElementById("nav");
    if (!nav) return;

    const button = document.createElement("button");
    button.className = "nav-item";
    button.dataset.view = "programacao";
    button.innerHTML = "<span>⏰</span><em>Irrigação Programada</em>";

    const manual = nav.querySelector('.nav-item[data-view="manual"]');
    if (manual) manual.insertAdjacentElement("afterend", button);
    else nav.appendChild(button);

    button.addEventListener("click", openScheduleView);
  }

  function injectView() {
    if (document.getElementById("view-programacao")) return;
    const content = document.querySelector("main.content");
    if (!content) return;

    const section = document.createElement("section");
    section.className = "view";
    section.id = "view-programacao";
    section.innerHTML = `
      <div class="page-intro">
        <div>
          <span class="kicker">Automação por horário</span>
          <h2>Irrigação Programada</h2>
          <p>Defina os horários de cada zona e combine a programação com a leitura do sensor para reduzir o risco de excesso de água.</p>
        </div>
        <span id="scheduleAuthPill" class="pill warning">🔒 Somente leitura</span>
      </div>

      <div class="notice info schedule-auth-note">
        <strong>Recomendado:</strong> use o modo inteligente. No horário programado, a irrigação só será liberada se a umidade estiver abaixo do limite configurado.
      </div>

      <div id="scheduleGrid" class="schedule-grid"></div>

      <div class="notice info schedule-help">
        A programação fica salva no Firebase. Na etapa do ESP-01 + Arduino, os horários serão sincronizados com o Arduino para continuar funcionando localmente mesmo se a internet cair.
      </div>
    `;
    content.appendChild(section);
  }

  function openScheduleView() {
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    const view = document.getElementById("view-programacao");
    if (view) view.classList.add("active");

    document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
    const button = document.querySelector('.nav-item[data-view="programacao"]');
    if (button) button.classList.add("active");

    const title = document.getElementById("pageTitle");
    if (title) title.textContent = "Irrigação Programada";

    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("overlay");
    if (sidebar) sidebar.classList.remove("open");
    if (overlay) overlay.classList.remove("open");
    document.body.style.overflow = "";

    renderSchedules();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function durationOptions(selected) {
    return DURATION_OPTIONS.map(value =>
      `<option value="${value}" ${Number(selected) === value ? "selected" : ""}>${value} segundos</option>`
    ).join("");
  }

  function dayControls(zone, selectedDays) {
    const selected = new Set((selectedDays || []).map(Number));
    return DAY_LABELS.map(day => `
      <label class="schedule-day">
        <input type="checkbox" data-schedule-day="${zone}" value="${day.value}" ${selected.has(day.value) ? "checked" : ""}>
        <span>${day.short}</span>
      </label>
    `).join("");
  }

  function timesMarkup(zone, times) {
    return (times || []).map(item => `
      <div class="schedule-time-row" data-time-id="${String(item.id).replace(/"/g, "")}">
        <input type="checkbox" class="schedule-time-enabled" ${item.enabled !== false ? "checked" : ""} aria-label="Ativar horário">
        <input type="time" class="schedule-time-value" value="${item.time}">
        <button type="button" class="remove-time" title="Remover horário" aria-label="Remover horário">×</button>
      </div>
    `).join("");
  }

  function summaryText(zone, s) {
    const activeTimes = s.times.filter(t => t.enabled !== false).map(t => t.time).sort();
    const daysCount = s.days.length;
    return `
      <div class="schedule-summary">
        <span>${s.enabled ? "✅ Programação ativa" : "⏸️ Programação desativada"}</span>
        <span>⏰ ${activeTimes.length ? activeTimes.join(" • ") : "Sem horários ativos"}</span>
        <span>📅 ${daysCount === 7 ? "Todos os dias" : `${daysCount} dia(s)/semana`}</span>
        <span>💧 Máx. ${s.durationSeconds}s</span>
      </div>
    `;
  }

  function cardMarkup(zone) {
    const s = scheduleState[zone] || defaultSchedule(zone);
    const smart = s.mode !== "fixa";

    return `
      <form class="config-card schedule-card" data-schedule-zone="${zone}">
        <div class="config-title">
          <span>${zone}</span>
          <div>
            <small>Zona ${zone}</small>
            <h3>${zoneMeta[zone].name}</h3>
          </div>
        </div>

        <label class="schedule-switch">
          <span>
            <strong>Ativar irrigação programada</strong>
            <small>Habilita os horários configurados nesta zona.</small>
          </span>
          <input type="checkbox" class="schedule-enabled" ${s.enabled ? "checked" : ""}>
        </label>

        <label>Comportamento
          <select class="schedule-mode">
            <option value="inteligente" ${smart ? "selected" : ""}>Inteligente — verifica a umidade</option>
            <option value="fixa" ${!smart ? "selected" : ""}>Fixa — irriga no horário</option>
          </select>
        </label>

        <div class="schedule-mode-note ${smart ? "smart" : "fixed"}">
          ${smart
            ? "🌱 No horário programado, a bomba só é liberada se o solo estiver abaixo do limite de umidade."
            : "⚠️ No modo fixo, a bomba pode irrigar mesmo com o solo já úmido. Use apenas quando realmente necessário."}
        </div>

        <div class="input-pair">
          <label class="schedule-threshold-wrap">Irrigar somente abaixo de (%)
            <input type="number" class="schedule-threshold" min="0" max="100" value="${s.threshold}" ${smart ? "" : "disabled"}>
          </label>
          <label>Duração máxima
            <select class="schedule-duration">${durationOptions(s.durationSeconds)}</select>
          </label>
        </div>

        <label>Intervalo mínimo entre irrigações (min)
          <input type="number" class="schedule-interval" min="10" max="720" step="10" value="${s.minIntervalMinutes}">
        </label>

        <div>
          <strong>Dias da semana</strong>
          <div class="schedule-days">${dayControls(zone, s.days)}</div>
        </div>

        <div>
          <div class="section-heading" style="margin-bottom:10px">
            <span class="kicker">Horários</span>
          </div>
          <div class="schedule-times">${timesMarkup(zone, s.times)}</div>
        </div>

        <div class="schedule-actions">
          <button type="button" class="btn ghost add-time">+ Adicionar horário</button>
          <button type="submit" class="btn primary">Salvar programação</button>
        </div>

        ${summaryText(zone, s)}
      </form>
    `;
  }

  function renderSchedules() {
    const grid = document.getElementById("scheduleGrid");
    if (!grid) return;
    grid.innerHTML = cardMarkup(1) + cardMarkup(2);

    grid.querySelectorAll(".schedule-card").forEach(form => {
      const zone = Number(form.dataset.scheduleZone);

      form.querySelector(".schedule-mode").addEventListener("change", event => {
        collectForm(zone, form);
        scheduleState[zone].mode = event.target.value === "fixa" ? "fixa" : "inteligente";
        renderSchedules();
      });

      form.querySelector(".add-time").addEventListener("click", () => {
        collectForm(zone, form);
        if (scheduleState[zone].times.length >= 8) {
          notify("Você pode cadastrar até 8 horários por zona.");
          return;
        }
        scheduleState[zone].times.push({
          id: `h${Date.now()}${Math.floor(Math.random() * 1000)}`,
          time: "06:00",
          enabled: true
        });
        renderSchedules();
      });

      form.querySelectorAll(".remove-time").forEach(button => {
        button.addEventListener("click", () => {
          collectForm(zone, form);
          const row = button.closest(".schedule-time-row");
          const id = row?.dataset.timeId;
          scheduleState[zone].times = scheduleState[zone].times.filter(item => String(item.id) !== String(id));
          if (!scheduleState[zone].times.length) {
            scheduleState[zone].times.push({
              id: `h${Date.now()}`,
              time: "06:00",
              enabled: true
            });
          }
          renderSchedules();
        });
      });

      form.addEventListener("submit", async event => {
        event.preventDefault();
        await saveZoneSchedule(zone, form);
      });
    });

    updateAuthUi();
  }

  function collectForm(zone, form) {
    const current = scheduleState[zone] || defaultSchedule(zone);
    const days = [...form.querySelectorAll(`[data-schedule-day="${zone}"]:checked`)].map(el => Number(el.value));

    const times = [...form.querySelectorAll(".schedule-time-row")].map((row, index) => ({
      id: String(row.dataset.timeId || `h${index + 1}`),
      time: row.querySelector(".schedule-time-value").value || "06:00",
      enabled: row.querySelector(".schedule-time-enabled").checked
    }));

    scheduleState[zone] = {
      ...current,
      enabled: form.querySelector(".schedule-enabled").checked,
      mode: form.querySelector(".schedule-mode").value === "fixa" ? "fixa" : "inteligente",
      threshold: clamp(form.querySelector(".schedule-threshold").value || zoneMeta[zone].min, 0, 100),
      durationSeconds: Number(form.querySelector(".schedule-duration").value),
      minIntervalMinutes: clamp(form.querySelector(".schedule-interval").value, 10, 720),
      days,
      times
    };
  }

  async function saveZoneSchedule(zone, form) {
    collectForm(zone, form);
    const s = scheduleState[zone];

    if (!s.days.length) {
      notify("Selecione pelo menos um dia da semana.");
      return;
    }
    if (!s.times.length || !s.times.some(item => item.enabled)) {
      notify("Deixe pelo menos um horário ativo.");
      return;
    }
    if (s.mode === "fixa") {
      const ok = window.confirm(
        "Modo fixo: a irrigação poderá ocorrer mesmo com o solo já úmido. Deseja salvar assim mesmo?"
      );
      if (!ok) return;
    }

    const api = fb();
    if (!api || !api.isAdminUser()) {
      notify("Entre no Painel do Administrador para salvar a programação.");
      return;
    }

    const saveButton = form.querySelector('button[type="submit"]');
    const oldText = saveButton.textContent;
    saveButton.disabled = true;
    saveButton.textContent = "Salvando...";

    try {
      await api.saveIrrigationSchedule(zone, payloadFor(zone));
      notify(`Programação da Zona ${zone} salva no Firebase.`);
    } catch (error) {
      console.error("Irrigação programada:", error);
      notify(`Falha ao salvar a programação da Zona ${zone}.`);
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = oldText;
    }
  }

  function applyRemoteZone(zone, data) {
    const cfg = data?.config || {};
    zoneMeta[zone].name = String(cfg.nome || `Zona ${zone}`);
    zoneMeta[zone].min = clamp(cfg.minimo ?? zoneMeta[zone].min, 0, 100);
    scheduleState[zone] = normalizeSchedule(cfg.programacao, zone);

    if (document.getElementById("view-programacao")?.classList.contains("active")) {
      renderSchedules();
    }
  }

  function updateAuthUi() {
    const pill = document.getElementById("scheduleAuthPill");
    if (!pill) return;
    if (currentAdmin) {
      pill.className = "pill success";
      pill.textContent = "🔓 Administrador — edição liberada";
    } else {
      pill.className = "pill warning";
      pill.textContent = "🔒 Somente leitura";
    }
  }

  function connectFirebase() {
    const api = fb();
    if (!api) {
      setTimeout(connectFirebase, 150);
      return;
    }

    api.listenZone(1, data => applyRemoteZone(1, data));
    api.listenZone(2, data => applyRemoteZone(2, data));
    api.listenAuth(user => {
      currentAdmin = api.isAdminUser(user) ? user : null;
      updateAuthUi();
    });
  }

  function init() {
    if (initialized) return;
    initialized = true;
    injectStyles();
    injectNavigation();
    injectView();
    scheduleState[1] = defaultSchedule(1);
    scheduleState[2] = defaultSchedule(2);
    renderSchedules();
    connectFirebase();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
