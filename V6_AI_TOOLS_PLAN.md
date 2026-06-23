# ailaeclass v6 AI Tools Plan

Date: 2026-06-23
Workspace: `E:\Class\ailaeclass-v6`
Branch: `v6-development`

## Goal

Build a useful AI tools area for Hong Kong primary and junior secondary students and teachers.

The first release should focus on tools that are:
- easy to understand in class
- safe for students
- low cost to run
- visibly useful after one input
- compatible with the current DeepSeek text API

Kimi can be added as a second provider for long-document tasks, especially teacher-uploaded reading passages and longer curriculum materials.

## Current Foundation

Existing v6 already has:
- `AI工具` in student and teacher/admin sidebars
- `ailaeclass Agent`
- DeepSeek server helper: `apps/dashboard/src/lib/utils/services/ai/deepseek.server.ts`
- Socratic learning endpoint: `apps/dashboard/src/routes/api/ai-tools/socratic/+server.ts`
- Student page: `apps/dashboard/src/routes/lms/ai-tools/+page.svelte`
- Teacher/admin page: `apps/dashboard/src/routes/org/[slug]/ai-tools/+page.svelte`

The next work should extend this structure instead of creating a separate AI system.

## Recommended Phase Plan

### Phase 1: AI Tools Hub and Shared Backend

Build the shared foundation first:
- redesign `AI工具` as a tool hub with cards
- add a common AI request wrapper for:
  - DeepSeek
  - Kimi/Moonshot later
  - timeout handling
  - JSON response validation
  - friendly errors
  - role checks
- add shared UI components:
  - tool card
  - prompt form
  - result panel
  - copy/export buttons
  - teacher/student mode labels
- add request limits:
  - max input length
  - max history length
  - basic daily usage guard

Recommended files:
- `apps/dashboard/src/lib/utils/services/ai/provider.server.ts`
- `apps/dashboard/src/lib/utils/services/ai/deepseek.server.ts`
- `apps/dashboard/src/lib/utils/services/ai/kimi.server.ts`
- `apps/dashboard/src/lib/components/AITools/ToolHub.svelte`
- `apps/dashboard/src/lib/components/AITools/ToolShell.svelte`

### Phase 2: First High-Impact Student/Teacher Tools

Implement these first because they are text-based, practical, and low risk:

1. AI 生字句子练习器
2. 英文作文改写助手
3. 数学错题讲解卡
4. 阅读理解提问器
5. 科学概念图生成器

These should all use structured JSON output from AI, then render with stable UI instead of trusting raw Markdown.

### Phase 3: Knowledge-Restricted and Data-Driven Tools

After Phase 2 is stable:

6. 常识科问答小助手
7. AI 今日推荐练习
8. 学习数据摘要
9. 强势 / 最弱科目 AI 提示
10. 多维成长雷达
11. AI 累计预警

These depend on course/exam/submission data quality and should be added after the logs and exams are stable in production.

### Phase 4: Creative and Sensitive Tools

Add later, with stronger guardrails:

12. 情绪日记与关怀提醒
13. AI 绘图故事卡

These can be valuable, but privacy, safety, image cost, and moderation need more design.

## Tool Recommendations

### 1. AI 生字句子练习器

Recommended: Yes, Phase 2 first batch.

Target:
- 小三至中一
- Chinese language support for Hong Kong students

Input:
- 生字 list
- optional topic, grade, Traditional/Simplified output preference

Output:
- pronunciation or reading hint if available
- meaning in age-appropriate language
- example sentence
- near synonym
- opposite word where useful
- fill-in-the-blank question
- answer key

Effect:
- teacher can make worksheet material quickly
- student gets immediate practice
- low risk because output is constrained and short

Implementation:
- endpoint: `/api/ai-tools/vocabulary-practice`
- response JSON:
  - `items[]`
  - `word`
  - `meaning`
  - `example`
  - `synonyms[]`
  - `blankQuestion`
  - `answer`
- UI: table/cards with “重新生成”, “复制”, “导出练习”

### 2. 英文作文改写助手

Recommended: Yes, Phase 2 first batch.

Target:
- 小五至中三

