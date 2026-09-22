# 飛行成績與 Google Drive AI 分析：本地預覽版本

日期：2026-09-17。狀態：本地實作與隔離測試完成；尚未部署 Railway，尚未向正式 Supabase 套用 migration。

## 最新需求與提交規則

1. Simulator 主要提交成績畫面截圖，不要求提供影片。
2. 實飛可提交成績截圖，以及同一次飛行的錄影。兩份證據屬於同一筆提交，產生一份聯合分析報告。
3. 先上傳至學員自己的 Google Drive，再貼上檔案分享連結。系統不登入或瀏覽學員的整個 Drive。
4. 第一個連結用於成績截圖；實飛模式下第二個連結用於同一次飛行的錄影。第二個連結可留空。
5. 若填寫第二個連結，第一個檔案必須為圖片、第二個必須為影片。不可用兩份無關資料替代。
6. 學員須確認擁有內容或已取得授權，並同意交由 AI 處理和儲存報告。
7. 保留 CSV／JSON／Google 試算表數據讀取能力，也可單獨提交錄影。但主流程是 Simulator 截圖與實飛雙證據。

## 使用入口

- 學生端：`/lms/simulator`，新增「我的成績」，原本的演示保留於「示範飛行」。
- 選擇「模擬器」或「實飛」，填入名稱、科目、分享連結，確認同意後讀取。
- 同頁顯示圖片／錄影預覽；學員確認內容後才執行 AI 分析。
- 實飛聯合分析順序：成績截圖 -> 12 張錄影取樣 -> 統一報告 -> 兩份證據核對。
- 可查看本人歷史報告、下載 JSON 報告、確認後刪除報告。刪除不會刪除 Google Drive 原檔。
- 管理端／教師端原模擬示範頁未修改。本次沒有加入教師查看學生報告的權限。
- 新模組提供繁中、簡中、英文、馬來文、印尼文、泰文、印地文文字；其他既有語言使用英文回退，不修改原語言 JSON。

## 檔案與分享要求

| 類型 | 限制 | 分析方式 |
| --- | --- | --- |
| JPG／PNG／WebP | 每張 5 MiB | 瀏覽器轉成最長邊 1600 px 的 JPEG；辨識可見成績與指標 |
| MP4/H.264／WebM | 每段 100 MiB、20 分鐘 | 瀏覽器擷取 12 張靜態畫面；不處理音訊、不逐幀分析 |
| 圖片＋影片 | 一張圖＋一段錄影 | 一個 report ID、13 張證據圖、同一份核對報告 |
| CSV／JSON／Google Sheets | 2 MiB、200 個有效指標 | 伺服器計算與檔案目標的偏差，AI 解釋結果 |

使用「知道連結的任何人／檢視者」，並允許下載。私有連結、資料夾、需要登入、被禁止下載的檔案會顯示錯誤，不會繞過 Google 權限。

公開連結意味著任何持有連結的人可在 Google Drive 讀取檔案。學員須先移除個人資料、學員名單或不應公開的內容。不是私有 OAuth Drive 整合。

Excel 檔請匯出 UTF-8 CSV，或轉成 Google 試算表再分享。PDF 可提供清晰成績截圖。本版不解析 PDF、DOCX、XLSX、壓縮包、整個資料夾或音訊。

CSV 欄位：`metric,value,unit,target,direction`。`lower` 為小於等於目標，`higher` 為大於等於目標，`equal` 為相等。下載範本位於 `/downloads/simulator-results-template.csv`。

## 判讀邊界

- 圖片中看不清的數字不可猜測；沒有標準不能僅憑數值大小宣稱優良或錯誤。
- 截圖上原有分數是模擬器提供的分數，不是 AI 另行認證的分數。
- 影片只取樣 12 張，不代表整段每一秒都已檢查，也不保證能發現瞬間碰撞、失控等事件。
- 圖片與錄影分開判讀，再標記 `consistent`、`conflict`、`unknown`。
- `consistent` 只表示可見證據相符，不代表全部飛行動作合格。
- 同一次飛行由提交者聲明，系統沒有驗證兩份檔案的真實來源或拍攝時間，`sameFlightIdentityVerified` 固定為 false。
- 如證據矛盾，不得將兩者平均或擅自選擇其一作為真相；應明確指出矛盾。
- CSV 的目標屬於提交者提供，不是已核實教師評分規則。
- 報告 `officialGrade` 固定為 false，不寫入正式考試成績，不提供真實飛行安全許可。

