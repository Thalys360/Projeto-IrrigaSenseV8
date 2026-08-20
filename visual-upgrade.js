(() => {
  "use strict";

  const WIKI_TITLES = {
    "Alface":"Alface",
    "Tomate":"Tomate",
    "Cebola":"Cebola",
    "Cebolinha":"Allium schoenoprasum",
    "Coentro":"Coentro",
    "Cenoura":"Cenoura",
    "Batata":"Batata",
    "Batata-doce":"Batata-doce",
    "Pimentão":"Pimentão",
    "Pimenta":"Pimenta",
    "Abóbora":"Abóbora",
    "Abobrinha":"Abobrinha",
    "Couve":"Couve",
    "Beterraba":"Beterraba",
    "Alho":"Alho",
    "Feijão":"Feijão",
    "Milho":"Milho",
    "Trigo":"Trigo",
    "Mandioca":"Mandioca",
    "Arroz":"Arroz",
    "Soja":"Soja"
  };

  const FALLBACK = {
    "Alface":"🥬","Tomate":"🍅","Cebola":"🧅","Cebolinha":"🌿","Coentro":"🌿",
    "Cenoura":"🥕","Batata":"🥔","Batata-doce":"🍠","Pimentão":"🫑","Pimenta":"🌶️",
    "Abóbora":"🎃","Abobrinha":"🥒","Couve":"🥬","Beterraba":"🫜","Alho":"🧄",
    "Feijão":"🫘","Milho":"🌽","Trigo":"🌾","Mandioca":"🌱","Arroz":"🌾","Soja":"🌱",
    "Outra / Personalizada":"🌱"
  };

  const imageCache = new Map();

  function injectStyles() {
    if (document.getElementById("irrigasenseVisualUpgradeStyles")) return;
    const style = document.createElement("style");
    style.id = "irrigasenseVisualUpgradeStyles";
    style.textContent = `
      :root{
        --brand-deep:#073d2c;
        --brand-green:#2e8b3c;
        --brand-lime:#77b72b;
      }

      .sidebar{
        background:
          radial-gradient(circle at 35% 12%,rgba(73,156,69,.20),transparent 28%),
          linear-gradient(180deg,#06392d 0%,#032d25 100%);
      }

      .brand-mark{
        background:rgba(255,255,255,.10)!important;
        box-shadow:inset 0 0 0 1px rgba(255,255,255,.08);
      }

      .hero{
        position:relative;
        overflow:hidden;
        min-height:520px;
        background:
          linear-gradient(90deg,rgba(255,255,255,.98) 0%,rgba(255,255,255,.94) 43%,rgba(239,249,244,.54) 66%,rgba(235,248,242,.15) 100%),
          url("assets/irrigasense-banner.jpeg") center/cover no-repeat!important;
        border:1px solid rgba(26,108,69,.12);
        box-shadow:0 24px 60px rgba(18,74,49,.13);
      }

      body.dark .hero{
        background:
          linear-gradient(90deg,rgba(12,29,23,.98) 0%,rgba(12,29,23,.93) 44%,rgba(12,29,23,.62) 70%,rgba(12,29,23,.25) 100%),
          url("assets/irrigasense-banner.jpeg") center/cover no-repeat!important;
      }

      .hero-copy{
        position:relative;
        z-index:3;
        max-width:650px;
      }

      .hero-copy h2{
        max-width:620px;
        font-size:clamp(2.2rem,5vw,4.6rem);
        line-height:.98;
        letter-spacing:-.045em;
      }

      .hero-copy h2::after{
        content:" 🌱";
        color:var(--green);
        font-size:.55em;
      }

      .hero-visual{
        position:relative;
        z-index:2;
        min-height:430px;
        display:flex!important;
        align-items:flex-end!important;
        justify-content:center!important;
      }

      .hero-plant{
        display:none!important;
      }

      .irrigasense-mascot-hero{
        width:min(470px,92%);
        max-height:440px;
        object-fit:contain;
        filter:drop-shadow(0 26px 26px rgba(0,38,22,.22));
        transform:translateY(20px);
        animation:mascotFloat 4.8s ease-in-out infinite;
      }

      @keyframes mascotFloat{
        0%,100%{transform:translateY(20px)}
        50%{transform:translateY(10px)}
      }

      .hero .floating-card{
        z-index:4;
        backdrop-filter:blur(12px);
        background:rgba(255,255,255,.88)!important;
        border:1px solid rgba(255,255,255,.74)!important;
        box-shadow:0 12px 28px rgba(14,64,43,.14)!important;
      }

      body.dark .hero .floating-card{
        background:rgba(14,34,27,.88)!important;
        border-color:rgba(255,255,255,.08)!important;
      }

      .zone-card{
        position:relative;
        overflow:hidden;
      }

      .crop-photo-shell{
        position:absolute;
        top:74px;
        right:22px;
        width:118px;
        height:92px;
        border-radius:20px;
        overflow:hidden;
        border:1px solid var(--border);
        background:var(--surface2);
        box-shadow:0 10px 24px rgba(20,78,54,.10);
        z-index:1;
      }

      .crop-photo-shell img{
        width:100%;
        height:100%;
        object-fit:cover;
        display:block;
      }

      .crop-photo-fallback{
        width:100%;
        height:100%;
        display:grid;
        place-items:center;
        font-size:3rem;
        background:linear-gradient(145deg,rgba(80,164,73,.14),rgba(216,238,214,.54));
      }

      .culture-preview{
        margin:-2px 0 8px;
        display:grid;
        grid-template-columns:96px 1fr;
        align-items:center;
        gap:14px;
        padding:12px;
        border:1px solid var(--border);
        border-radius:18px;
        background:var(--surface2);
      }

      .culture-preview-media{
        width:96px;
        height:74px;
        border-radius:14px;
        overflow:hidden;
        background:var(--surface);
        border:1px solid var(--border);
      }

      .culture-preview-media img{
        width:100%;
        height:100%;
        object-fit:cover;
      }

      .culture-preview-copy strong{
        display:block;
        font-size:1rem;
      }

      .culture-preview-copy small{
        display:block;
        color:var(--muted);
        margin-top:4px;
        line-height:1.35;
      }

      .assistant-card{
        position:relative;
        overflow:hidden;
      }

      .assistant-card .assistant-icon{
        width:150px!important;
        height:150px!important;
        border-radius:28px!important;
        overflow:hidden;
        background:linear-gradient(145deg,#eef8ef,#dcefdc)!important;
        flex:0 0 auto;
      }

      .assistant-card .assistant-icon img{
        width:100%;
        height:100%;
        object-fit:contain;
        padding:8px;
      }

      .footer{
        position:relative;
        overflow:hidden;
      }

      .footer::after{
        content:"";
        width:76px;
        height:76px;
        background:url("assets/irrigasense-mascote.png") center/contain no-repeat;
        opacity:.9;
        flex:0 0 auto;
      }

      .feature-card,.summary-card,.system-card,.zone-card,.config-card{
        transition:transform .22s ease,box-shadow .22s ease;
      }

      .feature-card:hover,.zone-card:hover,.config-card:hover{
        transform:translateY(-3px);
        box-shadow:0 18px 36px rgba(17,75,49,.10);
      }

      @media(max-width:1000px){
        .hero{
          min-height:auto;
          background:
            linear-gradient(180deg,rgba(255,255,255,.98) 0%,rgba(255,255,255,.92) 52%,rgba(239,249,244,.58) 100%),
            url("assets/irrigasense-banner.jpeg") center/cover no-repeat!important;
        }
        body.dark .hero{
          background:
            linear-gradient(180deg,rgba(12,29,23,.98) 0%,rgba(12,29,23,.92) 52%,rgba(12,29,23,.60) 100%),
            url("assets/irrigasense-banner.jpeg") center/cover no-repeat!important;
        }
        .irrigasense-mascot-hero{max-height:330px}
      }

      @media(max-width:640px){
        .hero-copy h2{font-size:2.35rem}
        .irrigasense-mascot-hero{width:85%;max-height:290px}
        .crop-photo-shell{
          position:relative;
          inset:auto;
          width:100%;
          height:150px;
          margin:14px 0 6px;
        }
        .culture-preview{
          grid-template-columns:78px 1fr;
        }
        .culture-preview-media{
          width:78px;
          height:68px;
        }
        .footer::after{display:none}
      }
    `;
    document.head.appendChild(style);
  }

  async function getCultureImage(culture) {
    const name = String(culture || "").trim();
    if (!name || name === "Outra / Personalizada") return null;
    if (imageCache.has(name)) return imageCache.get(name);

    const title = WIKI_TITLES[name] || name;
    const endpoint =
      "https://pt.wikipedia.org/w/api.php" +
      "?action=query&format=json&origin=*" +
      "&prop=pageimages&pithumbsize=600&redirects=1&titles=" +
      encodeURIComponent(title);

    try {
      const response = await fetch(endpoint, { mode:"cors" });
      if (!response.ok) throw new Error("HTTP_" + response.status);
      const data = await response.json();
      const pages = data?.query?.pages || {};
      const page = Object.values(pages)[0];
      const src = page?.thumbnail?.source || null;
      imageCache.set(name, src);
      return src;
    } catch (error) {
      console.warn("Imagem da cultura indisponível:", name, error);
      imageCache.set(name, null);
      return null;
    }
  }

  function mediaMarkup(culture, src) {
    if (src) {
      return `<img src="${src}" alt="${String(culture).replace(/"/g,"&quot;")}" loading="lazy" referrerpolicy="no-referrer">`;
    }
    return `<div class="crop-photo-fallback">${FALLBACK[culture] || "🌱"}</div>`;
  }

  async function updateZoneVisual(zone) {
    const cropText =
      document.getElementById(`dashCrop${zone}`)?.textContent?.trim() ||
      document.getElementById(`culture${zone}`)?.value ||
      "Outra / Personalizada";

    const img = await getCultureImage(cropText);

    const shell = document.getElementById(`cropPhotoShell${zone}`);
    if (shell) shell.innerHTML = mediaMarkup(cropText, img);

    const previewMedia = document.getElementById(`culturePreviewMedia${zone}`);
    if (previewMedia) previewMedia.innerHTML = mediaMarkup(cropText, img);

    const previewName = document.getElementById(`culturePreviewName${zone}`);
    if (previewName) previewName.textContent = cropText;
  }

  function injectMascot() {
    const heroVisual = document.querySelector(".hero-visual");
    if (heroVisual && !document.getElementById("irrigasenseMascotHero")) {
      const img = document.createElement("img");
      img.id = "irrigasenseMascotHero";
      img.className = "irrigasense-mascot-hero";
      img.src = "assets/irrigasense-mascote.png";
      img.alt = "Mascote do IrrigaSense";
      heroVisual.prepend(img);
    }

    const assistantIcon = document.querySelector(".assistant-card .assistant-icon");
    if (assistantIcon && !assistantIcon.querySelector("img")) {
      assistantIcon.innerHTML =
        '<img src="assets/irrigasense-mascote.png" alt="Assistente IrrigaSense">';
    }
  }

  function injectCultureSlots() {
    [1,2].forEach(zone => {
      const card = document.querySelectorAll(".zone-card")[zone - 1];
      if (card && !document.getElementById(`cropPhotoShell${zone}`)) {
        const shell = document.createElement("div");
        shell.id = `cropPhotoShell${zone}`;
        shell.className = "crop-photo-shell";
        shell.innerHTML = `<div class="crop-photo-fallback">${zone === 1 ? "🍅" : "🫘"}</div>`;
        card.appendChild(shell);
      }

      const select = document.getElementById(`culture${zone}`);
      if (select && !document.getElementById(`culturePreview${zone}`)) {
        const preview = document.createElement("div");
        preview.id = `culturePreview${zone}`;
        preview.className = "culture-preview";
        preview.innerHTML = `
          <div class="culture-preview-media" id="culturePreviewMedia${zone}">
            <div class="crop-photo-fallback">🌱</div>
          </div>
          <div class="culture-preview-copy">
            <strong id="culturePreviewName${zone}">Cultura</strong>
            <small>Imagem ilustrativa obtida automaticamente para facilitar a identificação da planta.</small>
          </div>
        `;
        select.closest("label")?.insertAdjacentElement("afterend", preview);

        select.addEventListener("change", () => {
          setTimeout(() => updateZoneVisual(zone), 30);
        });
      }
    });
  }

  function watchRemoteChanges() {
    [1,2].forEach(zone => {
      const target = document.getElementById(`dashCrop${zone}`);
      if (!target) return;
      new MutationObserver(() => updateZoneVisual(zone))
        .observe(target, { childList:true, subtree:true, characterData:true });
    });
  }

  function refreshAll() {
    injectMascot();
    injectCultureSlots();
    updateZoneVisual(1);
    updateZoneVisual(2);
  }

  function init() {
    injectStyles();
    refreshAll();
    watchRemoteChanges();

    // Reaplica após carregamentos dinâmicos do Firebase.
    setTimeout(refreshAll, 700);
    setTimeout(refreshAll, 1800);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once:true });
  } else {
    init();
  }
})();
