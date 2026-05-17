/**
 * Drop-in replacement for the Uploadcare widget on the Webflow lead form.
 *
 * What it does:
 *   - Hooks any <input type="file" data-lead-attachments> on the page.
 *   - For each file selected, requests a signed upload URL from
 *     /api/leads/upload-url and PUTs the file directly to Supabase Storage.
 *   - Accumulates a single `attachment_token` across all files and writes
 *     it into an <input name="attachment_token" type="hidden"> so the
 *     Webflow form submit posts the token along with the rest of the fields.
 *
 * How to use in Webflow:
 *   1. Remove the Uploadcare widget from the form in Designer.
 *   2. Add a regular file input: <input type="file" multiple data-lead-attachments>
 *   3. Add a hidden field: <input type="hidden" name="attachment_token">
 *   4. Add this script to the page (Settings → Custom Code → Before </body>):
 *        <script src="https://app.prototipalo.es/lead-attachments.js" defer></script>
 *
 * Status UI: writes a short status message into an optional
 * <span data-lead-attachments-status> sibling.
 */

(function () {
  const API_BASE = "https://app.prototipalo.es";
  const ENDPOINT = API_BASE + "/api/leads/upload-url";
  const SUPABASE_URL = "https://rqqwvgdmbmgdbegpcvmz.supabase.co";

  function setStatus(host, msg, isError) {
    const node = host.parentElement && host.parentElement.querySelector("[data-lead-attachments-status]");
    if (!node) return;
    node.textContent = msg;
    node.style.color = isError ? "#b91c1c" : "#555";
  }

  async function requestSignedUrl(filename, contentType, token) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename, contentType, token }),
    });
    if (!res.ok) throw new Error("upload-url " + res.status);
    return res.json();
  }

  async function uploadOne(signedUrl, file) {
    const res = await fetch(signedUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    if (!res.ok) throw new Error("upload " + res.status);
  }

  function ensureHiddenTokenField(input) {
    const form = input.form;
    if (!form) return null;
    let hidden = form.querySelector('input[name="attachment_token"]');
    if (!hidden) {
      hidden = document.createElement("input");
      hidden.type = "hidden";
      hidden.name = "attachment_token";
      hidden.setAttribute("data-name", "attachment_token");
      form.appendChild(hidden);
    }
    return hidden;
  }

  function attach(input) {
    let token = null;

    input.addEventListener("change", async () => {
      const files = Array.from(input.files || []);
      if (files.length === 0) return;

      const hidden = ensureHiddenTokenField(input);
      if (!hidden) {
        console.warn("[lead-attachments] file input not inside a <form>");
        return;
      }

      setStatus(input, "Subiendo " + files.length + " archivo(s)…", false);

      try {
        for (const file of files) {
          const { signedUrl, token: returnedToken } = await requestSignedUrl(
            file.name,
            file.type || "application/octet-stream",
            token,
          );
          token = returnedToken;
          await uploadOne(signedUrl, file);
        }
        hidden.value = token;
        setStatus(input, files.length + " archivo(s) subido(s) ✓", false);
      } catch (err) {
        console.error("[lead-attachments]", err);
        setStatus(input, "Error al subir, vuelve a intentarlo", true);
      }
    });
  }

  function init() {
    const inputs = document.querySelectorAll("input[type=file][data-lead-attachments]");
    inputs.forEach(attach);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Expose SUPABASE_URL on the global so this file is self-documenting if
  // someone needs to verify the target storage account.
  window.__leadAttachments = { endpoint: ENDPOINT, storage: SUPABASE_URL };
})();
