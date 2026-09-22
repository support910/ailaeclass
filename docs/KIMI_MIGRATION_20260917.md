# Kimi 統一接入與飛行成績分析

## 基線與範圍

工作目錄：`E:/Class/ailaeclass-v7-flight-results`，正式基線 `76441f3`。
修改前備份：`E:/Class/.archive/before-kimi-switch-20260917/workspace`，含當時本地配置；限制目前 Windows 帳號存取，不得上傳 Git。
原工作區 `E:/Class/ailaeclass-v7` 及正式 Railway／Supabase 均未修改。

本輪依使用者要求，將 chatbot、Agent、蘇格拉底輔導、既有共用 AI 工具與新增飛行分析統一接入 Kimi。
刪除運行程式及 Docker 設定中的 DeepSeek 路徑，不因 Kimi 未配置而偷偷回退到其他供應商。歷史發佈文件與備份保留原紀錄。
課程、考試、上傳圖片元件、權限、登入、支付、全域樣式、翻譯及既有知識庫內容未改。操作手冊只把 AI 配置提示改為 Kimi。
先前 CLEAN_BASE 文件的「5 個既有檔案」白名單是切换前紀錄；本輪白名單額外包含上述 AI 呼叫、三處錯誤碼與 Docker Compose。考試／課程等不變檢查仍保留。

## 分析算法的含義

這不是自行訓練的新模型，而是「服務端確定性數據比較 + Kimi 多模態判讀 + 結構化結果驗證」。

1. 學員提交 Google Drive 成績圖連結。實飛可再提供同一飛行的影片連結，兩份證據歸在同一筆紀錄。
2. 截圖保留一張；影片在瀏覽器解碼並取樣 12 張。雙證據共 13 張，第一張是成績截圖，其餘附影片時間點。不分析音訊，不宣稱看完所有影格。
3. Kimi 讀取清楚可見的標籤、數字、單位及原系統分數，描述可觀察的操作，再比較截圖與影片是否一致、矛盾或無法判断。每條視覺結論必須引用提供過的影格。
4. CSV／JSON 數據由 `data.js` 計算 `deviation = value - target`；lower 使用 `value <= target`，higher 使用 `value >= target`，equal 使用相等比較。缺標準、方向或有效數值不能判為通過。檔案標準是學員提供，非教師核准。
5. 例如高度偏差 1.2 m、檔案目標 <= 1 m，服務端判定待改善；沒有目標則是未知。不能只看畫面便猜測米數、速度或角度。
6. Kimi 回傳 JSON，服務端檢查欄位、文字長度、影格編號；雙證據必須有 crossCheck。錯誤或不完整回應不存為成功報告。
7. 報告記錄 aiProvider=kimi、實際模型名稱、analysisVersion、生成時間、證據來源與時間點，便於追查。

學員可修改瀏覽器取樣畫面，兩份檔案是否同一飛行也未經鑑證。因此報告是學習建議，不是官方分數、防作弊認證或飛行安全許可。不清楚、無標準、無法比對時必須標明限制。

## 回答限制與保護

- chatbot 保留中文 180 字／英文 100 詞的顯示限制及 256 token 請求預算，複雜問題沿用原有 Agent 引導。
- Agent 保留中文 1400 字／英文 700 詞限制及 1400 token 預算。修正共用接口原本會把明確預算壓到預設 700 token 的問題。
- 數據分析 1200 token；視覺分析 1800 token；共用硬上限 4096。token 與字數不是相同單位，既有顯示截斷政策未變。
- K2.5 使用 instant 模式、thinking disabled、temperature 0.6。Kimi 的圖片能力與參數依官方文件設定，並非只換供應商名稱。
- 使用者最新提供的第一項密鑰是 Kimi Code 類型。本地改用 `https://api.kimi.com/coding/v1`、`kimi-for-coding`，不與 Moonshot 開放平台混用；保留真實 AiLAEClass User-Agent，不冒充其他客戶端。
- API key 僅留在私有服務端環境，不放 PUBLIC_、前端程式、截圖或 Docker ARG／鏡像層。
- 模型請求最多 90 秒；取消及超時包含回應讀取階段。認證、配額、服務器錯誤不自動重試。僅明確不支援 response_format 的 400／422 最多移除參數重試一次。
- 上游錯誤內容不回傳前端，也不直接記錄可能含私有資料的錯誤正文。
- 既有登入驗證、本人資料隔離、提交配額與完成報告重用規則不變。

## 本地配置

密鑰檔可採 dotenv 格式，只需要 `PRIVATE_KIMI_API_KEY`，不要在聊天中貼出密鑰。

