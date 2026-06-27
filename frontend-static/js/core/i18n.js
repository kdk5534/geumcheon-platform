const SUPPORTED = ["ko", "en", "ja", "zh-CN"];
const STORAGE_KEY = "geumcheon-language";
const dictionaries = new Map();
let currentLanguage = "ko";

export async function initI18n() {
  const approved = approvedLanguages();
  const requested = languageFromUrl() || localStorage.getItem(STORAGE_KEY) || "ko";
  currentLanguage = approved.includes(requested) ? requested : "ko";
  await Promise.all([loadDictionary("ko"), currentLanguage === "ko" ? null : loadDictionary(currentLanguage)]);
  document.documentElement.lang = currentLanguage;
  applyTranslations();
  return currentLanguage;
}

export function approvedLanguages() {
  const configured = String(globalThis.window?.__ENV__?.APPROVED_LANGUAGES || "ko")
    .split(",").map((value) => value.trim()).filter(Boolean);
  return SUPPORTED.filter((language) => language === "ko" || configured.includes(language));
}

export function getLanguage() {
  return currentLanguage;
}

export function t(key) {
  return dictionaries.get(currentLanguage)?.[key] || dictionaries.get("ko")?.[key] || key;
}

export async function setLanguage(language) {
  if (!approvedLanguages().includes(language)) return false;
  await loadDictionary(language);
  currentLanguage = language;
  localStorage.setItem(STORAGE_KEY, language);
  document.documentElement.lang = language;
  const url = new URL(location.href);
  if (language === "ko") url.searchParams.delete("lang");
  else url.searchParams.set("lang", language);
  history.replaceState(null, "", url);
  applyTranslations();
  document.dispatchEvent(new CustomEvent("languagechange", { detail: { language } }));
  return true;
}

export function applyTranslations(root = document) {
  root.querySelectorAll?.("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  root.querySelectorAll?.("[data-i18n-placeholder]").forEach((element) => {
    element.setAttribute("placeholder", t(element.dataset.i18nPlaceholder));
  });
  root.querySelectorAll?.("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
  });
}

async function loadDictionary(language) {
  if (dictionaries.has(language)) return dictionaries.get(language);
  try {
    const response = await fetch(`./assets/i18n/${language}.json`);
    if (!response.ok) throw new Error("translation unavailable");
    const dictionary = await response.json();
    dictionaries.set(language, dictionary);
    return dictionary;
  } catch {
    dictionaries.set(language, {});
    return {};
  }
}

function languageFromUrl() {
  const value = new URL(location.href).searchParams.get("lang");
  return SUPPORTED.includes(value) ? value : null;
}
