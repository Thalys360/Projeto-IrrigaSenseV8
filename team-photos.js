import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  onValue,
  set,
  remove
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCUW_e3RKDbZuQreIkvtopdK6wTDKV6klE",
  authDomain: "irrigasensev8.firebaseapp.com",
  databaseURL: "https://irrigasensev8-default-rtdb.firebaseio.com/",
  projectId: "irrigasensev8",
  storageBucket: "irrigasensev8.firebasestorage.app",
  messagingSenderId: "974260083261",
  appId: "1:974260083261:web:7a8ec272ef36c6e42ee854"
};

const ADMIN_UID = "ruk4pA6CsNbkYmgKK90Dg0wc9s63";
const TEAM_PATH = "irrigasense/config/teamPhotos";

const members = [
  { key: "thalys", name: "Thalys Eduardo da Silva Lourenço", initials: "TE" },
  { key: "mary", name: "Mary Ellen Karla Sales Cabral", initials: "ME" },
  { key: "eduarda", name: "Maria Eduarda Sales Cabral", initials: "ME" },
  { key: "eriberto", name: "Prof. Dr. Eriberto Vagner de Souza Freitas", initials: "EV" },
  { key: "rayanna", name: "Profª Dra. Rayanna Campos Ferreira", initials: "RC" },
  { key: "pedro", name: "Pedro Kaio Gonçalves Penha", initials: "PK" }
];

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

let currentPhotos = {};
let pendingPhotos = {};

function injectStyles() {
  const style = document.createElement("style");
  style.textContent = `
    .team-card .avatar{
      overflow:hidden;
      position:relative;
      display:grid;
      place-items:center;
    }
    .team-card .avatar img.team-photo{
      width:100%;
      height:100%;
      object-fit:cover;
      border-radius:inherit;
      display:block;
    }
    .team-photo-admin-btn{margin-top:14px}
    .tp-modal-backdrop{
      position:fixed;
      inset:0;
      background:rgba(0,0,0,.62);
      display:none;
      align-items:center;
      justify-content:center;
      padding:18px;
      z-index:9999;
    }
    .tp-modal-backdrop.open{display:flex}
    .tp-modal{
      width:min(980px,100%);
      max-height:92vh;
      overflow:auto;
      background:var(--surface,#fff);
      color:var(--text,#173127);
      border-radius:22px;
      padding:22px;
      box-shadow:0 30px 80px rgba(0,0,0,.28);
    }
    .tp-head{
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:16px;
      margin-bottom:16px;
    }
    .tp-head h3{margin:0 0 6px}
    .tp-head p{margin:0;opacity:.75}
    .tp-close{
      border:0;
      background:transparent;
      font-size:30px;
      cursor:pointer;
      color:inherit;
    }
    .tp-login{
      display:grid;
      gap:12px;
      max-width:460px;
      margin:18px auto;
    }
    .tp-login input{
      width:100%;
      padding:12px 14px;
      border:1px solid rgba(128,128,128,.35);
      border-radius:12px;
      background:transparent;
      color:inherit;
    }
    .tp-login button,.tp-save,.tp-remove,.tp-logout{
      border:0;
      border-radius:12px;
      padding:11px 14px;
      font-weight:700;
      cursor:pointer;
    }
    .tp-login button,.tp-save{background:#0b6b45;color:#fff}
    .tp-remove{background:#b42318;color:#fff}
    .tp-logout{background:rgba(128,128,128,.14);color:inherit}
    .tp-status{min-height:22px;font-size:.92rem;margin-top:8px}
    .tp-grid{
      display:grid;
      grid-template-columns:repeat(3,minmax(0,1fr));
      gap:14px;
    }
    .tp-person{
      border:1px solid rgba(128,128,128,.22);
      border-radius:16px;
      padding:14px;
      display:grid;
      gap:10px;
    }
    .tp-person-preview{
      width:110px;
      height:110px;
      border-radius:50%;
      overflow:hidden;
      background:rgba(128,128,128,.12);
      display:grid;
      place-items:center;
      font-weight:800;
      font-size:24px;
      margin:auto;
    }
    .tp-person-preview img{
      width:100%;
      height:100%;
      object-fit:cover;
    }
    .tp-person strong{text-align:center}
    .tp-person input{width:100%}
    .tp-actions{display:flex;gap:8px}
    .tp-actions button{flex:1}
    .tp-admin-top{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      margin-bottom:16px;
      padding:10px 12px;
      border-radius:12px;
      background:rgba(11,107,69,.08);
    }
    @media(max-width:760px){
      .tp-grid{grid-template-columns:1fr}
      .tp-modal{padding:16px}
      .tp-person-preview{width:96px;height:96px}
    }
  `;
  document.head.appendChild(style);
}

function teamCards() {
  return [...document.querySelectorAll(".team-grid .team-card")];
}

