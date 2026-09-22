# 從正式版重建飛行成績開發分支

## 基線

| 項目 | 已核對值 |
| --- | --- |
| Railway 正式服務 | ailaeclass，production |
| 正式部署 | ff93fa31-abb9-4a6c-9218-8a59183bcff3，SUCCESS |
| 正式提交 | 76441f3f2297fa7a89d19fb54d0b6143a3df2364，v7.4.0 |
| 正式 Git tree | 2cfbc38a6a4ad83adca8dc6a52beb2ee92ad1a33 |
| 新目錄 | E:/Class/ailaeclass-v7-flight-results |
| 新分支 | feat/flight-results-v7.4-base |
| 舊目錄 | E:/Class/ailaeclass-v7，保留原樣 |
| 備份 | E:/Class/.archive/before-clean-flight-base-20260917 |

此次重建沒有 push、沒有 Railway redeploy、沒有套用正式 Supabase migration。

## 僅遷入的內容

- 飛行成績頁與個人歷史紀錄：Simulator 成績截圖、同一次實飛的成績截圖＋錄影。
- Google Drive 讀取、數值解析、單人資料權限、配額與分析 RPC migration。
- 新模組內的語言文案與 CSV 範本。
- 視覺 AI 輔助函數及既有文字 AI provider 的可選 AbortSignal。
- 新功能測試、截圖測試環境及操作說明。
- CSP 的 blob 圖像／媒體預覽許可，以及 Node request body 上限設定。

未遷入 `643734d` 的 25 檔手機端優化。未遷入原工作區未提交的全域翻譯修改、FlightReview 頁面、FlightReview API 與其專用服務。視覺 helper 是本次新功能依賴，不代表遷入整套舊 FlightReview。

原有檔案修改白名單只有 5 個：

1. apps/dashboard/.env.example
2. apps/dashboard/src/lib/utils/services/ai/provider.server.ts
3. apps/dashboard/src/routes/lms/simulator/+page.svelte
4. apps/dashboard/svelte.config.js
5. docker/Dockerfile.dashboard

其餘內容是新增檔案。既有考試、課程、登入、側欄、全域樣式與翻譯維持正式版內容。

## 環境界線

程式工作區、node_modules 與測試快取已分離，不使用指向舊工作區的 node_modules junction。

既有 `.env`／`.env.local` 原樣複製，未更改帳號或金鑰。這表示完整網站的本地預覽仍連到既有正式 Supabase，**不是整站獨立測試資料庫**。本次不對正式資料庫進行測試寫入；新功能的儲存與權限測試使用隔離 PGlite。

新 migration 尚未在正式資料庫執行，視覺模型亦未配置。新功能的真實 AI 辨識與正式帳號儲存尚不可作完整驗收。不要把合成圖片／模擬模型的自動測試當成真實成績辨識通過。

## 驗證

本輪結果：API 構建通過，Dashboard 完整構建通過；21 個單元／基線／支付 helper 回歸測試通過；18 個 PGlite 整合檢查通過；Chrome 自動化的圖片、影片、雙證據、報告、手機與桌面流程通過（外部服務為 fixture）。

另在使用者的 Chrome 實際開啟新副本，確認原有登入狀態可使用、「我的學習」顯示 11 門既有課程、原示範飛行顯示評分明細、新實飛表單可切換並顯示兩個連結欄位。新頁最終顯示「成績儲存尚未啟用」，與未套用 migration 的狀態相符。未建立、修改、刪除正式課程或考試資料，沒有執行付費 AI 測試。

5173 已由新目錄的構建版 Node 服務接管；舊 Vite 預覽及臨時 5174 服務已停止。這不是「全站所有功能已零缺陷驗收」；新增的真實儲存與 AI 配置仍待完成。

在 apps/dashboard 執行：

```powershell
node --test tests/flight-clean-base.test.mjs tests/simulator-drive.test.mjs tests/stripe-config.test.mjs tests/airwallex-security.test.mjs
$env:SIMULATOR_QA_PGLITE='file:///E:/Class/.tmp/simulator-drive-qa/node_modules/@electric-sql/pglite/dist/index.js'
node tests/simulator-integration.mjs
node tests/simulator-ui.mjs
```

`flight-clean-base.test.mjs` 驗證正式基線、既有檔案修改白名單，以及舊手機版／FlightReview 未被帶入。UI 測試、整合測試與真實模型測試使用不同 Vite cacheDir。

完整构建使用固定 lockfile，先執行 `pnpm --filter @cio/api build`，再於 apps/dashboard 執行 `pnpm exec svelte-kit sync` 與 `pnpm exec vite build`。

人工驗收使用已構建的 Node 服務，不依賴 Vite 開發快取。由新目錄執行 `./scripts/start-flight-preview.ps1`；端口已佔用時會拒絕啟動，不會自動停止其他程序。需要更換端口可加 `-Port 5174`。預覽 URL 為 `http://127.0.0.1:5173`，關機後需重新執行啟動腳本；修改程式後需重新構建再啟動。

歷史操作文件若仍提及 `E:/Class/ailaeclass-v7`，那是原工作區；本輪以本文件的新目錄為準。不得為「對齊正式版」而覆寫或 reset 舊工作區。
