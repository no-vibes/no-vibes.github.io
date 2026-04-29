const yearEl = document.querySelector("#year");
const siteNav = document.querySelector("#primary-nav");
const navToggle = document.querySelector(".nav-toggle");

if (yearEl) {
  yearEl.textContent = String(new Date().getFullYear());
}

if (siteNav && navToggle) {
  const MOBILE_NAV_BREAKPOINT = 980;

  function isMobileViewport() {
    return window.innerWidth <= MOBILE_NAV_BREAKPOINT;
  }

  function syncNavVisibility() {
    if (isMobileViewport()) {
      navToggle.style.display = "inline-flex";
      siteNav.style.display = siteNav.classList.contains("is-open") ? "flex" : "none";
      return;
    }

    navToggle.style.display = "none";
    siteNav.style.display = "flex";
  }

  function closeMobileNav() {
    siteNav.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
    navToggle.setAttribute("aria-label", "Open menu");
    syncNavVisibility();
  }

  navToggle.addEventListener("click", () => {
    const isOpen = siteNav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    navToggle.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
    syncNavVisibility();
  });

  siteNav.addEventListener("click", (event) => {
    const target = event.target;
    if (target instanceof HTMLAnchorElement) {
      closeMobileNav();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 980) {
      closeMobileNav();
    }

    syncNavVisibility();
  });

  syncNavVisibility();
}

const DRAFT_KEY = "aiCourseSite.contactDraft.v1";
const AUTOSAVE_DEBOUNCE_MS = 400;

const contactForm = document.querySelector("#contact-form");
const contactStatus = document.querySelector("#contact-status");

function setStatus(message, type = "neutral") {
  if (!contactStatus) {
    return;
  }

  contactStatus.textContent = message;
  contactStatus.dataset.state = type;
}

function getDraft() {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return {
      name: String(parsed.name || ""),
      email: String(parsed.email || ""),
      message: String(parsed.message || ""),
      updatedAt: String(parsed.updatedAt || ""),
    };
  } catch (_error) {
    return null;
  }
}

function setDraft(data) {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    return true;
  } catch (_error) {
    return false;
  }
}

function clearDraft() {
  try {
    window.localStorage.removeItem(DRAFT_KEY);
    return true;
  } catch (_error) {
    return false;
  }
}

function serializeForm(form) {
  const formData = new FormData(form);
  return {
    name: String(formData.get("name") || "").trim(),
    email: String(formData.get("email") || "").trim(),
    message: String(formData.get("message") || ""),
  };
}

function isEmptyDraft(data) {
  return !data.name && !data.email && !data.message.trim();
}

function restoreDraft(form, draft) {
  form.elements.namedItem("name").value = draft.name;
  form.elements.namedItem("email").value = draft.email;
  form.elements.namedItem("message").value = draft.message;
}

if (contactForm) {
  let autosaveTimeout = null;
  let lastSubmittedState = null;
  let isSubmitting = false;

  const initialDraft = getDraft();
  if (initialDraft && !isEmptyDraft(initialDraft)) {
    restoreDraft(contactForm, initialDraft);
    setStatus("Draft restored.");
  }

  function hasUnsentChanges() {
    const current = serializeForm(contactForm);
    if (isEmptyDraft(current)) {
      return false;
    }

    if (!lastSubmittedState) {
      return true;
    }

    return JSON.stringify(current) !== JSON.stringify(lastSubmittedState);
  }

  function persistCurrentForm() {
    const payload = {
      ...serializeForm(contactForm),
      updatedAt: new Date().toISOString(),
    };

    if (isEmptyDraft(payload)) {
      clearDraft();
      return;
    }

    const saved = setDraft(payload);
    setStatus(saved ? "Draft saved." : "Could not save draft in this browser.", saved ? "neutral" : "error");
  }

  contactForm.addEventListener("input", () => {
    if (autosaveTimeout) {
      window.clearTimeout(autosaveTimeout);
    }

    autosaveTimeout = window.setTimeout(() => {
      persistCurrentForm();
    }, AUTOSAVE_DEBOUNCE_MS);
  });

  window.addEventListener("beforeunload", (event) => {
    if (isSubmitting || !hasUnsentChanges()) {
      return;
    }

    event.preventDefault();
    event.returnValue = "";
  });

  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!contactForm.reportValidity()) {
      setStatus("Please fill in all required fields.", "error");
      return;
    }

    const action = contactForm.getAttribute("action");
    if (!action) {
      setStatus("Form endpoint is not configured yet.", "error");
      return;
    }

    const formData = new FormData(contactForm);
    isSubmitting = true;
    setStatus("Sending message...");

    try {
      const response = await window.fetch(action, {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Submit failed: ${response.status}`);
      }

      contactForm.reset();
      clearDraft();
      lastSubmittedState = serializeForm(contactForm);
      setStatus("Message sent successfully.", "success");
    } catch (_error) {
      persistCurrentForm();
      setStatus("Could not send. Your draft is still saved.", "error");
    } finally {
      isSubmitting = false;
    }
  });
}
