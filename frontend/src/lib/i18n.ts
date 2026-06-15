// ROLE: Локализация текстов интерфейса (RU/EN). Не содержит игровую логику.

type Locale = "ru" | "en";

const translations = {
  // Login screen
  "login.selectSkin": { ru: "Выберите скин", en: "Choose your skin" },
  "login.nickname": { ru: "Ваш никнейм", en: "Your nickname" },
  "login.play": { ru: "Играть", en: "Play" },

  // Skin names
  "skin.red": { ru: "Красный", en: "Red" },
  "skin.blue": { ru: "Синий", en: "Blue" },
  "skin.yellow": { ru: "Желтый", en: "Yellow" },
  "skin.green": { ru: "Зеленый", en: "Green" },
  "skin.pink": { ru: "Розовый", en: "Pink" },
  "skin.purple": { ru: "Фиолетовый", en: "Purple" },
  "skin.zebra": { ru: "Зебра", en: "Zebra" },
  "skin.tiger": { ru: "Тигр", en: "Tiger" },
  "skin.rainbow": { ru: "Радуга", en: "Rainbow" },
  "skin.cyberpunk": { ru: "Киберпанк", en: "Cyberpunk" },

  // Side menu
  "menu.title": { ru: "Меню игры", en: "Game Menu" },
  "menu.settings": { ru: "Настройки", en: "Settings" },
  "menu.camera": { ru: "Режим камеры", en: "Camera Mode" },
  "menu.controls": { ru: "Управление", en: "Controls" },
  "menu.guide": { ru: "Подсказки", en: "Guide" },
  "menu.admin": { ru: "Админ-панель", en: "Admin Panel" },

  // Control modes
  "control.touchDrag": { ru: "Сенсорный Драг", en: "Touch Drag" },
  "control.touchDragDesc": { ru: "Перетаскивание + зона буста", en: "Drag steering + Boost zone" },
  "control.tilt": { ru: "Наклон телефона", en: "Phone Tilt" },
  "control.tiltDesc": { ru: "Наклон + зона буста", en: "Tilt steering + Boost zone" },
  "control.gyroPermission": { ru: "Разрешить гироскоп (iOS)", en: "Allow Gyroscope (iOS)" },
  "control.keyboard": { ru: "Клавиатура", en: "Keyboard" },
  "control.keyboardDesc": { ru: "A/D или Стрелочки", en: "A/D or Arrows" },

  // Desktop controls help
  "help.controls": { ru: "Управление", en: "Controls" },
  "help.steeringKbd": { ru: "A / D / Стрелочки", en: "A / D / Arrows" },
  "help.steeringMouse": { ru: "Движение мыши", en: "Mouse movement" },
  "help.steering": { ru: "Руление", en: "Steering" },
  "help.space": { ru: "Пробел", en: "Space" },
  "help.boost": { ru: "Ускорение", en: "Boost" },
  "help.mode": { ru: "Режим", en: "Mode" },
  "help.keyboard": { ru: "клавиатура", en: "keyboard" },
  "help.mouse": { ru: "мышь", en: "mouse" },

  // Mobile guide
  "guide.touchSteer": { ru: "Тяните палец по холсту влево/вправо для плавного руления.", en: "Drag your finger left/right on the canvas to steer smoothly." },
  "guide.touchBoost": { ru: "Нижняя часть экрана — зона буста. Ускоряйтесь при удержании.", en: "The bottom area is the boost zone. Hold to accelerate." },
  "guide.tiltSteer": { ru: "Наклоняйте телефон влево/вправо для плавного руления.", en: "Tilt your phone left/right to steer smoothly." },
  "guide.tiltBoost": { ru: "Нижняя зона экрана — зона ускорения. Удерживайте палец для буста.", en: "The bottom area is the boost zone. Hold your finger to boost." },
  "guide.keySteer": { ru: "Используйте A/D или стрелочки для руления.", en: "Use A/D or arrows to steer." },
  "guide.keyBoost": { ru: "Удерживайте Пробел для ускорения.", en: "Hold Space to boost." },
  "guide.collectFood": { ru: "Очки собираются за поедание светящихся шариков еды.", en: "Collect points by eating glowing food orbs." },
  "guide.collision": { ru: "Столкновение с телом другого игрока приводит к гибели!", en: "Colliding with another player's body will kill you!" },

  // Leaderboard
  "leaderboard.top": { ru: "Топ", en: "Top" },
  "leaderboard.kills": { ru: "Убийства", en: "Kills" },
  "leaderboard.deaths": { ru: "Смерти", en: "Deaths" },
  "leaderboard.waiting": { ru: "Ожидание...", en: "Waiting..." },

  // Boost zone
  "boost.label": { ru: "УСКОРЕНИЕ", en: "BOOST" },

  // Gyro permission alert
  "alert.gyroDenied": { ru: "Доступ к гироскопу отклонён.", en: "Gyroscope permission denied." },
  "alert.gyroSecureRequired": { ru: "Управление наклоном работает только через безопасное соединение (HTTPS). На HTTP доступ к гироскопу заблокирован браузером.", en: "Tilt controls require a secure connection (HTTPS). On HTTP, sensor access is blocked by the browser." },

  // Default player name
  "game.defaultPlayer": { ru: "Игрок", en: "Player" },

  // Status and guides
  "status.connecting": { ru: "Подключение к серверу...", en: "Connecting to server..." },
  "status.reconnecting": { ru: "Соединение потеряно. Переподключение через {seconds}с...", en: "Connection lost. Reconnecting in {seconds}s..." },
  "status.serverRestart": { ru: "Сервер перезагружается...", en: "Server is restarting..." },
  "status.kbdGuide": { ru: "A/D/Стрелочки — рулить | Пробел — ускорение | T — управление", en: "A/D/Arrows — steer | Space — boost | T — controls" },
  "status.mouseGuide": { ru: "Движение за курсором | Пробел — ускорение | T — управление", en: "Move with cursor | Space — boost | T — controls" },
  "status.wall": { ru: "Стена", en: "Wall" },
  "debug.enterScore": { ru: "Укажите новое значение очков для вашей змейки (от 0):", en: "Enter a new score value for your snake (0 or greater):" },
  "debug.invalidScore": { ru: "Пожалуйста, введите корректное неотрицательное целое число.", en: "Please enter a valid non-negative integer." },
} as const;

type TranslationKey = keyof typeof translations;

function detectLocale(): Locale {
  if (typeof navigator === "undefined") return "en";
  const lang = navigator.language || (navigator as any).userLanguage || "en";
  return lang.toLowerCase().startsWith("ru") ? "ru" : "en";
}

export const locale: Locale = detectLocale();

export function t(key: TranslationKey, params?: Record<string, any>): string {
  const entry = translations[key];
  if (!entry) return key;
  let text: string = entry[locale] || entry.en;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
}
