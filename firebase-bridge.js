import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {
  getDatabase, ref, onValue, get, set, update, push, remove,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCUW_e3RKDbZuQreIkvtopdK6wTDKV6klE",
  authDomain: "irrigasensev8.firebaseapp.com",
  databaseURL: "https://irrigasensev8-default-rtdb.firebaseio.com/",
  projectId: "irrigasensev8",
  storageBucket: "irrigasensev8.firebasestorage.app",
  messagingSenderId: "974260083261",
  appId: "1:974260083261:web:7a8ec272ef36c6e42ee854",
  measurementId: "G-LBXLB45TD1"
};

const ADMIN_UID = "ruk4pA6CsNbkYmgKK90Dg0wc9s63";
const DEFAULT_MANUAL_PIN_HASH = "335257680320806b067d51b641477e7705278d63c1330af399a5f39d9a0ad8b8";

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getDatabase(firebaseApp);

function isAdminUser(user = auth.currentUser) {
  return !!user && user.uid === ADMIN_UID;
}

function requireAdmin() {
  if (!isAdminUser()) throw new Error("ADMIN_REQUIRED");
}

async function signInAdmin(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  if (cred.user.uid !== ADMIN_UID) {
    await signOut(auth);
    throw new Error("UNAUTHORIZED_UID");
  }
  return cred.user;
}

async function signOutAdmin() {
  await signOut(auth);
}

async function resetAdminPassword(email) {
  if (!email) throw new Error("EMAIL_REQUIRED");
  await sendPasswordResetEmail(auth, email);
}

function listenAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

function listenConnection(callback) {
  return onValue(ref(db, ".info/connected"), snap => callback(snap.val() === true));
}

function listenZone(zone, callback) {
  return onValue(ref(db, `irrigasense/zonas/zona${zone}`), snap => callback(snap.val() || null));
}

function listenSystem(callback) {
  return onValue(ref(db, "irrigasense/sistema"), snap => callback(snap.val() || null));
}

function listenHistory(callback) {
  return onValue(ref(db, "irrigasense/historico"), snap => callback(snap.val() || {}));
}

function listenTeamPhotos(callback) {
  return onValue(
    ref(db, "irrigasense/config/teamPhotos"),
    snap => callback(snap.exists() ? snap.val() : null)
  );
}

function listenGallery(callback) {
  return onValue(
    ref(db, "irrigasense/config/gallery"),
    snap => callback(snap.exists() ? snap.val() : null)
  );
}

async function ensureAdminSetup(initial) {
  requireAdmin();

  const securityRef = ref(db, "irrigasense/security/manualPinHash");
  const securitySnap = await get(securityRef);
  if (!securitySnap.exists()) await set(securityRef, DEFAULT_MANUAL_PIN_HASH);

  for (const z of [1,2]) {
    const cfgRef = ref(db, `irrigasense/zonas/zona${z}/config`);
    const cfgSnap = await get(cfgRef);
    if (!cfgSnap.exists() && initial?.zones?.[z-1]) {
      await set(cfgRef, initial.zones[z-1]);
    }
  }

  const systemCfg = ref(db, "irrigasense/sistema/config");
  if (!(await get(systemCfg)).exists()) {
    await set(systemCfg, {
      modo: "automatico",
      protecaoOffline: true,
      atualizadoEm: serverTimestamp()
    });
  }

  const flowRef = ref(db, "irrigasense/config/vazoesEstimadas");
  if (!(await get(flowRef)).exists() && initial?.flowRates) {
    await set(flowRef, initial.flowRates);
  }

  for (const s of [1,2]) {
    const calRef = ref(db, `irrigasense/calibracao/sensor${s}`);
    if (!(await get(calRef)).exists() && initial?.calibration?.[`sensor${s}`]) {
      await set(calRef, initial.calibration[`sensor${s}`]);
    }
  }
}

async function saveZoneConfig(zone, config) {
  requireAdmin();
  await set(ref(db, `irrigasense/zonas/zona${zone}/config`), {
    ...config,
    atualizadoEm: serverTimestamp()
  });
}

async function saveCalibration(sensor, data) {
  requireAdmin();
  await set(ref(db, `irrigasense/calibracao/sensor${sensor}`), {
    ...data,
    atualizadoEm: serverTimestamp()
  });
}

async function saveFlowRates(data) {
  requireAdmin();
  await set(ref(db, "irrigasense/config/vazoesEstimadas"), {
    ...data,
    atualizadoEm: serverTimestamp()
  });
}

