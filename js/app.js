const DATA_URL = "data/schedule.json";
const TIME_ZONE = "Europe/Kyiv";

// Future links/tasks integration lives here, separately from schedule parsing.
// Example: { "1021372": { meetingUrl: "https://…", tasksUrl: "https://…" } }
const RESOURCE_DATA = {};

const state = {
  lessons: [],
  selectedDate: null,
  view: "day",
};

const content = document.querySelector("#schedule-content");
const dateTitle = document.querySelector("#date-title");
const dateWeekday = document.querySelector("#date-weekday");
const updatedAt = document.querySelector("#updated-at");
const currentDate = document.querySelector("#current-date");
const previousButton = document.querySelector("#previous-button");
const nextButton = document.querySelector("#next-button");
const todayButton = document.querySelector("#today-button");
const viewButtons = [...document.querySelectorAll("[data-view]")];

function kyivDateParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

function todayIso() {
  const { year, month, day } = kyivDateParts();
  return `${year}-${month}-${day}`;
}

function parseIsoDate(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function shiftDate(iso, days) {
  const date = parseIsoDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

function weekStart(iso) {
  const date = parseIsoDate(iso);
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  return shiftDate(iso, -mondayOffset);
}

function formatDate(iso, options) {
  return new Intl.DateTimeFormat("uk-UA", { timeZone: "UTC", ...options }).format(parseIsoDate(iso));
}

function lessonsForDate(iso) {
  return state.lessons.filter((lesson) => lesson.date === iso);
}

function isCurrentLesson(lesson) {
  const now = kyivDateParts();
  const iso = `${now.year}-${now.month}-${now.day}`;
  const currentMinutes = Number(now.hour) * 60 + Number(now.minute);
  const [startHour, startMinute] = lesson.start.split(":").map(Number);
  const [endHour, endMinute] = lesson.end.split(":").map(Number);
  return lesson.date === iso
    && currentMinutes >= startHour * 60 + startMinute
    && currentMinutes < endHour * 60 + endMinute;
}

function minutesUntilLesson(lesson) {
  const now = kyivDateParts();
  const iso = `${now.year}-${now.month}-${now.day}`;
  if (lesson.date !== iso) return null;
  const currentMinutes = Number(now.hour) * 60 + Number(now.minute);
  const [startHour, startMinute] = lesson.start.split(":").map(Number);
  return startHour * 60 + startMinute - currentMinutes;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function lessonCard(lesson) {
  const card = element("article", "lesson-card");
  const current = isCurrentLesson(lesson);
  if (current) card.classList.add("is-current");

  const time = element("div", "lesson-time");
  time.append(element("span", "", lesson.start), element("small", "", `до ${lesson.end}`));

  const main = element("div", "lesson-main");
  const topline = element("div", "lesson-topline");
  topline.append(element("h3", "", lesson.subject || "Без назви"));
  if (lesson.type) topline.append(element("span", "lesson-type", lesson.type));
  if (current) topline.append(element("span", "current-badge", "Зараз"));
  const until = minutesUntilLesson(lesson);
  if (!current && until > 0 && until <= 180) {
    topline.append(element("span", "upcoming-badge", `Через ${until} хв`));
  }

  const meta = element("div", "lesson-meta");
  const teachers = Array.isArray(lesson.teachers) ? lesson.teachers.filter(Boolean) : [];
  if (teachers.length) meta.append(element("p", "", `Викладач: ${teachers.join(", ")}`));
  if (lesson.room) meta.append(element("p", "", `Аудиторія: ${lesson.room}`));
  if (!teachers.length && !lesson.room) meta.append(element("p", "", "Деталі заняття не вказані"));

  const resources = element("div", "lesson-resources");
  const resourceData = RESOURCE_DATA[String(lesson.subject_id)] || {};
  resources.append(
    resourceItem("Посилання на пару", resourceData.meetingUrl),
    resourceItem("Завдання", resourceData.tasksUrl),
  );

  main.append(topline, meta, resources);
  card.append(time, main);
  return card;
}

function resourceItem(label, url) {
  if (url) {
    const link = element("a", "resource-item");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.append(element("span", "", label), element("small", "", "Відкрити"));
    return link;
  }
  const placeholder = element("span", "resource-item is-placeholder");
  placeholder.append(element("span", "", label), element("small", "", "Скоро"));
  return placeholder;
}

function emptyState(title, description) {
  const wrapper = element("div", "empty-state");
  wrapper.append(
    element("div", "empty-icon", "✓"),
    element("h3", "", title),
    element("p", "", description),
  );
  return wrapper;
}

function updateHeading() {
  if (state.view === "day") {
    dateWeekday.textContent = formatDate(state.selectedDate, { weekday: "long" });
    dateTitle.textContent = formatDate(state.selectedDate, { day: "numeric", month: "long", year: "numeric" });
  } else {
    const start = weekStart(state.selectedDate);
    const end = shiftDate(start, 6);
    dateWeekday.textContent = "Навчальний тиждень";
    dateTitle.textContent = `${formatDate(start, { day: "numeric", month: "short" })} — ${formatDate(end, { day: "numeric", month: "short" })}`;
  }
}

function renderDay() {
  const lessons = lessonsForDate(state.selectedDate);
  if (!lessons.length) {
    const isToday = state.selectedDate === todayIso();
    const next = state.lessons.find((lesson) => lesson.date > state.selectedDate);
    let description = "Перевірте сусідню дату або тижневий розклад.";
    if (next) {
      description = next.date === shiftDate(state.selectedDate, 1)
        ? "Наступні заняття — завтра."
        : `Наступні заняття — ${formatDate(next.date, { day: "numeric", month: "long" })}.`;
    }
    content.replaceChildren(emptyState(
      isToday ? "Сьогодні занять немає" : "На цей день немає пар",
      description,
    ));
    return;
  }
  const list = element("div", "lesson-list");
  lessons.forEach((lesson) => list.append(lessonCard(lesson)));
  if (state.selectedDate === todayIso()) {
    const now = kyivDateParts();
    const currentMinutes = Number(now.hour) * 60 + Number(now.minute);
    const finished = lessons.every((lesson) => {
      const [hour, minute] = lesson.end.split(":").map(Number);
      return currentMinutes >= hour * 60 + minute;
    });
    if (finished) {
      content.replaceChildren(element("p", "day-note", "На сьогодні заняття вже завершилися."), list);
      return;
    }
  }
  content.replaceChildren(list);
}

function renderWeek() {
  const start = weekStart(state.selectedDate);
  const wrapper = element("div", "week-list");
  for (let offset = 0; offset < 7; offset += 1) {
    const iso = shiftDate(start, offset);
    const lessons = lessonsForDate(iso);

    const day = element("section", "week-day");
    if (iso === todayIso()) day.classList.add("is-today");
    const heading = element("div", "week-day-title");
    heading.append(
      element("h3", "", formatDate(iso, { weekday: "long" })),
      element("span", "", formatDate(iso, { day: "numeric", month: "long" })),
    );
    day.append(heading);
    if (lessons.length) {
      const list = element("div", "lesson-list");
      lessons.forEach((lesson) => list.append(lessonCard(lesson)));
      day.append(list);
    } else {
      day.append(element("p", "week-empty", "Немає пар"));
    }
    wrapper.append(day);
  }

  content.replaceChildren(wrapper);
}

function render() {
  updateHeading();
  if (state.view === "day") renderDay();
  else renderWeek();
}

function moveSelection(direction) {
  state.selectedDate = shiftDate(state.selectedDate, direction * (state.view === "week" ? 7 : 1));
  render();
}

function showError() {
  const wrapper = element("div", "error-state");
  wrapper.append(
    element("h3", "", "Не вдалося завантажити розклад"),
    element("p", "", "Перевірте з’єднання або спробуйте оновити сторінку пізніше."),
  );
  content.replaceChildren(wrapper);
  dateWeekday.textContent = "Помилка";
  dateTitle.textContent = "Дані недоступні";
  updatedAt.textContent = "Статус оновлення невідомий";
}

async function loadSchedule() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.lessons)) throw new Error("Invalid schedule format");

    state.lessons = data.lessons
      .filter((lesson) => lesson && lesson.date && lesson.start && lesson.end)
      .sort((a, b) => `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`));

    const today = todayIso();
    currentDate.textContent = formatDate(today, { weekday: "long", day: "numeric", month: "long" });
    const nearest = state.lessons.find((lesson) => lesson.date >= today);
    state.selectedDate = nearest?.date || today;

    if (data.updated_at) {
      const date = new Date(data.updated_at);
      updatedAt.textContent = `Оновлено ${new Intl.DateTimeFormat("uk-UA", {
        timeZone: TIME_ZONE,
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date)}`;
    } else {
      updatedAt.textContent = "Час оновлення не вказано";
    }
    render();
  } catch (error) {
    console.error("Schedule loading failed:", error);
    showError();
  }
}

previousButton.addEventListener("click", () => moveSelection(-1));
nextButton.addEventListener("click", () => moveSelection(1));
todayButton.addEventListener("click", () => {
  state.selectedDate = todayIso();
  render();
});

viewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.view = button.dataset.view;
    viewButtons.forEach((item) => item.classList.toggle("is-active", item === button));
    render();
  });
});

loadSchedule();
