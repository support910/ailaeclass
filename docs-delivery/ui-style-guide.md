# UI 風格指南 — AI 模塊延伸開發手冊

> 本文檔目標讀者：負責在 ClassroomIO 既有介面之上,繼續開發 AI 相關模塊(如 AI 助教、AI 出題、AI 批改、AI 對話等)的開發者或 AI 編程代理。
>
> 閱讀本文後,你應該能在不引入新 UI 庫、不破壞現有風格的前提下,新增 AI 模塊功能。

---

## 目錄

1. [技術棧速查](#1-技術棧速查)
2. [設計原則](#2-設計原則)
3. [色彩系統](#3-色彩系統)
4. [字型與排版](#4-字型與排版)
5. [間距、圓角、陰影、過渡](#5-間距圓角陰影過渡)
6. [深色模式](#6-深色模式)
7. [佈局與容器](#7-佈局與容器)
8. [核心元件清單](#8-核心元件清單)
9. [元件命名與目錄規範](#9-元件命名與目錄規範)
10. [AI 模塊既有實作](#10-ai-模塊既有實作)
11. [新 AI 功能的標準開發流程](#11-新-ai-功能的標準開發流程)
12. [AI 模塊 UI 範本](#12-ai-模塊-ui-範本)
13. [國際化(i18n)規範](#13-國際化i18n規範)
14. [可訪問性(a11y)與響應式](#14-可訪問性a11y與響應式)
15. [常見錯誤與禁止事項](#15-常見錯誤與禁止事項)
16. [檢查清單(Checklist)](#16-檢查清單checklist)

---

## 1. 技術棧速查

| 類別 | 技術 | 版本 | 用途 |
|------|------|------|------|
| 框架 | SvelteKit | 1.x | 路由、SSR、API |
| 語言 | Svelte | 4.x | 元件 |
| CSS | TailwindCSS | 3.3.x | 主要樣式系統 |
| CSS 插件 | @tailwindcss/forms、@tailwindcss/typography | 0.5.x | 表單、文章排版 |
| 元件庫 | carbon-components-svelte | 0.79.x | Popover / Loading / InlineNotification 等 |
| 圖示庫 | carbon-icons-svelte | 12.1.x | 全部 SVG 圖示 |
| 串流 AI | ai (Vercel AI SDK) | 2.x | `useCompletion` 等 hooks |
| LLM | openai-edge | 1.2.x | OpenAI Edge runtime |
| i18n | sveltekit-i18n | 2.4.x | 多語言 |
| Toast | 自製 Snackbar(包 Carbon `InlineNotification`) | — | 全局訊息提示 |

> **重要**:不要引入新的 UI 框架(MUI、Ant Design、shadcn 等)、不要引入新的圖示庫(lucide、heroicons 等)、不要引入新的動畫庫(framer-motion 等)。AI 模塊的所有外觀與互動都應**重用**現有元件。

`tailwind.config.js`:

```js
export default {
  darkMode: 'class',
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: { extend: {} },
  plugins: [require('@tailwindcss/typography'), require('@tailwindcss/forms')]
};
```

> 注意:`theme.extend` 是空的,所有顏色、間距、字級都使用 Tailwind 預設值,**不要**在 `tailwind.config.js` 加入自定義 token,品牌色透過 `app.postcss` 中的 `.bg-primary-*` 覆寫達成。

---

## 2. 設計原則

1. **一致勝過創新** — AI 功能不應該長得像「外掛」,要長得像產品本來就有的功能。
2. **內嵌不彈窗** — 優先使用 `Popover` 內嵌在輸入欄附近,而不是另開大型對話框。對話框只用於「需要使用者填表」的情境。
3. **三段式互動** — AI 結果預設提供三個動作:**插入(Insert)/ 改寫(Rephrase)/ 重置(Reset)**,順序固定。
4. **流式輸出** — 任何 AI 回應都採用 `StreamingTextResponse` 串流,不要一次性等到回應完整再顯示。
5. **可中斷與可恢復** — AI 載入時 disable 按鈕,顯示 `Loading` 元件;失敗用 Snackbar 提示,不卡住主流程。
6. **明確標示 AI 產物** — 凡是觸發 AI 的按鈕,**必須**使用 `MagicWandFilled` 圖示(來自 `carbon-icons-svelte/lib/MagicWandFilled.svelte`),這是專案的 AI 視覺識別。
7. **i18n 優先** — 任何字串都先放進翻譯文件,不要硬編碼中英文文字。
8. **Mobile-first** — 元件預設假設手機,寬螢幕用 `lg:`、`md:` 前綴擴展。

---

## 3. 色彩系統

### 3.1 主色 Token

專案有 **5 套主題色**,通過在 `<html>` 加上 class(`theme-rose` / `theme-green` / `theme-orange` / `theme-violet`)切換。預設(無 class)是藍綠色(Teal)。

| Token | 預設值(藍綠) | 用途 |
|-------|---------------|------|
| `bg-primary-50` / `text-primary-50` | `#ECF8F8` | 最淺背景、hover 區 |
| `bg-primary-100` | `#C8EDED` | 區塊輕底色 |
| `bg-primary-200` | `#9EDEDE` | — |
| `bg-primary-300` | `#6DCDCD` | — |
| `bg-primary-400` | `#3EBABA` | — |
| `bg-primary-500` | `#14A3A2` | 連結文字色、Snackbar info |
| `bg-primary-600` | `#0E8A89` | 表單 focus 邊框 |
| `bg-primary-700` | `#0E7372` | **主要按鈕底色 / Tab 啟用色** |
| `bg-primary-800` | `#095E5D` | — |
| `bg-primary-900` | `#064A49` | hover 加深底 |

> 完整色票見 `apps/dashboard/src/app.postcss`(行 196–706)。

### 3.2 CSS 變數

```css
--main-primary-color  /* 由組織自訂主色,Calendar、連結、navigation 高亮使用 */
--scrollbarBG         /* 滾動軌道背景,深色模式自動切換為 #000 */
--thumbBG             /* 滾動條顏色 */
```

組織管理員可在後台改變組織主色,該值會寫進 `--main-primary-color`。**新元件涉及「客戶可見頁(LMS、Course Landing Page)」時,優先使用此 CSS 變數**;後台 Dashboard 內部則使用 `bg-primary-*`。

### 3.3 語義色

| 用途 | Class |
|------|-------|
| 成功 | `bg-green-700 hover:bg-green-900 text-white` 或 `text-green-500` |
| 危險 / 錯誤 | `bg-red-700 hover:bg-red-900 text-white`、`text-red-500` |
| 警告 | `bg-yellow-600 text-white` |
| 中性 / 資訊 | `bg-gray-400 hover:bg-gray-600 text-white` |
| 取消 / 否定 | `bg-gray-200 dark:bg-neutral-800` |

### 3.4 灰階

| 場景 | 淺色 | 深色 |
|------|------|------|
| 主背景 | `bg-white` | `dark:bg-black` |
| 卡片、Modal 內容區 | `bg-white` | `dark:bg-neutral-800` |
| 輸入框背景 | `bg-gray-100` / `bg-gray-50` | `dark:bg-neutral-700` |
| 邊框 | `border-gray-200` | `dark:border-neutral-600` |
| 次要文字 | `text-gray-500` | `dark:text-white opacity-70` |
| 主要文字 | `text-black` | `dark:text-white` |

---

## 4. 字型與排版

### 4.1 字體棧

`app.postcss` 強制使用系統字體棧(`!important`),不要引入 Google Fonts:

```css
font-family:
  ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
  Segoe UI, Roboto, Helvetica Neue, Arial, Noto Sans, sans-serif,
  'Apple Color Emoji', 'Segoe UI Emoji', Segoe UI Symbol, 'Noto Color Emoji' !important;
```

### 4.2 字級規範

| 場景 | Class | 約等於 |
|------|-------|--------|
| 主標題(頁面 H1) | `text-lg font-semibold` 或 H 標籤 | 18px |
| 區塊標題 | `text-md font-medium` 或 `text-base font-semibold` | 16px |
| 內容/正文 | (預設,Tailwind base) | 14–16px |
| 輔助說明 | `text-sm` | 14px |
| 提示與徽章 | `text-xs` | 12px |
| 表單錯誤 | `text-sm text-red-500` | — |

### 4.3 標題行為

`app.postcss` 把所有 H1–H6 還原為瀏覽器原始大小(`font-size: revert`)並設了 `0.8em 0` 的上下邊距。**Markdown 渲染區(`.prose`)** 則覆寫為 `font-weight: 600` 與 `line-height: 1.25`。

> 因此:在「自由內容區」直接使用 `<h1>`–`<h6>`,在「卡片標題、Modal 標題」處使用 `<p class="text-md font-medium">` 而**不是** `<h?>` 以避免破壞節奏。

### 4.4 .prose 區塊

`@tailwindcss/typography` 套用在 AI 生成內容、課程筆記預覽、HTML 渲染上。深色模式下文字一律白色(見 `app.postcss` 行 87–98)。

---

## 5. 間距、圓角、陰影、過渡

### 5.1 圓角

| 場景 | Class |
|------|-------|
| 一般卡片、按鈕 | `rounded-md`(6px) |
| 大型容器、Modal | `rounded-md` |
| 圓形(頭像、icon button) | `rounded-full` |
| 標籤(chip) | `rounded-md` 或 `rounded-full` |
| 輸入框 | `rounded-t-md`(只圓上面兩角,因為下緣是底線) |

> **不要使用** `rounded-lg`、`rounded-xl` 之類更大的圓角,風格不一致。

### 5.2 陰影

| 場景 | Class |
|------|-------|
| 按鈕 hover | `hover:shadow-xl` |
| Modal | `shadow-lg` |
| 一般卡片 | 通常**不加** shadow,使用 `border` 區隔 |

### 5.3 過渡

主要按鈕使用統一的過渡時長:

```html
class="transition-all delay-150 duration-300 ease-in-out"
```

按下回饋:`hover:scale-95`(縮 5%,容易識別「能按」)。

Tab 底線、進度條:`transition-all duration-500 ease-in-out`。

Snackbar 滑入:`fly={{ x: 200, duration: 500 }}`。

### 5.4 間距(Padding / Margin)

| 場景 | Class |
|------|-------|
| 主按鈕內距 | `px-5 py-[0.2rem]` + `min-h-[36px]` |
| Icon 按鈕 | `p-2` 至 `p-3` |
| Modal 標題列 | `p-4 px-5` |
| Modal 內容區 | `p-6` |
| 表格列 | `py-3` |
| 表單項目間距 | `mt-1`(label 與 input)、`mb-2`(項目之間) |
| Page Body 邊距 | `pb-5 px-4`(隱藏導航時 `pb-20 px-4`) |

---

## 6. 深色模式

* 啟用方式:`darkMode: 'class'`,在 `<html>` 加 `dark` class。
* 切換邏輯由路由 layout 處理,不要在元件內部讀取本地 storage。
* **每一條淺色樣式都要寫對應的 `dark:` 樣式**,沒寫 = bug。
* 深色模式禁止使用純黑(`#000`)做大面積背景,改用 `dark:bg-neutral-800`(卡片)、`dark:bg-black`(頁面背景例外:導航與某些頂層容器)。

| 淺色 | 深色 |
|------|------|
| `bg-white` | `dark:bg-neutral-800` 或 `dark:bg-black` |
| `bg-gray-50` / `bg-gray-100` | `dark:bg-neutral-700` |
| `bg-gray-200` | `dark:bg-neutral-700` 或 `dark:bg-neutral-600` |
| `text-black` | `dark:text-white` |
| `border-gray-200` | `dark:border-neutral-600` |
| `border-gray-300` | `dark:border-neutral-600` |
| `hover:bg-gray-200` | `dark:hover:bg-neutral-800` 或 `dark:hover:bg-gray-700` |

`.prose` 在深色模式下會自動把全部標題、列表、段落、強調都轉白(見 `app.postcss` 行 87–98),AI 輸出渲染時不需要再額外處理。

---

## 7. 佈局與容器

### 7.1 全局結構

```
<html class="theme-orange dark">       ← 主題 + 深淺色開關
  <body>
    <Navigation />                     ← 頂部導航,高 ~48px
    <Page.Nav />                       ← 子頁面標頭(可選),高 61px,sticky
    <Page.Body>...</Page.Body>         ← 內容,寬度 max-w-4xl,padding pb-5 px-4
    <Snackbar />                       ← 浮動於右上 (top: 24px)
  </body>
</html>
```

### 7.2 容器寬度

| 容器 | 預設寬度 |
|------|---------|
| `Page.Body` | `max-w-4xl w-full lg:w-11/12` |
| Modal(預設) | `max-width: 1000px` |
| Modal(`size="sm"`) | `max-width: 388px` |
| Popover(AI 浮層) | `w-[300px] h-[220px]`(可依內容調整) |

### 7.3 高度計算

* 頁面內容區用 `h-[calc(100vh-127px)]`(扣除頂部導航 + Page.Nav)。
* 如果隱藏 `PageNav`,改成 `h-[calc(100vh-65px)]`。
* `org-slot`(組織內容區):`min-width: calc(100vw - 250px)`(扣除側欄)。
* **不要硬寫死 `100vh`**,這會造成 mobile Safari 的位址列遮擋。

---

## 8. 核心元件清單

> 路徑相對於 `apps/dashboard/src/lib/components/`。

| 元件 | 路徑 | 何時使用 |
|------|------|---------|
| **PrimaryButton** | `PrimaryButton/index.svelte` | 所有「主要動作」按鈕 — 提交、保存、生成 AI、下一步等 |
| **IconButton** | `IconButton/index.svelte` | 純圖示按鈕(關閉、刪除、密碼眼睛、AI 觸發按鈕外殼) |
| **Modal** | `Modal/index.svelte` | 需要使用者輸入或確認的彈窗 |
| **DeleteModal** | `Modal/DeleteModal.svelte` | 標準二次確認刪除 |
| **TextField** | `Form/TextField.svelte` | 單行輸入(支援 password、helper、error) |
| **TextArea** | `Form/TextArea.svelte` | 多行輸入,**已內建 `isAIEnabled` 開關**(見第 10 章) |
| **AutoGrowTextField** | `Form/AutoGrowTextField.svelte` | 隨內容增高的多行輸入 |
| **Checkbox / RadioItem / Select / Date / DateTime** | `Form/*.svelte` | 對應名稱的表單控件 |
| **Snackbar** | `Snackbar/index.svelte` + `store.js` | 全局訊息提示 — 透過 `snackbar.success(key)` / `.error(key)` |
| **Tabs / TabContent** | `Tabs/index.svelte` | 頁籤切換,動畫底線 |
| **Page** | `Page/{Body,Nav}.svelte` | 頁面殼層,包含內容區與標頭 |
| **Box** | `Box/index.svelte` | 空狀態容器(灰邊框、置中內容) |
| **Chip / TextChip / PlanChip** | `Chip/*.svelte` | 標籤、徽章、數字徽章 |
| **Avatar** | `Avatar/index.svelte` | 圓形頭像 |
| **Backdrop** | `Backdrop/` | 遮罩 |
| **Dropdown** | `Dropdown/index.svelte` | 下拉選單 |
| **CodeSnippet** | `CodeSnippet/` | 代碼片段顯示與複製 |
| **HTMLRender** | `HTMLRender/HTMLRender.svelte` | 安全渲染 HTML(內含 dompurify) |
| **MarkdownEditor** | `MarkdownEditor/index.svelte` | Markdown 編輯器(用於課程筆記、AI 結果預覽) |
| **TextEditor** | `TextEditor/` | 富文本編輯器 |
| **ToolTip** | `ToolTip/index.svelte` | 提示氣泡(IconButton 已自帶) |
| **AIButton(CustomPromptBtn)** | `AI/AIButton/CustomPromptBtn.svelte` | **AI 通用觸發鈕(本指南第 10 章詳述)** |
| **Loading**(來自 carbon) | `import { Loading } from 'carbon-components-svelte'` | 載入動畫 |
| **Popover**(來自 carbon) | `import { Popover } from 'carbon-components-svelte'` | AI 浮層、選單浮層 |

### 8.1 PrimaryButton 變體完整列表

定義於 `PrimaryButton/constants.js`,**必須**使用既有變體,不要在 className 自行覆寫顏色:

| 變體 | 何時用 |
|------|-------|
| `CONTAINED` | **預設主要按鈕**,`bg-primary-700 → primary-900` |
| `CONTAINED_LIGHT` | 主要按鈕較淺,`bg-primary-600 → primary-900` |
| `CONTAINED_DARK` | 黑底白字主按鈕(深色模式自動反相) |
| `CONTAINED_WHITE` | 白底黑字 |
| `CONTAINED_INFO` | 灰底白字,輔助動作 |
| `CONTAINED_SUCCESS` | 綠底白字,確認類成功動作 |
| `CONTAINED_DANGER` | 紅底白字,刪除確認 |
| `OUTLINED` | 透明底 + 黑邊 — **AI 觸發鈕用這個** |
| `NONE` | 完全透明,只有 hover 灰底,純 icon 按鈕 |
| `LINK` | 文字鏈接外觀 `text-primary-500` + hover 底線 |
| `TEXT` | 純文字按鈕,hover 加底線 |
| `TEXT_DANGER` | 紅色文字按鈕 |

範例:

```svelte
<PrimaryButton
  label="Save"
  variant={VARIANTS.CONTAINED}
  isLoading={saving}
  isDisabled={!isDirty}
  onClick={handleSave}
/>

<PrimaryButton variant={VARIANTS.OUTLINED} disableScale>
  <MagicWandFilled size={20} class="carbon-icon mr-3" />
  AI
</PrimaryButton>
```

---

## 9. 元件命名與目錄規範

```
src/lib/components/
└── <ComponentName>/                ← PascalCase 資料夾
    ├── index.svelte                ← 主入口(若元件單一)
    ├── constants.ts | constants.js ← 變體/常數
    ├── store.ts | store.js         ← 元件級 svelte store(Snackbar 是這個模式)
    ├── types.ts                    ← TS 型別
    └── <SubComponent>.svelte       ← 同一族元件的子組件
```

* 多組件叢集的目錄(像 `Form/`、`Buttons/`)直接放多個檔案,不再一層子資料夾。
* 子元件用 PascalCase,例如 `Form/TextField.svelte`。
* import 從 `$lib/components/<Name>/index.svelte` 或具體檔名。
* **路由**(`src/routes/...`)中**禁止**寫業務元件,所有可重用元件一律放 `lib/components/`。
* AI 模塊新元件統一放在 `lib/components/AI/<FeatureName>/` 下,例如:
  ```
  lib/components/AI/
  ├── AIButton/CustomPromptBtn.svelte         (已存在)
  ├── ChatPanel/index.svelte                  (新增範例:側邊聊天面板)
  └── QuestionGenerator/index.svelte          (新增範例:出題助手)
  ```

---

## 10. AI 模塊既有實作

### 10.1 後端串流端點

統一放在 `apps/dashboard/src/routes/api/completion/<feature>/+server.ts`,**全部使用 Edge runtime**,**全部回傳 `StreamingTextResponse`**:

```ts
// /api/completion/customprompt/+server.ts (範本)
import { Configuration, OpenAIApi } from 'openai-edge';
import { OpenAIStream, StreamingTextResponse } from 'ai';
import { env } from '$env/dynamic/private';

const openai = new OpenAIApi(new Configuration({ apiKey: env.OPENAI_API_KEY }));

export const config = { runtime: 'edge' };

export async function POST({ request }) {
  const { prompt } = await request.json();
  const { /* 參數 */ } = JSON.parse(prompt);

  const response = await openai.createChatCompletion({
    model: 'gpt-4o',                           // 預設模型
    messages: [
      { role: 'system', content: '...' },      // 簡短角色設定
      { role: 'user', content: '...' }         // 包進 locale, 顯式禁止輸出 ```
    ],
    stream: true
  });
  return new StreamingTextResponse(OpenAIStream(response));
}
```

現有端點:
* `POST /api/completion`(課程內容生成 — outline / note / activities)
* `POST /api/completion/customprompt`(任意 prompt 補全,給 AIButton 使用)
* `POST /api/completion/exerciseprompt`(產生練習題)
* `POST /api/completion/gradingprompt`(批改答案)

### 10.2 前端串流調用

```svelte
<script>
  import { useCompletion } from 'ai/svelte';

  const { input, handleSubmit, completion, isLoading } = useCompletion({
    api: '/api/completion/<feature>'
  });
</script>

{#if $isLoading}
  <Loading withOverlay={false} small />
{/if}

<HtmlRender content={$completion} />
```

### 10.3 AIButton(CustomPromptBtn)用法

對於「希望使用者輸入一段 prompt 後,得到 AI 文字結果並插入欄位」的最常見場景,**直接重用 `CustomPromptBtn`**,不要重寫:

```svelte
<TextArea
  bind:value={lessonNote}
  isAIEnabled={true}
  initAIPrompt="幫我生成一段關於「光合作用」的引言"
  aiAlignPopover="left"
  label={$t('lesson.note')}
/>
```

`TextArea` 已經內建 AI 觸發按鈕的整合(`isAIEnabled` 開關),**這是首選方式**。

如果需要在 TextArea 之外的地方放 AI 按鈕(例如工具列):

```svelte
<CustomPromptBtn
  defaultPrompt="..."
  alignPopover="right"
  isHTML={false}
  handleInsert={(text) => { myValue = text; }}
/>
```

行為:
1. 點擊魔杖 → 打開 Popover(300×220)。
2. 顯示 prompt 輸入框 + 提交按鈕。
3. 提交後串流顯示結果。
4. 結果區下方提供三個按鈕:**Insert / Rephrase / Reset**。

### 10.4 「AI 工具列」型按鈕

當需要多個預設動作(例如「生成大綱 / 生成筆記 / 生成活動」)時,使用「主按鈕 + Popover 內含選項列表」的模式,**參考 `Materials/index.svelte` 行 360–397**:

```svelte
<PrimaryButton
  className="flex items-center relative"
  onClick={() => (openPopover = !openPopover)}
  isLoading={$isLoading}
  isDisabled={$isLoading}
  variant={VARIANTS.OUTLINED}
  disableScale
>
  <MagicWandFilled size={20} class="carbon-icon mr-3" />
  AI
  <Popover caret align="left" bind:open={openPopover}>
    <div class="p-2">
      <button class={aiButtonClass} on:click={() => callAI('outline')}>
        <ListIcon class="carbon-icon mr-2" />
        {$t('...ai.outline')}
      </button>
      <!-- 更多選項 -->
    </div>
  </Popover>
</PrimaryButton>

<script>
  // 統一的 AI 子按鈕樣式
  let aiButtonClass =
    'flex items-center px-5 py-2 border border-gray-300 ' +
    'hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md w-full mb-2';
</script>
```

---

## 11. 新 AI 功能的標準開發流程

按順序執行,任何一步缺漏都會破壞風格一致性。

### Step 1 — 確認 UX 模式

選擇下列其中一種(優先序由上而下):

| 場景 | 建議 UI |
|------|---------|
| 在表單欄位旁協助生成內容 | **TextArea + `isAIEnabled`**(零自寫程式碼) |
| 工具列裡的多選 AI 動作 | `PrimaryButton(OUTLINED) + MagicWandFilled + Popover 內選項列` |
| 對話式問答(多輪) | 側欄 `Drawer` 或全頁路由,使用 `useChat` |
| 一次性大表單(批量生成) | `Modal`(`size=""` 預設,大型表單) |
| 「AI 設定」配置頁 | 新建路由 `/org/[id]/settings/ai`,沿用 `Page.Body` 寬度 |

### Step 2 — 後端

* 建立 `src/routes/api/completion/<feature>/+server.ts`。
* 一律用 Edge runtime + OpenAI streaming。
* 把 `locale` 當作參數傳入,讓 AI 回應的語言匹配使用者介面。
* 在 prompt 內**明確禁止**輸出 ```` ``` ```` 圍欄(模型常輸出三反引號污染 HTML)。

### Step 3 — 前端 Hook

* 建立 `lib/components/AI/<Feature>/index.svelte`。
* 內部使用 `useCompletion` 或 `useChat`(來自 `ai/svelte`)。
* `isLoading`、`error` 狀態都要連到 UI。

### Step 4 — 視覺

* 觸發按鈕**必有** `MagicWandFilled` 圖示。
* 主按鈕用 `PrimaryButton` 的 `OUTLINED` 變體 + `disableScale`(避免縮放打斷 Popover)。
* 結果區用 `<HtmlRender>` 或 `<MarkdownEditor>`,**不要** `{@html ...}` 直接輸出(XSS 風險)。
* 載入用 `<Loading withOverlay={false} small />`。
* 完成 / 失敗用 `snackbar.success('ai.<feature>.done')` / `snackbar.error('ai.<feature>.failed')`。

### Step 5 — 國際化

* 新字串放進 `src/lib/utils/functions/translations`(具體放法見第 13 章)。
* AI 相關字串統一前綴 `ai.`,例如 `ai.help_me`、`ai.insert`、`ai.rephrase`、`ai.reset`、`ai.placeholder`、`ai.text`、`ai.can_you`(這些 key 已存在,不要重複造)。

### Step 6 — 深色模式 / 響應式 / 鍵盤可訪問性

* 每個 class 都檢查 `dark:` 對應。
* mobile 寬度下 Popover 不能超出螢幕(用 `align="right"` 或自動翻轉)。
* 按鈕加 `aria-label`(空 icon button 必須)。

### Step 7 — Snackbar 整合

```svelte
import { snackbar } from '$lib/components/Snackbar/store';

snackbar.success('ai.outline.generated');
snackbar.error('ai.outline.failed');
```

訊息 key 一律放進 i18n,不要直接傳中英文。

---

## 12. AI 模塊 UI 範本

下面三段是**可直接複製**的模板。新功能優先從這些開始改。

### 12.1 模板 A — 在欄位旁加 AI 助手(最簡)

```svelte
<TextArea
  bind:value={essay}
  label={$t('exercise.your_answer')}
  rows={6}
  isAIEnabled={true}
  initAIPrompt={$t('ai.essay_starter_prompt')}
  aiAlignPopover="left"
/>
```

### 12.2 模板 B — 工具列多選 AI 動作

```svelte
<script lang="ts">
  import { useCompletion } from 'ai/svelte';
  import { Popover, Loading } from 'carbon-components-svelte';
  import MagicWandFilled from 'carbon-icons-svelte/lib/MagicWandFilled.svelte';
  import PrimaryButton from '$lib/components/PrimaryButton/index.svelte';
  import { VARIANTS } from '$lib/components/PrimaryButton/constants';
  import HtmlRender from '$lib/components/HTMLRender/HTMLRender.svelte';
  import { snackbar } from '$lib/components/Snackbar/store';
  import { t } from '$lib/utils/functions/translations';

  export let onInsert = (text: string) => {};

  let openPopover = false;

  const { input, handleSubmit, completion, isLoading } = useCompletion({
    api: '/api/completion/<feature>'
  });

  function callAI(type: 'summary' | 'simplify' | 'translate') {
    $input = JSON.stringify({ type, locale: 'zh-Hant' });
    handleSubmit({ preventDefault: () => {} });
  }

  const aiBtnClass =
    'flex items-center px-5 py-2 border border-gray-300 ' +
    'hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md w-full mb-2';
</script>

<PrimaryButton
  variant={VARIANTS.OUTLINED}
  isLoading={$isLoading}
  isDisabled={$isLoading}
  disableScale
  onClick={() => (openPopover = !openPopover)}
>
  <MagicWandFilled size={20} class="carbon-icon mr-3" />
  AI
  <Popover caret align="left" bind:open={openPopover}>
    <div class="p-2">
      <button class={aiBtnClass} on:click={() => callAI('summary')}>
        {$t('ai.summary')}
      </button>
      <button class={aiBtnClass} on:click={() => callAI('simplify')}>
        {$t('ai.simplify')}
      </button>
      <button class={aiBtnClass} on:click={() => callAI('translate')}>
        {$t('ai.translate')}
      </button>
    </div>
  </Popover>
</PrimaryButton>

{#if $completion}
  <div class="mt-3 bg-white dark:bg-neutral-700 p-3 rounded-md border border-gray-200 dark:border-neutral-600">
    <HtmlRender content={$completion} />
    <div class="flex gap-3 mt-3">
      <button
        class="text-xs px-4 py-2 border rounded-md font-medium"
        on:click={() => onInsert($completion)}
      >
        {$t('ai.insert')}
      </button>
    </div>
  </div>
{/if}
```

### 12.3 模板 C — 全螢幕 / 側欄 AI 對話面板

* **建議路由化**:`/org/[id]/ai-assistant`,沿用 `Page.Body` 容器。
* 使用 `useChat`(`ai/svelte`)管理多輪訊息。
* 訊息泡泡:使用者用 `bg-primary-50` 右對齊,AI 用 `bg-gray-100 dark:bg-neutral-700` 左對齊。
* 輸入欄使用 `AutoGrowTextField` + 右下角 `<PrimaryButton variant={VARIANTS.CONTAINED}>` 送出。

---

## 13. 國際化(i18n)規範

* **任何使用者可見字串都必須走 `t()`**,包括按鈕 label、placeholder、title、aria-label、Snackbar 訊息。
* 使用方式:

  ```svelte
  <script>
    import { t } from '$lib/utils/functions/translations';
  </script>

  <button>{$t('ai.insert')}</button>
  ```

* AI 相關 key 統一前綴 `ai.`。
* 後端 prompt 內的「給 AI 的指令文字」**不要**翻譯,但要把 `locale` 傳進去讓 AI **輸出**對應語言。
* 翻譯文件結構與運作邏輯詳見 `src/lib/utils/functions/translations.ts`。

---

## 14. 可訪問性(a11y)與響應式

### 14.1 a11y 必做事項

* 所有 `<button>` 必須有可讀文字或 `aria-label`。
* 純圖示按鈕用 `IconButton`(內含 `ToolTip`)而不是裸 `<button>`。
* Modal 開啟時自動鎖定 body 滾動(`Modal/index.svelte` 已實作)。
* 表單 label 與 input 透過 `<label>` 包裹建立關聯(`TextField` 已實作)。
* Tab 顺序與焦點環:focus 樣式由 Tailwind `@tailwindcss/forms` 提供,**不要**用 `outline:none` 移除。
* 顏色對比:文字色與背景色必須符合 WCAG AA;`primary-500` 以下色階不要單獨用作正文文字。

### 14.2 響應式斷點

Tailwind 預設斷點:`sm:640px / md:768px / lg:1024px / xl:1280px`。

| 場景 | 慣例 |
|------|------|
| 元件預設 | mobile-first,最小寬度先寫 |
| 大螢幕擴展 | `lg:w-11/12` 之類 |
| 隱藏 mobile | `hidden lg:flex` |
| 隱藏桌面 | `lg:hidden` |
| 觸控優先 | 點擊區最小 44×44(用 `min-h-[36px]` + `py-2` 達成大約 40px+) |

### 14.3 Cypress / Playwright 測試命名

新元件加 `data-testid="ai-<feature>-<element>"`,例如:

```html
<button data-testid="ai-summary-trigger">...</button>
```

便於既有 `cypress/` 與 `apps/dashboard/playwright/` 測試延伸。

---

## 15. 常見錯誤與禁止事項

### 15.1 不允許的做法

| 禁止 | 為什麼 | 改用 |
|------|--------|------|
| `<button class="bg-blue-500 ...">` 自寫主按鈕 | 不跟主題色;切主題時不會變 | `<PrimaryButton variant={VARIANTS.CONTAINED}>` |
| 用 `lucide-svelte` 或其他圖示庫 | 風格不一致 | `carbon-icons-svelte` |
| `{@html aiOutput}` 直接渲染 AI 結果 | XSS 風險 | `<HtmlRender content={aiOutput} />`(內含 dompurify) |
| `console.log` 留在生產代碼 | 影響效能 + 隱私 | 移除或用 `$lib/utils/log` |
| 引入 `framer-motion` / `motion` | 與 Svelte transition 不相容 | `svelte/transition` 的 `fade`、`fly`、`slide` |
| 自寫 Toast / Notification | 風格分裂 | `snackbar.success() / .error() / .info()` |
| 在元件內讀寫 `localStorage` | SSR 會炸 | 透過 `$lib/utils/store` 內現有 store |
| `setTimeout` / `setInterval` 不清理 | 記憶體洩漏 | 在 `onDestroy` 清掉 |
| 未串流的 AI 回應(等待整段返回) | 使用者體驗差 | `StreamingTextResponse` + `useCompletion` |
| 硬編碼中英文 label | 無法 i18n | `$t('...')` |
| 用 `rounded-lg` / `rounded-xl` / `rounded-3xl` | 風格不一致 | `rounded-md` 或 `rounded-full` |
| `dark:` class 漏寫 | 深色模式崩 | 每條淺色都對應寫深色 |
| 把 AI 元件寫在 `routes/` 而非 `lib/components/` | 無法重用 | 放 `lib/components/AI/<Feature>/` |
| 在 `tailwind.config.js` 加 custom colors | 與專案約定衝突 | 用 `app.postcss` 的 `bg-primary-*` 系列 |

### 15.2 容易踩雷的細節

* **OpenAI 回應常含 ```` ```html ... ``` ````**:在 prompt 裡明確說「DO NOT include three backticks」,並在前端用 `replace(/^```html\n?|\n?```$/g, '')` 兜底。
* **Popover 點擊外部關閉**:Carbon `Popover` 需要 `on:click:outside` 自行處理(見 `Materials/index.svelte` 行 377–379)。
* **Modal `body` 鎖定滾動**:多個 Modal 同時開會混亂,確保同時只有一個 Modal 開啟。
* **`useCompletion` 的 `$input` 必須 `set` 後 setTimeout 再 `handleSubmit`**(見 `CustomPromptBtn.svelte` 行 45–47),否則第一次提交會丟參數。
* **dark mode 文字輸入背景色**:`bg-gray-50`/`bg-gray-100` 在 dark mode 一定要改 `dark:bg-neutral-700`,且 input 自身字色要 `dark:text-white` 或 `dark:text-black`(視背景而定)。
* **carbon-components-svelte 元件預設樣式很「IBM」**:盡可能用包裝後的本地元件,如果一定要直用,記得疊 wrapper class 把它的 padding / radius 拉回專案規範。

---

## 16. 檢查清單(Checklist)

提交 PR 之前逐項檢查:

### 視覺一致性
- [ ] 主按鈕用 `PrimaryButton` + 既有 `VARIANTS`,沒自寫顏色
- [ ] 圖示來自 `carbon-icons-svelte`
- [ ] AI 觸發按鈕使用 `MagicWandFilled` 圖示
- [ ] 圓角是 `rounded-md` 或 `rounded-full`
- [ ] 主色透過 `primary-*` token,不出現 `#xxxxxx` 寫死(品牌色 CSS 變數除外)

### 深色模式
- [ ] 每條淺色 class 都有對應 `dark:` class
- [ ] 在 `<html class="dark">` 下肉眼測過一次

### 響應式
- [ ] mobile(<640px)下 Popover、Modal、Tab 不破版
- [ ] 在 `lg:` 與默認斷點下都看過

### AI 串流
- [ ] 後端走 Edge runtime + `StreamingTextResponse`
- [ ] 前端用 `useCompletion` / `useChat`,不直接 `fetch` 等待完整回應
- [ ] `isLoading` 狀態反映在按鈕 disable 與 `<Loading>` 顯示
- [ ] 渲染 AI 輸出用 `HtmlRender` 或 `MarkdownEditor`,不裸 `{@html}`

### i18n / a11y
- [ ] 所有可見字串走 `$t()`
- [ ] 圖示按鈕有 `aria-label` 或 `ToolTip.title`
- [ ] 焦點環沒被 `outline:none` 拿掉

### 程式碼品質
- [ ] 無 `console.log` / `debugger` 殘留
- [ ] 元件路徑放在 `lib/components/AI/<Feature>/`
- [ ] 新增 i18n key 已加進翻譯檔
- [ ] 失敗路徑有 `snackbar.error(...)` 提示
- [ ] 通過 `pnpm lint` 與 `pnpm format`

---

## 附錄 A — 常用 import 範本

```ts
// 元件
import PrimaryButton from '$lib/components/PrimaryButton/index.svelte';
import { VARIANTS } from '$lib/components/PrimaryButton/constants';
import IconButton from '$lib/components/IconButton/index.svelte';
import Modal from '$lib/components/Modal/index.svelte';
import TextField from '$lib/components/Form/TextField.svelte';
import TextArea from '$lib/components/Form/TextArea.svelte';
import HtmlRender from '$lib/components/HTMLRender/HTMLRender.svelte';
import CustomPromptBtn from '$lib/components/AI/AIButton/CustomPromptBtn.svelte';

// 工具
import { snackbar } from '$lib/components/Snackbar/store';
import { t } from '$lib/utils/functions/translations';
import { supabase } from '$lib/utils/functions/supabase';

// AI
import { useCompletion } from 'ai/svelte';
// import { useChat } from 'ai/svelte';   // 多輪對話用

// Carbon
import { Popover, Loading, InlineNotification } from 'carbon-components-svelte';
import MagicWandFilled from 'carbon-icons-svelte/lib/MagicWandFilled.svelte';
```

## 附錄 B — 關鍵檔案索引

| 用途 | 路徑 |
|------|------|
| 全局樣式、主題色定義 | `apps/dashboard/src/app.postcss` |
| Tailwind 設定 | `apps/dashboard/tailwind.config.js` |
| HTML 殼層 | `apps/dashboard/src/app.html` |
| 主按鈕變體 | `apps/dashboard/src/lib/components/PrimaryButton/constants.js` |
| AI 按鈕(範本) | `apps/dashboard/src/lib/components/AI/AIButton/CustomPromptBtn.svelte` |
| 既有 AI 工具列範例 | `apps/dashboard/src/lib/components/Course/components/Lesson/Materials/index.svelte`(行 357–397) |
| AI Streaming 端點範本 | `apps/dashboard/src/routes/api/completion/+server.ts` |
| Snackbar 全局 | `apps/dashboard/src/lib/components/Snackbar/{index.svelte,store.js,constants.ts}` |
| Modal 範本 | `apps/dashboard/src/lib/components/Modal/index.svelte` |
| 表單元件 | `apps/dashboard/src/lib/components/Form/*.svelte` |
| AI 上下文提示語 | `ai/prompts/lms-context.md` |

---

**版本資訊**

* 適用版本:ClassroomIO main 分支(2026-05-05 截稿)
* 撰寫者:UI 風格延伸文件
* 後續維護:每當新增主要 AI 模塊或更動主題色系時,請同步更新本文件第 8 章「核心元件清單」與第 10 章「AI 模塊既有實作」。