## 資料流與安全

1. 前端以既有 Supabase access token 呼叫新 API；服務端驗證登入後取得 user ID，不能由 request body 指定別人的 user ID。
2. 新表 `simulator_drive_reviews` 保存本人提交、原連結、飛行類型、兩份資料的關聯、數據摘要、報告和狀態。
3. Google 檔案經服務端代理讀取，暫時存在記憶體，再傳回本人瀏覽器。不是直接將 Drive 私人 cookie 提供給服務端。
4. 瀏覽器產生的取樣圖經服務端送至配置的視覺 AI。檔案內文字及圖像被當作不可信內容，不可作為系統指令。
5. 原始圖片、影片及擷取畫面不寫入 Supabase Storage 或資料庫；資料摘要與 AI 報告會持久儲存。AI 供應商自身的保留政策仍需另外確認。
6. 僅允許既定 Google Drive／Sheets 網域與特定 Google 下載轉址；每次轉址重新驗證，拒絕內網 URL 和偽造 Google 網域。
7. 串流讀取有大小與逾時限制，不相信 Content-Length。單個服務程序同時只處理一筆下載，減少大型影片的記憶體壓力。
8. RLS 僅讓 authenticated 使用者 select/delete 自己的報告，不允許直接偽造 insert/update。寫入由服務端 service-role 執行且再次帶 user_id 條件。
9. 提交上限：每人每 10 分鐘 5 筆、24 小時 30 筆。每份報告最多 3 次分析嘗試；已完成報告直接返回，不重複呼叫 AI。
10. 另設 quota ledger，刪除報告不會重設提交次數。原子 RPC 防止同時重複分析。
11. 回傳錯誤使用固定代碼，不把上游回應、API key 或資料庫細節回傳前端。不得在截圖、文件或 Git 提交中加入 `.env` 真實內容。

注意：瀏覽器提交的取樣畫面可以被修改，本功能是學習回饋，不是防作弊鑑證。正式考核需要服務端可信解碼、原檔雜湊、上傳簽名／時間證據與教師評分規則等獨立設計。

## 本地測試與正式啟用

本次未修改任何正式資料庫。SQL 只在隔離 PGlite/PostgreSQL 執行，Google Drive 和 AI 的端到端自動測試使用受控 fixture。

本地原網站仍使用既有 Supabase 設定，因此在新的 migration 尚未套用到測試資料庫時，新頁會顯示「成績儲存尚未啟用」，不能把這個狀態誤認為正式提交已可使用。

啟用步驟：

1. 先備份目標環境，確認是獨立測試 Supabase，不要使用 `supabase db reset` 重置已有資料。
2. 套用 `supabase/migrations/20260917090000_simulator_drive_reviews.sql`；新建兩個表與兩個受限 RPC，不修改課程、考试、支付等表。
3. 確認 auth.users 外鍵、RLS 及函數 execute grants 都已生效。authenticated 不應取得 reserve/claim RPC 的直接執行權。
4. 服務端使用現有 Supabase 設定；文字與視覺分析均使用 Kimi，不再自動選擇其他供應商。
5. 設定 `PRIVATE_KIMI_API_KEY`、`PRIVATE_KIMI_BASE_URL`、`PRIVATE_KIMI_MODEL=kimi-k2.5`、`PRIVATE_KIMI_VISION_MODEL=kimi-k2.5`。中國區 API 為 `https://api.moonshot.cn/v1`，國際區為 `https://api.moonshot.ai/v1`，密鑰須與帳戶區域一致。
6. 視覺模型須支援同次請求 13 張圖片及 image_url data URL。舊 `PRIVATE_VISION_*` 設定不再使用；不要只測文字便宣稱視覺已通過。完整說明見 `KIMI_MIGRATION_20260917.md`。
7. Railway Node 服務須設 `BODY_SIZE_LIMIT=10485760`（數字 bytes）。此倉庫使用的 adapter-node 版本不要填 `10mb`。Dockerfile 已加入該預設，部署前仍要檢查 Railway 是否有舊變數覆蓋。
8. 新分析 API 自身 JSON 上限為 9 MiB，單張 data URL 最長 700000 字元，最多 13 張。不是無限制提高所有上傳規格。
9. CSP 的 img-src/media-src 新增 blob: 供本人瀏覽器預覽，不放寬 script-src/object-src。
10. 開發伺服器：在 `apps/dashboard` 執行 `pnpm exec vite --host 127.0.0.1 --port 5173 --strictPort`。端口佔用時換端口，不終止不明進程。
11. 提供真實、去識別化的 Simulator 成績圖，以及同一次實飛的成績圖＋錄影。核對數字辨識、矛盾處理、原連結讀取、模型回應、本人重新登入後的紀錄。
12. 人工驗收通過後才依現有專案的 Railway／Supabase 部署流程上線；不可另建重複正式服務。