function renderPublicPhotos(photos = {}) {
  const cards = teamCards();

  members.forEach((member, index) => {
    const card = cards[index];
    if (!card) return;

    const avatar = card.querySelector(".avatar");
    if (!avatar) return;

    const dataUrl = photos?.[member.key]?.dataUrl;

    if (dataUrl) {
      avatar.innerHTML =
        `<img class="team-photo" src="${dataUrl}" alt="Foto de ${member.name}">`;
    } else {
      avatar.textContent = member.initials;
    }
  });
}

function buildManagerButton() {
  const grid = document.querySelector(".team-grid");
  if (!grid || document.getElementById("teamPhotoManagerBtn")) return;

  const btn = document.createElement("button");
  btn.id = "teamPhotoManagerBtn";
  btn.type = "button";
  btn.className = "btn ghost team-photo-admin-btn";
  btn.textContent = "🔐 Gerenciar fotos da equipe";

  grid.parentElement.insertBefore(btn, grid);
  btn.addEventListener("click", openModal);
}

function buildModal() {
  if (document.getElementById("teamPhotoModal")) return;

  const wrap = document.createElement("div");
  wrap.id = "teamPhotoModal";
  wrap.className = "tp-modal-backdrop";

  wrap.innerHTML = `
    <div class="tp-modal" role="dialog" aria-modal="true" aria-labelledby="tpTitle">
      <div class="tp-head">
        <div>
          <h3 id="tpTitle">Fotos da equipe</h3>
          <p>Entre como administrador para adicionar, trocar ou remover as fotos.</p>
        </div>
        <button class="tp-close" id="tpClose" type="button" aria-label="Fechar">×</button>
      </div>
      <div id="tpBody"></div>
    </div>
  `;

  document.body.appendChild(wrap);

  wrap.addEventListener("click", (event) => {
    if (event.target === wrap) closeModal();
  });

  wrap.querySelector("#tpClose").addEventListener("click", closeModal);
}

function openModal() {
  buildModal();
  document.getElementById("teamPhotoModal").classList.add("open");
  document.body.style.overflow = "hidden";
  renderAuthView(auth.currentUser);
}

function closeModal() {
  document.getElementById("teamPhotoModal")?.classList.remove("open");
  document.body.style.overflow = "";
  pendingPhotos = {};
}

function renderAuthView(user) {
  const body = document.getElementById("tpBody");
  if (!body) return;

  if (!user || user.uid !== ADMIN_UID) {
    body.innerHTML = `
      <form class="tp-login" id="tpLoginForm">
        <input id="tpEmail" type="email"
          autocomplete="username"
          placeholder="E-mail do administrador" required>
        <input id="tpPassword" type="password"
          autocomplete="current-password"
          placeholder="Senha" required>
        <button type="submit">Entrar</button>
        <div class="tp-status" id="tpLoginStatus"></div>
      </form>
    `;

    body.querySelector("#tpLoginForm")
      .addEventListener("submit", doLogin);

    return;
  }

  renderManager();
}

async function doLogin(event) {
  event.preventDefault();

  const status = document.getElementById("tpLoginStatus");
  const email = document.getElementById("tpEmail").value.trim();
  const password = document.getElementById("tpPassword").value;

  status.textContent = "Entrando...";

  try {
    const credential =
      await signInWithEmailAndPassword(auth, email, password);

    if (credential.user.uid !== ADMIN_UID) {
      await signOut(auth);
      status.textContent =
        "Esta conta não possui permissão de administrador.";
      return;
    }

    status.textContent = "";
    renderManager();
  } catch (error) {
    console.error(error);
    status.textContent =
      "Não foi possível entrar. Confira e-mail e senha.";
  }
}

function renderManager() {
  const body = document.getElementById("tpBody");

  body.innerHTML = `
    <div class="tp-admin-top">
      <strong>Administrador autenticado</strong>
      <button class="tp-logout" id="tpLogout" type="button">Sair</button>
    </div>

    <div class="tp-grid" id="tpGrid"></div>
    <div class="tp-status" id="tpManagerStatus"></div>
  `;

  document.getElementById("tpLogout")
    .addEventListener("click", async () => {
      await signOut(auth);
      renderAuthView(null);
    });

  const grid = document.getElementById("tpGrid");

  members.forEach((member) => {
    const dataUrl = currentPhotos?.[member.key]?.dataUrl || "";

    const card = document.createElement("div");
    card.className = "tp-person";

    card.innerHTML = `
      <div class="tp-person-preview" id="prev-${member.key}">
        ${
          dataUrl
            ? `<img src="${dataUrl}" alt="${member.name}">`
            : member.initials
        }
      </div>

      <strong>${member.name}</strong>

      <input
        type="file"
        accept="image/*"
        id="file-${member.key}"
      >

      <div class="tp-actions">
        <button class="tp-save" type="button"
          data-save="${member.key}">Salvar</button>

        <button class="tp-remove" type="button"
          data-remove="${member.key}">Remover</button>
      </div>
    `;

    grid.appendChild(card);

    card.querySelector(`#file-${member.key}`)
      .addEventListener("change", (event) => {
        previewFile(member, event.target.files?.[0]);
      });
  });

  grid.addEventListener("click", async (event) => {
    const saveKey = event.target.dataset.save;
    const removeKey = event.target.dataset.remove;

    if (saveKey) await savePhoto(saveKey);
    if (removeKey) await removePhoto(removeKey);
  });
}

