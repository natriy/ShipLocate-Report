# ShipLocate — Master Project Document

> **Инструкция для использования:** скинь этот файл в начало нового чата с Claude, чтобы он сразу был в контексте проекта. Обновляй по мере того как продукт меняется.
>
> **Язык общения:** русский. **Продукт, UI, код, терминология:** английский.

---

## 1. ЧТО ЭТО ЗА ПРОДУКТ

**ShipLocate** — SaaS-платформа для shipment visibility и operational workflow по грузам, предназначенная для **малого и среднего бизнеса (SMB)**, которому нужно контролировать свои отгрузки.

**Сайт:** `shiplocate.com` (лендинг) + `cloude.shiplocate.com` (рабочая панель)

**Слоган:** *"Ship Faster. Locate Smarter."*

**Главный месседж лендинга:** *"Stop calling drivers."*

**Ключевое отличие от конкурентов:** видимость работает через водителя напрямую (phone + SMS login), без интеграций с carrier-системами. Это делает продукт доступным для SMB, которые иначе были бы слепы, когда их груз везёт outside carrier.

---

## 2. ПРОБЛЕМА, КОТОРУЮ РЕШАЕТ

Типичный хаос у SMB-shipper'а:
- Груз создан, информация расползается по звонкам / SMS / email / заметкам
- Офис не знает где водитель и на каком этапе рейс
- Клиент спрашивает "что с грузом?" — диспетчер ищет ответ вручную
- Водитель не понимает что от него ждут
- Подтверждение этапов происходит хаотично
- История рейса потом собирается из разных мест

**Большие TMS (project44, FourKites, Tive)** не решают это для SMB — слишком дорогие, требуют интеграций, цикл внедрения месяцы. **Excel + звонки** — уже не справляется.

ShipLocate — "правильного размера" решение между этими двумя полюсами.

---

## 3. АУДИТОРИЯ

- **Primary:** shippers (SMB) — производители, дистрибьюторы, поставщики, оптовики
- **Secondary:** brokers
- **Optional:** carriers (не основной buyer — у них обычно уже есть свои TMS/ELD)

**Первый реальный клиент:** FMS Fresh Produce — produce distributor. Логичное направление для нишевания — **produce / perishables / cold chain / cross-border US-CA**.

---

## 4. ФИЛОСОФИЯ ПРОДУКТА

1. **Простота** — понятно без обучения
2. **Реальная операционная польза** — не BI, а ежедневная работа
3. **Status-driven UX** — пользователь сразу понимает: где груз, что дальше, есть ли проблема
4. **Driver-first clarity** — водителю нужен только текущий груз и одна большая кнопка next action
5. **Single source of truth per load** — всё про груз в одном месте
6. **Conversational AI как долгосрочная цель** — "What happened with load 50291?"

---

## 5. АРХИТЕКТУРА ПРОДУКТА

### A. Офисная веб-панель (cloude.shiplocate.com)

**Главные табы:** LOADS / HISTORY / LOCATIONS / CARRIERS
**Боковое меню:** Map / Docks / Reports / Settings / Logout
**Header карты:** AI Assistant button

**Модули:**
- **Loads** — центральный модуль, список активных грузов с колонками: Load Number, **Route Progress** (визуальные квадратики stops), Pickup/Delivery dates, Carrier (с insurance flag), Assigned To (телефон + статус подключения), Last Location, Actions
- **Load Details** — три вкладки:
  - **Tracking** — Connection Timeline (Phone linked → SMS sent → SMS delivered → Driver logged-in → Driver accepted → Delivered)
  - **Details** — Carrier, сумма/валюта (USD/CAD), Description, Stops с ETA и mark completed/uncompleted, Add Stop
  - **Activity** — timeline событий + Add Note / Send to Driver
