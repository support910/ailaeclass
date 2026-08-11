/**
 * Release history, admin-facing.
 *
 * Single source of truth: the sidebar page and the version badge both read from
 * here, so the number on screen can never drift from the notes beside it.
 *
 * When you ship, add ONE entry at the top and bump nothing else. `CURRENT_VERSION`
 * is derived from the first entry on purpose.
 */

export type ReleaseChangeKind = 'feature' | 'fix' | 'security' | 'perf' | 'ui' | 'config';

export interface ReleaseChange {
  kind: ReleaseChangeKind;
  /** what actually changed, in the user's terms, not the commit subject */
  zh: string;
  hant: string;
  en: string;
}

export interface Release {
  version: string;
  /** YYYY-MM-DD */
  date: string;
  /** false while the entry is still local and has not reached production */
  released: boolean;
  title: { zh: string; hant: string; en: string };
  changes: ReleaseChange[];
}

export const RELEASES: Release[] = [
  {
    version: '7.4.0',
    date: '2026-08-11',
    released: false,
    title: {
      zh: '考试提速、CSV 导入容错与版本记录',
      hant: '考試提速、CSV 匯入容錯與版本紀錄',
      en: 'Faster exams, tolerant CSV import, release notes'
    },
    changes: [
      {
        kind: 'perf',
        zh: '考试保存速度大幅提升：导入 20 道题后保存由约 35 秒缩短到约 7.6 秒。',
        hant: '考試儲存速度大幅提升：匯入 20 道題後儲存由約 35 秒縮短到約 7.6 秒。',
        en: 'Saving an exam is much faster: 20 imported questions went from about 35s to about 7.6s.'
      },
      {
        kind: 'perf',
        zh: '考试列表加载由约 2.4 秒缩短到约 1.2 秒。',
        hant: '考試列表載入由約 2.4 秒縮短到約 1.2 秒。',
        en: 'The exam list loads in about 1.2s instead of about 2.4s.'
      },
      {
        kind: 'ui',
        zh: '考试列表加载时改为显示骨架占位，不再只有一行「加载中」文字。',
        hant: '考試列表載入時改為顯示骨架佔位，不再只有一行「載入中」文字。',
        en: 'The exam list shows a skeleton while loading instead of a single line of text.'
      },
      {
        kind: 'fix',
        zh: 'CSV 导入可自动修正 AI 生成的常见格式问题：全角逗号、Markdown 代码围栏、表头前的说明文字、缺失的尾部逗号，并会告诉你修正了什么。',
        hant: 'CSV 匯入可自動修正 AI 產生的常見格式問題：全形逗號、Markdown 程式碼圍欄、表頭前的說明文字、缺少的尾端逗號，並會告訴你修正了什麼。',
        en: 'CSV import repairs the formatting an AI typically gets wrong — full-width commas, code fences, text before the header, missing trailing commas — and tells you what it fixed.'
      },
      {
        kind: 'fix',
        zh: '给 AI 的整理提示词改为 14 列格式，并写明模型最容易写错的几点；导入失败时的提示改为具体可操作的说明。',
        hant: '給 AI 的整理提示詞改為 14 欄格式，並寫明模型最容易寫錯的幾點；匯入失敗時的提示改為具體可操作的說明。',
        en: 'The AI prompt now asks for a simpler 14-column format and spells out what models get wrong; import errors say what to do about them.'
      },
      {
        kind: 'fix',
        zh: '课程列表视图的复制、分享、邀请、删除四个菜单项由占位提示改为真实功能；受众页的导出改为真正导出 CSV。',
        hant: '課程列表檢視的複製、分享、邀請、刪除四個選單項由佔位提示改為真實功能；受眾頁的匯出改為真正匯出 CSV。',
        en: 'Clone, share, invite and delete in the course list view do the real thing instead of showing a placeholder; the audience export now actually produces a CSV.'
      },
      {
        kind: 'feature',
        zh: '新增「版本记录」页面，集中查看每次迭代的更新内容；右上角显示当前版本号。仅管理端可见。',
        hant: '新增「版本紀錄」頁面，集中查看每次迭代的更新內容；右上角顯示目前版本號。僅管理端可見。',
        en: 'New Release notes page listing what changed in each iteration, with the current version shown in the header. Admin only.'
      }
    ]
  },
  {
    version: '7.3.0',
    date: '2026-08-08',
    released: true,
    title: {
      zh: '权限加固、侧栏分组与首屏提速',
      hant: '權限加固、側欄分組與首屏提速',
      en: 'Permission hardening, grouped sidebar, faster first paint'
    },
    changes: [
      {
        kind: 'security',
        zh: '机构初始化页面补上角色校验，教师与学生不再能通过网址直接打开。',
        hant: '機構初始化頁面補上角色檢查，教師與學生不再能透過網址直接開啟。',
        en: 'The organisation setup page now checks the role, so teachers and students can no longer open it by URL.'
      },
      {
        kind: 'security',
        zh: '审计记录不再使用源码内的公开盐值计算网络标识哈希。',
        hant: '稽核紀錄不再使用原始碼內的公開鹽值計算網路識別雜湊。',
        en: 'Audit records no longer hash network identifiers with a salt that was visible in the source.'
      },
      {
        kind: 'ui',
        zh: '左侧栏由 13 项扁平列表改为「教学 / 智能中心 / 运营 / 帮助与设置」四个可折叠分组，所在分组会自动展开。',
        hant: '左側欄由 13 項扁平列表改為「教學 / 智能中心 / 營運 / 幫助與設定」四個可摺疊分組，所在分組會自動展開。',
        en: 'The sidebar is grouped into Teaching, Intelligence, Operations and Help & settings instead of 13 flat entries, and the section you are in opens itself.'
      },
      {
        kind: 'ui',
        zh: '控制台改版，切换页面时顶部显示进度条并带淡入过渡。',
        hant: '控制台改版，切換頁面時頂部顯示進度條並帶淡入過渡。',
        en: 'The console was redesigned, and switching pages shows a progress bar and a fade.'
      },
      {
        kind: 'perf',
        zh: '首屏不再等待外部播放器脚本，控制台首次内容显示时间缩短约四成。',
        hant: '首屏不再等待外部播放器腳本，控制台首次內容顯示時間縮短約四成。',
        en: 'The first paint no longer waits on an external player script; the console shows content about 40% sooner.'
      },
      {
        kind: 'fix',
        zh: '无权限页面加上返回按钮，并修正插图不显示的问题。',
        hant: '無權限頁面加上返回按鈕，並修正插圖不顯示的問題。',
        en: 'The no-permission page has a back button, and its illustration no longer fails to load.'
      }
    ]
  },
  {
    version: '7.2.0',
    date: '2026-07-17',
    released: true,
    title: {
      zh: '考试计时与教师课程边界',
      hant: '考試計時與教師課程邊界',
      en: 'Exam timing and teacher course boundaries'
    },
    changes: [
      {
        kind: 'feature',
        zh: '传统考试与速解训练要求至少 1 分钟时长，倒计时归零自动交卷，服务端另留短暂网络宽限。',
        hant: '傳統考試與速解訓練要求至少 1 分鐘時長，倒數歸零自動交卷，伺服器另留短暫網路寬限。',
        en: 'Exams require at least one minute, submit automatically when the countdown ends, and the server allows a short network grace period.'
      },
      {
        kind: 'feature',
        zh: '教师的可管理课程列表只包含自己创建或被分配的课程，其余课程走只读预览。',
        hant: '教師的可管理課程列表只包含自己建立或被指派的課程，其餘課程走唯讀預覽。',
        en: 'A teacher only manages courses they created or were assigned; everything else is a read-only preview.'
      },
      {
        kind: 'ui',
        zh: '题目编辑器显示连续题号，增删或移动后自动重排。',
        hant: '題目編輯器顯示連續題號，增刪或移動後自動重排。',
        en: 'The question editor numbers questions continuously and renumbers after edits.'
      }
    ]
  },
  {
    version: '7.1.0',
    date: '2026-07-15',
    released: true,
    title: {
      zh: '考试图片、CSV 导入与印地语',
      hant: '考試圖片、CSV 匯入與印地語',
      en: 'Exam images, CSV import and Hindi'
    },
    changes: [
      {
        kind: 'feature',
        zh: '题干与选项支持图片，选择后立即预览，刷新后仍可显示，学生作答页与结果页同样可见。',
        hant: '題幹與選項支援圖片，選擇後立即預覽，重新整理後仍可顯示，學生作答頁與結果頁同樣可見。',
        en: 'Questions and options support images that preview immediately, survive a refresh, and appear for students while answering and reviewing.'
      },
      {
        kind: 'feature',
        zh: '支持一次最多导入 20 道题的 CSV/TSV，并提供可复制的 AI 整理提示词与校验预览。',
        hant: '支援一次最多匯入 20 道題的 CSV/TSV，並提供可複製的 AI 整理提示詞與驗證預覽。',
        en: 'CSV/TSV import handles up to 20 questions at a time, with a copyable AI prompt and a validation preview.'
      },
      {
        kind: 'feature',
        zh: '界面语言新增印地语。',
        hant: '介面語言新增印地語。',
        en: 'Hindi was added to the interface languages.'
      }
    ]
  },
  {
    version: '7.0.0',
    date: '2026-07-13',
    released: true,
    title: {
      zh: '课程治理与意见反馈中心',
      hant: '課程治理與意見回饋中心',
      en: 'Course governance and the feedback centre'
    },
    changes: [
      {
        kind: 'feature',
        zh: '教师可创建课程，管理员可为一门课程指派多名教师，并加入或移除学生。',
        hant: '教師可建立課程，管理員可為一門課程指派多名教師，並加入或移除學生。',
        en: 'Teachers can create courses; administrators can assign several teachers to a course and add or remove students.'
      },
      {
        kind: 'feature',
        zh: '学生可浏览未加入的课程公开介绍，并进行收藏与申请；申请仅供教师查看，不会自动入课。',
        hant: '學生可瀏覽未加入的課程公開介紹，並進行收藏與申請；申請僅供教師查看，不會自動入課。',
        en: 'Students can browse, favourite and apply to courses they have not joined; an application is visible to teachers but never enrols anyone automatically.'
      },
      {
        kind: 'feature',
        zh: '新增意见反馈中心，三端均可提交问题与截图。',
        hant: '新增意見回饋中心，三端均可提交問題與截圖。',
        en: 'A feedback centre was added; all three portals can submit an issue with screenshots.'
      }
    ]
  }
];

export const CURRENT_VERSION = RELEASES[0]?.version ?? '0.0.0';
export const CURRENT_RELEASE = RELEASES[0];
/** the newest entry that actually reached production */
export const LATEST_RELEASED = RELEASES.find((r) => r.released);
