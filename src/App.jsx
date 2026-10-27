import React, { useState, useEffect, useRef, useCallback } from 'react';

// --- API & Utility Helpers ---
const STORAGE_KEY = 'ai_smart_minutes_session_v3';

// Default Clean State
const initialSessionState = {
  inputText: '',
  meetingInfo: {
    title: '新規会議',
    date: new Date().toISOString().split('T')[0],
    time: '10:00 - 11:00',
    location: 'オンライン (Zoom / Teams)',
    participants: []
  },
  minutes: {
    executiveSummary: '',
    keyDecisions: [],
    discussionTopics: [],
    actionItems: []
  },
  report: {
    title: '',
    subtitle: '',
    date: new Date().toISOString().split('T')[0],
    author: 'AIスマート分析エンジン',
    executiveSummary: '',
    background: '',
    recommendations: [],
    roiAndImpact: '',
    nextSteps: ''
  },
  slides: [],
  risks: [],
  tasks: [],
  drafts: {
    slack: '',
    email: '',
    teams: ''
  },
  history: []
};

// Preset Sample Prompts/Transcripts for Quick Testing
const PRESET_TEMPLATES = [
  {
    id: 'exec_board',
    label: '役員会・経営戦略会議',
    text: `【日時】2026年10月27日 10:00-11:30
【出席者】田中CEO、佐藤COO、鈴木CFO、高橋CTO、渡辺リードエンジニア
【議題】Q4自社クラウドSaaS事業の拡張戦略および次年度予算配分について

1. 業績振り返りと現状
・鈴木CFO：Q3決算は売上目標比112%達成。特にエンタープライズ顧客の解約率(Churn Rate)が0.8%まで改善した。
・田中CEO：好調だが、競合他社が生成AI連携機能を相次いでリリースしている。当社もAI統合機能を最優先で開発すべき。

2. 次期AI新機能の開発方針
・高橋CTO：現在開発中のAI自動アナリティクス機能は12月中旬にα版完了予定。追加予算1,500万円とエンジニア2名の外部アサインが必要。
・佐藤COO：営業チームからもAI機能に対する顧客要望が非常に多い。1月中の正式リリースを強く希望。
・渡辺：セキュリティ審査（SOC2 Type2認証）の更新とバッティングしているため、リソースの再配分を検討したい。

3. 決定事項・アクション
・決定：AIアナリティクス開発に1,500万円の追加開発予算を承認する。
・決定：SOC2認証更新作業は11月中に前倒しで完了させ、12月以降はAI機能開発に集中する。
・アクション：高橋CTOは追加外部ベンダー選定を11/10までに完了する。
・アクション：佐藤COOは主要10社に対するAI機能の事前マーケティングプランを11/15までに作成する。
・アクション：鈴木CFOはQ4補正予算案を来週の経営会議で提出する。`
  },
  {
    id: 'sales_pitch',
    label: '営業商談・クライアントヒアリング',
    text: `【日時】2026年10月26日 14:00-15:00
【先方】株式会社未来ソリューションズ（山形IT部長、加藤DX推進リーダー）
【当方】小林営業マネージャー、中村ソリューションアーキテクト
【目的】基幹システム刷新に伴うワークフロー自動化ツールの導入検討

【発言要旨】
・山形部長：現場のペーパーレス化が進んでおらず、月間400時間の申請処理コストが発生している。
・加藤リーダー：現場スタッフの平均年齢が高いため、UIが複雑だと定着しない懸念がある。スマホ対応が必須。
・中村SA：当社のスマホ最適化テンプレートとAI入力補正機能を使えば、入力時間を80%削減可能。
・山形部長：導入予算のセキュリティ審査基準（ISMAP適合）についての資料がほしい。また、トライアル期間を設けることは可能か？
・小林：2週間の無料PoC（概念実証）プランをご用意可能。11月1日開始で調整したい。

【決まったこと】
・11/1より2週間の無料PoCを実施。対象部署は総務部と営業推進部（計20名）。
・小林よりセキュリティ白書と見積書（基本プラン＋保守サポート）を10/29までに送付する。
・加藤リーダーは社内セキュリティ審査に必要なチェックシートを10/28までに小林へ送付。`
  }
];

