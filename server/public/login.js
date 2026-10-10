(() => {
  const $ = (s) => document.querySelector(s);
  const msg = (text, kind = "err") => {
    $("#msg").innerHTML = text ? `<div class="${kind}">${text}</div>` : "";
  };

  const form = $("#f");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg("");
    const username = $("#u").value.trim();
    const password = $("#p").value;
    const isSetup = !!$("#p2");

    if (isSetup && password !== $("#p2").value) {
      return msg("Les deux mots de passe ne correspondent pas.");
    }

    const body = { username, password };
    const url = isSetup ? "/api/admin/setup" : "/api/admin/login";

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return msg(data.error || "Erreur.");
      location.href = "/admin";
    } catch {
      msg("Serveur injoignable.");
    }
  });
})();