初次建立時視覺供應商為 `configured: false`，當時 opt-in 測試因未配置而跳過。其後依使用者要求接入 Kimi，現已完成合成數值、單張截圖與雙證據的真實模型測試；詳見 `KIMI_MIGRATION_20260917.md`。正式學員 Drive 檔案到資料庫的完整流程仍未驗收，不能宣稱普遍 OCR 準確率已確立。

## 驗證紀錄

- 18 個單元測試通過：11 個新增連結／解析／串流上限測試，7 個既有支付 helper 回歸測試。
- 18 個整合檢查通過：實際 PostgreSQL migration、帳號隔離、RLS、配額、競爭請求、圖像及影片模型 request、錯誤引用、同一飛行雙證據匯入與儲存。
- Chrome 桌面 1440 px、手機 390 px：真實元件、Canvas 成績圖、實際 WebM 解碼與 12 張取樣、合併 13 張證據、下載、重開歷史、私有連結錯誤及英文切換通過。
- UI 測試的登入、Drive 和模型回應是 fixture；截圖中有 TEST FIXTURE 標記，不是學員真實成績。
- 截圖：`output/simulator-drive-20260917/`，`08-mobile-paired-flight.png` 與 `09-desktop-paired-flight.png` 是同次實飛兩份資料的驗收畫面。
- 網站完整 `vite build` 驗證另有既存 AuthUI／Exam 無障礙及套件警告，不屬於新頁修改。
- 沒有做完其他所有業務功能的真人全流程回歸，不作「全站零 bug」保證。

測試命令（於 apps/dashboard 執行）：

```powershell
node --test tests/simulator-drive.test.mjs tests/stripe-config.test.mjs tests/airwallex-security.test.mjs
$env:SIMULATOR_QA_PGLITE='file:///E:/Class/.tmp/simulator-drive-qa/node_modules/@electric-sql/pglite/dist/index.js'
node tests/simulator-integration.mjs
node tests/simulator-ui.mjs
pnpm exec vite build
```

PGlite 僅安裝在工作區外的本地測試工具目錄；其他機器需自行安装測試依賴並修改 `SIMULATOR_QA_PGLITE`，不必加到正式依賴。

真實模型測試是 opt-in，可能产生模型費用，只傳合成測試圖片，不讀取正式學生資料：

```powershell
$env:SIMULATOR_LIVE_VISION='1'
node tests/simulator-live-vision.mjs
```

## 備份、變更範圍與回退

### 本地空白頁修復

2026-09-17 實際在 Chrome 重現空白頁：主 HTML 回傳 200，但 Vite 前端依賴請求回傳 `504 Outdated Optimize Dep`，造成動態匯入失敗。不能只檢查首頁 HTTP 200 就判定頁面可使用。

已將三個測試腳本的 Vite cacheDir 分別隔離至 `node_modules/.cache/simulator-ui`、`simulator-integration`、`simulator-live-vision`，避免與主站共用依賴快取。重新啟動已確認的本地 Vite 進程並使用 `--force` 重新最佳化，再於 Chrome 強制重新整理，已目視確認登入表單正常顯示。沒有更改正式服務或登入業務程式。

變更前的既有入口、AI provider、vision helper、CSP、Dockerfile、env 範本備份位於 `E:/Class/.archive/simulator-drive-20260917/`。

沒有修改考試、課程、登入、支付、chatbot 字數上限與原 AI 知識庫。既有未提交的翻譯與 FlightReview 模組檔案保留原樣；僅對共用 provider 增加可選 AbortSignal，原呼叫者不需改動。

回退時先停用新頁入口，恢復備份的學生模擬器入口即可回到原演示。已上線後不可直接 drop 報告表；應先匯出學員紀錄並安排資料保留。不要用 `git reset --hard` 或還原整個目錄，避免覆蓋工作區其他人的變更。