async function saveTeamPhoto(memberId, dataUrl) {
  requireAdmin();
  if (!memberId || !dataUrl) throw new Error("INVALID_TEAM_PHOTO");
  await set(ref(db, `irrigasense/config/teamPhotos/${memberId}`), {
    dataUrl,
    atualizadoEmCliente: Date.now()
  });
}

async function removeTeamPhoto(memberId) {
  requireAdmin();
  await remove(ref(db, `irrigasense/config/teamPhotos/${memberId}`));
}

function cleanGalleryItem(item, order = 0) {
  return {
    id: Number(item.id),
    src: String(item.src || ""),
    title: String(item.title || ""),
    caption: String(item.caption || ""),
    date: String(item.date || ""),
    featured: !!item.featured,
    order: Number(order)
  };
}

async function saveGalleryItem(item, order = 0) {
  requireAdmin();
  if (!item || !item.id || !item.src) throw new Error("INVALID_GALLERY_ITEM");
  await set(
    ref(db, `irrigasense/config/gallery/${String(item.id)}`),
    cleanGalleryItem(item, order)
  );
}

async function removeGalleryItem(id) {
  requireAdmin();
  await remove(ref(db, `irrigasense/config/gallery/${String(id)}`));
}

async function saveGalleryOrder(items) {
  requireAdmin();
  if (!Array.isArray(items) || !items.length) return;
  const updates = {};
  items.forEach((item, index) => {
    updates[`${String(item.id)}/order`] = index;
  });
  await update(ref(db, "irrigasense/config/gallery"), updates);
}

// Compatibilidade com versões anteriores. Evite usar para galerias grandes.
async function saveGallery(items) {
  requireAdmin();
  if (!Array.isArray(items)) return;
  for (let index = 0; index < items.length; index++) {
    await saveGalleryItem(items[index], index);
  }
}

async function saveProfile(profile) {
  requireAdmin();
  await set(ref(db, `irrigasense/perfis/${profile.id}`), profile);
}

async function deleteProfile(id) {
  requireAdmin();
  await remove(ref(db, `irrigasense/perfis/${id}`));
}

async function getManualPinHash() {
  requireAdmin();
  const snap = await get(ref(db, "irrigasense/security/manualPinHash"));
  return snap.val() || DEFAULT_MANUAL_PIN_HASH;
}

async function setManualPinHash(hash) {
  requireAdmin();
  await set(ref(db, "irrigasense/security/manualPinHash"), hash);
}

async function sendCommand(zone, action, durationSeconds = 0) {
  requireAdmin();

  const commandRef = push(ref(db, "irrigasense/comandos"));
  const id = commandRef.key;

  const command = {
    id,
    zona: Number(zone),
    acao: String(action),
    duracaoSegundos: Number(durationSeconds),
    status: "pendente",
    origem: "site",
    solicitadoPor: auth.currentUser.uid,
    criadoEmCliente: Date.now(),
    criadoEm: serverTimestamp()
  };

  await set(commandRef, command);
  return id;
}

function listenCommand(commandId, callback) {
  return onValue(ref(db, `irrigasense/comandos/${commandId}`), snap => callback(snap.val() || null));
}

async function addHistory(entry) {
  if (!auth.currentUser) return;
  const r = push(ref(db, "irrigasense/historico"));
  await set(r, {
    ...entry,
    uid: auth.currentUser.uid,
    timestamp: serverTimestamp(),
    timestampCliente: Date.now()
  });
}

async function clearHistory() {
  requireAdmin();
  await remove(ref(db, "irrigasense/historico"));
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2,"0")).join("");
}

window.IrrigaFirebase = {
  ADMIN_UID,
  auth,
  db,
  isAdminUser,
  signInAdmin,
  signOutAdmin,
  resetAdminPassword,
  listenAuth,
  listenConnection,
  listenZone,
  listenSystem,
  listenHistory,
  listenTeamPhotos,
  listenGallery,
  ensureAdminSetup,
  saveZoneConfig,
  saveCalibration,
  saveFlowRates,
  saveTeamPhoto,
  removeTeamPhoto,
  saveGalleryItem,
  removeGalleryItem,
  saveGalleryOrder,
  saveGallery,
  saveProfile,
  deleteProfile,
  getManualPinHash,
  setManualPinHash,
  sendCommand,
  listenCommand,
  addHistory,
  clearHistory,
  sha256
};

window.dispatchEvent(new CustomEvent("irrigasense-firebase-ready"));
