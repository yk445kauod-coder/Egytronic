/* Contact portal: reads its copy from data attributes so the English build can
   translate it, posts once, and always offers a way out if the endpoint fails. */
const form = document.querySelector("[data-contact-form]");

if (form) {
  const msg = (key) => form.dataset[key] || "";
  const status = form.querySelector("[data-status]");
  const fallback = form.querySelector("[data-fallback]");
  const submit = form.querySelector("[data-submit]");

  const setStatus = (text, tone) => {
    if (!status) return;
    status.textContent = text;
    status.dataset.tone = tone || "";
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (fallback) fallback.hidden = true;

    if (!form.checkValidity()) {
      setStatus(msg("msgInvalid"), "warn");
      form.reportValidity();
      return;
    }

    const data = Object.fromEntries(new FormData(form).entries());
    submit.disabled = true;
    submit.textContent = msg("msgSending");
    setStatus("", "");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json().catch(() => ({}));

      if (response.ok && result.ok) {
        form.reset();
        setStatus(msg("msgOk"), "ok");
      } else if (response.status === 429) {
        setStatus(msg("msgRate"), "warn");
      } else {
        setStatus(msg("msgDown"), "warn");
        if (fallback) fallback.hidden = false;
      }
    } catch {
      setStatus(msg("msgOffline"), "warn");
      if (fallback) fallback.hidden = false;
    } finally {
      submit.disabled = false;
      submit.textContent = msg("msgButton");
    }
  });

  form.querySelectorAll("[data-copy-mail]").forEach((button) => {
    button.addEventListener("click", async () => {
      const address = button.dataset.copyMail;
      try {
        await navigator.clipboard.writeText(address);
        setStatus(button.dataset.message, "ok");
      } catch {
        setStatus(button.dataset.fail, "warn");
      }
    });
  });
}
