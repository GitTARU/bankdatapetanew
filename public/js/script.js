            // ── State ──
            let allMaps = [];
            let currentMap = null;
            let currentPins = [];
            let pinModeActive = false;
            let pendingPin = null; // { x_pct, y_pct } waiting for name
            let editingPinId = null;
            let pendingUploadFiles = [];
            let editingMapId = null;
            let searchTimer = null;

            // ── Toast ──
            function toast(msg, type = "success") {
                const el = document.getElementById("toast");
                el.textContent = msg;
                el.className = `show ${type}`;
                clearTimeout(el._t);
                el._t = setTimeout(() => el.classList.remove("show"), 3000);
            }

            // ── Spinner helper ──
            function setLoading(btn, loading, label = "Saving…") {
                if (loading) {
                    btn.disabled = true;
                    btn.innerHTML = `<span class="spinner"></span> ${label}`;
                } else {
                    btn.disabled = false;
                }
            }

            // ── Views ──
            function showGallery() {
                document.getElementById("view-gallery").classList.add("active");
                document
                    .getElementById("view-detail")
                    .classList.remove("active");
                document.getElementById("btn-back").style.display = "none";
                document.getElementById("btn-add-map").style.display = "";
                document.getElementById("header-search").style.display = "";
                document.getElementById("search-input").style.display = "";
                pinModeActive = false;
                currentMap = null;
                loadGallery(
                    document.getElementById("search-input").value.trim(),
                );
            }

            function showDetail(map) {
                currentMap = map;
                document
                    .getElementById("view-gallery")
                    .classList.remove("active");
                document.getElementById("view-detail").classList.add("active");
                document.getElementById("btn-back").style.display = "";
                document.getElementById("btn-add-map").style.display = "none";
                document.getElementById("header-search").style.display = "none";

                document.getElementById("detail-title").textContent = map.name;
                document.getElementById("detail-subtitle").textContent =
                    new Date(map.uploaded_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                    }) +
                    (map.file_size ? "  ·  " + formatBytes(map.file_size) : "");

                const img = document.getElementById("detail-map-img");
                img.src = `/uploads/${map.filename}`;
                img.alt = map.name;

                if (map.notes) {
                    document.getElementById("map-notes-box").textContent =
                        map.notes;
                    document.getElementById("map-notes-section").style.display =
                        "";
                } else {
                    document.getElementById("map-notes-section").style.display =
                        "none";
                }

                setPinMode(false);
                loadPins();
            }

            // ── Gallery ──
            async function loadGallery(q = "") {
                const grid = document.getElementById("gallery-grid");
                const loading = document.getElementById("loading-gallery");
                const empty = document.getElementById("empty-state");
                const noRes = document.getElementById("no-results");

                loading.style.display = "block";
                grid.style.display = "none";
                empty.style.display = "none";
                noRes.style.display = "none";

                try {
                    const url = q
                        ? `/api/maps?q=${encodeURIComponent(q)}`
                        : "/api/maps";
                    const res = await fetch(url);
                    if (!res.ok) throw new Error();
                    allMaps = await res.json();
                } catch {
                    toast("Could not load maps", "error");
                    loading.style.display = "none";
                    return;
                }

                loading.style.display = "none";

                const label = document.getElementById("count-label");
                if (!q) {
                    label.innerHTML =
                        allMaps.length === 0
                            ? "No maps in the archive yet."
                            : `<strong>${allMaps.length}</strong> map${allMaps.length === 1 ? "" : "s"} in the archive`;
                }

                if (!q && allMaps.length === 0) {
                    empty.style.display = "";
                    return;
                }
                if (allMaps.length === 0) {
                    noRes.style.display = "";
                    return;
                }

                grid.style.display = "";
                grid.innerHTML = allMaps
                    .map(
                        (m) => `
    <div class="map-card" data-id="${m.id}" onclick="openMap('${m.id}')">
      <img class="thumb" src="/uploads/${m.filename}" alt="${m.name}" loading="lazy">
      <div class="card-body">
        <div class="card-name" title="${m.name}">${m.name}</div>
        ${m.notes ? `<div class="card-note">${m.notes}</div>` : ""}
        <div class="card-meta">
          <span>${new Date(m.uploaded_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
          ${parseInt(m.pin_count) > 0 ? `<span class="pin-badge">${m.pin_count} pin${m.pin_count == 1 ? "" : "s"}</span>` : ""}
        </div>
      </div>
      <div class="card-actions">
        <button class="card-btn" title="Edit" onclick="startEditMap('${m.id}',event)">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 2l3 3-8 8H3v-3L11 2z"/></svg>
        </button>
        <button class="card-btn danger" title="Delete" onclick="deleteMap('${m.id}',event)">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9h8l1-9"/></svg>
        </button>
      </div>
    </div>
  `,
                    )
                    .join("");
            }

            async function openMap(id) {
                try {
                    const res = await fetch(`/api/maps/${id}`);
                    const map = await res.json();
                    showDetail(map);
                } catch {
                    toast("Could not open map", "error");
                }
            }

            // ── Upload / Edit Map Modal ──
            document
                .getElementById("file-input")
                .addEventListener("change", function (e) {
                    pendingUploadFiles = Array.from(e.target.files);
                    this.value = "";
                    if (pendingUploadFiles.length)
                        showUploadModal(pendingUploadFiles[0]);
                });

            function showUploadModal(file) {
                editingMapId = null;
                const reader = new FileReader();
                reader.onload = (e) => {
                    document.getElementById("modal-map-preview").src =
                        e.target.result;
                    document.getElementById("modal-map-preview").style.display =
                        "";
                };
                reader.readAsDataURL(file);

                document.getElementById("modal-map-title").textContent =
                    pendingUploadFiles.length > 1
                        ? `Add Map (${pendingUploadFiles.length} remaining)`
                        : "Add Map to Archive";
                document.getElementById("modal-map-name").value =
                    file.name.replace(/\.[^/.]+$/, "");
                document.getElementById("modal-map-notes").value = "";
                document.getElementById("upload-bar").style.display = "none";
                document.getElementById("btn-modal-map-save").textContent =
                    "Save to Archive";
                document.getElementById("btn-modal-map-save").disabled = false;
                openModal("modal-map");
            }

            function startEditMap(id, e) {
                e && e.stopPropagation();
                const map = allMaps.find((m) => m.id === id) || currentMap;
                if (!map) return;
                editingMapId = id;
                document.getElementById("modal-map-title").textContent =
                    "Edit Map Details";
                document.getElementById("modal-map-preview").src =
                    `/uploads/${map.filename}`;
                document.getElementById("modal-map-preview").style.display = "";
                document.getElementById("modal-map-name").value = map.name;
                document.getElementById("modal-map-notes").value =
                    map.notes || "";
                document.getElementById("upload-bar").style.display = "none";
                document.getElementById("btn-modal-map-save").textContent =
                    "Save Changes";
                document.getElementById("btn-modal-map-save").disabled = false;
                openModal("modal-map");
            }

            document.getElementById("btn-edit-map-meta").onclick = () => {
                if (currentMap) startEditMap(currentMap.id);
            };

            document.getElementById("btn-modal-map-save").onclick =
                async () => {
                    const btn = document.getElementById("btn-modal-map-save");
                    if (editingMapId) {
                        // Edit mode
                        const name = document
                            .getElementById("modal-map-name")
                            .value.trim();
                        const notes = document
                            .getElementById("modal-map-notes")
                            .value.trim();
                        setLoading(btn, true);
                        try {
                            const res = await fetch(
                                `/api/maps/${editingMapId}`,
                                {
                                    method: "PUT",
                                    headers: {
                                        "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify({ name, notes }),
                                },
                            );
                            if (!res.ok) throw new Error();
                            const updated = await res.json();
                            toast("Changes saved");
                            closeModal("modal-map");
                            if (currentMap && currentMap.id === editingMapId) {
                                currentMap = { ...currentMap, ...updated };
                                showDetail(currentMap);
                            }
                            loadGallery(
                                document
                                    .getElementById("search-input")
                                    .value.trim(),
                            );
                        } catch {
                            toast("Save failed", "error");
                        }
                        setLoading(btn, false);
                        btn.textContent = "Save Changes";
                    } else {
                        // Upload mode
                        const file = pendingUploadFiles[0];
                        const name =
                            document
                                .getElementById("modal-map-name")
                                .value.trim() || file.name;
                        const notes = document
                            .getElementById("modal-map-notes")
                            .value.trim();
                        setLoading(btn, true, "Uploading…");
                        document.getElementById("upload-bar").style.display =
                            "";

                        const formData = new FormData();
                        formData.append("image", file);
                        formData.append("name", name);
                        formData.append("notes", notes);

                        const xhr = new XMLHttpRequest();
                        xhr.open("POST", "/api/maps");
                        xhr.upload.onprogress = (e) => {
                            if (e.lengthComputable)
                                document.getElementById(
                                    "upload-progress",
                                ).value = Math.round(
                                    (e.loaded / e.total) * 100,
                                );
                        };
                        xhr.onload = () => {
                            if (xhr.status === 201) {
                                toast(`"${name}" added to archive`);
                                pendingUploadFiles.shift();
                                closeModal("modal-map");
                                loadGallery();
                                if (pendingUploadFiles.length)
                                    setTimeout(
                                        () =>
                                            showUploadModal(
                                                pendingUploadFiles[0],
                                            ),
                                        200,
                                    );
                            } else {
                                toast("Upload failed", "error");
                                btn.disabled = false;
                                btn.textContent = "Save to Archive";
                                document.getElementById(
                                    "upload-bar",
                                ).style.display = "none";
                            }
                        };
                        xhr.onerror = () => {
                            toast("Upload error", "error");
                            btn.disabled = false;
                            btn.textContent = "Save to Archive";
                        };
                        xhr.send(formData);
                    }
                };

            document.getElementById("btn-modal-map-cancel").onclick = () => {
                pendingUploadFiles = [];
                closeModal("modal-map");
            };

            async function deleteMap(id, e) {
                e && e.stopPropagation();
                const map = allMaps.find((m) => m.id === id) || currentMap;
                if (!map) return;
                if (
                    !confirm(
                        `Remove "${map.name}"? This will also delete all its pins and the image file.`,
                    )
                )
                    return;
                try {
                    const res = await fetch(`/api/maps/${id}`, {
                        method: "DELETE",
                    });
                    if (!res.ok) throw new Error();
                    toast(`"${map.name}" removed`);
                    if (currentMap && currentMap.id === id) showGallery();
                    else
                        loadGallery(
                            document
                                .getElementById("search-input")
                                .value.trim(),
                        );
                } catch {
                    toast("Delete failed", "error");
                }
            }

            // ── Pins ──
            async function loadPins() {
                if (!currentMap) return;
                try {
                    const res = await fetch(`/api/maps/${currentMap.id}/pins`);
                    currentPins = await res.json();
                } catch {
                    currentPins = [];
                }
                renderPins();
            }

            function renderPins() {
                renderPinOverlay();
                renderPinList();
            }

            function renderPinOverlay() {
                const overlay = document.getElementById("pins-overlay");
                const img = document.getElementById("detail-map-img");
                const w = img.clientWidth;
                const h = img.clientHeight;

                overlay.setAttribute("viewBox", `0 0 ${w} ${h}`);
                overlay.innerHTML = currentPins
                    .map((p, i) => {
                        const x = (parseFloat(p.x_pct) / 100) * w;
                        const y = (parseFloat(p.y_pct) / 100) * h;
                        return `
      <g class="pin-group" data-id="${p.id}"
         onmouseenter="showPinTooltip(event,'${p.id}')"
         onmouseleave="hidePinTooltip()"
         onclick="focusPin('${p.id}')">
        <circle class="pin-ring" cx="${x}" cy="${y}" r="9"/>
        <circle class="pin-dot"  cx="${x}" cy="${y}" r="7"/>
        <text class="pin-number" x="${x}" y="${y}">${i + 1}</text>
      </g>`;
                    })
                    .join("");
            }

            function renderPinList() {
                const list = document.getElementById("pin-list");
                if (!currentPins.length) {
                    list.innerHTML = `<div class="pin-empty">No pins yet — click "Drop a new pin" then click on the map.</div>`;
                    return;
                }
                list.innerHTML = currentPins
                    .map(
                        (p, i) => `
    <div class="pin-item" id="pin-item-${p.id}" onclick="focusPin('${p.id}')">
      <div class="pin-num">${i + 1}</div>
      <div class="pin-info">
        <div class="pin-road">${p.road_name}</div>
        ${p.notes ? `<div class="pin-notes-text">${p.notes}</div>` : ""}
      </div>
      <div class="pin-actions">
        <button class="pin-action-btn" title="Edit" onclick="startEditPin('${p.id}',event)">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 2l3 3-8 8H3v-3L11 2z"/></svg>
        </button>
        <button class="pin-action-btn danger" title="Delete" onclick="deletePin('${p.id}',event)">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9h8l1-9"/></svg>
        </button>
      </div>
    </div>
  `,
                    )
                    .join("");
            }

            function focusPin(id) {
                document
                    .querySelectorAll(".pin-item")
                    .forEach((el) => el.classList.remove("active"));
                document
                    .querySelectorAll(".pin-group")
                    .forEach((el) => el.classList.remove("active"));
                const item = document.getElementById(`pin-item-${id}`);
                if (item) {
                    item.classList.add("active");
                    item.scrollIntoView({
                        behavior: "smooth",
                        block: "nearest",
                    });
                }
                const grp = document.querySelector(
                    `.pin-group[data-id="${id}"]`,
                );
                if (grp) grp.classList.add("active");
            }

            function showPinTooltip(e, id) {
                const pin = currentPins.find((p) => p.id === id);
                if (!pin) return;
                const tooltip = document.getElementById("pin-tooltip");
                const wrap = document.getElementById("map-canvas-wrap");
                const wRect = wrap.getBoundingClientRect();
                const img = document.getElementById("detail-map-img");
                const x = (parseFloat(pin.x_pct) / 100) * img.clientWidth;
                const y = (parseFloat(pin.y_pct) / 100) * img.clientHeight;
                tooltip.textContent = pin.road_name;
                tooltip.style.left = x + "px";
                tooltip.style.top = y + "px";
                tooltip.classList.add("show");
            }

            function hidePinTooltip() {
                document.getElementById("pin-tooltip").classList.remove("show");
            }

            // ── Pin mode ──
            function togglePinMode() {
                setPinMode(!pinModeActive);
            }

            function setPinMode(active) {
                pinModeActive = active;
                const toggle = document.getElementById("pin-mode-toggle");
                const wrap = document.getElementById("map-canvas-wrap");
                const overlay = document.getElementById("pins-overlay");
                const banner = document.getElementById("pin-mode-banner");

                toggle.classList.toggle("active", active);
                wrap.classList.toggle("view-mode", !active);
                overlay.classList.toggle("pin-mode", active);
                banner.classList.toggle("visible", active);
            }

            // Click on map to place pin
            document
                .getElementById("map-canvas-wrap")
                .addEventListener("click", function (e) {
                    if (!pinModeActive) return;
                    if (e.target.closest(".pin-group")) return; // clicked existing pin

                    const img = document.getElementById("detail-map-img");
                    const rect = img.getBoundingClientRect();
                    const x_pct = ((e.clientX - rect.left) / rect.width) * 100;
                    const y_pct = ((e.clientY - rect.top) / rect.height) * 100;

                    if (x_pct < 0 || x_pct > 100 || y_pct < 0 || y_pct > 100)
                        return;

                    pendingPin = {
                        x_pct: parseFloat(x_pct.toFixed(3)),
                        y_pct: parseFloat(y_pct.toFixed(3)),
                    };
                    editingPinId = null;
                    document.getElementById("modal-pin-title").textContent =
                        "Name this road";
                    document.getElementById("modal-pin-name").value = "";
                    document.getElementById("modal-pin-notes").value = "";
                    document.getElementById("btn-modal-pin-save").textContent =
                        "Save Pin";
                    document.getElementById("btn-modal-pin-save").disabled =
                        false;
                    openModal("modal-pin");
                    setTimeout(
                        () => document.getElementById("modal-pin-name").focus(),
                        50,
                    );
                });

            document.getElementById("btn-modal-pin-save").onclick =
                async () => {
                    const btn = document.getElementById("btn-modal-pin-save");
                    const road_name = document
                        .getElementById("modal-pin-name")
                        .value.trim();
                    const notes = document
                        .getElementById("modal-pin-notes")
                        .value.trim();
                    if (!road_name) {
                        document.getElementById("modal-pin-name").focus();
                        return;
                    }

                    setLoading(btn, true);
                    try {
                        if (editingPinId) {
                            const res = await fetch(
                                `/api/maps/${currentMap.id}/pins/${editingPinId}`,
                                {
                                    method: "PUT",
                                    headers: {
                                        "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify({ road_name, notes }),
                                },
                            );
                            if (!res.ok) throw new Error();
                            toast("Pin updated");
                        } else {
                            const res = await fetch(
                                `/api/maps/${currentMap.id}/pins`,
                                {
                                    method: "POST",
                                    headers: {
                                        "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify({
                                        road_name,
                                        notes,
                                        ...pendingPin,
                                    }),
                                },
                            );
                            if (!res.ok) throw new Error();
                            toast(`"${road_name}" pinned`);
                            setPinMode(false);
                        }
                        pendingPin = null;
                        editingPinId = null;
                        closeModal("modal-pin");
                        await loadPins();
                    } catch {
                        toast("Save failed", "error");
                    }

                    btn.disabled = false;
                    btn.textContent = editingPinId
                        ? "Save Changes"
                        : "Save Pin";
                };

            function startEditPin(id, e) {
                e && e.stopPropagation();
                const pin = currentPins.find((p) => p.id === id);
                if (!pin) return;
                editingPinId = id;
                pendingPin = null;
                document.getElementById("modal-pin-title").textContent =
                    "Edit Road Pin";
                document.getElementById("modal-pin-name").value = pin.road_name;
                document.getElementById("modal-pin-notes").value =
                    pin.notes || "";
                document.getElementById("btn-modal-pin-save").textContent =
                    "Save Changes";
                document.getElementById("btn-modal-pin-save").disabled = false;
                openModal("modal-pin");
                setTimeout(
                    () => document.getElementById("modal-pin-name").focus(),
                    50,
                );
            }

            async function deletePin(id, e) {
                e && e.stopPropagation();
                const pin = currentPins.find((p) => p.id === id);
                if (!confirm(`Remove pin for "${pin?.road_name}"?`)) return;
                try {
                    const res = await fetch(
                        `/api/maps/${currentMap.id}/pins/${id}`,
                        { method: "DELETE" },
                    );
                    if (!res.ok) throw new Error();
                    toast("Pin removed");
                    await loadPins();
                } catch {
                    toast("Delete failed", "error");
                }
            }

            document.getElementById("btn-modal-pin-cancel").onclick = () => {
                pendingPin = null;
                editingPinId = null;
                closeModal("modal-pin");
            };

            // ── Full view lightbox ──
            document.getElementById("btn-view-full").onclick = () => {
                if (!currentMap) return;
                document.getElementById("lightbox-img").src =
                    `/uploads/${currentMap.filename}`;
                document.getElementById("lightbox-cap").textContent =
                    currentMap.name;
                document.getElementById("lightbox").classList.add("open");
            };
            document.getElementById("btn-view-newtab").onclick = () => {
                window.open(`/uploads/${currentMap.filename}`, "_blank");
            };
            document
                .getElementById("lightbox")
                .addEventListener("click", (e) => {
                    if (e.target === document.getElementById("lightbox"))
                        document
                            .getElementById("lightbox")
                            .classList.remove("open");
                });

            // ── Modal helpers ──
            function openModal(id) {
                document.getElementById(id).classList.add("open");
            }
            function closeModal(id) {
                document.getElementById(id).classList.remove("open");
            }

            document
                .getElementById("modal-map")
                .addEventListener("click", (e) => {
                    if (e.target === document.getElementById("modal-map")) {
                        pendingUploadFiles = [];
                        closeModal("modal-map");
                    }
                });
            document
                .getElementById("modal-pin")
                .addEventListener("click", (e) => {
                    if (e.target === document.getElementById("modal-pin")) {
                        pendingPin = null;
                        editingPinId = null;
                        closeModal("modal-pin");
                    }
                });

            document.addEventListener("keydown", (e) => {
                if (e.key === "Escape") {
                    document
                        .getElementById("lightbox")
                        .classList.remove("open");
                    pendingUploadFiles = [];
                    pendingPin = null;
                    editingPinId = null;
                    closeModal("modal-map");
                    closeModal("modal-pin");
                    if (pinModeActive) setPinMode(false);
                }
            });

            // ── Search ──
            document
                .getElementById("search-input")
                .addEventListener("input", (e) => {
                    clearTimeout(searchTimer);
                    searchTimer = setTimeout(
                        () => loadGallery(e.target.value.trim()),
                        500,
                    );
                });

            // ── Re-render pins on image resize ──
            const resizeObs = new ResizeObserver(() => {
                if (currentMap) renderPinOverlay();
            });
            resizeObs.observe(document.getElementById("detail-map-img"));

            // ── Utils ──
            function formatBytes(b) {
                if (b < 1024) return b + " B";
                if (b < 1048576) return Math.round(b / 1024) + " KB";
                return (b / 1048576).toFixed(1) + " MB";
            }

            // ── Init ──
            showGallery();
