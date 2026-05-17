/**
 * Drop-in upload widget for the Webflow lead form.
 *
 * What it does:
 *   - Hooks any <input type="file" data-lead-attachments> on the page.
 *   - Replaces the native input with a styled dropzone + file list.
 *   - Supports click-to-pick and drag-and-drop.
 *   - Accumulates files across multiple selections (the native input only
 *     keeps the last one — this widget keeps everything).
 *   - For each file: requests a signed upload URL from /api/leads/upload-url
 *     and PUTs the file directly to Supabase Storage. Shows per-file status.
 *   - Writes the resulting attachment_token into a hidden input that
 *     Webflow submits along with the rest of the form.
 *
 * How to use in Webflow:
 *   1. Remove the Uploadcare widget.
 *   2. Embed: <input type="file" multiple data-lead-attachments>
 *   3. Custom Code → Before </body>:
 *        <script src="https://app.prototipalo.es/lead-attachments.js" defer></script>
 *
 * The widget creates everything else (button, dropzone, file list) and the
 * hidden attachment_token input. No extra HTML required.
 */

(function () {
  var ENDPOINT = "https://app.prototipalo.es/api/leads/upload-url";
  var MAX_FILE_MB = 25;

  function injectStyles() {
    if (document.getElementById("la-widget-styles")) return;
    var css = [
      ".la-widget { display:flex; flex-direction:column; gap:10px; margin:24px 0; }",
      ".la-dropzone { border:2px dashed #d1d5db; border-radius:10px; padding:22px 18px; text-align:center; cursor:pointer; transition:border-color .15s ease, background .15s ease; background:#fafafa; }",
      ".la-dropzone:hover { border-color:#9ca3af; background:#f3f4f6; }",
      ".la-dropzone.is-dragover { border-color:#2563eb; background:#eff6ff; }",
      ".la-dropzone-title { font-weight:600; font-size:14px; color:#111827; margin:0 0 4px; }",
      ".la-dropzone-hint { font-size:12px; color:#6b7280; margin:0; }",
      ".la-list { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:6px; }",
      ".la-item { display:flex; align-items:center; gap:10px; padding:8px 12px; border:1px solid #e5e7eb; border-radius:8px; background:#fff; font-size:13px; }",
      ".la-item-name { flex:1 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#1f2937; }",
      ".la-item-status { flex:0 0 auto; font-size:12px; color:#6b7280; }",
      ".la-item.is-done .la-item-status { color:#059669; font-weight:600; }",
      ".la-item.is-error .la-item-status { color:#dc2626; font-weight:600; }",
      ".la-item-remove { flex:0 0 auto; border:none; background:transparent; color:#9ca3af; cursor:pointer; font-size:16px; line-height:1; padding:2px 4px; }",
      ".la-item-remove:hover { color:#dc2626; }",
      ".la-summary { font-size:12px; color:#6b7280; }",
    ].join("\n");
    var style = document.createElement("style");
    style.id = "la-widget-styles";
    style.textContent = css;
    document.head.appendChild(style);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  function formatSize(bytes) {
    if (!bytes) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function ensureHiddenTokenField(form) {
    var hidden = form.querySelector('input[name="attachment_token"]');
    if (!hidden) {
      hidden = document.createElement("input");
      hidden.type = "hidden";
      hidden.name = "attachment_token";
      hidden.setAttribute("data-name", "attachment_token");
      form.appendChild(hidden);
    }
    return hidden;
  }

  function requestSignedUrl(filename, contentType, token) {
    return fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: filename, contentType: contentType, token: token }),
    }).then(function (r) {
      if (!r.ok) throw new Error("upload-url " + r.status);
      return r.json();
    });
  }

  function uploadOne(signedUrl, file) {
    return fetch(signedUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    }).then(function (r) {
      if (!r.ok) throw new Error("upload " + r.status);
    });
  }

  function attach(input) {
    var form = input.form;
    if (!form) {
      console.warn("[lead-attachments] input must live inside a <form>");
      return;
    }

    var hidden = ensureHiddenTokenField(form);
    var token = null;
    var uploads = []; // {file, li, status: 'uploading'|'done'|'error'}

    // Build the widget around the original input — the input stays in the
    // DOM (hidden) so Webflow's form serialisation doesn't get confused.
    var wrapper = document.createElement("div");
    wrapper.className = "la-widget";
    wrapper.innerHTML =
      '<div class="la-dropzone" tabindex="0" role="button" aria-label="Subir archivos">' +
      '  <p class="la-dropzone-title">Arrastra archivos aquí o haz clic</p>' +
      '  <p class="la-dropzone-hint">Hasta ' + MAX_FILE_MB + ' MB por archivo · imágenes, PDF, etc.</p>' +
      "</div>" +
      '<ul class="la-list"></ul>' +
      '<p class="la-summary" data-summary></p>';

    input.style.display = "none";
    input.parentNode.insertBefore(wrapper, input);

    var dropzone = wrapper.querySelector(".la-dropzone");
    var list = wrapper.querySelector(".la-list");
    var summary = wrapper.querySelector("[data-summary]");

    function updateSummary() {
      var total = uploads.length;
      var done = uploads.filter(function (u) { return u.status === "done"; }).length;
      var err = uploads.filter(function (u) { return u.status === "error"; }).length;
      if (total === 0) {
        summary.textContent = "";
      } else if (done === total) {
        summary.textContent = total + " archivo(s) listo(s) para enviar ✓";
        summary.style.color = "#059669";
      } else if (err > 0) {
        summary.textContent = done + " de " + total + " subido(s) · " + err + " con error";
        summary.style.color = "#dc2626";
      } else {
        summary.textContent = "Subiendo " + done + " / " + total + "…";
        summary.style.color = "#6b7280";
      }
    }

    function renderRow(u) {
      var li = document.createElement("li");
      li.className = "la-item is-uploading";
      li.innerHTML =
        '<span class="la-item-name">' + escapeHtml(u.file.name) +
        ' <span style="color:#9ca3af;">(' + formatSize(u.file.size) + ")</span></span>" +
        '<span class="la-item-status">Subiendo…</span>' +
        '<button type="button" class="la-item-remove" aria-label="Quitar">×</button>';
      list.appendChild(li);
      u.li = li;

      li.querySelector(".la-item-remove").addEventListener("click", function () {
        // We don't delete the bytes from Supabase here — the cron pending
        // cleanup will sweep abandoned files. Just remove from the UI.
        uploads = uploads.filter(function (x) { return x !== u; });
        li.remove();
        if (uploads.filter(function (x) { return x.status === "done"; }).length === 0) {
          hidden.value = "";
          token = null;
        }
        updateSummary();
      });
    }

    async function processFiles(files) {
      var accepted = files.filter(function (f) {
        if (f.size > MAX_FILE_MB * 1024 * 1024) {
          alert("Archivo demasiado grande: " + f.name + " (máx " + MAX_FILE_MB + " MB)");
          return false;
        }
        return true;
      });

      for (var i = 0; i < accepted.length; i++) {
        var u = { file: accepted[i], status: "uploading", li: null };
        uploads.push(u);
        renderRow(u);
      }
      updateSummary();

      for (var j = 0; j < accepted.length; j++) {
        var u2 = uploads[uploads.length - accepted.length + j];
        try {
          var res = await requestSignedUrl(
            u2.file.name,
            u2.file.type || "application/octet-stream",
            token
          );
          token = res.token;
          await uploadOne(res.signedUrl, u2.file);
          u2.status = "done";
          u2.li.classList.remove("is-uploading");
          u2.li.classList.add("is-done");
          u2.li.querySelector(".la-item-status").textContent = "✓";
        } catch (err) {
          console.error("[lead-attachments]", err);
          u2.status = "error";
          u2.li.classList.remove("is-uploading");
          u2.li.classList.add("is-error");
          u2.li.querySelector(".la-item-status").textContent = "Error";
        }
        updateSummary();
      }

      hidden.value = token || "";
    }

    // Drag & drop
    ["dragenter", "dragover"].forEach(function (ev) {
      dropzone.addEventListener(ev, function (e) {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add("is-dragover");
      });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      dropzone.addEventListener(ev, function (e) {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove("is-dragover");
      });
    });
    dropzone.addEventListener("drop", function (e) {
      var dropped = Array.prototype.slice.call(e.dataTransfer.files || []);
      if (dropped.length > 0) processFiles(dropped);
    });

    // Click / keyboard to open native picker
    dropzone.addEventListener("click", function () { input.click(); });
    dropzone.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        input.click();
      }
    });

    input.addEventListener("change", function () {
      var selected = Array.prototype.slice.call(input.files || []);
      if (selected.length > 0) processFiles(selected);
      // Reset so picking the same filename twice still triggers change.
      input.value = "";
    });
  }

  function init() {
    injectStyles();
    var inputs = document.querySelectorAll("input[type=file][data-lead-attachments]");
    for (var i = 0; i < inputs.length; i++) attach(inputs[i]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.__leadAttachments = { endpoint: ENDPOINT, version: 2 };
})();