Important rule:
- Do not rewrite the whole essay for the student.
- Give correction and suggestions only.

Input:
- student short essay
- grade level
- optional focus: grammar, vocabulary, sentence variety, organization

Output:
- grammar corrections by sentence
- vocabulary upgrade suggestions
- sentence pattern suggestions
- 3 priority improvements
- short encouragement

Effect:
- useful for students without doing homework for them
- useful for teachers to show common mistakes

Implementation:
- endpoint: `/api/ai-tools/english-writing-coach`
- response JSON:
  - `overallFeedback`
  - `corrections[]`
  - `vocabularyUpgrades[]`
  - `sentenceSuggestions[]`
  - `nextRevisionTask`
- UI should show original sentence and suggestion side by side.

Not allowed:
- full rewritten essay
- “copy this improved essay”

### 3. 数学错题讲解卡

Recommended: Yes, but start with text input first.

Target:
- 小四至中二

Input:
- question text
- student's wrong answer or working steps
- optional correct answer if teacher has it

Output:
- where the thinking went wrong
- correct next step
- short concept explanation
- one similar practice question
- answer hidden until clicked

Effect:
- strong student value
- aligns with the current Socratic tutor work

Implementation:
- endpoint: `/api/ai-tools/math-error-card`
- text input first
- image/photo support later, because reliable OCR/vision is a separate feature
- response JSON:
  - `mistakeSummary`
  - `wrongStep`
  - `correctStep`
  - `concept`
  - `similarQuestion`
  - `similarAnswer`

Not recommended in first version:
- photo solving only
- automatic answer without student working

Reason:
- DeepSeek text API is not enough for robust image OCR.
- Bad OCR will create wrong math explanations.

### 4. 科学概念图生成器

Recommended: Yes, Phase 2 or Phase 3.

Target:
- 小五至中三

Input:
- topic, grade level, optional keywords

Output:
- concept nodes
- relationships
- key definitions
- common misconceptions
- quick quiz

Effect:
- visually useful in class
- good for revision

Implementation:
- endpoint: `/api/ai-tools/science-concept-map`
- response JSON:
  - `nodes[]`
  - `edges[]`
  - `keywords[]`
  - `misconceptions[]`
  - `quiz[]`
- UI renders a simple concept map using HTML/SVG or Mermaid-like layout.

Do not rely on AI-generated images for this first.

Reason:
- structured concept map is faster, cheaper, editable, and safer.

### 5. 阅读理解提问器

Recommended: Yes, high teacher value.

Target:
- 小四至中二

Input:
- teacher pastes or uploads article
- language
- grade
- number of questions

Output:
- multiple choice questions
- open questions
- vocabulary/keyword prompts
- answer key
- difficulty labels

Effect:
- immediately useful for teachers
- can generate classroom exercises from existing text

Implementation:
- endpoint: `/api/ai-tools/reading-question-generator`
- DeepSeek is fine for short passages.
- Kimi is better for longer articles because of long-context handling.
- response JSON:
  - `multipleChoice[]`
  - `openQuestions[]`
  - `keywords[]`
  - `answerKey[]`

### 6. 常识科问答小助手

Recommended: Yes, but not in first batch unless the knowledge base is ready.

Target:
- 小三至小六

Rule:
- only answer from teacher-approved knowledge base
- if no source, say it cannot answer

Effect:
- safe classroom Q&A
- good for Hong Kong General Studies topics

Implementation:
- reuse `ailaeclass Agent` knowledge loader
- add teacher upload/selection of approved topics
- every answer should show sources hidden behind “查看来源”

Do not make it open-ended web Q&A.

Reason:
- “常识科” often needs curriculum-aligned answers.
- Open web answers can be inconsistent or inappropriate.

### 7. 情绪日记与关怀提醒

Recommended: Later, with strict guardrails.

Target:
- 小四至中三

Effect:
- students can reflect on mood
- teachers may see trend signals, not private diary content by default

Implementation:
- daily mood selection
- optional one-sentence note
- AI returns gentle encouragement and a study suggestion
- severe distress keywords trigger a safe message asking student to contact trusted adult/teacher

