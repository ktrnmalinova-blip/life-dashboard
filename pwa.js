/**
 * Life Dashboard — PWA Bootstrap
 * Подключить ПОСЛЕДНЕЙ строкой в <head> каждого HTML-файла:
 *   <script src="pwa.js"></script>
 *
 * Делает три вещи:
 *  1. Дописывает в <head> недостающие теги (manifest, иконки, apple meta).
 *  2. Регистрирует Service Worker (офлайн + установка).
 *  3. Показывает кнопку "Установить" (Android/desktop) или
 *     подсказку для iOS ("Поделиться → На экран Домой").
 */
(function () {
  'use strict';

  /* ── 1. Дописываем head, если тегов ещё нет ── */
  function ensureHead() {
    const add = (tag, attrs) => {
      const sel = attrs.rel ? `link[rel="${attrs.rel}"]` : `meta[name="${attrs.name}"]`;
      if (document.head.querySelector(sel)) return;
      const el = document.createElement(tag);
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      document.head.appendChild(el);
    };
    add('link', { rel: 'manifest', href: 'manifest.json' });
    add('link', { rel: 'icon', href: 'favicon-32.png', sizes: '32x32', type: 'image/png' });
    add('link', { rel: 'apple-touch-icon', href: 'apple-touch-icon.png' });
    add('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' });
    add('meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' });
    add('meta', { name: 'mobile-web-app-capable', content: 'yes' });
    if (!document.head.querySelector('meta[name="theme-color"]')) {
      add('meta', { name: 'theme-color', content: '#07070f' });
    }
  }
  ensureHead();

  /* ── 2. Service Worker ── */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(err => {
        console.warn('SW registration failed (не критично для работы сайта):', err);
      });
    });
  }

  /* ── Утилиты ── */
  const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;

  const DISMISS_KEY = 'ld_pwa_install_dismissed_until';
  function isDismissed() {
    const until = parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10);
    return Date.now() < until;
  }
  function dismissFor(days) {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + days * 86400000));
  }

  /* ── Стили баннера (самодостаточные, не зависят от styles.css) ── */
  function injectBannerStyles() {
    if (document.getElementById('ld-pwa-style')) return;
    const s = document.createElement('style');
    s.id = 'ld-pwa-style';
    s.textContent = `
      #ld-pwa-banner {
        position: fixed; left: 50%; bottom: calc(84px + env(safe-area-inset-bottom, 20px));
        transform: translateX(-50%) translateY(140%);
        width: calc(100% - 32px); max-width: 420px;
        background: linear-gradient(180deg, rgba(20,18,34,0.92), rgba(7,7,15,0.96));
        border: 1px solid rgba(255,255,255,0.12);
        backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
        border-radius: 20px; padding: 14px 14px 14px 16px;
        display: flex; align-items: center; gap: 12px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(124,58,237,0.08);
        z-index: 9999; font-family: 'Sora', -apple-system, sans-serif;
        transition: transform .4s cubic-bezier(.2,.8,.2,1);
      }
      #ld-pwa-banner.show { transform: translateX(-50%) translateY(0); }
      #ld-pwa-banner__icon {
        width: 42px; height: 42px; border-radius: 12px; flex-shrink: 0;
        background: linear-gradient(135deg, #7c3aed, #34d399);
        display: flex; align-items: center; justify-content: center; font-size: 20px;
      }
      #ld-pwa-banner__body { flex: 1; min-width: 0; }
      #ld-pwa-banner__title { color: #f0ebff; font-size: 13.5px; font-weight: 700; margin-bottom: 2px; }
      #ld-pwa-banner__text { color: rgba(255,255,255,0.5); font-size: 11.5px; line-height: 1.4; }
      #ld-pwa-banner__actions { display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; }
      #ld-pwa-banner button {
        font-family: inherit; border: none; cursor: pointer; border-radius: 10px;
        font-size: 12px; font-weight: 600; padding: 7px 12px; white-space: nowrap;
      }
      #ld-pwa-install-btn {
        background: linear-gradient(135deg, #7c3aed, #6d28d9); color: #fff;
        box-shadow: 0 4px 14px rgba(124,58,237,0.4);
      }
      #ld-pwa-dismiss-btn { background: transparent; color: rgba(255,255,255,0.4); }
    `;
    document.head.appendChild(s);
  }

  function buildBanner({ title, text, showInstallBtn, onInstall }) {
    injectBannerStyles();
    let el = document.getElementById('ld-pwa-banner');
    if (el) el.remove();
    el = document.createElement('div');
    el.id = 'ld-pwa-banner';
    el.innerHTML = `
      <div id="ld-pwa-banner__icon">📲</div>
      <div id="ld-pwa-banner__body">
        <div id="ld-pwa-banner__title">${title}</div>
        <div id="ld-pwa-banner__text">${text}</div>
      </div>
      <div id="ld-pwa-banner__actions">
        ${showInstallBtn ? '<button id="ld-pwa-install-btn">Установить</button>' : ''}
        <button id="ld-pwa-dismiss-btn">Не сейчас</button>
      </div>
    `;
    document.body.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));

    el.querySelector('#ld-pwa-dismiss-btn').addEventListener('click', () => {
      el.classList.remove('show');
      dismissFor(7);
      setTimeout(() => el.remove(), 400);
    });
    if (showInstallBtn) {
      el.querySelector('#ld-pwa-install-btn').addEventListener('click', async () => {
        await onInstall();
        el.classList.remove('show');
        setTimeout(() => el.remove(), 400);
      });
    }
    return el;
  }

  /* ── 3a. Android / Desktop Chrome: нативный prompt ── */
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    if (isStandalone() || isDismissed()) return;
    buildBanner({
      title: 'Установить Life Dashboard',
      text: 'Быстрый доступ с домашнего экрана, работа офлайн и уведомления.',
      showInstallBtn: true,
      onInstall: async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        deferredPrompt = null;
      }
    });
  });

  window.addEventListener('appinstalled', () => {
    dismissFor(3650);
    const el = document.getElementById('ld-pwa-banner');
    if (el) el.remove();
  });

  /* ── 3b. iOS Safari: своя подсказка (нет beforeinstallprompt) ── */
  document.addEventListener('DOMContentLoaded', () => {
    if (isStandalone() || isDismissed()) return;
    if (isIOS()) {
      setTimeout(() => {
        buildBanner({
          title: 'Установить на экран «Домой»',
          text: 'Нажмите кнопку «Поделиться» ⬆️ внизу Safari, затем «На экран «Домой»».',
          showInstallBtn: false
        });
      }, 1200);
    }
  });

  /* ── Экспорт для ручного вызова (например, кнопка в настройках) ── */
  window.ldPWA = {
    canInstall: () => !!deferredPrompt,
    install: async () => {
      if (!deferredPrompt) return false;
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      deferredPrompt = null;
      return choice.outcome === 'accepted';
    },
    isStandalone
  };
})();