```powershell
node scripts/configure-kimi-local.mjs E:/Class/_local_secrets/kimi_api_key.txt
# 國際區帳號才加：--international
# 本次使用者提供的檔案，第一行為 Kimi Code key：
node scripts/configure-kimi-local.mjs D:/zhuomian/5Gnu/api.txt --coding
```

脚本先請求官方 /models，驗證成功且具備所選模型才備份並更新被 Git 忽略的 dashboard/.env.local。不改 Supabase，也不部署。認證失敗不覆蓋配置。多個憑證的文件只讀首行 key，不使用其他供應商憑證。
配置成功後重新啟動本地預覽；代碼有變更則先構建。不要同時啟動兩個 5173 服務。

正式部署時在原 Railway 服務的 runtime Variables 設置四個 PRIVATE_KIMI_* 欄位；不要新建重複服務。必須先驗證模型、備份目標環境，且經使用者確認才執行部署。本輪未推送。Kimi 官方將 Code 會員定位為程式開發用途，產品整合與企業調用建議使用 Kimi 開放平台；正式向學員提供服務前，應確認帳戶方案／配額適用性，建議換為開放平台 key，而不是將本地測試成功等同於商用接入已確認。

## 驗收與未完成項

- 31 個單元／基線／既有支付 helper 測試通過；其中新增 10 個 Kimi 供應商測試。
- 隔離 PostgreSQL 的 18 個整合檢查通過，包含同次實飛雙證據、RLS、重複分析、儲存與讀取。AI 及 Drive 上游為 fixture。
- 舊 kimi_api_key.txt 對 Moonshot 兩區均 401。使用者其後指定 api.txt 的第一項，已確認是不同的 Kimi Code key；正確端點的模型列表與文字請求成功。
- 真實單張合成截圖分析已通過：讀出偏差 1.2 m、目標 1.0 m，保留非正式評核限制。測試找出提示詞範例的 frame:null 會令視覺結果驗證失敗，已改為視覺 frame:1、純數據 frame:null 的分開規則並加入回歸檢查。
- 真實 Kimi 雙證據分析通過：13 張輸入合併處理，讀出截圖數字，對測試動畫沒有 HUD／飛行編號的情況回傳 crossCheck=unknown，未編造一致性。
- 真實 Kimi 數值分析通過：確認 1 項達標、2 項待改善、1 項缺標準；保留服務端數字比較與未知限制。
- 真實模型輸出保留在 `output/simulator-drive-20260917/live-synthetic-{image,paired,data}-report.json`。這些都是人工合成、非學員私人資料。
- Chrome 桌面／手機 screenshot QA 通過；`output/simulator-drive-20260917/kimi-live-ui/` 是重播上述真實 Kimi 報告的 UI 截圖。登入、Drive 下載與儲存仍為 fixture，不能把這組圖說成正式帳號已完成上傳保存。
- Dashboard 完整 build 通過，已有的 AuthUI／Exam 無障礙警告仍在。掃描前端構建資產，Kimi 密鑰出現次數為 0。
- 已重啟新工作區本地 5173 Node 服務，Chrome 已確認學生模擬系統可載入；新成績頁如實顯示儲存未啟用。未發佈 Railway，未修改 Supabase，未改使用者帳號。
- 新成績表 migration 尚未套用到完整網站所連的 Supabase，因此正式帳號的新成績持久化也尚未啟用。不得為測試而直接修改正式資料庫。
- 目前 Kimi 本地模型配置已可用，仍需獨立測試 Supabase 與真實去識別化 Drive 檔案，才可完成真實 Drive → Kimi → 儲存 → 歷史報告全流程驗收；合成測試不代表所有學員素材的準確率。
- 未作全站所有功能的真人回歸，不作「零 bug」保證。

官方參考：https://platform.kimi.com/docs/api/chat 、https://github.com/MoonshotAI/Kimi-K2.5 、https://www.kimi.com/en/help/kimi-code/membership-guide

## 真實模型與截圖复驗

在 apps/dashboard 執行以下命令。模型呼叫會使用 Kimi 帳戶額度，但只發送合成素材；不寫入正式資料庫。

```powershell
# 先生成合成圖像／影片取樣輸入
node tests/simulator-ui.mjs
$env:SIMULATOR_LIVE_VISION='1'
node tests/simulator-live-vision.mjs
$env:SIMULATOR_LIVE_PAIRED='1'
node tests/simulator-live-vision.mjs
Remove-Item Env:SIMULATOR_LIVE_PAIRED
$env:SIMULATOR_LIVE_DATA='1'
node tests/simulator-live-vision.mjs
Remove-Item Env:SIMULATOR_LIVE_DATA
$env:SIMULATOR_UI_LIVE_REPORTS='1'
node tests/simulator-ui.mjs
```