- **Меню груза:** Show Route / Mark as Delivered / Duplicate / Remove / **Share Load**
- **History** — завершённые грузы (отдельный search scope)
- **Locations** — справочник с типами (Customer/Warehouse), адресом, notes, **Geofence Radius** (default 1000м, редактируемый)
- **Carriers** — справочник с DOT/MC, Phone, Email, **Insurance Expiry** (красный флаг "Already expired")
- **Docks** — в будущем
- **Reports** — в будущем
- **Settings:** Profile / Security / Users (роли Admin/User, Active flag) / Billing & Invoices

### B. Мобильное приложение водителя

- Логин по **телефону + SMS PIN**
- Один текущий груз + (опционально) upcoming
- Большая кнопка next action
- Пошаговый guided workflow по milestones
- Multi-language (EN/ES/FR минимум)
- Offline capture с локальными timestamps (синхронизация при появлении связи)

---

## 6. КЛЮЧЕВЫЕ ФИЧИ (УЖЕ ГОТОВЫ)

- ✅ Multi-language для водителей
- ✅ Driver swap flow (смена водителя посреди груза)
- ✅ Offline capture с правильными timestamps
- ✅ Configurable geofence radius (default 1000м)
- ✅ Timezone handling (локальное время каждого stop'а)
- ✅ Insurance expiry warning при назначении carrier
- ✅ Штрафы водителей через систему (setup клиентом)
- ✅ Share Load (публичная tracking-ссылка для клиента shipper'а)
- ✅ AI Assistant (кнопка уже в header карты)
- ✅ Multi-user с ролями (Admin/User)
- ✅ Billing threshold ladder с автоматической эскалацией тиров
- ✅ Connection timeline (диагностика связи с водителем)
- ✅ Route progress визуализация (квадратики stops)
- ✅ Multi-stop support
- ✅ Notifications (почти готово)

---

## 7. LIFECYCLE ГРУЗА

Груз — это цепочка stop events, не плоский статус.

**Pickup stop:** assigned → arrived → loading → loaded → departed
**Delivery stop:** arrived → unloading → delivered

На главном экране это отображается **квадратиками Route Progress** (заполнен = пройдено, пустой = впереди, красный = проблема) — даёт мгновенное понимание состояния груза без чтения статусов.

**Assigned To:** не просто "водитель", а live-статус подключения — "New - Need Driver" / "Pending Acceptance" / процент соединения (89%, 71%, 82%).

---

## 8. PRICING (ТЕКУЩИЙ И ПЛАНИРУЕМЫЙ)

### Текущая структура (на лендинге):
| План | Цена | Loads |
|------|------|-------|
| Starter | Free | 5 |
| Basic | $99 | 6-50 |
| Growth | $149 | 200 |
| Pro | $349 | 500 |
| Enterprise | $499 | 1000 |

### Планируемая перестройка:
| План | Цена | Loads |
|------|------|-------|
| Free | $0 | 10-15 |
| Basic | $99 | 50 |
| Growth | $149 | 150 |
| Scale | $249 | 300 |
| Pro | $399 | 600 |
| Business | $599 | 1200 |
| Enterprise | Contact | 1200+ |

**Принципы:**
- **Всё включено, никаких add-ons** — honest pricing, сильное позиционирование против конкурентов
- **Threshold ladder** — при превышении лимита автоматически списывается следующий тир, работа не блокируется
- **Monthly reset** каждый billing period
- **AI Assistant будет платным в будущем** — модель: скорее всего фикс в месяц (не токены, не per-query), либо включено в Growth и выше

---

## 9. AI ASSISTANT

**Концепция:** пользователь пишет *"What happened with load 50291?"* — система собирает ответ из:
- Load details
- Status history
- Tracking data
- Activity timeline
- Notes
- (в будущем) emails, docs

**Текущий статус:** кнопка в header карты уже есть. Функциональность — на разных стадиях готовности.

**Монетизация:** обсуждается. Приоритет — фикс в месяц / включено в тир, а НЕ per-token или per-query (это нервирует SMB).

---

## 10. СТРАТЕГИЯ

**Ниша:** produce / perishables / cold chain / cross-border US-CA (отталкиваясь от FMS Fresh Produce как первого клиента).

**Ров против больших TMS:** скорость, простота, низкая цена, фокус на SMB. Не раздувать функционал в сторону enterprise TMS — проиграешь project44/FourKites. Остаться узким и быстрым.

**Ров против Excel и звонков:** реальная visibility без интеграций и hardware.

**Главный маркетинг-актив:** case study по FMS Fresh Produce — *"How FMS cut check calls by X%"*.

**Позиционирование:** *"One price. Everything included. No hidden upsells."*

---

## 11. РОДМАП И ОТКРЫТЫЕ ВОПРОСЫ

### Что НЕ делаем (осознанные решения):
- ❌ API / интеграции (пока нет, возможно в 2027 если будет спрос от 5+ клиентов)
- ❌ Add-ons (всё в тиры)
- ❌ Customer Portal (Share Load пока закрывает use case)
- ❌ Per-token / per-query pricing для AI

### Что обсудить / доделать:
- **Pricing перестройка** (см. пункт 8)
- **Summary экран** для Reports — не BI, а одностраничная сводка за месяц (Total loads, On-time %, Avg delay, Top-3 carriers, Top-3 problem carriers, Busiest lane) + **Proof of Service PDF** per load
- **AI Assistant монетизация** — финализировать модель
- **Offboarding carrier** при expired insurance — уже предупреждение + shipper решает сам ✅

### Долгосрочно:
- CSV import/export (вместо API на первое время)
- Полноценный Reports модуль
- Docks модуль
- Расширение AI assistant возможностей

---

## 12. ТЕХНИЧЕСКИЙ СТЕК (для справки, не главное)

- **Frontend:** React + TypeScript, Tailwind v4, shadcn/ui
- **Font:** Nunito Sans
- **Design:** Nova neutral, компактный UI
- **Архитектура:** модульная, ~150 строк на файл
- **Дата формат:** MM/DD/YYYY HH:MM AM/PM
- **Badge colors (фиксированы):**
  - Green `#51C548`
  - Blue `#44AFFE`
  - Red `#FE6860`
  - Yellow `#FDC53F`
  - Gray `#A6B1C2`

---

## 13. ВАЖНЫЕ НЮАНСЫ (не забывать)

- **Free tier 5 loads слишком мало** — надо расширить до 10-15
- **Gap Growth → Pro** ($149 → $349) надо закрыть промежуточным тиром ($249)
- **"Enterprise" за $499 — название обманчивое**, переименовать в Business/Scale/Premium
- **Annual billing со скидкой 15-20%** стоит добавить (cash upfront, меньше churn)
- **Customer Portal** — не делать пока кто-то не попросит явно
- **Водители** — дисциплинируются через систему штрафов (настраивает клиент, ShipLocate только фиксирует события)

---

## 14. КОНТЕКСТ О СОБЕСЕДНИКЕ

- Язык общения: русский (но без "джохера пиздежа" — по существу, прямо)
- Любит короткие, честные ответы
- Не любит "корпоративный" тон
- Знает свою аудиторию лучше меня — доверяй его чутью по SMB
- Продукт уже гораздо более зрелый, чем кажется из документации — многое "почти готово" или готово

---

## 15. ОДНОАБЗАЦНОЕ ОПРЕДЕЛЕНИЕ

**ShipLocate** — SaaS для shipment visibility и operational workflow, построенный для SMB-shippers, которым нужно видеть свои грузы (включая те, что везут outside carriers) без сложных интеграций, без enterprise-цен и без времени на внедрение. Видимость работает через водителя напрямую (phone + SMS login), груз живёт как цепочка stop events с визуальным progress, вся история собирается в единый Activity timeline, и в долгосрочной перспективе продукт эволюционирует в AI-assistant, отвечающий на операционные вопросы человеческим языком.