async function previewFile(member, file) {
  if (!file) return;

  const status = document.getElementById("tpManagerStatus");

  if (!file.type.startsWith("image/")) {
    status.textContent = "Selecione um arquivo de imagem.";
    return;
  }

  status.textContent = "Preparando imagem...";

  try {
    const dataUrl = await compressImage(file);

    pendingPhotos[member.key] = dataUrl;

    document.getElementById(`prev-${member.key}`).innerHTML =
      `<img src="${dataUrl}" alt="${member.name}">`;

    status.textContent =
      "Pré-visualização pronta. Clique em Salvar.";
  } catch (error) {
    console.error(error);
    status.textContent =
      "Não foi possível preparar esta imagem.";
  }
}

function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = reject;

    reader.onload = () => {
      const image = new Image();

      image.onerror = reject;
      image.onload = () => resolve(image);
      image.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
}

async function compressImage(file) {
  const image = await fileToImage(file);

  const maxSide = 700;
  const scale =
    Math.min(1, maxSide / Math.max(image.width, image.height));

  const canvas = document.createElement("canvas");

  canvas.width =
    Math.max(1, Math.round(image.width * scale));

  canvas.height =
    Math.max(1, Math.round(image.height * scale));

  const context =
    canvas.getContext("2d", { alpha: false });

  context.drawImage(
    image,
    0,
    0,
    canvas.width,
    canvas.height
  );

  let quality = 0.82;
  let dataUrl =
    canvas.toDataURL("image/jpeg", quality);

  while (
    dataUrl.length > 500000 &&
    quality > 0.48
  ) {
    quality -= 0.08;

    dataUrl =
      canvas.toDataURL("image/jpeg", quality);
  }

  if (dataUrl.length > 650000) {
    throw new Error("Imagem muito grande");
  }

  return dataUrl;
}

async function savePhoto(key) {
  const status =
    document.getElementById("tpManagerStatus");

  const dataUrl = pendingPhotos[key];

  if (!dataUrl) {
    status.textContent =
      "Escolha uma nova foto antes de salvar.";
    return;
  }

  if (
    !auth.currentUser ||
    auth.currentUser.uid !== ADMIN_UID
  ) {
    status.textContent =
      "Sessão de administrador inválida.";
    return;
  }

  status.textContent = "Salvando...";

  try {
    await set(
      ref(db, `${TEAM_PATH}/${key}`),
      {
        dataUrl,
        updatedAt: Date.now()
      }
    );

    delete pendingPhotos[key];

    status.textContent =
      "Foto salva. Ela já aparecerá no site em outros aparelhos.";
  } catch (error) {
    console.error(error);

    status.textContent =
      "Erro ao salvar. Verifique as regras do Firebase.";
  }
}

async function removePhoto(key) {
  const status =
    document.getElementById("tpManagerStatus");

  if (
    !auth.currentUser ||
    auth.currentUser.uid !== ADMIN_UID
  ) return;

  if (!confirm("Remover a foto desta pessoa?")) {
    return;
  }

  status.textContent = "Removendo...";

  try {
    await remove(
      ref(db, `${TEAM_PATH}/${key}`)
    );

    delete pendingPhotos[key];

    status.textContent = "Foto removida.";
    renderManager();
  } catch (error) {
    console.error(error);
    status.textContent =
      "Não foi possível remover a foto.";
  }
}

function init() {
  injectStyles();
  buildManagerButton();
  buildModal();

  onValue(
    ref(db, TEAM_PATH),
    (snapshot) => {
      currentPhotos = snapshot.val() || {};

      renderPublicPhotos(currentPhotos);

      if (
        document.getElementById("teamPhotoModal")
          ?.classList.contains("open") &&
        auth.currentUser?.uid === ADMIN_UID
      ) {
        renderManager();
      }
    },
    (error) => {
      console.warn(
        "IrrigaSense: fotos da equipe indisponíveis",
        error
      );
    }
  );

  onAuthStateChanged(auth, (user) => {
    if (
      document.getElementById("teamPhotoModal")
        ?.classList.contains("open")
    ) {
      renderAuthView(user);
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
