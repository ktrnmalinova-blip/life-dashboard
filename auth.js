/**
 * Life Dashboard — PIN Auth
 * Подключить в <head> каждого HTML-файла:
 *   <script src="auth.js"></script>
 */
(function () {
  'use strict';

  const PIN_KEY     = 'ld_pin_hash';
  const SESSION_KEY = 'ld_session_ok';

  /* ── Простая хеш-функция (защита от случайного взгляда) ── */
  function hashPin(pin) {
    let h = 5381;
    for (let i = 0; i < pin.length; i++) {
      h = (Math.imul(h, 33) ^ pin.charCodeAt(i)) >>> 0;
    }
    return h.toString(36);
  }

  function isUnlocked() {
    const stored = localStorage.getItem(PIN_KEY);
    return stored && sessionStorage.getItem(SESSION_KEY) === stored;
  }

  function unlock(pin) {
    const stored = localStorage.getItem(PIN_KEY);
    const h      = hashPin(pin);
    if (h === stored) {
      sessionStorage.setItem(SESSION_KEY, stored);
      return true;
    }
    return false;
  }

  function setPin(pin) {
    const h = hashPin(pin);
    localStorage.setItem(PIN_KEY, h);
    sessionStorage.setItem(SESSION_KEY, h);
  }

  /* ── Инъекция стилей экрана блокировки ── */
  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      #ld-lock {
        position: fixed; inset: 0; z-index: 99999;
        background: #07070f;
        display: flex; align-items: center; justify-content: center;
        font-family: 'Sora', -apple-system, sans-serif;
        animation: ld-fade-in .25s ease;
      }
      @keyframes ld-fade-in { from { opacity:0 } to { opacity:1 } }

      .ld-lock__box {
        width: 100%; max-width: 340px; padding: 40px 28px;
        text-align: center;
        background: rgba(255,255,255,0.035);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 28px;
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
      }

      /* орбы */
      .ld-lock__orb1, .ld-lock__orb2 {
        position: fixed; border-radius: 50%;
        filter: blur(60px); pointer-events: none;
      }
      .ld-lock__orb1 {
        width: 280px; height: 280px;
        background: #5b21b6; opacity: .3;
        top: -80px; left: -60px;
      }
      .ld-lock__orb2 {
        width: 220px; height: 220px;
        background: #92400e; opacity: .25;
        bottom: 0; right: -60px;
      }

      .ld-lock__icon { font-size: 2.8rem; margin-bottom: 12px; }
      .ld-lock__title {
        font-size: 1.25rem; font-weight: 600;
        color: #f0ebff; margin-bottom: 4px;
      }
      .ld-lock__sub {
        font-size: .8rem; color: rgba(255,255,255,.35);
        margin-bottom: 28px;
      }

      /* PIN dots */
      .ld-dots {
        display: flex; justify-content: center; gap: 12px;
        margin-bottom: 28px;
      }
      .ld-dot {
        width: 14px; height: 14px; border-radius: 50%;
        background: rgba(255,255,255,.1);
        border: 2px solid rgba(255,255,255,.2);
        transition: all .2s;
      }
      .ld-dot.filled {
        background: #7c3aed;
        border-color: #7c3aed;
        box-shadow: 0 0 10px rgba(124,58,237,.6);
      }
      .ld-dot.error {
        background: #f87171;
        border-color: #f87171;
        animation: ld-shake .4s ease;
      }
      @keyframes ld-shake {
        0%,100% { transform: translateX(0) }
        20%      { transform: translateX(-4px) }
        40%      { transform: translateX(4px) }
        60%      { transform: translateX(-4px) }
        80%      { transform: translateX(4px) }
      }

      /* Numpad */
      .ld-numpad {
        display: grid; grid-template-columns: repeat(3, 1fr);
        gap: 10px; max-width: 240px; margin: 0 auto;
      }
      .ld-key {
        aspect-ratio: 1;
        background: rgba(255,255,255,.05);
        border: 1px solid rgba(255,255,255,.08);
        border-radius: 50%;
        color: #f0ebff; font-size: 1.3rem; font-weight: 500;
        font-family: inherit;
        cursor: pointer; transition: all .15s;
        display: flex; align-items: center; justify-content: center;
      }
      .ld-key:active, .ld-key:hover {
        background: rgba(124,58,237,.25);
        border-color: rgba(124,58,237,.5);
        transform: scale(.95);
      }
      .ld-key--empty { background: transparent; border-color: transparent; cursor: default; }
      .ld-key--empty:hover { background: transparent; border-color: transparent; transform: none; }
      .ld-key--del { font-size: 1rem; }

      .ld-lock__hint {
        margin-top: 20px; font-size: .75rem;
        color: rgba(255,255,255,.2);
      }
      .ld-lock__error {
        margin-top: 12px; font-size: .8rem;
        color: #f87171; min-height: 1.2em;
        transition: opacity .2s;
      }
      .ld-lock__confirm-title {
        font-size: .85rem; color: rgba(255,255,255,.5);
        margin-bottom: 20px;
      }
    `;
    document.head.appendChild(style);
  }

  /* ── Рендер экрана ── */
  function buildLockScreen() {
    const hasPIN = !!localStorage.getItem(PIN_KEY);
    let entered = '';
    let confirm_step = false;
    let firstPin    = '';
    const PIN_LEN   = 4;

    const wrap = document.createElement('div');
    wrap.id = 'ld-lock';
    wrap.innerHTML = `
      <div class="ld-lock__orb1"></div>
      <div class="ld-lock__orb2"></div>
      <div class="ld-lock__box">
        <div class="ld-lock__icon">🔐</div>
        <div class="ld-lock__title" id="ld-title">${hasPIN ? 'Добро пожаловать' : 'Создайте PIN'}</div>
        <div class="ld-lock__sub" id="ld-sub">${hasPIN ? 'Введите PIN-код' : 'Придумайте 4-значный код'}</div>
        <div class="ld-dots" id="ld-dots">
          ${Array(PIN_LEN).fill('<div class="ld-dot"></div>').join('')}
        </div>
        <div class="ld-lock__confirm-title" id="ld-confirm-title" style="display:none">
          Повторите PIN для подтверждения
        </div>
        <div class="ld-numpad">
          ${[1,2,3,4,5,6,7,8,9,'','0','⌫'].map(k => {
            if (k === '') return '<div class="ld-key ld-key--empty"></div>';
            return `<button class="ld-key${k==='⌫'?' ld-key--del':''}" data-key="${k}">${k}</button>`;
          }).join('')}
        </div>
        <div class="ld-lock__error" id="ld-error"></div>
        <div class="ld-lock__hint" id="ld-hint">${hasPIN ? '' : 'Запомните его — восстановление невозможно'}</div>
      </div>
    `;

    function dots() { return wrap.querySelectorAll('.ld-dot'); }
    function updateDots() {
      dots().forEach((d, i) => {
        d.classList.toggle('filled', i < entered.length);
        d.classList.remove('error');
      });
    }
    function shakeError(msg) {
      dots().forEach(d => d.classList.add('error'));
      wrap.querySelector('#ld-error').textContent = msg;
      setTimeout(() => {
        entered = '';
        updateDots();
        wrap.querySelector('#ld-error').textContent = '';
      }, 700);
    }

    function handleKey(k) {
      if (k === '⌫') {
        entered = entered.slice(0, -1);
        updateDots();
        return;
      }
      if (entered.length >= PIN_LEN) return;
      entered += k;
      updateDots();

      if (entered.length < PIN_LEN) return;

      if (hasPIN) {
        // Вход
        if (unlock(entered)) {
          wrap.style.transition = 'opacity .3s';
          wrap.style.opacity = '0';
          setTimeout(() => wrap.remove(), 300);
        } else {
          shakeError('Неверный PIN');
        }
      } else {
        // Создание PIN
        if (!confirm_step) {
          firstPin = entered;
          entered  = '';
          confirm_step = true;
          wrap.querySelector('#ld-title').textContent = 'Подтвердите PIN';
          wrap.querySelector('#ld-sub').style.display = 'none';
          wrap.querySelector('#ld-confirm-title').style.display = '';
          wrap.querySelector('#ld-hint').textContent  = '';
          updateDots();
        } else {
          if (entered === firstPin) {
            setPin(entered);
            wrap.style.transition = 'opacity .3s';
            wrap.style.opacity = '0';
            setTimeout(() => wrap.remove(), 300);
          } else {
            confirm_step = false;
            firstPin = '';
            wrap.querySelector('#ld-title').textContent = 'Создайте PIN';
            wrap.querySelector('#ld-sub').style.display = '';
            wrap.querySelector('#ld-confirm-title').style.display = 'none';
            wrap.querySelector('#ld-hint').textContent = 'Запомните его — восстановление невозможно';
            shakeError('Коды не совпадают, попробуйте снова');
          }
        }
      }
    }

    wrap.addEventListener('click', e => {
      const k = e.target.closest('[data-key]');
      if (k) handleKey(k.dataset.key);
    });

    // Поддержка физической клавиатуры
    document.addEventListener('keydown', function handler(e) {
      if (!document.getElementById('ld-lock')) {
        document.removeEventListener('keydown', handler);
        return;
      }
      if (/^\d$/.test(e.key)) handleKey(e.key);
      if (e.key === 'Backspace') handleKey('⌫');
    });

    return wrap;
  }

  /* ── Точка входа ── */
  function init() {
    if (isUnlocked()) return; // уже авторизован

    injectStyles();
    // Скрыть основной контент моментально
    document.documentElement.style.visibility = 'hidden';

    const run = () => {
      document.documentElement.style.visibility = '';
      const lock = buildLockScreen();
      document.body.appendChild(lock);
    };

    if (document.body) {
      run();
    } else {
      document.addEventListener('DOMContentLoaded', run);
    }
  }

  init();
})();