Privacy rule:
- do not expose full diary to teachers by default
- only aggregate mood trend unless the student chooses to share

Not first batch.

Reason:
- sensitive student wellbeing data
- needs privacy design, retention policy, and escalation wording

### 8. AI 绘图故事卡

Recommended: Later.

Target:
- 小一至小六

Effect:
- fun creative writing tool
- student enters character and scene
- system helps write 3 sentences

Implementation:
- first version can generate a story card without image generation:
  - title
  - character
  - scene
  - 3 sentence starter/story lines
  - vocabulary words
- image generation requires a separate image model/provider and moderation.

Not first batch if only DeepSeek/Kimi are available.

Reason:
- DeepSeek/Kimi text APIs do not generate images.
- Image generation adds cost, latency, and safety review.

## Data-Driven AI Modules

### AI 基础服务搭建

Recommended: Must do first.

Includes:
- provider abstraction
- prompt templates
- JSON validation
- rate limiting
- logging without storing full sensitive text unnecessarily
- role checks
- shared error handling

### AI 名师伴学

Recommended: Phase 3.

Effect:
- subject-specific tutor persona
- can guide students through course content
- can use course lessons, exams, and knowledge base

Do after:
- AI tools hub
- course knowledge source selection
- role boundaries

### AI 累计预警

Recommended: Phase 3/4.

Effect:
- warn teacher/admin when a student has repeated low scores, missed submissions, or long inactivity

Needs:
- stable exam attempts
- submission records
- attendance data
- thresholds configurable by teacher

Do not make AI decide high-stakes labels alone.

### AI 今日推荐练习

Recommended: Phase 3.

Effect:
- student sees 3 recommended practice items based on weak topics

Needs:
- tagged questions/exams
- recent score history

### 多维成长雷达

Recommended: Phase 3/4.

Effect:
- visual radar for accuracy, persistence, completion, vocabulary, reasoning, etc.

Needs:
- enough data points
- careful explanation to avoid ranking students unfairly

### 强势 / 最弱科目 AI 提示

Recommended: Phase 3.

Effect:
- simple teacher/student summary:
  - strongest area
  - weakest area
  - next step

Needs:
- subject/topic tags
- assessment history

### 学习数据摘要

Recommended: Phase 3 first among data tools.

Effect:
- teacher/admin can read a weekly summary:
  - course participation
  - submissions
  - common wrong topics
  - recommended next lesson focus

Reason:
- lower risk than prediction/warning
- uses data already collected in v5

## Suggested Build Order

1. AI基础服务搭建
2. AI工具中心页面 redesign
3. 生字句子练习器
4. 英文作文改写助手
5. 数学错题讲解卡 text version
6. 阅读理解提问器
7. 科学概念图生成器
8. 常识科知识库问答
9. 学习数据摘要
10. 今日推荐练习
11. 强弱科目提示 / 成长雷达 / 累计预警
12. 情绪日记
13. 绘图故事卡

## Not Recommended for Immediate Development

### Photo-first math solver

Reason:
- needs OCR/vision
- wrong OCR creates wrong teaching
- better to start with text input and add image later

### Full essay rewriting

Reason:
- encourages homework outsourcing
- weakens learning
- should provide correction and revision tasks instead

### Open unrestricted web Q&A for young students

Reason:
- inconsistent sources
- safety and age-appropriateness risk
- use approved knowledge base for school topics

### Mental-health diagnosis

Reason:
- high sensitivity
- not appropriate for an education app without professional workflow
- only offer gentle encouragement and trusted-adult escalation

### AI-generated image first

Reason:
- requires image provider, moderation, and cost controls
- text story card gives faster value first

## Provider Choice

DeepSeek:
- best for short structured text tasks
- good for 生字、英文修正、数学讲解、短文阅读题、概念图 JSON
- lower integration complexity because it already exists in v6

Kimi:
- best for long-context reading and teacher-uploaded longer documents
- useful for 阅读理解提问器 and knowledge-base style tasks
- add after shared provider abstraction is done

Image generation:
- not covered by DeepSeek/Kimi text APIs
- only add when a safe image provider and moderation plan are selected