// --- Main App Component ---
export default function App() {
  // --- Persistent States ---
  const [session, setSession] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load session:', e);
    }
    return initialSessionState;
  });

  const [customApiKey, setCustomApiKey] = useState(() => {
    return localStorage.getItem('gemini_custom_api_key') || '';
  });

  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme_mode') === 'dark';
  });

  // --- Active Tab State ---
  const [activeTab, setActiveTab] = useState('minutes'); // 'minutes', 'report', 'slides', 'risks', 'kanban', 'drafts', 'settings'

  // --- UI Control States ---
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [reportEditMode, setReportEditMode] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState('保存済み');
  const [toastMessage, setToastMessage] = useState(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [groundedSearchLoading, setGroundedSearchLoading] = useState(false);

  // --- Audio Upload Simulation State ---
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  // Auto-save session effect
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0];
      setAutoSaveStatus(`自動保存完了 (${timeStr})`);
    } catch (e) {
      console.error('Auto-save error:', e);
      setAutoSaveStatus('保存エラー');
    }
  }, [session]);

  // Dark mode toggle effect
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme_mode', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme_mode', 'light');
    }
  }, [darkMode]);

  // Toast Notification Helper
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // --- API Call Core Handler ---
  const callGeminiAPI = async (prompt, systemInstruction = '', useSearch = false) => {
    // API key resolution: use user-provided key, or standard environment/runtime endpoint fallback
    const apiKey = customApiKey || '';
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;

    const payload = {
      contents: [{ parts: [{ text: prompt }] }]
    };

    if (systemInstruction) {
      payload.systemInstruction = {
        parts: [{ text: systemInstruction }]
      };
    }

    if (useSearch) {
      payload.tools = [{ google_search: {} }];
    }

    // Exponential backoff fetch logic
    let retries = 3;
    let delay = 1000;

    while (retries > 0) {
      try {
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();
        const candidate = data.candidates?.[0];

        if (candidate?.content?.parts?.[0]?.text) {
          return {
            text: candidate.content.parts[0].text,
            groundingMetadata: candidate.groundingMetadata || null
          };
        } else {
          throw new Error('API returned an empty response.');
        }
      } catch (err) {
        retries--;
        if (retries === 0) throw err;
        await new Promise((r) => setTimeout(r, delay));
        delay *= 2;
      }
    }
  };

  // --- AI Comprehensive Analysis Handler ---
  const handleFullAIAnalysis = async () => {
    if (!session.inputText.trim()) {
      showToast('⚠️ 会議テキストまたは書き起こしを入力してください。');
      return;
    }

    setIsProcessing(true);
    setProcessingStep('テキストを解析中...');

    const systemPrompt = `
You are an expert AI Business Analyst & Executive Report Writer.
Analyze the provided meeting transcript or notes and output a single valid JSON object strictly adhering to this schema. Do not include markdown code block formatting in the raw text if possible, or ensure it can be parsed cleanly as standard JSON.

Schema:
{
  "meetingInfo": {
    "title": "会議タイトル",
    "date": "YYYY-MM-DD",
    "time": "時間帯 (例: 10:00 - 11:30)",
    "location": "開催場所またはオンライン形式",
    "participants": ["参加者1", "参加者2"]
  },
  "minutes": {
    "executiveSummary": "全体要約 (2-3文で要約)",
    "keyDecisions": ["決定事項1", "決定事項2"],
    "discussionTopics": [
      {
        "topic": "アジェンダ/議題",
        "details": "議論の要点・意見"
      }
    ],
    "actionItems": [
      {
        "id": "task_1",
        "task": "タスク内容",
        "assignee": "担当者",
        "dueDate": "期限",
        "priority": "High" | "Medium" | "Low",
        "status": "todo"
      }
    ]
  },
  "report": {
    "title": "エグゼクティブ・ビジネスレポート件名",
    "subtitle": "副題・サブタイトル",
    "date": "YYYY-MM-DD",
    "author": "AI経営分析エンジン",
    "executiveSummary": "経営陣向けエグゼクティブ要約 (定量的かつ戦略的な観点を含める)",
    "background": "背景と現状の課題分析",
    "recommendations": [
      {
        "id": "rec_1",
        "title": "推奨施策タイトル",
        "detail": "具体的な施策の実行プラン",
        "impact": "期待される定量的・定性的インパクト"
      }
    ],
    "roiAndImpact": "財務・運用面でのROIおよび期待効果予測",
    "nextSteps": "今後のロードマップ・マイルストーン"
  },
  "slides": [
    {
      "id": "slide_1",
      "slideNumber": 1,
      "title": "スライドタイトル",
      "bullets": ["要点1", "要点2", "要点3"],
      "speakerNotes": "発表者用ノート・想定される質疑応答"
    }
  ],
  "risks": [
    {
      "id": "risk_1",
      "issue": "識別されたリスク・ボトルネック",
      "riskLevel": "High" | "Medium" | "Low",
      "impact": "事業やプロジェクトへの影響度",
      "solution": "標準的な回避策・対応策",
      "webSearchQuery": "Google検索で業界のベストプラクティスを補強するための推奨検索クエリ"
    }
  ],
  "drafts": {
    "slack": "Slack/Teams用の簡潔な連絡文面 (Emoji活用)",
    "email": "経営陣・関係者向けの公式報告メール文面",
    "teams": "プロジェクトチーム宛のアクションアイテム確認通知文"
  }
}
`;

    try {
      setProcessingStep('AIモデルに照会中 (議事録・レポート・リスク生成)...');
      const response = await callGeminiAPI(
        `【入力テキスト】:\n${session.inputText}`,
        systemPrompt
      );

      setProcessingStep('生成データの構造化中...');

      // Clean response text to ensure JSON parsing
      let jsonStr = response.text.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const parsed = JSON.parse(jsonStr);

      // Create Kanban Tasks array from action items
      const tasksData = parsed.minutes?.actionItems
        ? parsed.minutes.actionItems.map((item, idx) => ({
            id: item.id || `task_${idx}_${Date.now()}`,
            title: item.task,
            assignee: item.assignee || '未アサイン',
            dueDate: item.dueDate || '未定',
            priority: item.priority || 'Medium',
            status: 'todo'
          }))
        : [];

      // Update state
      setSession((prev) => ({
        ...prev,
        meetingInfo: parsed.meetingInfo || prev.meetingInfo,
        minutes: parsed.minutes || prev.minutes,
        report: parsed.report || prev.report,
        slides: parsed.slides || prev.slides,
        risks: parsed.risks || prev.risks,
        tasks: tasksData,
        drafts: parsed.drafts || prev.drafts,
        history: [
          {
            id: Date.now(),
            timestamp: new Date().toLocaleString(),
            title: parsed.meetingInfo?.title || '無題の会議',
            summary: parsed.minutes?.executiveSummary || ''
          },
          ...prev.history
        ]
      }));

      showToast('✨ AI分析・レポート生成が正常に完了しました！');
      setActiveTab('minutes');
    } catch (err) {
      console.error('AI Processing Error:', err);
      showToast('❌ 解析エラー: APIキーまたは通信状態を確認してください。');
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  // --- Grounded Web Search Solution Enriched Function for Risks ---
  const handleEnhanceRiskWithWebSearch = async (riskId) => {
    const targetRisk = session.risks.find((r) => r.id === riskId);
    if (!targetRisk) return;

    setGroundedSearchLoading(riskId);

    const query = targetRisk.webSearchQuery || `${targetRisk.issue} 解決策 ベストプラクティス`;
    const prompt = `
リスク・課題「${targetRisk.issue}」（影響: ${targetRisk.impact}）について、
Web上の最新の業界ベストプラクティスや事例、専門知識を検索し、実践的な解決策と導入ステップを詳しく提案してください。
回答には具体的な解決ステップと参照可能なWeb検索知見を含めてください。
`;

    try {
      const result = await callGeminiAPI(
        prompt,
        'あなたは先進的な課題解決コンサルタントです。Web検索結果を活用して、実行可能で信頼性の高い解決案を提示してください。',
        true
      );

      // Extract text & sources if available
      let enrichedSolution = result.text;
      if (result.groundingMetadata?.groundingAttributions?.length > 0) {
        const sources = result.groundingMetadata.groundingAttributions
          .map((a) => a.web?.title)
          .filter(Boolean)
          .join(', ');
        if (sources) {
          enrichedSolution += `\n\n🌐 Web参照ソース: ${sources}`;
        }
      }

      // Update risks in state
      setSession((prev) => ({
        ...prev,
        risks: prev.risks.map((r) =>
          r.id === riskId
            ? { ...r, solution: enrichedSolution, enriched: true }
            : r
        )
      }));

      showToast('🌐 Web検索による最新の解決案で補強しました！');
    } catch (e) {
      console.error('Web Search Grounding Error:', e);
      showToast('❌ Web解決案の取得に失敗しました。');
    } finally {
      setGroundedSearchLoading(null);
    }
  };

  // --- AI Refinement for Executive Report ---
  const handleRefineReportSection = async (sectionKey, promptInstruction) => {
    setIsProcessing(true);
    setProcessingStep(`AIがレポートの[${sectionKey}]を洗練中...`);

    const currentText = typeof session.report[sectionKey] === 'string'
      ? session.report[sectionKey]
      : JSON.stringify(session.report[sectionKey]);

    const prompt = `
以下のエグゼクティブ・レポートの「${sectionKey}」セクションを、次の指示に従って改稿してください。
【指示】: ${promptInstruction}
【現在の内容】:
${currentText}

改善後の該当セクションの内容のみをテキストで出力してください（他の解説や挨拶は不要です）。
`;

    try {
      const result = await callGeminiAPI(prompt, 'あなたは経営幹部向けのプロフェッショナルなリポート執筆者です。');
      
      setSession((prev) => ({
        ...prev,
        report: {
          ...prev.report,
          [sectionKey]: result.text.trim()
        }
      }));

      showToast(`✨ ${sectionKey} のAI改稿が完了しました。`);
    } catch (e) {
      console.error('Report refinement error:', e);
      showToast('❌ AI改稿に失敗しました。');
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  // --- File Import Simulation ---
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSelectedFile(file.name);
    // Simulate loading audio transcript or document text
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      setSession((prev) => ({
        ...prev,
        inputText: content || `【音声・テキストファイル取り込み完了: ${file.name}】\n※取り込まれたテキストがここに表示されます。`
      }));
      showToast(`📁 ファイル「${file.name}」を取り込みました`);
    };

    if (file.type.includes('text') || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
      reader.readAsText(file);
    } else {
      // For audio/binary files, output simulated metadata
      setSession((prev) => ({
        ...prev,
        inputText: `【音声ファイル読み込み情報: ${file.name} (サイズ: ${(file.size / (1024 * 1024)).toFixed(2)} MB)】\n\nAI文字起こし処理を開始できます。「AI全自動解析 & 生成」ボタンを押してください。`
      }));
      showToast(`🎵 音声ファイル「${file.name}」をインポートしました`);
    }
  };

  // --- Export Helpers ---
  const handleDownloadMarkdown = (content, filename) => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`📥 ${filename} をダウンロードしました`);
  };

  const handlePrintReport = () => {
    window.print();
  };

  const handleCopyText = (text) => {
    navigator.clipboard.writeText(text);
    showToast('📋 クリップボードにコピーしました！');
  };

  // --- Session Reset Handler ---
  const handleResetSession = () => {
    setSession(initialSessionState);
    setShowResetModal(false);
    showToast('🧹 セッションを初期化しました');
  };

  // --- Recommendations Interactive Editor Helpers ---
  const handleAddRecommendation = () => {
    const newRec = {
      id: `rec_${Date.now()}`,
      title: '新規推奨施策',
      detail: '施策の具体的な実施要領を記入してください。',
      impact: '期待される成果やROIを記入'
    };
    setSession((prev) => ({
      ...prev,
      report: {
        ...prev.report,
        recommendations: [...(prev.report.recommendations || []), newRec]
      }
    }));
  };

  const handleUpdateRecommendation = (id, field, value) => {
    setSession((prev) => ({
      ...prev,
      report: {
        ...prev.report,
        recommendations: prev.report.recommendations.map((item) =>
          item.id === id ? { ...item, [field]: value } : item
        )
      }
    }));
  };

  const handleDeleteRecommendation = (id) => {
    setSession((prev) => ({
      ...prev,
      report: {
        ...prev.report,
        recommendations: prev.report.recommendations.filter((item) => item.id !== id)
      }
    }));
  };

  // --- Action Item / Task Status Switcher ---
  const handleTaskStatusChange = (taskId, newStatus) => {
    setSession((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    }));
  };

  return (
    <div className={`min-h-screen font-sans ${darkMode ? 'dark bg-gray-950 text-gray-100' : 'bg-slate-50 text-slate-800'}`}>
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-2xl bg-indigo-600 text-white font-medium flex items-center gap-2 transition-all transform animate-bounce">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* --- Top Navigation Header --- */}
      <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-gray-800 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md px-4 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Logo & Brand Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="font-bold text-lg md:text-xl text-slate-900 dark:text-white flex items-center gap-2">
                AIスマート議事録 & レポート Pro
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hidden sm:inline-block">
                  v3.0 Gemini-Grounded
                </span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-gray-400 hidden md:block">
                万能デバイス対応 ・ 自動ローカル保存 ・ リポート高度編集機能付き
              </p>
            </div>
          </div>

          {/* Action Tools & Status */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Auto Save Status Badge */}
            <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-500 dark:text-gray-400 bg-slate-100 dark:bg-gray-800 px-3 py-1.5 rounded-full border border-slate-200 dark:border-gray-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>{autoSaveStatus}</span>
            </div>

            {/* Quick Demo Data Loader */}
            <button
              onClick={() => {
                setSession((prev) => ({
                  ...prev,
                  inputText: PRESET_TEMPLATES[0].text
                }));
                showToast('📝 役員会デモ原稿を読み込みました');
              }}
              className="text-xs font-medium px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 transition min-h-[44px] flex items-center"
              title="デモテキストを読み込み"
            >
              ⚡ デモ入力
            </button>

            {/* Reset / New Session */}
            <button
              onClick={() => setShowResetModal(true)}
              className="text-xs font-medium px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-800 transition min-h-[44px] flex items-center"
              title="新規セッションを作成"
            >
              🧹 新規作成
            </button>

            {/* Dark Mode Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2.5 rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700 transition min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="テーマ切替"
            >
              {darkMode ? '☀️' : '🌙'}
            </button>

            {/* Settings Modal Button */}
            <button
              onClick={() => setShowSettingsModal(true)}
              className="p-2.5 rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700 transition min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="APIキー・各種設定"
            >
              ⚙️
            </button>
          </div>
        </div>
      </header>

      {/* --- Main Dashboard Container --- */}
      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-6 pb-24 md:pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* ========================================== */}
          {/* LEFT PANEL: Input & AI Command Hub (4 Cols) */}
          {/* ========================================== */}
          <div className="lg:col-span-4 space-y-5">
            {/* Input Card */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-slate-200 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>🎙️ 会議入力・書き起こし</span>
                </h2>
                <span className="text-xs text-slate-400">
                  {session.inputText.length} 文字
                </span>
              </div>

              {/* Template Selectors */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-gray-400">
                  プリセットテンプレートから入力:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {PRESET_TEMPLATES.map((tmpl) => (
                    <button
                      key={tmpl.id}
                      onClick={() => {
                        setSession((prev) => ({ ...prev, inputText: tmpl.text }));
                        showToast(`「${tmpl.label}」を入力しました`);
                      }}
                      className="text-left text-xs p-2 rounded-lg border border-slate-200 dark:border-gray-800 hover:border-indigo-500 dark:hover:border-indigo-500 bg-slate-50 dark:bg-gray-800/50 hover:bg-indigo-50/50 transition truncate font-medium text-slate-700 dark:text-gray-300"
                    >
                      {tmpl.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* File / Audio Upload Simulation */}
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".txt,.md,.m4a,.mp3,.wav,.ogg"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2 px-3 border border-dashed border-slate-300 dark:border-gray-700 rounded-xl bg-slate-50 dark:bg-gray-800/40 hover:bg-slate-100 dark:hover:bg-gray-800 text-xs font-medium text-slate-600 dark:text-gray-300 flex items-center justify-center gap-2 transition"
                >
                  <span>📂</span>
                  <span>{selectedFile ? `選択中: ${selectedFile}` : 'テキスト/音声ファイルを指定...'}</span>
                </button>
              </div>

              {/* Main Transcript Text Area */}
              <div>
                <textarea
                  value={session.inputText}
                  onChange={(e) =>
                    setSession((prev) => ({ ...prev, inputText: e.target.value }))
                  }
                  placeholder="ここに会議のメモ、発言ログ、議事録の原稿、または音声文字起こしテキストを貼り付けてください..."
                  className="w-full h-64 lg:h-80 p-3.5 text-sm rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-gray-950 text-slate-800 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                ></textarea>
              </div>

              {/* AI Processing Primary Button */}
              <button
                onClick={handleFullAIAnalysis}
                disabled={isProcessing}
                className="w-full py-3.5 px-4 rounded-xl font-bold text-white bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-lg shadow-indigo-500/25 transition transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-h-[48px]"
              >
                {isProcessing ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>{processingStep || '分析中...'}</span>
                  </>
                ) : (
                  <>
                    <span>✨</span>
                    <span>AI全自動解析 & レポート生成</span>
                  </>
                )}
              </button>
            </div>

            {/* Quick Session Stats / Metadata Card */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-slate-200 dark:border-gray-800 shadow-sm space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                現在の会議ステータス
              </h3>
              <div className="text-sm space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 dark:text-gray-400">件名:</span>
                  <span className="font-semibold text-slate-800 dark:text-gray-200 truncate max-w-[180px]">
                    {session.meetingInfo.title}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 dark:text-gray-400">開催日:</span>
                  <span className="font-semibold text-slate-800 dark:text-gray-200">
                    {session.meetingInfo.date}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 dark:text-gray-400">決定事項数:</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-bold">
                    {session.minutes.keyDecisions?.length || 0} 件
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 dark:text-gray-400">未処理タスク:</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 font-bold">
                    {session.tasks.filter((t) => t.status === 'todo').length} 件
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================== */}
          {/* RIGHT PANEL: Output & Interactive Editors (8 Cols) */}
          {/* ========================================== */}
          <div className="lg:col-span-8 space-y-4">
            
            {/* Top Responsive Navigation Tabs */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-2 border border-slate-200 dark:border-gray-800 shadow-sm overflow-x-auto scrollbar-none">
              <div className="flex items-center gap-1 min-w-max">
                {[
                  { id: 'minutes', label: '📝 議事録', badge: session.minutes.keyDecisions?.length },
                  { id: 'report', label: '📄 エグゼクティブ・レポート', highlight: true },
                  { id: 'slides', label: '📊 プレゼン資料案', badge: session.slides?.length },
                  { id: 'risks', label: '🛡️ リスク・課題 & Web解決策', badge: session.risks?.length },
                  { id: 'kanban', label: '⚡ タスク看板', badge: session.tasks?.length },
                  { id: 'drafts', label: '✉️ 共有文面' }
                ].map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 min-h-[44px] ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                          : 'text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      <span>{tab.label}</span>
                      {tab.badge > 0 && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : 'bg-slate-200 dark:bg-gray-700 text-slate-700 dark:text-gray-300'
                          }`}
                        >
                          {tab.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* TAB CONTENT 1: 📝 議事録 (Minutes View & Direct Editor) */}
            {activeTab === 'minutes' && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-slate-200 dark:border-gray-800 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-gray-800">
                  <div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                      標準議事録フォーマット
                    </span>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                      {session.meetingInfo.title || '会議要約・決定事項'}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const mdStr = `# ${session.meetingInfo.title}\n\n**日時:** ${session.meetingInfo.date}\n**要約:**\n${session.minutes.executiveSummary}\n\n## 決定事項\n${session.minutes.keyDecisions?.map((d) => `- ${d}`).join('\n')}`;
                        handleDownloadMarkdown(mdStr, `${session.meetingInfo.title}_議事録.md`);
                      }}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-gray-700 hover:bg-slate-100 dark:hover:bg-gray-800 transition min-h-[44px]"
                    >
                      📥 MD出力
                    </button>
                    <button
                      onClick={() => {
                        const text = `【${session.meetingInfo.title}】\n日時: ${session.meetingInfo.date}\n\n【決定事項】\n${session.minutes.keyDecisions?.map((d) => `・${d}`).join('\n')}\n\n【要約】\n${session.minutes.executiveSummary}`;
                        handleCopyText(text);
                      }}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300 hover:bg-indigo-100 transition min-h-[44px]"
                    >
                      📋 テキストコピー
                    </button>
                  </div>
                </div>

                {/* Executive Summary */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-gray-800/40 border border-slate-200 dark:border-gray-800 space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    💡 エグゼクティブ・サマリー (全体要約)
                  </h3>
                  <textarea
                    value={session.minutes.executiveSummary || ''}
                    onChange={(e) =>
                      setSession((prev) => ({
                        ...prev,
                        minutes: { ...prev.minutes, executiveSummary: e.target.value }
                      }))
                    }
                    placeholder="分析を実行するとAI要約が生成されます..."
                    className="w-full bg-transparent border-none text-sm leading-relaxed text-slate-800 dark:text-gray-200 focus:outline-none resize-y min-h-[70px]"
                  />
                </div>

                {/* Key Decisions Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-base">
                      <span>✅ 決定事項 (Key Decisions)</span>
                    </h3>
                    <button
                      onClick={() => {
                        setSession((prev) => ({
                          ...prev,
                          minutes: {
                            ...prev.minutes,
                            keyDecisions: [...(prev.minutes.keyDecisions || []), '新規の決定事項を入力...']
                          }
                        }));
                      }}
                      className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                    >
                      + 決定事項を追加
                    </button>
                  </div>

                  <div className="space-y-2">
                    {session.minutes.keyDecisions?.length === 0 && (
                      <p className="text-xs text-slate-400 italic">決定事項はまだ登録されていません。</p>
                    )}
                    {session.minutes.keyDecisions?.map((decision, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/60"
                      >
                        <span className="text-emerald-600 font-bold text-sm">・</span>
                        <input
                          type="text"
                          value={decision}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSession((prev) => ({
                              ...prev,
                              minutes: {
                                ...prev.minutes,
                                keyDecisions: prev.minutes.keyDecisions.map((d, i) => (i === idx ? val : d))
                              }
                            }));
                          }}
                          className="w-full bg-transparent text-sm font-medium text-slate-800 dark:text-gray-200 focus:outline-none"
                        />
                        <button
                          onClick={() => {
                            setSession((prev) => ({
                              ...prev,
                              minutes: {
                                ...prev.minutes,
                                keyDecisions: prev.minutes.keyDecisions.filter((_, i) => i !== idx)
                              }
                            }));
                          }}
                          className="text-slate-400 hover:text-red-500 text-xs px-2"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Discussion Topics */}
                <div className="space-y-3">
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    📌 議題・議論の詳細 (Discussion Topics)
                  </h3>
                  <div className="space-y-3">
                    {session.minutes.discussionTopics?.map((topic, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-xl border border-slate-200 dark:border-gray-800 space-y-2 bg-slate-50/50 dark:bg-gray-800/20"
                      >
                        <input
                          type="text"
                          value={topic.topic}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSession((prev) => ({
                              ...prev,
                              minutes: {
                                ...prev.minutes,
                                discussionTopics: prev.minutes.discussionTopics.map((t, i) =>
                                  i === idx ? { ...t, topic: val } : t
                                )
                              }
                            }));
                          }}
                          className="font-bold text-sm text-indigo-600 dark:text-indigo-400 bg-transparent w-full focus:outline-none"
                        />
                        <textarea
                          value={topic.details}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSession((prev) => ({
                              ...prev,
                              minutes: {
                                ...prev.minutes,
                                discussionTopics: prev.minutes.discussionTopics.map((t, i) =>
                                  i === idx ? { ...t, details: val } : t
                                )
                              }
                            }));
                          }}
                          className="w-full bg-transparent text-xs sm:text-sm text-slate-700 dark:text-gray-300 focus:outline-none resize-y"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT 2: 📄 エグゼクティブ・レポート (High-level Interactive Report Editor) */}
            {activeTab === 'report' && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-800 shadow-sm overflow-hidden">
                {/* Report Header Toolbar */}
                <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/80 dark:bg-gray-800/50">
                  <div>
                    <span className="text-xs font-bold text-violet-600 dark:text-violet-400 tracking-wider uppercase">
                      Executive Briefing & Strategic Report
                    </span>
                    <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                      {session.report.title || 'エグゼクティブ・戦略分析レポート'}
                    </h2>
                  </div>

                  {/* Mode Switcher & Export Tools */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Toggle Edit vs Preview Mode */}
                    <div className="bg-slate-200 dark:bg-gray-700 p-1 rounded-xl flex items-center">
                      <button
                        onClick={() => setReportEditMode(false)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                          !reportEditMode
                            ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                            : 'text-slate-600 dark:text-gray-300'
                        }`}
                      >
                        👁️ プレビューモード
                      </button>
                      <button
                        onClick={() => setReportEditMode(true)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                          reportEditMode
                            ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                            : 'text-slate-600 dark:text-gray-300'
                        }`}
                      >
                        ✏️ 編集モード
                      </button>
                    </div>

                    <button
                      onClick={handlePrintReport}
                      className="px-3 py-2 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-semibold hover:bg-slate-100 transition min-h-[44px]"
                    >
                      🖨️ PDF / 印刷
                    </button>
                  </div>
                </div>

                {/* EDIT MODE FORM VIEW */}
                {reportEditMode ? (
                  <div className="p-6 space-y-6 bg-slate-50/30 dark:bg-gray-950/30">
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between">
                      <span>✏️ 現在「編集モード」です。テキストを直接変更・AI追記が可能です。</span>
                      <button
                        onClick={() => setReportEditMode(false)}
                        className="font-bold underline ml-2"
                      >
                        プレビューに戻る
                      </button>
                    </div>

                    {/* Report Metadata */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-500 dark:text-gray-400">レポート件名</label>
                        <input
                          type="text"
                          value={session.report.title || ''}
                          onChange={(e) =>
                            setSession((prev) => ({
                              ...prev,
                              report: { ...prev.report, title: e.target.value }
                            }))
                          }
                          className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-sm font-bold text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 dark:text-gray-400">サブタイトル</label>
                        <input
                          type="text"
                          value={session.report.subtitle || ''}
                          onChange={(e) =>
                            setSession((prev) => ({
                              ...prev,
                              report: { ...prev.report, subtitle: e.target.value }
                            }))
                          }
                          className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-sm text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>

                    {/* Executive Summary Section */}
                    <div className="space-y-2 bg-white dark:bg-gray-900 p-4 rounded-xl border border-slate-200 dark:border-gray-800">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase">
                          1. エグゼクティブ要約 (Executive Summary)
                        </label>
                        <button
                          onClick={() => handleRefineReportSection('executiveSummary', '経営陣向けに、数値と成果の強調を強めて要約を洗練してください。')}
                          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-semibold"
                        >
                          ✨ AI文章洗練
                        </button>
                      </div>
                      <textarea
                        value={session.report.executiveSummary || ''}
                        onChange={(e) =>
                          setSession((prev) => ({
                            ...prev,
                            report: { ...prev.report, executiveSummary: e.target.value }
                          }))
                        }
                        className="w-full p-3 rounded-lg border border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-gray-950 text-sm leading-relaxed resize-y h-28"
                      />
                    </div>

                    {/* Background & Context */}
                    <div className="space-y-2 bg-white dark:bg-gray-900 p-4 rounded-xl border border-slate-200 dark:border-gray-800">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase">
                          2. 背景および現状課題 (Context & Background)
                        </label>
                        <button
                          onClick={() => handleRefineReportSection('background', '現状の市場動向や社内課題の背景を論理的に整理して補強してください。')}
                          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-semibold"
                        >
                          ✨ AI論理補強
                        </button>
                      </div>
                      <textarea
                        value={session.report.background || ''}
                        onChange={(e) =>
                          setSession((prev) => ({
                            ...prev,
                            report: { ...prev.report, background: e.target.value }
                          }))
                        }
                        className="w-full p-3 rounded-lg border border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-gray-950 text-sm leading-relaxed resize-y h-28"
                      />
                    </div>

                    {/* Strategic Recommendations Interactive Editor */}
                    <div className="space-y-3 bg-white dark:bg-gray-900 p-4 rounded-xl border border-slate-200 dark:border-gray-800">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase">
                          3. 戦略的推奨施策 (Strategic Recommendations)
                        </label>
                        <button
                          onClick={handleAddRecommendation}
                          className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                        >
                          + 施策項目を追加
                        </button>
                      </div>

                      <div className="space-y-4">
                        {session.report.recommendations?.map((rec) => (
                          <div
                            key={rec.id}
                            className="p-4 rounded-xl bg-slate-50 dark:bg-gray-800/40 border border-slate-200 dark:border-gray-800 space-y-3"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <input
                                type="text"
                                value={rec.title}
                                onChange={(e) => handleUpdateRecommendation(rec.id, 'title', e.target.value)}
                                placeholder="施策タイトル"
                                className="font-bold text-sm text-slate-900 dark:text-white bg-transparent w-full focus:outline-none border-b border-slate-200 dark:border-gray-700 pb-1"
                              />
                              <button
                                onClick={() => handleDeleteRecommendation(rec.id)}
                                className="text-red-500 hover:text-red-700 text-xs font-bold"
                              >
                                削除
                              </button>
                            </div>
                            <textarea
                              value={rec.detail}
                              onChange={(e) => handleUpdateRecommendation(rec.id, 'detail', e.target.value)}
                              placeholder="具体プラン"
                              className="w-full p-2 text-xs rounded bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800"
                            />
                            <input
                              type="text"
                              value={rec.impact}
                              onChange={(e) => handleUpdateRecommendation(rec.id, 'impact', e.target.value)}
                              placeholder="期待インパクト/ROI"
                              className="w-full p-2 text-xs rounded bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-200/50 dark:border-emerald-800/50"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Financial & ROI Impact */}
                    <div className="space-y-2 bg-white dark:bg-gray-900 p-4 rounded-xl border border-slate-200 dark:border-gray-800">
                      <label className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase">
                        4. 財務インパクト・ROI試算 (Financial Impact & ROI)
                      </label>
                      <textarea
                        value={session.report.roiAndImpact || ''}
                        onChange={(e) =>
                          setSession((prev) => ({
                            ...prev,
                            report: { ...prev.report, roiAndImpact: e.target.value }
                          }))
                        }
                        className="w-full p-3 rounded-lg border border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-gray-950 text-sm leading-relaxed resize-y h-24"
                      />
                    </div>
                  </div>
                ) : (
                  /* PREVIEW / PUBLICATION VIEW (PRINT READY) */
                  <div className="p-8 space-y-8 bg-white dark:bg-gray-900 text-slate-800 dark:text-gray-100 print:p-0 print:bg-white print:text-black">
                    {/* Report Cover Header */}
                    <div className="border-b-2 border-indigo-600 pb-6 space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                        <span>CONFIDENTIAL - FOR EXECUTIVE USE ONLY</span>
                        <span>発行日: {session.report.date || new Date().toISOString().split('T')[0]}</span>
                      </div>
                      <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                        {session.report.title || 'エグゼクティブ・戦略報告書'}
                      </h1>
                      {session.report.subtitle && (
                        <p className="text-base text-slate-600 dark:text-gray-300 font-medium">
                          {session.report.subtitle}
                        </p>
                      )}
                    </div>

                    {/* Executive Summary Card */}
                    <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-50/80 to-slate-50 dark:from-indigo-950/40 dark:to-gray-800/40 border border-indigo-100 dark:border-indigo-900/50 space-y-3">
                      <h3 className="text-xs font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                        <span>📊 Executive Summary (経営要約)</span>
                      </h3>
                      <p className="text-sm leading-relaxed font-medium text-slate-800 dark:text-gray-200 whitespace-pre-line">
                        {session.report.executiveSummary || '分析を実行するとAIレポート要約が生成されます。'}
                      </p>
                    </div>

                    {/* Context & Background */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white border-l-4 border-indigo-600 pl-3">
                        1. 背景および現状課題の認識
                      </h3>
                      <p className="text-sm text-slate-700 dark:text-gray-300 leading-relaxed whitespace-pre-line pl-4">
                        {session.report.background || '現状の背景課題についての分析結果が表示されます。'}
                      </p>
                    </div>

                    {/* Strategic Recommendations */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white border-l-4 border-indigo-600 pl-3">
                        2. 経営陣への推奨施策プラン
                      </h3>
                      <div className="grid grid-cols-1 gap-4 pl-4">
                        {session.report.recommendations?.map((rec, i) => (
                          <div
                            key={rec.id || i}
                            className="p-4 rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-800/20 space-y-2"
                          >
                            <h4 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center">
                                {i + 1}
                              </span>
                              {rec.title}
                            </h4>
                            <p className="text-xs sm:text-sm text-slate-600 dark:text-gray-300 leading-relaxed">
                              {rec.detail}
                            </p>
                            {rec.impact && (
                              <div className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 inline-block border border-emerald-200/50 dark:border-emerald-800/50">
                                📈 期待効果: {rec.impact}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* ROI & Impact */}
                    {session.report.roiAndImpact && (
                      <div className="space-y-3">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white border-l-4 border-indigo-600 pl-3">
                          3. 財務・運用面でのROIおよび期待インパクション
                        </h3>
                        <p className="text-sm text-slate-700 dark:text-gray-300 leading-relaxed whitespace-pre-line pl-4">
                          {session.report.roiAndImpact}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT 3: 📊 プレゼン資料案 (Slide Deck Outline) */}
            {activeTab === 'slides' && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-slate-200 dark:border-gray-800 shadow-sm space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-gray-800">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      📊 プレゼンテーション構成案
                    </h2>
                    <p className="text-xs text-slate-500">役員会・社内報告用スライド（全 {session.slides?.length || 0} 枚）</p>
                  </div>
                  <button
                    onClick={() => {
                      const newSlide = {
                        id: `slide_${Date.now()}`,
                        slideNumber: (session.slides?.length || 0) + 1,
                        title: '新規スライドタイトル',
                        bullets: ['ポイント1', 'ポイント2'],
                        speakerNotes: '発表用メモを入力'
                      };
                      setSession((prev) => ({
                        ...prev,
                        slides: [...(prev.slides || []), newSlide]
                      }));
                    }}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 min-h-[44px]"
                  >
                    + スライド追加
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {session.slides?.map((slide, idx) => (
                    <div
                      key={slide.id || idx}
                      className="p-5 rounded-2xl border border-slate-200 dark:border-gray-800 bg-slate-50/70 dark:bg-gray-800/30 space-y-3 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-2">
                          <span>SLIDE {slide.slideNumber || idx + 1}</span>
                          <button
                            onClick={() => {
                              setSession((prev) => ({
                                ...prev,
                                slides: prev.slides.filter((_, i) => i !== idx)
                              }));
                            }}
                            className="text-slate-400 hover:text-red-500"
                          >
                            削除
                          </button>
                        </div>
                        <input
                          type="text"
                          value={slide.title}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSession((prev) => ({
                              ...prev,
                              slides: prev.slides.map((s, i) => (i === idx ? { ...s, title: val } : s))
                            }));
                          }}
                          className="font-bold text-base text-slate-900 dark:text-white bg-transparent w-full focus:outline-none border-b border-slate-200 dark:border-gray-700 pb-1 mb-3"
                        />
                        <ul className="space-y-1.5 text-xs sm:text-sm text-slate-700 dark:text-gray-300 list-disc list-inside">
                          {slide.bullets?.map((bullet, bIdx) => (
                            <li key={bIdx} className="leading-snug">
                              {bullet}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {slide.speakerNotes && (
                        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-gray-800 text-[11px] text-slate-500 dark:text-gray-400 bg-white/60 dark:bg-gray-900/60 p-2.5 rounded-xl">
                          <span className="font-bold block text-slate-700 dark:text-gray-300">🗣️ 発表メモ:</span>
                          {slide.speakerNotes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB CONTENT 4: 🛡️ リスク・課題 & Web解決策 (Risk Matrix with Grounded Search) */}
            {activeTab === 'risks' && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-slate-200 dark:border-gray-800 shadow-sm space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    🛡️ リスク・ボトルネック分析 & Web解決案
                  </h2>
                  <p className="text-xs text-slate-500">
                    識別されたプロジェクトリスクと、Gemini Web検索に基づく業界ベストプラクティス
                  </p>
                </div>

                <div className="space-y-4">
                  {session.risks?.map((risk) => (
                    <div
                      key={risk.id}
                      className="p-5 rounded-2xl border border-slate-200 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-800/20 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${
                                risk.riskLevel === 'High'
                                  ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 border border-red-200 dark:border-red-800'
                                  : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                              }`}
                            >
                              リスク度: {risk.riskLevel}
                            </span>
                            {risk.enriched && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                                🌐 Web検証済み
                              </span>
                            )}
                          </div>
                          <h3 className="font-bold text-slate-900 dark:text-white text-base">
                            {risk.issue}
                          </h3>
                        </div>

                        {/* Grounded Web Search Action Button */}
                        <button
                          onClick={() => handleEnhanceRiskWithWebSearch(risk.id)}
                          disabled={groundedSearchLoading === risk.id}
                          className="px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 text-xs font-bold transition flex items-center gap-1.5 shrink-0 border border-indigo-200 dark:border-indigo-800 min-h-[44px]"
                        >
                          {groundedSearchLoading === risk.id ? (
                            <span>🌐 検索中...</span>
                          ) : (
                            <>
                              <span>🔍</span>
                              <span>Webベストプラクティス検索</span>
                            </>
                          )}
                        </button>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-gray-400">
                        <strong className="text-slate-700 dark:text-gray-300">影響:</strong> {risk.impact}
                      </p>

                      <div className="p-3.5 rounded-xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 text-xs sm:text-sm text-slate-800 dark:text-gray-200 space-y-1">
                        <span className="font-bold text-indigo-600 dark:text-indigo-400 block">
                          💡 推奨解決アプローチ:
                        </span>
                        <p className="leading-relaxed whitespace-pre-line">{risk.solution}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB CONTENT 5: ⚡ タスク看板 (Interactive Task Kanban Board) */}
            {activeTab === 'kanban' && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-slate-200 dark:border-gray-800 shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      ⚡ アクションアイテム・カンバンボード
                    </h2>
                    <p className="text-xs text-slate-500">会議から抽出されたタスクの進捗管理</p>
                  </div>
                  <button
                    onClick={() => {
                      const newTask = {
                        id: `task_${Date.now()}`,
                        title: '新規タスク',
                        assignee: '未割当',
                        dueDate: '未定',
                        priority: 'Medium',
                        status: 'todo'
                      };
                      setSession((prev) => ({ ...prev, tasks: [...prev.tasks, newTask] }));
                    }}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 text-white shadow min-h-[44px]"
                  >
                    + タスク追加
                  </button>
                </div>

                {/* 3 Columns Kanban */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { id: 'todo', title: '⏳ 未着手 (To Do)', color: 'border-slate-300 dark:border-gray-700' },
                    { id: 'in_progress', title: '🚀 進行中 (In Progress)', color: 'border-indigo-400' },
                    { id: 'done', title: '✅ 完了 (Completed)', color: 'border-emerald-400' }
                  ].map((col) => {
                    const colTasks = session.tasks?.filter((t) => (t.status || 'todo') === col.id) || [];
                    return (
                      <div
                        key={col.id}
                        className="bg-slate-50 dark:bg-gray-800/40 p-4 rounded-2xl border border-slate-200 dark:border-gray-800 flex flex-col min-h-[300px]"
                      >
                        <div className="flex items-center justify-between font-bold text-xs text-slate-700 dark:text-gray-300 mb-3 pb-2 border-b border-slate-200 dark:border-gray-700">
                          <span>{col.title}</span>
                          <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-gray-700 text-slate-800 dark:text-gray-200">
                            {colTasks.length}
                          </span>
                        </div>

                        <div className="space-y-3 flex-1">
                          {colTasks.map((task) => (
                            <div
                              key={task.id}
                              className="p-3.5 bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-800 shadow-sm space-y-2"
                            >
                              <p className="font-bold text-xs text-slate-900 dark:text-white">
                                {task.title}
                              </p>
                              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-gray-400">
                                <span>👤 {task.assignee}</span>
                                <span>📅 {task.dueDate}</span>
                              </div>

                              {/* Quick Move Buttons */}
                              <div className="flex items-center justify-end gap-1 pt-2 border-t border-slate-100 dark:border-gray-800">
                                {col.id !== 'todo' && (
                                  <button
                                    onClick={() => handleTaskStatusChange(task.id, 'todo')}
                                    className="text-[10px] px-2 py-1 rounded bg-slate-100 dark:bg-gray-800 hover:bg-slate-200"
                                  >
                                    ← ToDo
                                  </button>
                                )}
                                {col.id !== 'in_progress' && (
                                  <button
                                    onClick={() => handleTaskStatusChange(task.id, 'in_progress')}
                                    className="text-[10px] px-2 py-1 rounded bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300"
                                  >
                                    進行中
                                  </button>
                                )}
                                {col.id !== 'done' && (
                                  <button
                                    onClick={() => handleTaskStatusChange(task.id, 'done')}
                                    className="text-[10px] px-2 py-1 rounded bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300"
                                  >
                                    完了 →
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB CONTENT 6: ✉️ 共有文面 (Slack / Teams / Email Draft Generator) */}
            {activeTab === 'drafts' && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-slate-200 dark:border-gray-800 shadow-sm space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    ✉️ マルチチャネル共有用文面
                  </h2>
                  <p className="text-xs text-slate-500">ワンクリックでSlack、Teams、メールに共有可能</p>
                </div>

                <div className="space-y-6">
                  {/* Slack Format */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                        <span>💬 Slack / LINE Works 用（要点まとめ）</span>
                      </label>
                      <button
                        onClick={() => handleCopyText(session.drafts?.slack || '')}
                        className="text-xs px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300 font-bold min-h-[44px]"
                      >
                        📋 コピー
                      </button>
                    </div>
                    <textarea
                      value={session.drafts?.slack || ''}
                      onChange={(e) =>
                        setSession((prev) => ({
                          ...prev,
                          drafts: { ...prev.drafts, slack: e.target.value }
                        }))
                      }
                      className="w-full h-32 p-3 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-gray-950 font-mono resize-y"
                    />
                  </div>

                  {/* Email Format */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                        <span>✉️ 役員・社内関係者向け公式報告メール</span>
                      </label>
                      <button
                        onClick={() => handleCopyText(session.drafts?.email || '')}
                        className="text-xs px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300 font-bold min-h-[44px]"
                      >
                        📋 コピー
                      </button>
                    </div>
                    <textarea
                      value={session.drafts?.email || ''}
                      onChange={(e) =>
                        setSession((prev) => ({
                          ...prev,
                          drafts: { ...prev.drafts, email: e.target.value }
                        }))
                      }
                      className="w-full h-40 p-3 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-gray-950 font-mono resize-y"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* --- Mobile Bottom Navigation Bar (Screens < 768px) --- */}
      <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-slate-200 dark:border-gray-800 px-2 py-1.5">
        <div className="flex items-center justify-around text-[10px] font-bold">
          {[
            { id: 'minutes', icon: '📝', label: '議事録' },
            { id: 'report', icon: '📄', label: 'レポート' },
            { id: 'slides', icon: '📊', label: 'スライド' },
            { id: 'risks', icon: '🛡️', label: 'リスク' },
            { id: 'kanban', icon: '⚡', label: 'タスク' },
            { id: 'drafts', icon: '✉️', label: '共有' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition min-h-[44px] min-w-[44px] justify-center ${
                activeTab === item.id
                  ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950'
                  : 'text-slate-500 dark:text-gray-400'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* --- SETTINGS & API KEY MODAL --- */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-gray-800 shadow-2xl space-y-5 animate-in fade-in zoom-in">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-gray-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <span>⚙️ アプリケーション・APIキー設定</span>
              </h3>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-gray-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 dark:text-gray-300">
                Gemini API Key (APTキー) 設定:
              </label>
              <input
                type="password"
                value={customApiKey}
                onChange={(e) => {
                  setCustomApiKey(e.target.value);
                  localStorage.setItem('gemini_custom_api_key', e.target.value);
                }}
                placeholder="AI Studio API Key (空白の場合は標準埋め込みキーを使用)"
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-gray-950 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <p className="text-[11px] text-slate-500 dark:text-gray-400 leading-relaxed">
                ※APIキー（APTキー）未指定時も、アプリ内蔵のクライアント接続ロジックによりすぐに動作します。開発者用キーを登録すると制限の上限が拡張されます。
              </p>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-gray-800 flex justify-end">
              <button
                onClick={() => {
                  setShowSettingsModal(false);
                  showToast('⚙️ 設定を保存しました');
                }}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow hover:bg-indigo-500 min-h-[44px]"
              >
                保存して閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- RESET CONFIRMATION MODAL --- */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-sm w-full p-6 border border-slate-200 dark:border-gray-800 shadow-2xl space-y-4">
            <h3 className="font-bold text-slate-900 dark:text-white text-base">
              🧹 セッションを初期化しますか？
            </h3>
            <p className="text-xs text-slate-600 dark:text-gray-400 leading-relaxed">
              入力したテキスト、生成された議事録、およびレポートのデータが消去され初期状態に戻ります。この操作は取り消せません。
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800 transition min-h-[44px]"
              >
                キャンセル
              </button>
              <button
                onClick={handleResetSession}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-500 transition min-h-[44px]"
              >
                初期化を実行
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
