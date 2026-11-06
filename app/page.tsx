"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BarChart3,
  BookOpen,
  Calculator,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  ClipboardCheck,
  Cpu,
  FileSpreadsheet,
  FileText,
  Flag,
  Info,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  RotateCcw,
  Search,
  UserRound,
} from "lucide-react";
import { AccessLoading, LearnerAccess, type LearnerAccount } from "./components/learner-access";
import { HackSprintSponsors } from "./components/hacksprint-sponsors";
import { ExamStageNavigation } from "./components/exam-stage-navigation";
import diagnosisData from "./data/diagnosis.json";
import conceptNoteData from "./data/exam-concept-notes.json";
import evidenceData from "./data/lecture-evidence-top.json";
import keywordData from "./data/keyword-map.json";
import legacyAttemptData from "./data/legacy-attempts.json";
import daytonaHackSprintEvidenceData from "./data/daytona-hacksprint-evidence.json";
import liveEvidencePreviewData from "./data/live-evidence-refresh.mock.json";
import type { CoachRun, LearningHistoryItem } from "./lib/coach";
import { classifyContentKeyword, type KeywordInsight, type KeywordQuestionRef } from "./lib/keyword-taxonomy";

type ChoiceMap = Record<"①" | "②" | "③" | "④", string>;
type View = "today" | "questions" | "exam" | "analysis" | "lectures" | "pipeline";
type QuestionFilter = "all" | "review" | "calculation";
type ExamTrack = "insurance" | "jlpt" | "essay";
type SubjectCode = "BIZ" | "CONTRACT" | "THEORY";
type AnalysisAudience = "learner" | "instructor";
type QuestionDataTable = {
  label: string;
  columns: string[];
  rows: string[][];
};

type JlptQuestion = {
  id: number;
  prompt: string;
  target: string;
  choices: string[];
  answer: number;
  concept: string;
  diagnosis: string;
  nextAction: string;
};

// Newly authored language-reading fixtures; not official JLPT questions.
const jlptQuestions: JlptQuestion[] = [
  { id: 1, prompt: "[DEMO] ここに本があります。", target: "本", choices: ["ほん", "もん", "はん", "へん"], answer: 1, concept: "합성 읽기 · 本", diagnosis: "기본 읽기를 다시 확인하세요.", nextAction: "本을 읽고 예문을 만들어 보기" },
  { id: 2, prompt: "[DEMO] 赤い花を見ました。", target: "赤い", choices: ["あおい", "あかい", "しろい", "くろい"], answer: 2, concept: "합성 읽기 · 赤い", diagnosis: "색 표현의 읽기를 확인하세요.", nextAction: "赤い를 읽고 다른 색과 비교하기" },
  { id: 3, prompt: "[DEMO] 小さな犬がいます。", target: "犬", choices: ["ねこ", "とり", "いぬ", "うま"], answer: 3, concept: "합성 읽기 · 犬", diagnosis: "동물 표현의 읽기를 확인하세요.", nextAction: "犬를 소리 내어 읽기" },
  { id: 4, prompt: "[DEMO] 明日は休みです。", target: "明日", choices: ["あした", "きのう", "きょう", "まいにち"], answer: 1, concept: "합성 읽기 · 明日", diagnosis: "날짜 표현을 확인하세요.", nextAction: "明日를 사용해 문장 만들기" },
  { id: 5, prompt: "[DEMO] 水をください。", target: "水", choices: ["ひ", "つち", "かぜ", "みず"], answer: 4, concept: "합성 읽기 · 水", diagnosis: "기본 명사의 읽기를 확인하세요.", nextAction: "水를 소리 내어 읽기" },
  { id: 6, prompt: "[DEMO] 山が見えます。", target: "山", choices: ["かわ", "やま", "うみ", "そら"], answer: 2, concept: "합성 읽기 · 山", diagnosis: "장소 표현의 읽기를 확인하세요.", nextAction: "山을 다른 장소 표현과 비교하기" },
];

type EssayRubricItem = {
  id: string;
  label: string;
  keywords: string[];
  minMatches: number;
  evidence: string;
  missingAction: string;
};

const essayPrompt = "상법상 손해보험에서 보험자대위의 요건과 효과를 설명하고, 청구권대위에서 피보험자·제3자·보험자의 관계와 입증 구조를 서술하시오.";

const essaySampleAnswer = "보험자대위는 손해가 발생하고 보험자가 보험금을 지급한 때 그 지급한 한도에서 피보험자가 제3자에게 가진 권리가 보험자에게 이전되는 제도이다. 청구권대위에서는 제3자의 책임과 손해 사이의 인과관계가 중요하고, 보험자는 지급 범위 안에서 청구할 수 있다. 따라서 답안은 지급 사실, 권리 이전 범위, 제3자에 대한 청구 순서까지 나누어 써야 한다.";

const essayRubric: EssayRubricItem[] = [
  {
    id: "conditions",
    label: "요건 특정",
    keywords: ["요건", "손해", "지급", "제3자", "권리"],
    minMatches: 3,
    evidence: "손해 발생, 지급, 제3자 권리의 발생 요건을 분리해 쓰는지 확인",
    missingAction: "지급 전후와 제3자 권리 발생 요건을 별도 문장으로 보강",
  },
  {
    id: "effect",
    label: "법률효과",
    keywords: ["이전", "대위", "청구", "범위", "한도"],
    minMatches: 3,
    evidence: "권리 이전, 청구 범위, 지급 한도를 연결하는지 확인",
    missingAction: "대위 효과와 청구 가능 범위를 한 문장으로 정리",
  },
  {
    id: "parties",
    label: "당사자 관계",
    keywords: ["피보험자", "보험자", "제3자", "상대방"],
    minMatches: 2,
    evidence: "피보험자, 지급 주체, 제3자의 관계를 혼동하지 않는지 확인",
    missingAction: "세 당사자의 지위와 권리 이동 방향을 도식처럼 서술",
  },
  {
    id: "proof",
    label: "입증 구조",
    keywords: ["입증", "증명", "책임", "원인", "인과관계"],
    minMatches: 3,
    evidence: "누가 무엇을 증명해야 하는지 답안에 드러나는지 확인",
    missingAction: "입증책임 주체와 증명 대상을 별도 문장으로 추가",
  },
  {
    id: "conclusion",
    label: "결론 문장",
    keywords: ["따라서", "결론", "정리하면", "그러므로"],
    minMatches: 1,
    evidence: "사안 적용 결과를 마지막에 정리하는지 확인",
    missingAction: "따라서로 시작하는 적용 결론 문장을 마지막에 추가",
  },
];

type Question = {
  id: string;
  subject: string;
  subjectCode: SubjectCode;
  round: number;
  questionNo: number;
  questionText: string;
  presentation?: {
    prompt: string;
    context?: { label: "사례" | "제시문" | "계약 조건"; text: string } | null;
    dataTable?: QuestionDataTable | null;
    statements: Array<{ marker: string; text: string }>;
    structure: "korean-statements" | "latin-statements" | "bullet-statements" | "context-only" | "context-data";
  } | null;
  choices: ChoiceMap;
  answer: string;
  domain: string;
  concept: string;
  keywords: string[];
  trapType: string;
  numericType: string;
  questionForm: string;
  sourceFile: string;
  classificationSource?: string;
};

type ExamQuestion = Omit<Question, "answer">;

type ExamResult = {
  correct: boolean;
  acceptedAnswers: string[];
};

type ExamConceptNote = {
  title: string;
  points: Array<{ term: string; description: string }>;
  conclusion: string;
};

type ExamSession = {
  answers: Record<string, string>;
  submitted: boolean;
  startedAt?: string;
  submissionId?: string;
  score?: number;
  submittedAt?: string;
  results?: Record<string, ExamResult>;
  serverSaved?: boolean;
  serverAttemptNo?: number;
  reviewTasksScheduled?: number;
};

type LegacyAttemptRecord = {
  questionId: string;
  questionNo: number;
  concept: string;
  domain: string;
  rawEntry: string;
  selectedChoice: string | null;
  correct: boolean;
  acceptedAnswers: string[];
  recordState: "answered" | "marked-unknown";
};

type LegacyAttempt = {
  id: string;
  round: number;
  subject: string;
  subjectCode: SubjectCode;
  attemptNo: number;
  score: number;
  total: number;
  percentage: number;
  recordCount: number;
  choiceCount: number;
  unknownMarkCount: number;
  sourceSheet: string;
  recordedAt: null;
  records: LegacyAttemptRecord[];
};

type LegacyAttemptPayload = {
  metadata: {
    sourceType: string;
    sourceFile: string;
    attemptCount: number;
    questionRecordCount: number;
    explicitChoiceCount: number;
    unknownMarkCount: number;
    averageScore: number;
    gradingSource: string;
    recordedAtPolicy: string;
    unknownMarkPolicy: string;
  };
  attempts: LegacyAttempt[];
};

type RoundAnalytics = {
  round: number;
  total: number;
  caseCount: number;
  numericCount: number;
  directCalculationCount: number;
  combinationCount: number;
  negativeCount: number;
  averageStemLength: number;
  answerDistribution: Record<string, number>;
  numericTypes: Record<string, number>;
  questionForms: Record<string, number>;
  classificationSources: Record<string, number>;
};

type AnalyticsPayload = {
  scope: SubjectCode | "ALL";
  total: number;
  rounds: RoundAnalytics[];
  keywordInsights: KeywordInsight[];
  source: string;
  method: string;
};

type PersonalKeywordInsight = KeywordInsight & {
  attemptedQuestionCount: number;
  accuracy: number | null;
  repeatedWrongCount: number;
  trendScore: number;
  weaknessScore: number;
  repeatScore: number;
  priorityScore: number | null;
  targetQuestion: KeywordQuestionRef | null;
};

function keywordStudyCopy(insight: PersonalKeywordInsight) {
  const targetLabel = insight.targetQuestion
    ? `제${insight.targetQuestion.round}회 ${insight.targetQuestion.questionNo}번`
    : null;
  if (insight.accuracy === null) {
    return {
      reason: "개인 풀이 기록이 없습니다. 취약도는 계산하지 않고, 출제된 회차 수만 순위에 사용합니다.",
      action: targetLabel ? `${targetLabel} 문항으로 진단을 시작합니다.` : "연결할 연습문항이 없습니다.",
    };
  }
  const record = `최근 기록 정답률 ${insight.accuracy}% · ${insight.attemptedQuestionCount}문항 측정 · 반복 오답 ${insight.repeatedWrongCount}문항`;
  if (insight.repeatedWrongCount > 0) {
    return {
      reason: `${record}. 같은 키워드에서 두 번 이상 틀린 기록이 있습니다.`,
      action: targetLabel ? `${targetLabel} 최근 오답 문항을 다시 풉니다.` : "다시 풀 문항이 없습니다.",
    };
  }
  if (insight.accuracy < 100) {
    return {
      reason: `${record}. 반복 오답은 없고, 최근 결과 중 오답이 있습니다.`,
      action: targetLabel ? `${targetLabel} 문항을 다시 확인합니다.` : "다시 볼 문항이 없습니다.",
    };
  }
  return {
    reason: `${record}.`,
    action: targetLabel ? `${targetLabel} 문항을 한 번 더 확인합니다.` : "확인할 문항이 없습니다.",
  };
}

type Diagnostic = {
  id: string;
  round?: number;
  questionNo: number;
  correct: number;
  attempts: Array<number | string | null>;
  status: string;
  priorityScore: number | null;
  priority: string;
  domain: string;
  concept: string;
  trapType: string;
  numericType: string;
  diagnosis: string;
  nextAction: string;
  lectureSearchQuery: string;
  sourceNote?: string;
  recordSummary?: string;
  priorityComponents?: Array<{ label: string; score: number; reason: string }>;
};

type CalculationPattern = {
  id: string;
  subject: string;
  questionNo: number;
  numericType: string;
  concept: string;
  formulaOrRule: string;
  commonWrongPath: string;
  difficulty: string;
  qualityStatus: string;
};

type EvidenceIndex = {
  matches: Record<string, NonNullable<CoachRun["evidence"]>[]>;
};

type SponsorPayload = {
  sponsors: Array<{
    id: string;
    name: string;
    role: string;
    codePath: string;
    requiredSecrets: string[];
    adapterReady: boolean;
    configured: boolean;
    verified: boolean;
    state: string;
    proof: string;
  }>;
  adapterReadyCount: number;
  configuredCount: number;
  verifiedCount: number;
  integrationCount: number;
  lastCheckedAt: string | null;
  checkMode: "dry-run" | "live";
};

const daytonaEventSponsorFallback: SponsorPayload["sponsors"] = [
  {
    id: "daytona",
    name: "Daytona",
    role: "1,200문항의 ID·정답·보기 구조를 격리 샌드박스에서 검증",
    codePath: "scripts/sponsors/daytona_validate.mjs",
    requiredSecrets: [],
    adapterReady: true,
    configured: false,
    verified: false,
    state: "API 키 설정 후 실행",
    proof: "Sandbox ID·실행 시각·고유 ID 1,200개·누락 0건을 receipt로 표시",
  },
  {
    id: "nosana",
    name: "Nosana",
    role: "합성 예시로 AI 복습 제안 생성",
    codePath: "app/lib/hacksprint-sponsors.ts",
    requiredSecrets: [],
    adapterReady: true,
    configured: false,
    verified: false,
    state: "API 키 설정 후 실행",
    proof: "이 공개 실행 환경에서 아직 검증하지 않았습니다.",
  },
];

type DaytonaHackSprintEvidence = {
  event: string;
  verifiedAtKst: string;
  provider: string;
  keyScope: string;
  sandboxId: string;
  command: string;
  sourcePath: string;
  result: {
    questionCount: number;
    uniqueIds: number;
    subjectCount: number;
    roundRange: string;
    invalidChoiceCounts: number;
    missingAnswers: number;
    valid: boolean;
  };
  secretBoundary: string;
};

const daytonaHackSprintEvidence = daytonaHackSprintEvidenceData as DaytonaHackSprintEvidence;

type DaytonaRunPayload = {
  status: "verified" | "fallback" | "failed";
  reason: string;
  message: string;
  checkedAtKst: string;
  receipt: DaytonaHackSprintEvidence;
  fallbackReceipt?: DaytonaHackSprintEvidence;
  fallbackUsed: boolean;
};

function formatDaytonaSandboxDisplayId(sandboxId: string) {
  return sandboxId.length > 16 ? `${sandboxId.slice(0, 8)}…${sandboxId.slice(-6)}` : sandboxId;
}

type InstructorInsightPayload = {
  available: boolean;
  dataset: {
    origin: "synthetic";
    label: string;
    batchId: string;
    generatedAt: string;
    learnerCount: number;
    attemptCount: number;
    answerCount: number;
    averageAccuracy: number;
  } | null;
  realData: { learnerCount: number; attemptCount: number };
  insights: Array<{
    id: string;
    subjectCode: SubjectCode;
    subject: string;
    domain: string;
    concept: string;
    learnerCount: number;
    wrongLearners: number;
    answerCount: number;
    wrongCount: number;
    accuracy: number;
    wrongRate: number;
    demandScore: number;
    baselineDemandScore: number;
    recommendation: string;
    reason: string;
    validation: string;
    dominantWrongQuestionId: string | null;
    dominantWrongQuestionNo: number | null;
    dominantWrongChoice: string | null;
    dominantWrongChoiceText: string | null;
    dominantWrongChoiceCount: number;
    dominantWrongLearners: number;
    confusionCode: string | null;
    confusionLabel: string | null;
    confusionSource: string;
    intervention: {
      id: string;
      status: "applied" | "measured" | string;
      actionType: "explanation" | "drill" | "recall";
      actionLabel: string;
      appliedAt: string;
      evidence: { material: string; page: number | null } | null;
      baseline: {
        answerCount: number;
        accuracy: number;
        targetChoiceRate: number;
        affectedLearners: number;
      };
      post: {
        answerCount: number;
        accuracy: number | null;
        targetChoiceRate: number | null;
        affectedLearners: number;
      };
      effect: {
        accuracyChange: number | null;
        targetChoiceRateChange: number | null;
        residualConfusionRate: number | null;
        updatedDemandScore: number | null;
        measurementReady: boolean;
      };
    } | null;
  }>;
  scoring: string;
};

type ReviewQueueItem = {
  id: string;
  questionId: string;
  concept: string;
  confusionCode: string | null;
  confusionLabel: string | null;
  evidence: { material: string; page: number | null } | null;
  dueAt: string;
  status: "pending" | "due";
  repeatCount: number;
  intervention: { id: string; action: string | null } | null;
};

type ServerAttemptSummary = {
  id: string;
  round: number;
  subjectCode: SubjectCode;
  attemptNo: number;
  score: number;
  total: number;
  startedAt: string | null;
  submittedAt: string;
};

const symbols = ["①", "②", "③", "④"] as const;
const reviewStatuses = new Set(["불안정", "개선", "고정취약"]);
const answerNumbers: Record<string, number> = { "①": 1, "②": 2, "③": 3, "④": 4 };
const subjectOptions: Array<{
  code: SubjectCode;
  name: string;
  note: string;
  hasDiagnostics: boolean;
}> = [
  { code: "BIZ", name: "보험업법", note: "40문항 · 진단 대기", hasDiagnostics: false },
  { code: "CONTRACT", name: "보험계약법", note: "40문항 · 진단 대기", hasDiagnostics: false },
  { code: "THEORY", name: "손해사정이론", note: "40문항 · 2회독", hasDiagnostics: true },
];
const legacyPayload = legacyAttemptData as LegacyAttemptPayload;

function StatusPill({ status }: { status: string }) {
  const className = status === "불안정" || status.includes("오답") || status.includes("실패")
    ? "unstable"
    : status === "개선" || status.includes("정답") || status.includes("검증 완료")
      ? "improved"
      : status === "미진단" || status === "임시 매핑" || status === "풀이 중" || status.includes("대기") || status === "연결 대기"
        ? "pending"
        : "stable";
  return <span className={`status-pill ${className}`}>{status}</span>;
}

function pendingDiagnostic(question: Question): Diagnostic {
  return {
    id: question.id,
    questionNo: question.questionNo,
    correct: answerNumbers[question.answer] ?? 0,
    attempts: [null, null, null],
    status: "미진단",
    priorityScore: null,
    priority: "측정 대기",
    domain: question.domain,
    concept: question.concept,
    trapType: question.trapType,
    numericType: question.numericType,
    diagnosis: "풀이 기록 연결 대기",
    nextAction: "첫 답안을 저장하면 오답 패턴과 복습 우선도를 계산합니다.",
    lectureSearchQuery: `${question.domain} > ${question.concept} > ${question.keywords.slice(0, 3).join(" · ")}`,
  };
}

function buildLectureCandidates(
  round: number,
  subject: SubjectCode,
  appHistory: LearningHistoryItem[],
  questionLookup: Map<string, Question>,
) {
  const points = legacyPayload.attempts
    .filter((attempt) => attempt.round === round && attempt.subjectCode === subject)
    .sort((a, b) => a.attemptNo - b.attemptNo)
    .flatMap((attempt) => attempt.records.map((record) => ({
      questionId: record.questionId,
      questionNo: record.questionNo,
      concept: record.concept,
      domain: record.domain,
      correct: record.correct,
      selectedChoice: record.selectedChoice,
    })));

  appHistory.forEach((item) => {
    if (!item.questionId.startsWith(`${round}-${subject}-`)) return;
    const question = questionLookup.get(item.questionId);
    points.push({
      questionId: item.questionId,
      questionNo: question?.questionNo ?? Number(item.questionId.split("-").at(-1)),
      concept: question?.concept ?? item.concept,
      domain: question?.domain ?? "개념 진단",
      correct: item.correct,
      selectedChoice: null,
    });
  });

  const grouped = new Map<string, typeof points>();
  points.forEach((point) => grouped.set(point.questionId, [...(grouped.get(point.questionId) ?? []), point]));

  return Array.from(grouped.entries()).flatMap(([id, records]) => {
    const wrongCount = records.filter((record) => !record.correct).length;
    if (wrongCount === 0) return [];
    const latest = records.at(-1)!;
    const indexed = (diagnosisData.diagnostics as Diagnostic[]).find((item) => item.id === id);
    const status = latest.correct ? "개선" : wrongCount >= 2 ? "고정취약" : "불안정";
    const classified = classifyContentKeyword({
      id,
      round,
      subject: subjectOptions.find((option) => option.code === subject)?.name ?? subject,
      subjectCode: subject,
      questionNo: latest.questionNo,
      questionText: latest.concept,
      choices: {},
      domain: latest.domain,
      concept: latest.concept,
      keywords: [latest.domain],
      numericType: indexed?.numericType ?? "없음",
      questionForm: "",
    });
    const concept = indexed?.concept ?? classified.keyword;
    const domain = indexed?.domain ?? classified.area;
    const hasMixedResults = records.some((record) => record.correct) && records.some((record) => !record.correct);
    const priorityComponents = indexed ? undefined : [
      {
        label: "최근 정오",
        score: latest.correct ? 8 : 36,
        reason: latest.correct ? "최근 답안은 정답" : "최근 답안이 오답",
      },
      {
        label: "반복 오답",
        score: Math.min(24, wrongCount * 12),
        reason: `저장된 오답 ${wrongCount}회`,
      },
      {
        label: "회독 변동",
        score: hasMixedResults ? 18 : 0,
        reason: hasMixedResults ? "회독 사이 정오가 바뀜" : "회독 결과 변동 없음",
      },
      {
        label: "문항 복잡도",
        score: indexed?.numericType && indexed.numericType !== "없음" ? 16 : 4,
        reason: indexed?.numericType && indexed.numericType !== "없음" ? indexed.numericType : "일반 개념 문항",
      },
      {
        label: "재검 시급성",
        score: latest.correct ? 3 : 10,
        reason: latest.correct ? "간격복습 후보" : "다음 학습에서 재검 필요",
      },
    ];
    const calculatedPriority = priorityComponents?.reduce((sum, component) => sum + component.score, 0) ?? 0;
    const priorityScore = indexed?.priorityScore ?? Math.min(100, calculatedPriority);
    return [{
      id,
      round,
      questionNo: latest.questionNo,
      correct: indexed?.correct ?? 0,
      attempts: indexed?.attempts ?? records.slice(-3).map((record) => record.selectedChoice ? answerNumbers[record.selectedChoice] : record.correct ? "정답" : "오답"),
      status: indexed?.status ?? status,
      priorityScore,
      priority: indexed?.priority ?? (priorityScore >= 85 ? "긴급" : priorityScore >= 65 ? "높음" : "보통"),
      domain,
      concept,
      trapType: indexed?.trapType ?? (wrongCount >= 2 ? "반복 오답" : "오답 기록"),
      numericType: indexed?.numericType ?? "없음",
      diagnosis: indexed?.diagnosis ?? (latest.correct ? `${wrongCount}회 오답 뒤 최근 정답` : `${wrongCount}회 오답 기록`),
      nextAction: indexed?.nextAction ?? (latest.correct
        ? "개선된 개념입니다. 같은 개념의 변형 문항으로 유지 여부를 확인합니다."
        : "강사 자료에서 해당 개념의 판단 기준을 확인한 뒤 같은 회차 문항을 다시 풉니다."),
      lectureSearchQuery: indexed?.lectureSearchQuery ?? `${domain} > ${concept}`,
      sourceNote: indexed?.sourceNote,
      recordSummary: `제${round}회 · 저장된 풀이 ${records.length}건 · 오답 ${wrongCount}회`,
      priorityComponents,
    } satisfies Diagnostic];
  }).sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0) || a.questionNo - b.questionNo).slice(0, 12);
}

function buildTodayQueue(
  subject: SubjectCode,
  appHistory: LearningHistoryItem[],
  questionLookup: Map<string, Question>,
) {
  return Array.from({ length: 10 }, (_, index) => index + 40)
    .flatMap((round) => buildLectureCandidates(round, subject, appHistory, questionLookup))
    .sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0) || (b.round ?? 0) - (a.round ?? 0) || a.questionNo - b.questionNo)
    .slice(0, 12);
}

function PriorityIndex({ item, run }: { item: Diagnostic; run?: CoachRun }) {
  if (run) {
    return (
      <button className="priority-wrap" type="button" aria-label={`복습 우선도 ${run.priority.score}. 시험 점수나 정답률이 아닙니다.`}>
        <span className="priority-score"><b>{run.priority.score}</b><small>우선도</small></span>
        <span className="priority-tooltip" role="tooltip">
          <strong>복습 우선도 {run.priority.score} · {run.priority.level}</strong>
          <em>시험 점수나 정답률이 아닙니다.</em>
          {run.priority.components.map((component) => (
            <span key={component.label} title={component.reason}>{component.label}<b>+{component.score}</b></span>
          ))}
          <small>현재 답안·반복 혼동·회독 변동·문항 복잡도·재검 시급성의 합계</small>
        </span>
      </button>
    );
  }

  if (item.priorityScore === null) {
    return (
      <button className="priority-wrap pending" type="button">
        <span className="priority-score"><b>-</b><small>측정 전</small></span>
        <span className="priority-tooltip" role="tooltip">
          <strong>복습 우선도 측정 전</strong>
          <em>풀이 기록을 연결하면 계산됩니다.</em>
        </span>
      </button>
    );
  }

  if (item.priorityComponents?.length) {
    return (
      <button className="priority-wrap" type="button" aria-label={`복습 우선도 ${item.priorityScore}. 시험 점수나 정답률이 아닙니다.`}>
        <span className="priority-score"><b>{item.priorityScore}</b><small>우선도</small></span>
        <span className="priority-tooltip" role="tooltip">
          <strong>복습 우선도 {item.priorityScore} · {item.priority}</strong>
          <em>시험 점수나 정답률이 아닙니다.</em>
          {item.priorityComponents.map((component) => (
            <span key={component.label} title={component.reason}>{component.label}<b>+{component.score}</b></span>
          ))}
          <small>최근 정오·반복 오답·회독 변동·문항 복잡도·재검 시급성의 합계</small>
        </span>
      </button>
    );
  }

  const statusScore = diagnosisData.rules.statusRules.find((rule) => rule.status === item.status)?.score ?? 0;
  const numericScore = diagnosisData.rules.numericWeights.find((rule) => rule.numericType === item.numericType)?.weight ?? 0;
  const noteScore = item.sourceNote ? 5 : 0;

  return (
    <button className="priority-wrap" type="button" aria-label={`복습 우선도 ${item.priorityScore}. 시험 점수나 정답률이 아닙니다.`}>
      <span className="priority-score"><b>{item.priorityScore}</b><small>우선도</small></span>
      <span className="priority-tooltip" role="tooltip">
        <strong>복습 우선도 {item.priorityScore}</strong>
        <em>시험 점수나 정답률이 아닙니다.</em>
        <span>학습상태 <b>{statusScore}</b></span>
        <span>수치유형 <b>+{numericScore}</b></span>
        <span>원문메모 <b>+{noteScore}</b></span>
        <small>현재 산식: {statusScore} + {numericScore} + {noteScore}</small>
      </span>
    </button>
  );
}

function StructuredQuestionData({ table }: { table: QuestionDataTable }) {
  return (
    <section className="question-data" aria-label={table.label}>
      <span>{table.label}</span>
      <table>
        <thead><tr>{table.columns.map((column) => <th key={column} scope="col">{column}</th>)}</tr></thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={`${table.label}-${rowIndex}`}>
              {row.map((cell, cellIndex) => <td key={`${cell}-${cellIndex}`}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function JlptExperiment({ onBack }: { onBack: () => void }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const question = jlptQuestions[index];
  const selected = answers[question.id];
  const answered = selected !== undefined;
  const correct = answered && selected === question.answer;
  const completed = Object.keys(answers).length;
  const score = Object.entries(answers).filter(([id, choice]) =>
    jlptQuestions.find((item) => item.id === Number(id))?.answer === choice,
  ).length;
  const answeredItems = jlptQuestions.filter((item) => answers[item.id] !== undefined);
  const missedItems = answeredItems.filter((item) => answers[item.id] !== item.answer);
  const stableItems = answeredItems.filter((item) => answers[item.id] === item.answer);
  const completionRate = Math.round((completed / jlptQuestions.length) * 100);
  const skillRows = [
    { label: "한자음 읽기", matcher: (item: JlptQuestion) => item.concept.includes("한자음") },
    { label: "훈독 읽기", matcher: (item: JlptQuestion) => item.concept.includes("훈독") },
    { label: "탁음 구별", matcher: (item: JlptQuestion) => item.concept.includes("탁음") },
    { label: "관용 음독", matcher: (item: JlptQuestion) => item.concept.includes("관용") },
  ].map((skill) => {
    const items = jlptQuestions.filter(skill.matcher);
    const attempted = items.filter((item) => answers[item.id] !== undefined);
    const missed = attempted.filter((item) => answers[item.id] !== item.answer);
    return {
      label: skill.label,
      total: items.length,
      attempted: attempted.length,
      missed: missed.length,
      rate: attempted.length ? Math.round(((attempted.length - missed.length) / attempted.length) * 100) : null,
    };
  });
  const weakestSkill = skillRows
    .filter((item) => item.attempted > 0)
    .sort((a, b) => b.missed - a.missed || b.total - a.total)[0];
  const generalityTrace = [
    { label: "문항", value: "일본어 합성 읽기 예시", note: "문항 텍스트와 보기 구조만 바꿔 동일 풀이 루프를 사용" },
    { label: "진단", value: "개념 · 흔들림 원인 · 다음 행동", note: "손해사정사 오답 진단 필드를 외국어 학습에도 재사용" },
    { label: "경계", value: "실험 화면", note: "공식 JLPT 문항·난도·성과가 아닌 합성 입력의 동작 예시" },
  ];

  function choose(choice: number) {
    if (answered) return;
    setAnswers((current) => ({ ...current, [question.id]: choice }));
  }

  function reset() {
    setAnswers({});
    setIndex(0);
  }

  return (
    <main className="jlpt-shell">
      <header className="jlpt-header">
        <div className="jlpt-brand"><span>EC</span><div><strong>Exam Coach</strong><small>범용성 실험 · 합성 일본어</small></div></div>
        <button className="track-switch" onClick={onBack} type="button">손해사정사 모드</button>
      </header>
      <section className="jlpt-workspace">
        <div className="jlpt-title-row">
          <div><p className="eyebrow">2018 · 언어지식 · 문자·어휘</p><h1>읽기 6문항 진단</h1></div>
          <div className="jlpt-score"><span>진행 {completed}/6</span><strong>{score}<small> 정답</small></strong></div>
        </div>
        <div className="jlpt-progress" aria-label={`6문항 중 ${completed}문항 완료`}><i style={{ width: `${(completed / 6) * 100}%` }} /></div>
        <div className="jlpt-grid">
          <nav className="jlpt-question-nav" aria-label="문항 이동">
            <span className="section-label">문항</span>
            <div>
              {jlptQuestions.map((item, itemIndex) => (
                <button
                  className={`${itemIndex === index ? "active" : ""} ${answers[item.id] !== undefined ? (answers[item.id] === item.answer ? "done" : "missed") : ""}`}
                  key={item.id}
                  onClick={() => setIndex(itemIndex)}
                  type="button"
                >
                  {item.id}
                </button>
              ))}
            </div>
            <p>초록은 정답, 빨강은 복습 대상이에요.</p>
          </nav>
          <section className="jlpt-card">
            <div className="jlpt-question-meta"><span>문제 1 · Q{question.id}</span><b>가장 알맞은 읽기를 고르세요</b></div>
            <h2>{question.prompt.split(question.target).map((part, partIndex, parts) => <span key={`${part}-${partIndex}`}>{part}{partIndex < parts.length - 1 && <mark>{question.target}</mark>}</span>)}</h2>
            <div className="jlpt-choices">
              {question.choices.map((choice, choiceIndex) => {
                const number = choiceIndex + 1;
                const className = answered ? number === question.answer ? "correct" : number === selected ? "wrong" : "" : "";
                return <button className={className} disabled={answered} key={choice} onClick={() => choose(number)} type="button"><b>{symbols[choiceIndex]}</b><span>{choice}</span>{answered && number === question.answer && <Check aria-label="정답" />}</button>;
              })}
            </div>
            {!answered && <div className="jlpt-guide">답을 선택하면 정답보다 먼저 <strong>왜 흔들렸는지</strong>와 다음 행동을 보여줘요.</div>}
            {answered && <div className={`jlpt-result ${correct ? "correct" : "wrong"}`}><span>{correct ? "정답 · 현재 안정" : "오답 · 복습 우선"}</span><h3>{question.concept}</h3><p>{correct ? "읽기와 표기가 정확하게 연결됐어요." : question.diagnosis}</p><dl><dt>다음 행동</dt><dd>{correct ? "현재 복습큐에서 제외하고 간격복습 대기" : question.nextAction}</dd></dl></div>}
            <footer className="jlpt-actions">
              <button disabled={index === 0} onClick={() => setIndex((current) => current - 1)} type="button">이전</button>
              {index < jlptQuestions.length - 1
                ? <button className="primary-button" disabled={!answered} onClick={() => setIndex((current) => current + 1)} type="button">다음 문항 <ChevronRight aria-hidden="true" /></button>
                : <button className="primary-button" disabled={completed < 6} onClick={reset} type="button"><RotateCcw aria-hidden="true" /> 다시 진단</button>}
            </footer>
          </section>
        </div>
        <section className="jlpt-analysis-summary" aria-labelledby="jlpt-analysis-title">
          <div className="jlpt-analysis-heading">
            <div>
              <p className="eyebrow">Generalization proof</p>
              <h2 id="jlpt-analysis-title">일본어 합성 예시 분석</h2>
              <p>손해사정사 전용 화면이 아니라, 문제은행형 시험이면 문항·개념·오답 원인·다음 행동으로 같은 진단 구조를 재사용할 수 있음을 보여주는 흔적입니다.</p>
            </div>
            <div className="jlpt-analysis-score">
              <span>분석 생성</span>
              <strong>{completed ? "활성" : "대기"}</strong>
              <small>{completionRate}% 응답 기반</small>
            </div>
          </div>
          <div className="jlpt-analysis-grid">
            <article className="jlpt-analysis-card">
              <span>현재 요약</span>
              <dl>
                <div><dt>정답</dt><dd>{score} / {completed || 0}</dd></div>
                <div><dt>복습 후보</dt><dd>{missedItems.length}개</dd></div>
                <div><dt>안정 개념</dt><dd>{stableItems.length}개</dd></div>
                <div><dt>우선 보강</dt><dd>{weakestSkill?.missed ? weakestSkill.label : completed ? "유지 복습" : "응답 대기"}</dd></div>
              </dl>
            </article>
            <article className="jlpt-analysis-card">
              <span>문자·어휘 skill map</span>
              <div className="jlpt-skill-list">
                {skillRows.map((skill) => (
                  <div key={skill.label}>
                    <b>{skill.label}</b>
                    <span>{skill.attempted}/{skill.total} 응답 · {skill.missed} 오답</span>
                    <i style={{ width: `${skill.rate ?? 0}%` }} />
                  </div>
                ))}
              </div>
            </article>
            <article className="jlpt-analysis-card review">
              <span>다음 학습 큐</span>
              {missedItems.length ? (
                <ol>
                  {missedItems.map((item) => (
                    <li key={item.id}><b>Q{item.id} · {item.concept}</b><small>{item.nextAction}</small></li>
                  ))}
                </ol>
              ) : (
                <p>{completed ? "현재 오답은 없습니다. 같은 유형 변형 1세트로 유지 여부를 확인하면 됩니다." : "문항을 풀면 오답 개념과 다음 행동이 여기에 쌓입니다."}</p>
              )}
            </article>
            <article className="jlpt-analysis-card proof">
              <span>제품 확장 흔적</span>
              {generalityTrace.map((item) => (
                <div key={item.label}><b>{item.label}</b><strong>{item.value}</strong><small>{item.note}</small></div>
              ))}
            </article>
          </div>
        </section>
      </section>
    </main>
  );
}

function analyzeEssayAnswer(answer: string) {
  const normalized = answer.replace(/\s+/g, " ").trim();
  const rubricRows = essayRubric.map((item) => {
    const matched = item.keywords.filter((keyword) => normalized.includes(keyword));
    return {
      ...item,
      matched,
      covered: matched.length >= item.minMatches,
    };
  });
  const coveredCount = rubricRows.filter((item) => item.covered).length;
  const missingRows = rubricRows.filter((item) => !item.covered);
  const sentences = normalized
    .split(/[.!?。！？]\s*/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const longSentenceCount = sentences.filter((sentence) => sentence.length > 95).length;
  const absoluteTerms = normalized.match(/항상|무조건|반드시|전부/g) ?? [];
  const sentenceRisks = [
    ...(longSentenceCount ? [`95자 이상 긴 문장 ${longSentenceCount}개: 채점자가 논점 경계를 놓칠 수 있습니다.`] : []),
    ...(absoluteTerms.length ? [`단정 표현 ${Array.from(new Set(absoluteTerms)).join(", ")}: 근거 없는 절대 표현은 감점 위험입니다.`] : []),
    ...(normalized.length < 160 ? ["답안 길이가 짧습니다: 요건·효과·사안 적용이 한 덩어리로 뭉칠 수 있습니다."] : []),
  ];

  return {
    rubricRows,
    coveredCount,
    missingRows,
    sentenceRisks,
    wordCount: normalized ? normalized.split(" ").length : 0,
    charCount: normalized.length,
    readiness: Math.round((coveredCount / essayRubric.length) * 100),
  };
}

function EssayExperiment({ onBack }: { onBack: () => void }) {
  const [answer, setAnswer] = useState(essaySampleAnswer);
  const [analysisState, setAnalysisState] = useState("샘플 분석");
  const essayAnalysis = analyzeEssayAnswer(answer);
  const firstMissing = essayAnalysis.missingRows[0];
  const nextAction = firstMissing
    ? `${firstMissing.label}: ${firstMissing.missingAction}`
    : "같은 구조로 사례형 조건을 바꿔 1문항 더 검증";
  const dependencyRows = [
    { label: "짧은 입력", value: "UI 필수 의존성 낮음", note: "한 명의 typed answer는 로컬 rubric 분석만으로도 데모 가능" },
    { label: "대량 답안", value: "검증 의존성 상승", note: "여러 답안을 같은 rubric 버전으로 반복 실행하고 결과를 비교해야 함" },
    { label: "증거 제출", value: "receipt 가치 상승", note: "샌드박스 ID, 실행 시각, rubric 버전, 처리 건수를 남기기 좋음" },
  ];

  return (
    <main className="essay-shell">
      <header className="jlpt-header">
        <div className="jlpt-brand"><span>EC</span><div><strong>Exam Coach</strong><small>범용성 실험 · 2차 주관식</small></div></div>
        <button className="track-switch" onClick={onBack} type="button">손해사정사 모드</button>
      </header>
      <section className="essay-workspace">
        <div className="essay-title-row">
          <div>
            <p className="eyebrow">Generalization proof · 2차 주관식</p>
            <h1>서술 답안 구조 진단</h1>
            <p>객관식 정오를 넘어, 문장형 답안에서 논점·근거·입증 구조·결론 문장을 분리해 보는 얇은 확장 실험입니다.</p>
          </div>
          <div className="essay-score-card">
            <span>논점 커버리지</span>
            <strong>{essayAnalysis.coveredCount}<small> / {essayRubric.length}</small></strong>
            <i style={{ width: `${essayAnalysis.readiness}%` }} />
          </div>
        </div>

        <div className="essay-proof-strip">
          <section><span>입력 형태</span><strong>문장형 답안</strong><small>선택지가 아니라 서술 텍스트를 분석</small></section>
          <section><span>분석 단위</span><strong>논점 · 근거 · 문장</strong><small>rubric coverage와 sentence risk 분리</small></section>
          <section><span>경계</span><strong>확장 가능성 검증</strong><small>공식 채점·합격 예측 claim 아님</small></section>
        </div>

        <div className="essay-grid">
          <section className="essay-input-card">
            <div>
              <p className="eyebrow">Prompt</p>
              <h2>상법·계약형 주관식 샘플</h2>
              <p>{essayPrompt}</p>
            </div>
            <label htmlFor="essay-answer">답안 입력</label>
            <textarea
              id="essay-answer"
              onChange={(event) => {
                setAnswer(event.target.value);
                setAnalysisState("입력 반영");
              }}
              value={answer}
            />
            <footer className="essay-actions">
              <button
                className="primary-button"
                onClick={() => setAnalysisState("방금 분석 완료")}
                type="button"
              >
                <FileText aria-hidden="true" /> 샘플 답안 분석
              </button>
              <button
                onClick={() => {
                  setAnswer(essaySampleAnswer);
                  setAnalysisState("샘플 복원");
                }}
                type="button"
              >
                <RotateCcw aria-hidden="true" /> 답안 초기화
              </button>
            </footer>
          </section>

          <section className="essay-analysis-shell" aria-labelledby="essay-analysis-title">
            <div className="essay-analysis-heading">
              <div><p className="eyebrow">Analysis</p><h2 id="essay-analysis-title">논점별 답안 진단</h2></div>
              <span>{analysisState}</span>
            </div>
            <div className="essay-metric-row">
              <div><span>문자 수</span><strong>{essayAnalysis.charCount}</strong></div>
              <div><span>단어 추정</span><strong>{essayAnalysis.wordCount}</strong></div>
              <div><span>문장 위험</span><strong>{essayAnalysis.sentenceRisks.length}</strong></div>
            </div>
            <div className="essay-rubric-list">
              {essayAnalysis.rubricRows.map((item) => (
                <article className={item.covered ? "covered" : "missing"} key={item.id}>
                  <span>{item.covered ? "충족" : "보강"}</span>
                  <h3>{item.label}</h3>
                  <p>{item.covered ? item.evidence : item.missingAction}</p>
                  <small>감지 키워드: {item.matched.length ? item.matched.join(", ") : "없음"}</small>
                </article>
              ))}
            </div>
            <div className="essay-next-panel">
              <section>
                <span>다음 보강</span>
                <strong>{nextAction}</strong>
              </section>
              <section>
                <span>문장 위험</span>
                {essayAnalysis.sentenceRisks.length ? (
                  <ul>{essayAnalysis.sentenceRisks.map((risk) => <li key={risk}>{risk}</li>)}</ul>
                ) : (
                  <p>긴 문장과 근거 없는 절대 표현은 아직 감지되지 않았습니다.</p>
                )}
              </section>
            </div>
          </section>
        </div>

        <section className="essay-daytona-panel" aria-labelledby="essay-daytona-title">
          <div>
            <p className="eyebrow">Runtime dependency</p>
            <h2 id="essay-daytona-title">Daytona 의존성 판단</h2>
            <p>짧은 typed-answer demo에서는 Daytona가 필수 UI 의존성은 아닙니다. 하지만 2차 주관식으로 확장되어 많은 답안, rubric 버전, 근거 추출, 반복 evaluator 실행을 다루면 Daytona 의존성은 커집니다.</p>
            <strong>주관식으로 갈수록 Daytona는 ‘필수 UI 의존성’이 아니라 ‘검증·재현·배치 실행 의존성’이 커진다.</strong>
          </div>
          <div className="essay-dependency-grid">
            {dependencyRows.map((item) => (
              <article key={item.label}>
                <span>{item.label}</span>
                <h3>{item.value}</h3>
                <p>{item.note}</p>
              </article>
            ))}
          </div>
        </section>

        <div className="essay-boundary" role="note">
          이 화면은 2차 주관식 확장 가능성 검증 흔적이며, 공식 채점·합격 예측·손글씨 OCR 완성 claim이 아닙니다.
        </div>
      </section>
    </main>
  );
}

export default function Home() {
  const allQuestions = useMemo(
    () => (keywordData.questions as Question[]).filter((question) => question.round === 48),
    [],
  );
  const questionMap = useMemo(
    () => new Map(allQuestions.map((question) => [question.id, question])),
    [allQuestions],
  );
  const diagnostics = diagnosisData.diagnostics as Diagnostic[];
  const diagnosticMap = useMemo(
    () => new Map(diagnostics.map((item) => [item.id, item])),
    [diagnostics],
  );
  const calculations = keywordData.calculationPatterns as CalculationPattern[];

  const [view, setView] = useState<View>("today");
  const demoDetailsRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const demo = new URLSearchParams(window.location.search).get("demo");
    if (demo === "jlpt" || demo === "essay") setExamTrack(demo);
    if (demo === "daytona") setView("pipeline");
  }, []);
  const [examTrack, setExamTrack] = useState<ExamTrack>("insurance");
  const [accessState, setAccessState] = useState<"loading" | "unauthenticated" | "authenticated" | "guest">("loading");
  useEffect(() => {
    if (view === "pipeline") demoDetailsRef.current?.setAttribute("open", "");
  }, [view, accessState]);
  const [learner, setLearner] = useState<LearnerAccount | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<SubjectCode>("THEORY");
  const [selectedId, setSelectedId] = useState("48-THEORY-33");
  const [reviewQuestion, setReviewQuestion] = useState<Question | null>(null);
  const [reviewQuestionError, setReviewQuestionError] = useState<string | null>(null);
  const [draftChoices, setDraftChoices] = useState<Record<string, string>>({});
  const [submittedAnswers, setSubmittedAnswers] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<"diagnosis" | "retry">("diagnosis");
  const [questionFilter, setQuestionFilter] = useState<QuestionFilter>("all");
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [agentRuns, setAgentRuns] = useState<Record<string, CoachRun>>({});
  const [history, setHistory] = useState<LearningHistoryItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = window.localStorage.getItem("exam-coach-history-v1");
      return stored ? JSON.parse(stored) as LearningHistoryItem[] : [];
    } catch {
      window.localStorage.removeItem("exam-coach-history-v1");
      return [];
    }
  });
  const [serverAttempts, setServerAttempts] = useState<ServerAttemptSummary[]>([]);
  const [serverReviewQueue, setServerReviewQueue] = useState<ReviewQueueItem[]>([]);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [sponsorPayload, setSponsorPayload] = useState<SponsorPayload | null>(null);
  const [sponsorLoading, setSponsorLoading] = useState(false);
  const [sponsorError, setSponsorError] = useState<string | null>(null);
  const [daytonaRunPayload, setDaytonaRunPayload] = useState<DaytonaRunPayload | null>(null);
  const [daytonaRunLoading, setDaytonaRunLoading] = useState(false);
  const [daytonaRunError, setDaytonaRunError] = useState<string | null>(null);
  const [examRound, setExamRound] = useState(48);
  const [lectureRound, setLectureRound] = useState(48);
  const [selectedLectureId, setSelectedLectureId] = useState("48-THEORY-33");
  const [examSubject, setExamSubject] = useState<SubjectCode>("THEORY");
  const [examQuestions, setExamQuestions] = useState<ExamQuestion[]>([]);
  const [examQuestionNo, setExamQuestionNo] = useState(1);
  const [examLoading, setExamLoading] = useState(false);
  const [examGrading, setExamGrading] = useState(false);
  const [examError, setExamError] = useState<string | null>(null);
  const [examSessions, setExamSessions] = useState<Record<string, ExamSession>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const stored = window.localStorage.getItem("exam-coach-sessions-v1");
      return stored ? JSON.parse(stored) as Record<string, ExamSession> : {};
    } catch {
      window.localStorage.removeItem("exam-coach-sessions-v1");
      return {};
    }
  });
  const [viewedLegacyAttemptId, setViewedLegacyAttemptId] = useState<string | null>(null);
  const [analysisSubject, setAnalysisSubject] = useState<SubjectCode | "ALL">("ALL");
  const [analysisAudience, setAnalysisAudience] = useState<AnalysisAudience>("learner");
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [instructorPayload, setInstructorPayload] = useState<InstructorInsightPayload | null>(null);
  const [instructorLoading, setInstructorLoading] = useState(false);
  const [instructorError, setInstructorError] = useState<string | null>(null);
  const [instructorActionSaving, setInstructorActionSaving] = useState(false);
  const [instructorActionMessage, setInstructorActionMessage] = useState<string | null>(null);
  const [showInstructorCandidates, setShowInstructorCandidates] = useState(false);
  const [showAllKeywords, setShowAllKeywords] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [diagnosisSpotlight, setDiagnosisSpotlight] = useState(false);
  const [todayWorkspaceOpen, setTodayWorkspaceOpen] = useState(false);
  const [evidencePreviewEnabled, setEvidencePreviewEnabled] = useState(false);
  const requestedExamQuestionNo = useRef(1);
  const diagnosisResultRef = useRef<HTMLDivElement>(null);

  const selectedSubjectInfo = subjectOptions.find((subject) => subject.code === selectedSubject) ?? subjectOptions[2];
  const subjectQuestions = useMemo(
    () => allQuestions.filter((question) => question.subjectCode === selectedSubject),
    [allQuestions, selectedSubject],
  );
  const todayQueues = useMemo(
    () => Object.fromEntries(subjectOptions.map((subject) => [
      subject.code,
      buildTodayQueue(subject.code, history, questionMap),
    ])) as Record<SubjectCode, Diagnostic[]>,
    [history, questionMap],
  );
  const displayQueue = todayQueues[selectedSubject];
  const selectedQueueItem = displayQueue.find((item) => item.id === selectedId) ?? displayQueue[0] ?? null;
  const selectedQuestion = questionMap.get(selectedId)
    ?? (reviewQuestion?.id === selectedId ? reviewQuestion : null)
    ?? subjectQuestions[0]
    ?? allQuestions[0];
  const selectedDiagnostic = selectedQueueItem ?? diagnosticMap.get(selectedQuestion.id) ?? pendingDiagnostic(selectedQuestion);
  const selectedQuestionReady = selectedQuestion.id === selectedDiagnostic.id;
  const reviewQuestionLoading = Boolean(selectedQueueItem && !questionMap.has(selectedQueueItem.id) && !selectedQuestionReady && !reviewQuestionError);
  const correctChoice = selectedQuestion.answer;
  const selectedChoice = draftChoices[selectedQuestion.id] ?? null;
  const submittedChoice = submittedAnswers[selectedQuestion.id] ?? null;
  const hasStoredFirstAttempt = selectedDiagnostic.attempts[0] !== null;
  const isSolveMode = !hasStoredFirstAttempt || mode === "retry";
  const submitted = submittedChoice !== null;
  const canRevealAnswer = mode === "diagnosis" ? hasStoredFirstAttempt : submitted;
  const showLiveEvidencePreview = evidencePreviewEnabled
    && selectedQuestion.id === "48-THEORY-33"
    && canRevealAnswer;
  const liveEvidenceAssessment = liveEvidencePreviewData.assessments.find(
    (assessment) => assessment.decision === "maintain",
  );
  const selectedRun = agentRuns[selectedQuestion.id] ?? null;
  const indexedEvidence = ((evidenceData as EvidenceIndex).matches[selectedQuestion.id] ?? [])[0] ?? null;
  const activeEvidence = selectedRun?.evidence ?? indexedEvidence;
  const isAnalyzing = analyzingId === selectedQuestion.id;
  const displayStatus = submitted
    ? `${hasStoredFirstAttempt ? "재풀이" : "1회독"} ${submittedChoice === correctChoice ? "정답" : "오답"}`
    : hasStoredFirstAttempt
      ? selectedDiagnostic.status
      : "풀이 중";
  const subjectScore = selectedSubjectInfo.hasDiagnostics ? diagnosisData.summary.attemptScores.second : null;
  const todayHighPriorityCount = displayQueue.filter((item) => (item.priorityScore ?? 0) >= 65).length;
  const todayRoundCounts = useMemo(
    () => Object.fromEntries(subjectOptions.map((subject) => {
      const rounds = new Set<number>();
      legacyPayload.attempts.filter((attempt) => attempt.subjectCode === subject.code).forEach((attempt) => rounds.add(attempt.round));
      history.forEach((item) => {
        const [round, code] = item.questionId.split("-");
        if (code === subject.code && Number.isInteger(Number(round))) rounds.add(Number(round));
      });
      serverAttempts.filter((attempt) => attempt.subjectCode === subject.code).forEach((attempt) => rounds.add(attempt.round));
      return [subject.code, rounds.size];
    })) as Record<SubjectCode, number>,
    [history, serverAttempts],
  );
  const dashboardCandidates = useMemo(
    () => subjectOptions.flatMap((subject) => todayQueues[subject.code].map((item) => ({ item, subject })))
      .sort((a, b) => (b.item.priorityScore ?? 0) - (a.item.priorityScore ?? 0)
        || (b.item.round ?? 0) - (a.item.round ?? 0)
        || a.item.questionNo - b.item.questionNo),
    [todayQueues],
  );
  const dashboardTopPriority = dashboardCandidates[0]?.item.priorityScore ?? null;
  const dashboardLead = dashboardCandidates.find(({ item }) => item.id === selectedId && item.priorityScore === dashboardTopPriority)
    ?? dashboardCandidates[0]
    ?? null;
  const dashboardReviewTotal = subjectOptions.reduce((sum, subject) => sum + todayQueues[subject.code].length, 0);
  const dashboardHighPriorityTotal = subjectOptions.reduce(
    (sum, subject) => sum + todayQueues[subject.code].filter((item) => (item.priorityScore ?? 0) >= 65).length,
    0,
  );
  const dashboardCompletedUnits = useMemo(() => {
    const units = new Set<string>();
    legacyPayload.attempts.forEach((attempt) => units.add(`${attempt.round}-${attempt.subjectCode}`));
    Object.entries(examSessions).forEach(([key, session]) => {
      if (session.submitted) units.add(key);
    });
    serverAttempts.forEach((attempt) => units.add(`${attempt.round}-${attempt.subjectCode}`));
    return units;
  }, [examSessions, serverAttempts]);
  const dashboardSubjectProgress = subjectOptions.map((subject) => {
    const completed = Array.from(dashboardCompletedUnits).filter((key) => key.endsWith(`-${subject.code}`)).length;
    return {
      ...subject,
      completed: Math.min(10, completed),
      percentage: Math.min(100, Math.round((completed / 10) * 100)),
    };
  });
  const dashboardCompletedCount = Math.min(30, dashboardCompletedUnits.size);
  const dashboardProgressPercent = Math.min(100, Math.round((dashboardCompletedCount / 30) * 100));
  const dashboardDueReviewCount = serverReviewQueue.filter((item) => item.status === "due").length;
  const dashboardPendingReviewCount = Math.max(0, serverReviewQueue.length - dashboardDueReviewCount);
  const dashboardLeadEvidence = dashboardLead
    ? ((evidenceData as EvidenceIndex).matches[dashboardLead.item.id] ?? [])[0] ?? null
    : null;
  const dashboardLoopStages = [
    { label: "풀이", value: `${dashboardCompletedCount}/30`, state: dashboardCompletedCount > 0 ? "complete" : "current" },
    { label: "진단", value: `${dashboardReviewTotal}개`, state: dashboardReviewTotal > 0 ? "complete" : "waiting" },
    { label: "근거", value: dashboardLeadEvidence ? "연결" : "대기", state: dashboardLeadEvidence ? "complete" : "waiting" },
    {
      label: "재풀이",
      value: dashboardDueReviewCount > 0 ? `오늘 ${dashboardDueReviewCount}` : serverReviewQueue.length > 0 ? `예정 ${serverReviewQueue.length}` : "준비",
      state: dashboardDueReviewCount > 0 ? "current" : "waiting",
    },
  ];
  const activeDaytonaEvidence = daytonaRunPayload?.receipt ?? daytonaHackSprintEvidence;
  const activeDaytonaSandboxId = formatDaytonaSandboxDisplayId(activeDaytonaEvidence.sandboxId);
  const loadedEventSponsors = (sponsorPayload?.sponsors ?? []).filter((sponsor) => sponsor.id === "daytona" || sponsor.id === "nosana");
  const eventSponsors = loadedEventSponsors.length ? loadedEventSponsors : daytonaEventSponsorFallback;
  const daytonaRunStatusLabel = daytonaRunLoading
    ? "샌드박스 실행 중"
    : daytonaRunPayload?.status === "verified"
      ? "방금 실행 완료"
      : daytonaRunPayload?.status === "failed"
        ? "검증 실패 · fallback"
        : daytonaRunPayload?.status === "fallback"
          ? "실행 미확인 · 로컬 자료"
          : "실행 대기";

  const filteredQuestions = subjectQuestions.filter((question) => {
    const diagnostic = diagnosticMap.get(question.id);
    if (questionFilter === "review") return diagnostic ? reviewStatuses.has(diagnostic.status) : false;
    if (questionFilter === "calculation") return question.numericType !== "없음";
    return true;
  });
  const calculationCount = subjectQuestions.filter((question) => question.numericType !== "없음").length;
  const reviewCount = subjectQuestions.filter((question) => {
    const diagnostic = diagnosticMap.get(question.id);
    return diagnostic ? reviewStatuses.has(diagnostic.status) : false;
  }).length;
  const subjectCalculations = calculations.filter((item) => item.subject === selectedSubjectInfo.name);
  const numericCounts = subjectCalculations.reduce<Record<string, number>>((counts, item) => {
    counts[item.numericType] = (counts[item.numericType] ?? 0) + 1;
    return counts;
  }, {});
  const maxNumericCount = Math.max(1, ...Object.values(numericCounts));
  const lectureTitle = activeEvidence
    ? `${activeEvidence.material} · p.${activeEvidence.page}`
    : `${selectedDiagnostic.domain} · ${selectedDiagnostic.concept}`;
  const lectureCandidates = useMemo(
    () => buildLectureCandidates(lectureRound, selectedSubject, history, questionMap),
    [lectureRound, selectedSubject, history, questionMap],
  );
  const lectureCandidateCounts = useMemo(
    () => Object.fromEntries(subjectOptions.map((subject) => [
      subject.code,
      buildLectureCandidates(lectureRound, subject.code, history, questionMap).length,
    ])) as Record<SubjectCode, number>,
    [lectureRound, history, questionMap],
  );
  const selectedLectureCandidate = lectureCandidates.find((item) => item.id === selectedLectureId) ?? lectureCandidates[0];
  const selectedLectureEvidence = selectedLectureCandidate
    ? ((evidenceData as EvidenceIndex).matches[selectedLectureCandidate.id] ?? [])[0] ?? null
    : null;
  const selectedLectureRun = selectedLectureCandidate ? agentRuns[selectedLectureCandidate.id] ?? null : null;
  const selectedLectureTitle = selectedLectureCandidate
    ? selectedLectureEvidence
      ? `${selectedLectureEvidence.material} · p.${selectedLectureEvidence.page}`
      : `${selectedLectureCandidate.domain} · ${selectedLectureCandidate.concept}`
    : "저장된 진단을 먼저 선택하세요";
  const examSessionKey = `${examRound}-${examSubject}`;
  const examSession = examSessions[examSessionKey] ?? { answers: {}, submitted: false };
  const examSubjectInfo = subjectOptions.find((subject) => subject.code === examSubject) ?? subjectOptions[0];
  const activeExamQuestion = examQuestions.find((question) => question.questionNo === examQuestionNo) ?? examQuestions[0];
  const scopedLegacyAttempts = legacyPayload.attempts.filter(
    (attempt) => attempt.round === examRound && attempt.subjectCode === examSubject,
  );
  const viewedLegacyAttempt = scopedLegacyAttempts.find((attempt) => attempt.id === viewedLegacyAttemptId) ?? null;
  const activeLegacyRecord = activeExamQuestion
    ? viewedLegacyAttempt?.records.find((record) => record.questionId === activeExamQuestion.id)
    : undefined;
  const activeExamResult = activeExamQuestion
    ? viewedLegacyAttempt
      ? activeLegacyRecord
        ? { correct: activeLegacyRecord.correct, acceptedAnswers: activeLegacyRecord.acceptedAnswers }
        : undefined
      : examSession.results?.[activeExamQuestion.id]
    : undefined;
  const activeConceptNote = activeExamQuestion
    ? (conceptNoteData as Record<string, ExamConceptNote>)[activeExamQuestion.id]
    : undefined;
  const displayedExamAnswers = viewedLegacyAttempt
    ? Object.fromEntries(viewedLegacyAttempt.records.flatMap((record) => record.selectedChoice ? [[record.questionId, record.selectedChoice]] : []))
    : examSession.answers;
  const displayedExamSubmitted = Boolean(viewedLegacyAttempt) || examSession.submitted;
  const displayedExamScore = viewedLegacyAttempt?.score ?? examSession.score;
  const examAnsweredCount = viewedLegacyAttempt?.recordCount ?? Object.keys(examSession.answers).length;
  const completedSessions = Object.entries(examSessions).filter(([, session]) => session.submitted);
  const completedScores = [
    ...legacyPayload.attempts.map((attempt) => attempt.score),
    ...completedSessions.map(([, session]) => session.score ?? 0),
  ];
  const completedAttemptCount = completedScores.length;
  const completedRoundCount = new Set([
    ...legacyPayload.attempts.map((attempt) => String(attempt.round)),
    ...completedSessions.map(([key]) => key.split("-")[0]),
  ]).size;
  const completedAverage = completedScores.length
    ? Math.round((completedScores.reduce((sum, score) => sum + score, 0) / completedScores.length) * 10) / 10
    : null;
  const nextAttemptNo = Math.max(0, ...scopedLegacyAttempts.map((attempt) => attempt.attemptNo)) + 1;
  function getQuickExamStatus(subject: SubjectCode, round = examRound) {
    const session = examSessions[`${round}-${subject}`];
    const answered = Object.keys(session?.answers ?? {}).length;
    if (session?.submitted) return `${round}회 · ${session.score ?? 0}/40 채점 완료`;
    if (answered > 0) return `${round}회 · ${answered}/40 이어풀기`;
    const latestAttempt = Math.max(
      0,
      ...legacyPayload.attempts
        .filter((attempt) => attempt.round === round && attempt.subjectCode === subject)
        .map((attempt) => attempt.attemptNo),
    );
    return latestAttempt > 0 ? `${round}회 · ${latestAttempt + 1}회독 시작` : `${round}회 · 시작`;
  }
  const legacyScoreRows = Array.from(new Set(legacyPayload.attempts.map((attempt) => attempt.round)))
    .sort((a, b) => b - a)
    .map((round) => ({
      round,
      attempts: legacyPayload.attempts.filter((attempt) => attempt.round === round).sort((a, b) => a.attemptNo - b.attemptNo),
    }));
  const legacyLearningHistory = useMemo<LearningHistoryItem[]>(
    () => legacyPayload.attempts.flatMap((attempt) => attempt.records.map((record) => ({
      questionId: record.questionId,
      concept: record.concept,
      correct: record.correct,
      answeredAt: null,
      source: "legacy-xlsx",
    }))),
    [],
  );

  useEffect(() => {
    const previewEnabled = new URLSearchParams(window.location.search).get("evidencePreview") === "1";
    if (!previewEnabled) return;

    const frame = window.requestAnimationFrame(() => {
      setEvidencePreviewEnabled(true);
      setTodayWorkspaceOpen(true);
      setSelectedSubject("THEORY");
      setSelectedId("48-THEORY-33");
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth", { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as { authenticated?: boolean; learner?: LearnerAccount };
        if (payload.authenticated && payload.learner) {
          setLearner(payload.learner);
          setAccessState("authenticated");
        } else {
          setAccessState("unauthenticated");
        }
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setAccessState("unauthenticated");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (accessState !== "authenticated" || !learner) return;
    const controller = new AbortController();
    fetch("/api/attempts", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json() as Promise<{
          attempts?: ServerAttemptSummary[];
          history?: LearningHistoryItem[];
          reviewQueue?: ReviewQueueItem[];
        }>;
      })
      .then((payload) => {
        if (!payload) return;
        setServerAttempts(payload.attempts ?? []);
        setServerReviewQueue(payload.reviewQueue ?? []);
        if (!payload.history) return;
        setHistory((current) => {
          const merged = new Map<string, LearningHistoryItem>();
          [...payload.history!, ...current].forEach((item) => {
            merged.set(`${item.questionId}:${item.answeredAt ?? "legacy"}`, item);
          });
          return [...merged.values()].slice(-4000);
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
      });
    return () => controller.abort();
  }, [accessState, learner]);

  useEffect(() => {
    if (view !== "today" || !selectedQueueItem || questionMap.has(selectedQueueItem.id)) {
      return;
    }
    const controller = new AbortController();
    fetch(`/api/exams?mode=review&id=${encodeURIComponent(selectedQueueItem.id)}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as { question?: Question; error?: string };
        if (!response.ok || !payload.question) throw new Error(payload.error ?? "복습 문항을 불러오지 못했습니다.");
        setReviewQuestion(payload.question);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setReviewQuestionError(error instanceof Error ? error.message : "복습 문항을 불러오지 못했습니다.");
      });
    return () => controller.abort();
  }, [view, selectedQueueItem, questionMap]);

  useEffect(() => {
    if (view !== "exam") return;
    const controller = new AbortController();
    fetch(`/api/exams?round=${examRound}&subject=${examSubject}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as { questions?: ExamQuestion[]; error?: string };
        if (!response.ok || !payload.questions) throw new Error(payload.error ?? "합성 문항을 불러오지 못했습니다.");
        setExamQuestions(payload.questions);
        setExamQuestionNo(Math.min(payload.questions.length, Math.max(1, requestedExamQuestionNo.current)));
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setExamError(error instanceof Error ? error.message : "합성 문항을 불러오지 못했습니다.");
      })
      .finally(() => setExamLoading(false));
    return () => controller.abort();
  }, [view, examRound, examSubject]);

  useEffect(() => {
    if (view !== "analysis") return;
    const controller = new AbortController();
    const subjectQuery = analysisSubject === "ALL" ? "" : `&subject=${analysisSubject}`;
    fetch(`/api/exams?mode=analytics${subjectQuery}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as AnalyticsPayload & { error?: string };
        if (!response.ok || !payload.rounds) throw new Error(payload.error ?? "전회차 분석을 불러오지 못했습니다.");
        setAnalytics(payload);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setAnalyticsError(error instanceof Error ? error.message : "전회차 분석을 불러오지 못했습니다.");
      })
      .finally(() => setAnalyticsLoading(false));
    return () => controller.abort();
  }, [view, analysisSubject]);

  useEffect(() => {
    if (view !== "analysis" || analysisAudience !== "instructor") return;
    const controller = new AbortController();
    const subjectQuery = analysisSubject === "ALL" ? "" : `?subject=${analysisSubject}`;
    fetch(`/api/instructor-insights${subjectQuery}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as InstructorInsightPayload & { error?: string };
        if (!response.ok || !payload.available) throw new Error(payload.error ?? "강의 인사이트를 불러오지 못했습니다.");
        setInstructorPayload(payload);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setInstructorError(error instanceof Error ? error.message : "강의 인사이트를 불러오지 못했습니다.");
      })
      .finally(() => setInstructorLoading(false));
    return () => controller.abort();
  }, [view, analysisAudience, analysisSubject]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("exam-coach-sessions-v1", JSON.stringify(examSessions));
    }
  }, [examSessions]);

  useEffect(() => {
    if (!selectedRun?.runId) return;
    const frame = window.requestAnimationFrame(() => {
      setDiagnosisSpotlight(true);
      diagnosisResultRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "center",
      });
      diagnosisResultRef.current?.focus({ preventScroll: true });
    });
    const timer = window.setTimeout(() => setDiagnosisSpotlight(false), 2200);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [selectedRun?.runId]);

  useEffect(() => {
    if (!focusMode) return;
    function exitFocusMode(event: KeyboardEvent) {
      if (event.key === "Escape") setFocusMode(false);
    }
    window.addEventListener("keydown", exitFocusMode);
    return () => window.removeEventListener("keydown", exitFocusMode);
  }, [focusMode]);

  function changeSubject(code: SubjectCode) {
    const preferred = todayQueues[code][0];
    setSelectedSubject(code);
    if (preferred) setSelectedId(preferred.id);
    setMode(preferred?.attempts[0] !== null && preferred?.attempts[0] !== undefined ? "diagnosis" : "retry");
    setReviewQuestion(null);
    setReviewQuestionError(null);
    setEvidenceOpen(false);
    setQuestionFilter("all");
  }

  function openTodayDashboard() {
    setFocusMode(false);
    setTodayWorkspaceOpen(false);
    setView("today");
  }

  function openTodaySubject(subject: SubjectCode) {
    const preferred = todayQueues[subject][0];
    if (!preferred) {
      openSubjectExam(subject, 48);
      return;
    }
    selectQuestion(preferred.id);
  }

  function selectQuestion(id: string, nextView: View = "today") {
    const question = questionMap.get(id);
    const subject = id.split("-")[1] as SubjectCode;
    if (question) setSelectedSubject(question.subjectCode);
    else if (["BIZ", "CONTRACT", "THEORY"].includes(subject)) setSelectedSubject(subject);
    setSelectedId(id);
    const diagnostic = todayQueues[subject]?.find((item) => item.id === id) ?? diagnosticMap.get(id);
    setMode(diagnostic?.attempts[0] !== null && diagnostic?.attempts[0] !== undefined ? "diagnosis" : "retry");
    if (reviewQuestion?.id !== id) setReviewQuestion(null);
    setReviewQuestionError(null);
    setEvidenceOpen(false);
    if (nextView === "today") setTodayWorkspaceOpen(true);
    setView(nextView);
  }

  function beginRetry() {
    setMode("retry");
    setDraftChoices((current) => {
      const next = { ...current };
      delete next[selectedQuestion.id];
      return next;
    });
    setSubmittedAnswers((current) => {
      const next = { ...current };
      delete next[selectedQuestion.id];
      return next;
    });
    setAnalysisError(null);
  }

  function selectExamAnswer(choice: string) {
    if (!activeExamQuestion || examSession.submitted || viewedLegacyAttempt) return;
    const startedAt = examSession.startedAt ?? new Date().toISOString();
    const submissionId = examSession.submissionId ?? crypto.randomUUID();
    setExamSessions((current) => ({
      ...current,
      [examSessionKey]: {
        ...examSession,
        startedAt,
        submissionId,
        answers: { ...examSession.answers, [activeExamQuestion.id]: choice },
      },
    }));
  }

  async function finishExam() {
    if (examAnsweredCount !== examQuestions.length || examSession.submitted || viewedLegacyAttempt) return;
    setExamGrading(true);
    setExamError(null);
    try {
      const response = await fetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          round: examRound,
          subject: examSubject,
          answers: examSession.answers,
          startedAt: examSession.startedAt,
          clientSubmissionId: examSession.submissionId ?? crypto.randomUUID(),
        }),
      });
      const payload = await response.json() as {
        score?: number;
        submittedAt?: string;
        results?: Record<string, ExamResult>;
        persistence?: { saved: boolean; attemptNo?: number; reviewTasksScheduled?: number; reason?: string };
        error?: string;
      };
      if (!response.ok || payload.score === undefined || !payload.submittedAt || !payload.results) {
        throw new Error(payload.error ?? "채점을 완료하지 못했습니다.");
      }
      setExamSessions((current) => ({
        ...current,
        [examSessionKey]: {
          ...examSession,
          submitted: true,
          score: payload.score,
          submittedAt: payload.submittedAt,
          results: payload.results,
          serverSaved: payload.persistence?.saved ?? false,
          serverAttemptNo: payload.persistence?.attemptNo,
          reviewTasksScheduled: payload.persistence?.reviewTasksScheduled,
        },
      }));
      if (learner && payload.persistence?.saved) {
        setLearner((current) => current ? {
          ...current,
          attemptCount: current.attemptCount + 1,
          answerCount: current.answerCount + 40,
          lastAttemptAt: payload.submittedAt as string,
        } : current);
      }
      const nextHistory = [
        ...history,
        ...examQuestions.map((question) => ({
          questionId: question.id,
          concept: question.concept,
          correct: payload.results?.[question.id]?.correct ?? false,
          answeredAt: payload.submittedAt as string,
        })),
      ].slice(-1500);
      setHistory(nextHistory);
      window.localStorage.setItem("exam-coach-history-v1", JSON.stringify(nextHistory));
      const firstWrong = examQuestions.find((question) => !payload.results?.[question.id]?.correct);
      setExamQuestionNo(firstWrong?.questionNo ?? 1);
    } catch (error) {
      setExamError(error instanceof Error ? error.message : "채점을 완료하지 못했습니다.");
    } finally {
      setExamGrading(false);
    }
  }

  function resetExam() {
    setExamSessions((current) => {
      const next = { ...current };
      delete next[examSessionKey];
      return next;
    });
    setViewedLegacyAttemptId(null);
    requestedExamQuestionNo.current = 1;
    setExamQuestionNo(1);
  }

  function openSubjectExam(subject: SubjectCode, round = 48, legacyAttemptId: string | null = null, questionNo = 1) {
    setExamLoading(view !== "exam" || subject !== examSubject || round !== examRound || examQuestions.length === 0);
    setExamError(null);
    requestedExamQuestionNo.current = questionNo;
    setSelectedSubject(subject);
    setExamSubject(subject);
    setExamRound(round);
    setViewedLegacyAttemptId(legacyAttemptId);
    setExamQuestionNo(questionNo);
    setView("exam");
  }

  function openExam() {
    if (view === "exam") return;
    setExamLoading(examQuestions.length === 0);
    setExamError(null);
    setView("exam");
  }

  function openSelectedLecture() {
    const round = selectedDiagnostic.round ?? selectedQuestion.round;
    setLectureRound(round);
    setSelectedLectureId(selectedDiagnostic.id);
    setSelectedSubject(selectedQuestion.subjectCode);
    setView("lectures");
  }

  function changeExamRound(round: number) {
    if (round === examRound) return;
    setExamLoading(true);
    setExamError(null);
    setViewedLegacyAttemptId(null);
    requestedExamQuestionNo.current = 1;
    setExamQuestionNo(1);
    setExamRound(round);
  }

  function changeExamSubject(subject: SubjectCode) {
    if (subject === examSubject) return;
    setExamLoading(true);
    setExamError(null);
    setViewedLegacyAttemptId(null);
    requestedExamQuestionNo.current = 1;
    setExamQuestionNo(1);
    setExamSubject(subject);
  }

  function openAnalysis() {
    if (analysisAudience !== "learner") setAnalysisAudience("learner");
    if (view === "analysis" && analysisAudience === "learner") return;
    setAnalyticsLoading(analytics === null);
    setAnalyticsError(null);
    setView("analysis");
  }

  function openInstructorInsight() {
    setAnalysisAudience("instructor");
    setInstructorLoading(true);
    setInstructorError(null);
    setShowInstructorCandidates(false);
    setView("analysis");
  }

  function changeAnalysisAudience(audience: AnalysisAudience) {
    if (audience === analysisAudience) return;
    if (audience === "instructor") {
      setInstructorLoading(true);
      setInstructorError(null);
      setShowInstructorCandidates(false);
    }
    setAnalysisAudience(audience);
  }

  function openInstructorCandidates(subject: SubjectCode | "ALL") {
    setShowInstructorCandidates(true);
    if (subject !== analysisSubject) changeAnalysisSubject(subject);
  }

  async function applyInstructorIntervention() {
    if (!instructorLeadInsight || instructorLeadInsight.intervention || instructorActionSaving) return;
    setInstructorActionSaving(true);
    setInstructorActionMessage(null);
    setInstructorError(null);
    try {
      const response = await fetch("/api/instructor-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectCode: instructorLeadInsight.subjectCode,
          domain: instructorLeadInsight.domain,
          concept: instructorLeadInsight.concept,
          questionId: instructorLeadInsight.dominantWrongQuestionId,
          wrongChoice: instructorLeadInsight.dominantWrongChoice,
          confusionCode: instructorLeadInsight.confusionCode,
          evidenceMaterial: instructorLeadEvidence?.material ?? null,
          evidencePage: instructorLeadEvidence?.page ?? null,
        }),
      });
      const saved = await response.json() as { saved?: boolean; error?: string };
      if (!response.ok || !saved.saved) throw new Error(saved.error ?? "보강 조치를 저장하지 못했습니다.");

      const subjectQuery = analysisSubject === "ALL" ? "" : `?subject=${analysisSubject}`;
      const refreshed = await fetch(`/api/instructor-insights${subjectQuery}`);
      const payload = await refreshed.json() as InstructorInsightPayload & { error?: string };
      if (!refreshed.ok || !payload.available) throw new Error(payload.error ?? "보강 상태를 다시 불러오지 못했습니다.");
      setInstructorPayload(payload);
      setInstructorActionMessage("보강 기준 시점을 저장했습니다. 이후 같은 개념 재풀이부터 효과 구간으로 집계합니다.");
    } catch (error) {
      setInstructorError(error instanceof Error ? error.message : "보강 조치를 저장하지 못했습니다.");
    } finally {
      setInstructorActionSaving(false);
    }
  }

  function changeAnalysisSubject(subject: SubjectCode | "ALL") {
    if (subject === analysisSubject) return;
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    if (analysisAudience === "instructor") {
      setInstructorLoading(true);
      setInstructorError(null);
    }
    setShowAllKeywords(false);
    setAnalysisSubject(subject);
  }

  async function submitAnswer() {
    if (!selectedChoice) return;
    setSubmittedAnswers((current) => ({ ...current, [selectedQuestion.id]: selectedChoice }));
    setAnalyzingId(selectedQuestion.id);
    setAnalysisError(null);

    try {
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: {
            ...selectedQuestion,
            domain: selectedDiagnostic.domain,
            concept: selectedDiagnostic.concept,
            trapType: selectedDiagnostic.trapType,
            numericType: selectedDiagnostic.numericType,
          },
          selectedChoice,
          priorAttempts: selectedDiagnostic.attempts,
          history: [...legacyLearningHistory, ...history],
        }),
      });
      const payload = (await response.json()) as { run?: CoachRun; error?: string };
      if (!response.ok || !payload.run) throw new Error(payload.error ?? "진단을 완료하지 못했습니다.");
      setAgentRuns((current) => ({ ...current, [selectedQuestion.id]: payload.run as CoachRun }));
      const historyItem: LearningHistoryItem = {
        questionId: selectedQuestion.id,
        concept: selectedDiagnostic.concept,
        correct: payload.run.correct,
        answeredAt: payload.run.generatedAt,
      };
      setHistory((current) => {
        const next = [...current, historyItem].slice(-100);
        window.localStorage.setItem("exam-coach-history-v1", JSON.stringify(next));
        return next;
      });
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "진단을 완료하지 못했습니다.");
    } finally {
      setAnalyzingId(null);
    }
  }

  async function refreshSponsorStatus() {
    if (sponsorLoading) return;
    setSponsorLoading(true);
    setSponsorError(null);
    try {
      const response = await fetch(`/api/sponsors?checked=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error("연동 상태를 읽지 못했습니다.");
      setSponsorPayload(await response.json() as SponsorPayload);
    } catch (error) {
      setSponsorError(error instanceof Error ? error.message : "연동 상태를 읽지 못했습니다.");
    } finally {
      setSponsorLoading(false);
    }
  }

  async function runDaytonaHackSprintValidation() {
    if (daytonaRunLoading) return;
    setDaytonaRunLoading(true);
    setDaytonaRunError(null);
    try {
      const response = await fetch("/api/daytona-hacksprint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "validate-exam-data" }),
      });
      const payload = await response.json() as DaytonaRunPayload & { error?: string };
      if (!response.ok || !payload.receipt) throw new Error(payload.error ?? "Daytona 실행 결과를 읽지 못했습니다.");
      setDaytonaRunPayload(payload);
    } catch (error) {
      setDaytonaRunError(error instanceof Error ? error.message : "Daytona 실행 결과를 읽지 못했습니다.");
    } finally {
      setDaytonaRunLoading(false);
    }
  }

  async function openPipeline() {
    setView("pipeline");
    demoDetailsRef.current?.setAttribute("open", "");
    if (sponsorPayload || sponsorLoading) return;
    await refreshSponsorStatus();
  }

  async function signOut() {
    if (accessState === "authenticated") {
      await fetch("/api/auth", { method: "DELETE" }).catch(() => null);
    }
    setLearner(null);
    setAccessState("unauthenticated");
  }

  const baselineRounds = analytics?.rounds.filter((round) => round.round <= 47) ?? [];
  const recentRounds = analytics?.rounds.filter((round) => round.round >= 48) ?? [];
  const metricRate = (rounds: RoundAnalytics[], metric: "caseCount" | "numericCount" | "directCalculationCount" | "combinationCount") => {
    const total = rounds.reduce((sum, round) => sum + round.total, 0);
    const count = rounds.reduce((sum, round) => sum + round[metric], 0);
    return total ? Math.round((count / total) * 1000) / 10 : 0;
  };
  const changeMetrics = [
    { label: "사례적용형", metric: "caseCount" as const, description: "계약·사고 상황에 규칙을 적용하는 문항" },
    { label: "수치 포함형", metric: "numericCount" as const, description: "계산형과 법정 기간·금액·비율 문항" },
    { label: "직접 계산군", metric: "directCalculationCount" as const, description: "직접계산·공식선택·금액사례형 문항" },
    { label: "조합·개수형", metric: "combinationCount" as const, description: "복수 판단이나 옳은 항목 개수를 묻는 문항" },
  ].map((item) => {
    const baseline = metricRate(baselineRounds, item.metric);
    const recent = metricRate(recentRounds, item.metric);
    return { ...item, baseline, recent, delta: Math.round((recent - baseline) * 10) / 10 };
  });
  const maxTrendCount = Math.max(1, ...(analytics?.rounds.map((round) => Math.max(round.caseCount, round.numericCount)) ?? [1]));
  const personalKeywordInsights = useMemo<PersonalKeywordInsight[]>(() => {
    if (!analytics) return [];
    const attemptsByQuestion = new Map<string, boolean[]>();
    const addResult = (questionId: string, correct: boolean) => {
      const records = attemptsByQuestion.get(questionId) ?? [];
      records.push(correct);
      attemptsByQuestion.set(questionId, records);
    };
    legacyPayload.attempts.forEach((attempt) => attempt.records.forEach((record) => addResult(record.questionId, record.correct)));
    history.forEach((record) => addResult(record.questionId, record.correct));

    return analytics.keywordInsights.map((insight) => {
      const attemptedRefs = insight.questionRefs.filter((question) => attemptsByQuestion.has(question.id));
      const latestResults = attemptedRefs.map((question) => attemptsByQuestion.get(question.id)?.at(-1) ?? false);
      const accuracy = attemptedRefs.length
        ? Math.round((latestResults.filter(Boolean).length / attemptedRefs.length) * 100)
        : null;
      const repeatedWrongCount = attemptedRefs.filter((question) => (
        attemptsByQuestion.get(question.id)?.filter((correct) => !correct).length ?? 0
      ) >= 2).length;
      const recurrenceScore = Math.round((insight.roundCount / 10) * 15);
      const recentScore = Math.min(10, insight.recentCount * 2);
      const growthScore = Math.min(5, Math.round(Math.max(0, insight.trendDelta) / 2));
      const trendScore = Math.min(30, recurrenceScore + recentScore + growthScore);
      const weaknessScore = accuracy === null ? 0 : Math.round((100 - accuracy) * 0.5);
      const repeatScore = Math.min(20, repeatedWrongCount * 5);
      const priorityScore = accuracy === null ? null : Math.min(100, trendScore + weaknessScore + repeatScore);
      const latestWrong = attemptedRefs.find((question) => attemptsByQuestion.get(question.id)?.at(-1) === false);
      return {
        ...insight,
        attemptedQuestionCount: attemptedRefs.length,
        accuracy,
        repeatedWrongCount,
        trendScore,
        weaknessScore,
        repeatScore,
        priorityScore,
        targetQuestion: latestWrong ?? insight.questionRefs[0] ?? null,
      };
    }).sort((a, b) => {
      if ((a.priorityScore !== null) !== (b.priorityScore !== null)) return a.priorityScore !== null ? -1 : 1;
      return (b.priorityScore ?? b.trendScore) - (a.priorityScore ?? a.trendScore)
        || b.roundCount - a.roundCount
        || b.questionCount - a.questionCount;
    });
  }, [analytics, history]);
  const leadKeywordInsight = personalKeywordInsights[0] ?? null;
  const leadKeywordCopy = leadKeywordInsight ? keywordStudyCopy(leadKeywordInsight) : null;
  const otherKeywordInsights = personalKeywordInsights.slice(1);
  const displayedKeywordInsights = showAllKeywords ? otherKeywordInsights : otherKeywordInsights.slice(0, 3);
  const measuredKeywordCount = personalKeywordInsights.filter((insight) => insight.priorityScore !== null).length;
  const instructorDataset = instructorPayload?.dataset ?? null;
  const instructorKeywordInsights = instructorPayload?.insights ?? [];
  const instructorObservedKeywordCount = instructorKeywordInsights.filter((insight) => insight.wrongLearners >= 5 && insight.wrongRate >= 50).length;
  const instructorLectureCandidateCount = instructorKeywordInsights.filter((insight) => insight.demandScore >= 55).length;
  const instructorLeadInsight = instructorKeywordInsights[0] ?? null;
  const instructorLeadClassification = instructorLeadInsight ? classifyContentKeyword({
    id: instructorLeadInsight.id,
    round: 48,
    subject: instructorLeadInsight.subject,
    subjectCode: instructorLeadInsight.subjectCode,
    questionNo: 0,
    questionText: instructorLeadInsight.concept,
    choices: {},
    domain: instructorLeadInsight.domain,
    concept: instructorLeadInsight.concept,
    keywords: [],
    numericType: "없음",
    questionForm: "개념형",
  }) : null;
  const instructorLeadTrend = instructorLeadClassification
    ? analytics?.keywordInsights.find((insight) => insight.subjectCode === instructorLeadInsight?.subjectCode && insight.keyword === instructorLeadClassification.keyword) ?? null
    : null;
  const instructorLeadEvidenceRef = instructorLeadTrend?.questionRefs.find(
    (reference) => Boolean((evidenceData as EvidenceIndex).matches[reference.id]?.[0]),
  ) ?? null;
  const instructorLeadEvidence = instructorLeadEvidenceRef
    ? (evidenceData as EvidenceIndex).matches[instructorLeadEvidenceRef.id]?.[0] ?? null
    : null;
  const instructorSubjectBriefs = subjectOptions
    .filter((subject) => analysisSubject === "ALL" || subject.code === analysisSubject)
    .map((subject) => {
      const insights = instructorKeywordInsights.filter((insight) => insight.subjectCode === subject.code);
      return {
        ...subject,
        lead: insights[0] ?? null,
        candidateCount: insights.filter((insight) => insight.demandScore >= 55).length,
        observedSignalCount: insights.filter((insight) => insight.wrongLearners >= 5 && insight.wrongRate >= 50).length,
      };
    });
  const selectedTodayRound = selectedDiagnostic.round ?? selectedQuestion.round;
  const sidebarRound = view === "lectures" ? lectureRound : view === "today" ? selectedTodayRound : examRound;
  const sidebarSubject = view === "lectures" || view === "today" ? selectedSubject : examSubject;
  const sidebarSubjectInfo = subjectOptions.find((subject) => subject.code === sidebarSubject) ?? subjectOptions[0];

  const titles: Record<View, { eyebrow: string; title: string }> = {
    today: {
      eyebrow: todayWorkspaceOpen ? `전 회차 학습기록 · ${selectedSubjectInfo.name}` : "Agent brief · 전 회차 학습기록",
      title: todayWorkspaceOpen
        ? displayQueue.length ? "지금 다시 볼 개념과 근거" : "한 회차를 채점하면 진단이 시작됩니다"
        : dashboardLead ? "오늘은 이 한 가지부터" : "첫 기록을 만들면 에이전트가 시작합니다",
    },
    questions: { eyebrow: `${selectedSubjectInfo.name} · 40문항`, title: "문항별 개념과 계산 경향" },
    exam: { eyebrow: `제${examRound}회 · ${examSubjectInfo.name}`, title: "회차를 골라 실전처럼 풉니다" },
    analysis: {
      eyebrow: analysisAudience === "learner" ? "DEMO 세트 40~49 · 합성 문항" : `강의 인사이트 · 합성 학습자 ${instructorDataset?.learnerCount ?? 0}명`,
      title: analysisAudience === "learner" ? "다음에 복습할 내용 키워드" : "이번에 보강할 한 가지",
    },
    lectures: { eyebrow: `제${lectureRound}회 · ${selectedSubjectInfo.name}`, title: "해당 회차의 취약개념에 맞는 강의 후보" },
    pipeline: { eyebrow: "데모 · 개발자 증거 · Daytona HackSprint Seoul 2026", title: "실행 증거" },
  };

  if (accessState === "loading") return <AccessLoading />;
  if (accessState === "unauthenticated") {
    return (
      <><ExamStageNavigation stage="first" /><LearnerAccess
        onAuthenticated={(account) => {
          setLearner(account);
          setAccessState("authenticated");
        }}
        onGuest={() => setAccessState("guest")}
      /></>
    );
  }

  if (examTrack === "jlpt") return <JlptExperiment onBack={() => setExamTrack("insurance")} />;
  if (examTrack === "essay") return <EssayExperiment onBack={() => setExamTrack("insurance")} />;

  return (
    <main className={`app-shell ${focusMode && view === "today" ? "focus-mode" : ""}`}>
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">EC</div>
          <div><strong>Exam Coach</strong><span>1차 시험 · 객관식</span></div>
        </div>

        <button className="sidebar-primary" onClick={() => openSubjectExam(sidebarSubject, sidebarRound)} type="button">
          <Play aria-hidden="true" />
          <span><strong>바로 이어풀기</strong><small>제{sidebarRound}회 {sidebarSubjectInfo.name}</small><small>{getQuickExamStatus(sidebarSubject, sidebarRound).replace(`${sidebarRound}회 · `, "")}</small></span>
          <ChevronRight aria-hidden="true" />
        </button>

        <nav className="side-nav" aria-label="학습 메뉴">
          <button className={`nav-item ${view === "analysis" && analysisAudience === "instructor" ? "active" : ""}`} onClick={openInstructorInsight} type="button">
            <UserRound aria-hidden="true" /><span>강의 인사이트</span>
          </button>
          <button className={`nav-item ${view === "today" ? "active" : ""}`} onClick={openTodayDashboard} type="button">
            <LayoutDashboard aria-hidden="true" /><span>한눈에 보기</span>
          </button>
          <button className={`nav-item ${view === "exam" ? "active" : ""}`} onClick={openExam} type="button">
            <ClipboardCheck aria-hidden="true" /><span>회차별 풀이</span>
          </button>
          <button className={`nav-item ${view === "analysis" && analysisAudience === "learner" ? "active" : ""}`} onClick={openAnalysis} type="button">
            <BarChart3 aria-hidden="true" /><span>전회차 분석</span>
          </button>
          <button className={`nav-item ${view === "lectures" ? "active" : ""}`} onClick={() => setView("lectures")} type="button">
            <BookOpen aria-hidden="true" /><span>추천 강의</span>
          </button>
        </nav>

        <div className="subject-block">
          <span className="section-label">회차별 풀이 바로가기 · {sidebarRound}회</span>
          <div className="sidebar-subject-list">
            {subjectOptions.map((subject) => (
              <button
                className={`subject-button ${(view === "exam" && subject.code === examSubject) || ((view === "today" || view === "lectures") && subject.code === selectedSubject) ? "active" : ""}`}
                key={subject.code}
                onClick={() => openSubjectExam(subject.code, sidebarRound)}
                type="button"
              >
                <strong>{subject.name}</strong>
                <small>{getQuickExamStatus(subject.code, sidebarRound)}</small>
              </button>
            ))}
          </div>
        </div>

        <details className="sidebar-demo" ref={demoDetailsRef}>
          <summary>데모 · 개발자 증거</summary>
          <div className="sidebar-demo-body">
            <p>Daytona 구조 검사와 Nosana 합성 예시 생성 기록입니다. 학습 진단과 분리되어 있으며, 개인 답안은 전송하지 않습니다.</p>
            <button className={view === "pipeline" ? "active" : ""} onClick={openPipeline} type="button">
              <Activity aria-hidden="true" />
              <span>{view === "pipeline" ? "실행 증거 보는 중" : "실행 증거 열기"}</span>
            </button>
          </div>
        </details>

        <div className={`learner-card ${accessState === "guest" ? "guest" : ""}`}>
          <UserRound aria-hidden="true" />
          <span>
            <strong>{learner?.nickname ?? "데모 방문자"}</strong>
            <small>{learner ? `서버 저장 ${learner.attemptCount}회 · ${learner.answerCount}문항` : "새 기록은 이 기기에만 저장"}</small>
          </span>
          <button aria-label={learner ? "로그아웃" : "학습 기록 저장 시작"} onClick={signOut} type="button"><LogOut aria-hidden="true" /></button>
        </div>
      </aside>

      <section className="workspace">
        <ExamStageNavigation stage="first" />
        <div className="review-boundary" role="note">
          <Info aria-hidden="true" />
          <span><b>합성 연습</b> SYNTHETIC DEMO · 문항, 기본 풀이 이력과 분석은 합성 자료입니다. 실제 시험 문항·개인 학습 성과·교재 발췌가 아닙니다. Daytona·Nosana 실행 증거는 사이드바의 데모 · 개발자 증거에 있습니다.</span>
        </div>
        <header className="topbar">
          <div><p className="eyebrow">{titles[view].eyebrow}</p><h1>{titles[view].title}</h1></div>
          {view !== "pipeline" && !(view === "today" && !todayWorkspaceOpen) && <div className="score-strip" aria-label="학습 기록 요약">
            {view === "exam" ? (
              <>
                <div><span>{viewedLegacyAttempt ? "기록 문항" : "응답 완료"}</span><strong>{examAnsweredCount}<small>/40</small></strong></div>
                <div><span>현재 문항</span><strong>{examQuestionNo}<small>번</small></strong></div>
                <div><span>{viewedLegacyAttempt ? `${viewedLegacyAttempt.attemptNo}회독 점수` : "채점 결과"}</span><strong className={displayedExamSubmitted ? "positive" : ""}>{displayedExamSubmitted ? displayedExamScore : "-"}<small>/40</small></strong></div>
              </>
            ) : view === "analysis" ? (
              analysisAudience === "instructor" ? (
                <>
                  <div><span>집계 학습자</span><strong>{instructorDataset?.learnerCount ?? 0}<small>명</small></strong></div>
                  <div><span>완료 풀이</span><strong>{instructorDataset?.attemptCount ?? 0}<small>회</small></strong></div>
                  <div><span>강의 보강 후보</span><strong className="positive">{instructorLectureCandidateCount}<small>개</small></strong></div>
                </>
              ) : (
                <>
                  <div><span>분석 회차</span><strong>10<small>개</small></strong></div>
                  <div><span>합성 문항</span><strong>1,200<small>개</small></strong></div>
                  <div><span>완료 회독</span><strong className="positive">{completedAttemptCount}<small>개</small></strong></div>
                </>
              )
            ) : view === "lectures" ? (
              <>
                <div><span>선택 회차</span><strong>{lectureRound}<small>회</small></strong></div>
                <div><span>추천 후보</span><strong className={lectureCandidates.length ? "danger" : ""}>{lectureCandidates.length}<small>개</small></strong></div>
                <div><span>근거 연결</span><strong className="positive">{lectureCandidates.filter((item) => Boolean((evidenceData as EvidenceIndex).matches[item.id]?.length)).length}<small>개</small></strong></div>
              </>
            ) : view === "today" ? (
              <>
                <div><span>학습 회차</span><strong>{todayRoundCounts[selectedSubject]}<small>개</small></strong></div>
                <div><span>복습 후보</span><strong className={displayQueue.length ? "danger" : ""}>{displayQueue.length}<small>개</small></strong></div>
                <div><span>높은 우선도</span><strong className={todayHighPriorityCount ? "danger" : "positive"}>{todayHighPriorityCount}<small>개</small></strong></div>
              </>
            ) : (
              <>
                <div><span>현재 점수</span><strong>{subjectScore ?? "-"}<small>/40</small></strong></div>
                {selectedSubjectInfo.hasDiagnostics ? (
              <>
                <div><span>불안정</span><strong className="danger">{diagnosisData.summary.statusCounts.불안정}<small>문항</small></strong></div>
                <div><span>개선</span><strong className="positive">{diagnosisData.summary.statusCounts.개선}<small>문항</small></strong></div>
              </>
            ) : (
              <>
                <div><span>진단 기록</span><strong>0<small>문항</small></strong></div>
                <div><span>합성 데이터</span><strong className="positive">40<small>문항</small></strong></div>
              </>
                )}
              </>
            )}
          </div>}
        </header>


        {view === "today" && todayWorkspaceOpen && (
          <div className="today-workspace-heading">
            <button onClick={openTodayDashboard} type="button"><ChevronLeft aria-hidden="true" />한눈에 보기</button>
            <span>{selectedSubjectInfo.name} · 상세 복습 {displayQueue.length}개</span>
          </div>
        )}

        {((view === "today" && todayWorkspaceOpen) || view === "questions") && <div className="subject-switcher" role="tablist" aria-label={view === "today" ? "전 회차 진단 과목 선택" : "제48회 과목 선택"}>
          {subjectOptions.map((subject) => (
            <button
              aria-selected={subject.code === selectedSubject}
              className={subject.code === selectedSubject ? "active" : ""}
              key={subject.code}
              onClick={() => changeSubject(subject.code)}
              role="tab"
              type="button"
            >
              <strong>{subject.name}</strong><small>{view === "today"
                ? todayRoundCounts[subject.code]
                  ? `${todayRoundCounts[subject.code]}회차 기록 · ${todayQueues[subject.code].length}개 복습`
                  : "학습 기록 없음"
                : subject.note}</small>
            </button>
          ))}
        </div>}

        {view === "today" && !todayWorkspaceOpen && (
          <>
          <details className="service-overview">
          <summary>서비스 소개 · 학습 기록 예시</summary>
          <section className="wanted-demo-overview" aria-label="제출용 서비스 요약">
            <div>
              <span className="section-label">AI Exam Coach</span>
              <h2>문제은행 풀이를 학습 행동으로 바꾸는 엔진</h2>
              <p>학습자는 오답 이유와 다음 복습을 보고, 강사는 취약 개념과 계산·수치 오류 경향을 지도에 활용합니다.</p>
            </div>
            <div className="wanted-loop-proof" aria-label="Learning Loop 예시">
              <span>Learning Loop</span>
              <strong>선택 → 진단 → 재풀이</strong>
              <small>합성 기록으로 보여주는 동작 예시 · 성과 수치 아님</small>
            </div>
            <div className="wanted-demo-actions">
              <button onClick={() => openSubjectExam("THEORY", 48, null, 33)} type="button"><ClipboardCheck aria-hidden="true" />문제풀이 보기</button>
              <button onClick={openInstructorInsight} type="button"><BarChart3 aria-hidden="true" />강의 인사이트</button>
            </div>
          </section>
          </details>
          <section className="agent-dashboard" aria-labelledby="agent-prescription-title">
            <div className="agent-prescription">
              <div className="agent-prescription-heading">
                <span><Cpu aria-hidden="true" />오늘 먼저 복습할 내용</span>
                {dashboardLead && <b>복습 우선도 {dashboardLead.item.priorityScore ?? "측정 전"}</b>}
              </div>
              {dashboardLead ? (
                <>
                  <p className="agent-prescription-meta">제{dashboardLead.item.round}회 · {dashboardLead.subject.name} · Q{dashboardLead.item.questionNo}</p>
                  <h2 id="agent-prescription-title">{dashboardLead.item.concept}</h2>
                  <p className="agent-prescription-diagnosis">{dashboardLead.item.diagnosis}</p>
                  <div className="agent-rationale">
                    <span>왜 지금?</span>
                    <strong>{dashboardLead.item.recordSummary ?? dashboardLead.item.sourceNote ?? `제${dashboardLead.item.round}회 저장 기록에서 반복 혼동이 확인됐습니다.`}</strong>
                  </div>
                  <div className="agent-next-action">
                    <span>다음 학습</span>
                    <strong>{dashboardLead.item.nextAction}</strong>
                  </div>
                  <button className="agent-start-button" onClick={() => selectQuestion(dashboardLead.item.id)} type="button">
                    <Play aria-hidden="true" />이 복습 시작<ChevronRight aria-hidden="true" />
                  </button>
                </>
              ) : (
                <>
                  <h2 id="agent-prescription-title">아직 비교할 풀이 기록이 없습니다.</h2>
                  <p className="agent-prescription-diagnosis">한 회차를 채점하면 에이전트가 오답, 회독 변화와 문항 유형을 비교해 다음 한 행동을 고릅니다.</p>
                  <button className="agent-start-button" onClick={() => openSubjectExam("BIZ", 48)} type="button">
                    <ClipboardCheck aria-hidden="true" />첫 진단 시작<ChevronRight aria-hidden="true" />
                  </button>
                </>
              )}
              <dl className="agent-dashboard-summary">
                <div><dt>복습 후보</dt><dd>{dashboardReviewTotal}</dd></div>
                <div><dt>높은 우선도</dt><dd>{dashboardHighPriorityTotal}</dd></div>
                <div><dt>예약 복습</dt><dd>{serverReviewQueue.length}</dd></div>
              </dl>
            </div>

            <aside className="subject-dashboard" aria-labelledby="subject-dashboard-title">
              <div className="subject-dashboard-heading">
                <span className="section-label">3과목 상태</span>
                <h2 id="subject-dashboard-title">지금 어디까지 왔는지</h2>
              </div>

              <div className="dashboard-progress-overview">
                <div
                  aria-label={`합성 문항 진도 ${dashboardProgressPercent}%`}
                  className="dashboard-progress-ring"
                  role="img"
                  style={{ background: `conic-gradient(var(--teal) ${dashboardProgressPercent}%, #e5eaed 0)` }}
                >
                  <span><strong>{dashboardProgressPercent}%</strong><small>전체 진도</small></span>
                </div>
                <div className="dashboard-progress-copy">
                  <span>40~49회 · 3과목</span>
                  <strong>{dashboardCompletedCount}<small>/30 학습단위</small></strong>
                  <div
                    aria-label={`30개 학습단위 중 ${dashboardCompletedCount}개 완료`}
                    aria-valuemax={30}
                    aria-valuemin={0}
                    aria-valuenow={dashboardCompletedCount}
                    className="dashboard-progress-bar"
                    role="progressbar"
                  >
                    <i style={{ width: `${dashboardProgressPercent}%` }} />
                  </div>
                </div>
              </div>

              <ol aria-label="학습 루프 진행 상태" className="dashboard-loop-track">
                {dashboardLoopStages.map((stage) => (
                  <li className={stage.state} key={stage.label}>
                    {stage.state === "complete" ? <CheckCircle2 aria-hidden="true" /> : <CircleDashed aria-hidden="true" />}
                    <strong>{stage.label}</strong>
                    <small>{stage.value}</small>
                  </li>
                ))}
              </ol>

              <div className="dashboard-review-pulse" role="status">
                <RotateCcw aria-hidden="true" />
                <span><strong>간격복습</strong><small>{dashboardDueReviewCount > 0
                  ? `오늘 ${dashboardDueReviewCount}개 · 이후 ${dashboardPendingReviewCount}개`
                  : dashboardPendingReviewCount > 0
                    ? `예정 ${dashboardPendingReviewCount}개`
                    : "40문항 채점 후 일정 생성"}</small></span>
              </div>

              <div className="subject-dashboard-list">
                {dashboardSubjectProgress.map((subject) => {
                  const queue = todayQueues[subject.code];
                  return (
                    <button key={subject.code} onClick={() => openTodaySubject(subject.code)} type="button">
                      <span className="subject-progress-title"><strong>{subject.name}</strong><b>{subject.percentage}%</b></span>
                      <span className="subject-progress-meta">{subject.completed}/10회 · {queue.length}개 복습</span>
                      <span
                        aria-label={`${subject.name} 진도 ${subject.percentage}%`}
                        aria-valuemax={100}
                        aria-valuemin={0}
                        aria-valuenow={subject.percentage}
                        className="subject-progress-bar"
                        role="progressbar"
                      ><i style={{ width: `${subject.percentage}%` }} /></span>
                      <ChevronRight aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
              <button className="dashboard-analysis-link" onClick={openAnalysis} type="button">
                전회차 분석 보기<ChevronRight aria-hidden="true" />
              </button>
            </aside>
          </section>
          </>
        )}

        {view === "today" && todayWorkspaceOpen && (
          <>
          <div className="today-context-band" role="note">
            <div><span>선정 범위</span><strong>{todayRoundCounts[selectedSubject] ? `저장된 ${todayRoundCounts[selectedSubject]}개 회차` : "저장된 기록 없음"}</strong></div>
            <div><span>정렬 기준</span><strong>최근 정오 · 반복 오답 · 회독 변동 · 문항 복잡도 · 재검 시급성</strong></div>
            <button onClick={openAnalysis} type="button">전회차 분석 보기<ChevronRight aria-hidden="true" /></button>
          </div>
          {displayQueue.length === 0 ? (
            <section className="today-empty-state" aria-labelledby="today-empty-title">
              <ClipboardCheck aria-hidden="true" />
              <div><span className="section-label">진단 준비</span><h2 id="today-empty-title">{selectedSubjectInfo.name}의 저장된 풀이 기록이 없습니다.</h2><p>한 회차 40문항을 채점하면 오답과 회독 변화를 바탕으로 복습 우선도와 강의 후보가 자동으로 연결됩니다.</p></div>
              <button onClick={() => openSubjectExam(selectedSubject, 48)} type="button">제48회 진단 시작<ChevronRight aria-hidden="true" /></button>
            </section>
          ) : (
          <div className={`work-grid ${focusMode ? "diagnosis-focused" : ""}`}>
            <section className="queue-panel" aria-labelledby="queue-title">
              <div className="panel-heading">
                <div>
                  <span className="section-label">전 회차 · 우선도순</span>
                  <h2 id="queue-title">오늘의 복습큐</h2>
                </div>
                <span className="count-badge">{displayQueue.length}</span>
              </div>
              <div className="queue-list">
                {displayQueue.map((item) => {
                  const run = agentRuns[item.id];
                  return (
                    <div className={`queue-item ${item.id === selectedDiagnostic.id ? "selected" : ""}`} key={item.id}>
                      <button className="queue-select" onClick={() => selectQuestion(item.id)} type="button">
                        <span className={`status-dot ${run ? run.correct ? "improved" : "unstable" : item.status === "불안정" ? "unstable" : item.status === "개선" ? "improved" : "pending"}`} />
                        <span className="queue-copy">
                          <span className="queue-meta">제{item.round}회 · Q{item.questionNo} · {item.domain}</span>
                          <strong>{item.concept}</strong><span>{run?.diagnosis ?? item.diagnosis}</span>
                        </span>
                      </button>
                      <PriorityIndex item={item} run={run} />
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="detail-panel" aria-labelledby="question-title">
              {reviewQuestionLoading || !selectedQuestionReady ? (
                <div className="today-question-state" role="status"><LoaderCircle aria-hidden="true" /><div><strong>제{selectedDiagnostic.round}회 문항을 불러오고 있습니다.</strong><span>선택한 회차의 문제와 저장된 풀이 기록을 연결합니다.</span></div></div>
              ) : reviewQuestionError ? (
                <div className="today-question-state error" role="alert"><Info aria-hidden="true" /><div><strong>문항을 불러오지 못했습니다.</strong><span>{reviewQuestionError}</span></div></div>
              ) : <>
              <div className="detail-toolbar">
                {hasStoredFirstAttempt ? (
                  <div className="segmented" aria-label="보기 모드">
                    <button className={mode === "diagnosis" ? "active" : ""} onClick={() => setMode("diagnosis")} type="button">진단</button>
                    <button className={mode === "retry" ? "active" : ""} onClick={beginRetry} type="button">
                      <RotateCcw aria-hidden="true" />재풀이
                    </button>
                  </div>
                ) : (
                  <div className="segmented" aria-label="풀이 단계">
                    <button className="active" type="button">1회차 풀이</button>
                  </div>
                )}
                <div className="detail-toolbar-actions">
                  <StatusPill status={displayStatus} />
                  <button
                    aria-pressed={focusMode}
                    className={`focus-mode-button ${focusMode ? "active" : ""}`}
                    onClick={() => setFocusMode((current) => !current)}
                    title={focusMode ? "전체 화면 구성으로 돌아가기" : "진단 결과에만 집중하기"}
                    type="button"
                  >
                    {focusMode ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
                    {focusMode ? "전체 보기" : "진단 집중"}
                  </button>
                </div>
              </div>

              <div className="today-selection-reason">
                <span>왜 오늘 보나요?</span>
                <strong>{selectedDiagnostic.recordSummary ?? selectedDiagnostic.sourceNote ?? `제${selectedTodayRound}회 저장 기록`}</strong>
                <p>{selectedDiagnostic.diagnosis} · 복습 우선도 {selectedDiagnostic.priorityScore ?? "측정 전"}</p>
              </div>

              <div className="question-header">
                <p>제{selectedQuestion.round}회 · Q{selectedQuestion.questionNo} · {selectedQuestion.domain}</p>
                <h2 id="question-title">{selectedQuestion.presentation?.prompt ?? selectedQuestion.questionText}</h2>
                {selectedQuestion.presentation?.context && (
                  <div className="question-context"><span>{selectedQuestion.presentation.context.label}</span><p>{selectedQuestion.presentation.context.text}</p></div>
                )}
                {selectedQuestion.presentation?.dataTable && <StructuredQuestionData table={selectedQuestion.presentation.dataTable} />}
                {selectedQuestion.presentation && selectedQuestion.presentation.statements.length > 0 && (
                  <div className={`internal-statements ${selectedQuestion.presentation.structure}`}>
                    {selectedQuestion.presentation.statements.map((statement, index) => (
                      <div key={`${statement.marker}-${index}`}><b>{statement.marker === "•" || statement.marker === "․" ? "•" : statement.marker}</b><p>{statement.text}</p></div>
                    ))}
                  </div>
                )}
                <div className="tag-row">{selectedQuestion.keywords.slice(0, 4).map((keyword) => <span key={keyword}>{keyword}</span>)}</div>
              </div>

              <div className="choices" aria-label="선택지">
                {symbols.map((symbol) => {
                  const isSelected = isSolveMode && !submitted && symbol === selectedChoice;
                  const isCorrect = canRevealAnswer && submitted && symbol === correctChoice;
                  const isWrong = canRevealAnswer && submitted && symbol === submittedChoice && symbol !== correctChoice;
                  return (
                    <button
                      aria-pressed={isSelected}
                      className={`${isSelected ? "selected" : ""} ${isCorrect ? "correct" : ""} ${isWrong ? "wrong" : ""}`}
                      disabled={!isSolveMode || submitted}
                      key={symbol}
                      onClick={() => setDraftChoices((current) => ({ ...current, [selectedQuestion.id]: symbol }))}
                      type="button"
                    >
                      <b>{symbol}</b><span>{selectedQuestion.choices[symbol]}</span>
                    </button>
                  );
                })}
              </div>

              {isSolveMode && !submitted && (
                <button className="primary-button answer-submit" disabled={!selectedChoice} onClick={submitAnswer} type="button">
                  답안 제출
                </button>
              )}

              <div
                aria-live="polite"
                className={`diagnosis-stage ${selectedRun ? "ready" : ""} ${diagnosisSpotlight ? "spotlight" : ""}`}
                ref={diagnosisResultRef}
                tabIndex={-1}
              >
                {selectedRun && (
                  <section className="diagnosis-value-chain" aria-label="선택에서 다음 학습까지의 진단 흐름">
                    <div><span>내 선택</span><strong>{selectedRun.selectedChoice}</strong></div>
                    <ChevronRight aria-hidden="true" />
                    <div><span>취약 개념</span><strong>{selectedRun.diagnosis}</strong></div>
                    <ChevronRight aria-hidden="true" />
                    <div><span>강사 자료</span><strong>{activeEvidence ? `p.${activeEvidence.page}` : "연결 대기"}</strong></div>
                    <ChevronRight aria-hidden="true" />
                    <div><span>다음 학습</span><strong>{selectedRun.recommendation.stage}</strong></div>
                  </section>
                )}

                {isAnalyzing ? (
                  <div className="agent-loading" role="status">
                    <LoaderCircle aria-hidden="true" />
                    <div><strong>근거를 찾고 오답 패턴을 분석하고 있습니다.</strong><span>데모 기준 정답 확인 · 강사 자료 검색 · 다음 학습 결정</span></div>
                  </div>
                ) : !canRevealAnswer ? (
                  <div className="retry-prompt">
                    <strong>{hasStoredFirstAttempt ? "다시 풀어보세요." : "1회차 풀이 중"}</strong>
                    <span>답안을 제출하기 전에는 정답과 코치 진단이 공개되지 않습니다.</span>
                  </div>
                ) : (
                  <div className="coach-band">
                    <section>
                      <span className="section-label">코치 진단</span>
                      <h3>
                        {selectedRun
                          ? selectedRun.diagnosis
                          : submitted
                          ? submittedChoice === correctChoice
                            ? `${hasStoredFirstAttempt ? "재풀이" : "1회차"} 정답입니다`
                            : "선택한 답과 정답을 비교하세요"
                          : selectedDiagnostic.diagnosis}
                      </h3>
                      <p>
                        {selectedRun
                          ? `${selectedRun.whyWrong} ${selectedRun.nextAction}`
                          : submitted && !hasStoredFirstAttempt
                          ? "강의 근거가 연결되면 이 답안을 바탕으로 오답 원인과 복습 우선도를 계산합니다."
                          : selectedDiagnostic.nextAction}
                      </p>
                    </section>
                    <dl>
                      <div><dt>1회독</dt><dd>{hasStoredFirstAttempt ? selectedDiagnostic.attempts[0] : answerNumbers[submittedChoice ?? ""] ?? "-"}</dd></div>
                      <div><dt>2회독</dt><dd>{selectedDiagnostic.attempts[1] ?? "-"}</dd></div>
                      <div><dt>정답</dt><dd>{correctChoice}</dd></div>
                    </dl>
                  </div>
                )}

                {selectedRun?.intervention && (
                  <div className="coach-intervention-note" role="status">
                    <Activity aria-hidden="true" />
                    <span>
                      <b>강의 보강 반영</b>
                      <strong>{selectedRun.intervention.actionLabel}</strong>
                      <small>
                        {selectedRun.intervention.evidenceMaterial
                          ? `${selectedRun.intervention.evidenceMaterial}${selectedRun.intervention.evidencePage ? ` · p.${selectedRun.intervention.evidencePage}` : ""}`
                          : "강사 보강 자료"}
                        {selectedRun.analysisSignal.reviewDueAt
                          ? ` · 권장 재풀이 ${new Date(selectedRun.analysisSignal.reviewDueAt).toLocaleString("ko-KR")}`
                          : ""}
                      </small>
                    </span>
                  </div>
                )}

                {analysisError && <p className="analysis-error" role="alert">{analysisError} 다시 제출해 주세요.</p>}

                {selectedRun?.choiceAnalysis && !selectedRun.correct && (
                  <section className="choice-analysis" aria-labelledby="choice-analysis-title">
                    <div className="choice-analysis-heading">
                      <div>
                        <span className="section-label">선택지 단위 진단</span>
                        <h3 id="choice-analysis-title">{selectedRun.choiceAnalysis.axis}</h3>
                      </div>
                      <small>{selectedRun.choiceAnalysis.source}</small>
                    </div>
                    <div className="choice-analysis-contrast">
                      <article>
                        <span>내 선택 {submittedChoice}</span>
                        <strong>{selectedRun.choiceAnalysis.selectedInterpretation}</strong>
                      </article>
                      <article>
                        <span>데모 기준 정답 {correctChoice}</span>
                        <strong>{selectedRun.choiceAnalysis.correctPrinciple}</strong>
                      </article>
                    </div>
                    <div className="choice-analysis-path">
                      <div>
                        <span>{selectedRun.choiceAnalysis.calculationStage ? "오류 단계" : "다시 판단할 순서"}</span>
                        {selectedRun.choiceAnalysis.calculationStage && <strong>{selectedRun.choiceAnalysis.calculationStage}</strong>}
                      </div>
                      <ol>
                        {selectedRun.choiceAnalysis.reasoningSteps.map((step) => <li key={step}>{step}</li>)}
                      </ol>
                    </div>
                    <div className="choice-analysis-terms">
                      <span>복습 핵심어</span>
                      {selectedRun.choiceAnalysis.focusTerms.map((term) => <b key={term}>{term}</b>)}
                    </div>
                  </section>
                )}
              </div>

              <div className="resource-grid">
                <section className="resource-block evidence">
                  <span className="section-label">학습 근거</span>
                  <h3>{canRevealAnswer ? activeEvidence ? `${activeEvidence.material} · p.${activeEvidence.page}` : "강사 자료 연결 대기" : "답안 제출 후 근거 검색"}</h3>
                  <p>
                    {canRevealAnswer && evidenceOpen && activeEvidence
                      ? `${activeEvidence.snippet} 출처: ${activeEvidence.sourceFile}`
                      : canRevealAnswer && activeEvidence
                        ? `일치어 ${activeEvidence.matchedTerms.join(" · ")} · 근거 신뢰도 ${activeEvidence.confidence}`
                        : canRevealAnswer
                          ? "현재 색인에서 일치하는 강사 자료 페이지를 찾지 못했습니다. 근거를 임의로 만들지 않고 연결 대기로 둡니다."
                          : "학생 입력이 아닌 강사 자료·전사·교재를 우선 근거로 사용합니다."}
                  </p>
                  {showLiveEvidencePreview && liveEvidenceAssessment && (
                    <aside className="live-evidence-preview" aria-label="최신 공식 근거 갱신 미리보기">
                      <div className="live-evidence-preview-heading">
                        <span><CheckCircle2 aria-hidden="true" />최신 공식 근거</span>
                        <b>시연용 목 · 외부 호출 없음</b>
                      </div>
                      <div className="live-evidence-decision">
                        <span>근거 갱신 판단</span>
                        <strong>기존 진단 유지</strong>
                        <p>허용된 공식 출처 {liveEvidenceAssessment.evidenceIds.length}건이 현재 검수 진단과 일치하는 경우의 화면입니다.</p>
                      </div>
                      <ol className="live-evidence-route">
                        <li><b>Tavily</b><span>공식 근거 발견</span></li>
                        <li><b>Bright Data</b><span>대체 접근 미사용</span></li>
                        <li><b>Nebius</b><span>진단 유지 판단 · 목</span></li>
                      </ol>
                      <small>2026-08-26 확인 · 실제 연동 전 UI·데이터 계약 검증 단계</small>
                    </aside>
                  )}
                  <button disabled={!canRevealAnswer || !activeEvidence} onClick={() => setEvidenceOpen((open) => !open)} type="button"><FileText aria-hidden="true" />{evidenceOpen ? "근거 닫기" : "근거 보기"}</button>
                </section>
                <section className="resource-block lecture">
                  <span className="section-label">추천 학습</span>
                  <h3>{canRevealAnswer ? lectureTitle : "진단 후 추천"}</h3>
                  <p>
                    {canRevealAnswer
                      ? `${selectedRun?.recommendation.stage ?? "Essential"} 단계 · ${selectedRun?.recommendation.reason ?? "취약개념을 강사 자료에서 먼저 확인합니다."}`
                      : "답안을 제출하면 현재 회독과 오답 유형에 맞춰 Essential·Drill·the Final 중 다음 단계를 고릅니다."}
                  </p>
                  <button onClick={openSelectedLecture} type="button"><BookOpen aria-hidden="true" />이 개념의 강의 후보</button>
                </section>
              </div>

              {selectedRun && (
                <section className="agent-trace" aria-labelledby="agent-trace-title">
                  <div className="trace-heading">
                    <div><span className="section-label">에이전트 실행 기록</span><h3 id="agent-trace-title">근거에서 다음 행동까지</h3></div>
                    <span className={`provider-badge ${selectedRun.provider.mode}`}><Cpu aria-hidden="true" />{selectedRun.provider.name}{selectedRun.provider.model ? ` · ${selectedRun.provider.model}` : ""}</span>
                  </div>
                  <div className="trace-list">
                    {selectedRun.trace.map((item) => (
                      <article key={item.step}>
                        {item.status === "complete" ? <CheckCircle2 aria-hidden="true" /> : <CircleDashed aria-hidden="true" />}
                        <div><span>{item.provider}</span><strong>{item.step}</strong><p>{item.detail}</p></div>
                      </article>
                    ))}
                  </div>
                </section>
              )}
              </>}
            </section>
          </div>
          )}
          </>
        )}

        {view === "exam" && (
          <section className="exam-workspace" aria-labelledby="exam-title">
            <div className="exam-control-band">
              <label>
                <span>응시 회차</span>
                <select value={examRound} onChange={(event) => changeExamRound(Number(event.target.value))}>
                  {Array.from({ length: 10 }, (_, index) => index + 40).map((round) => <option key={round} value={round}>제{round}회</option>)}
                </select>
              </label>
              <div className="exam-subject-control" role="group" aria-label="응시 과목">
                {subjectOptions.map((subject) => (
                  <button className={subject.code === examSubject ? "active" : ""} key={subject.code} onClick={() => changeExamSubject(subject.code)} type="button">
                    {subject.name}
                  </button>
                ))}
              </div>
              <div className="exam-progress-copy">
                <span>{viewedLegacyAttempt ? "기록 검토" : "진행률"}</span>
                <strong>{examAnsweredCount}/40</strong>
                <div><i style={{ width: `${(examAnsweredCount / 40) * 100}%` }} /></div>
              </div>
            </div>

            {scopedLegacyAttempts.length > 0 && (
              <div className="exam-history-band" aria-label="과거 풀이 기록">
                <div className="history-band-title">
                  <FileSpreadsheet aria-hidden="true" />
                  <span><strong>과거 풀이 기록</strong><small>{legacyPayload.metadata.sourceFile} · 문항별 답안 포함</small></span>
                </div>
                <div className="history-attempt-buttons">
                  {scopedLegacyAttempts.map((attempt) => (
                    <button
                      className={viewedLegacyAttemptId === attempt.id ? "active" : ""}
                      key={attempt.id}
                      onClick={() => {
                        setViewedLegacyAttemptId(attempt.id);
                        setExamQuestionNo(1);
                      }}
                      type="button"
                    >
                      <span>{attempt.attemptNo}회독</span><strong>{attempt.score}<small>/40</small></strong>
                    </button>
                  ))}
                  <button
                    className={viewedLegacyAttemptId === null ? "active current-attempt" : "current-attempt"}
                    onClick={() => {
                      setViewedLegacyAttemptId(null);
                      setExamQuestionNo(1);
                    }}
                    type="button"
                  >
                    <span>{nextAttemptNo}회독</span><strong>{examSession.submitted ? `${examSession.score}/40` : "시작"}</strong>
                  </button>
                </div>
              </div>
            )}

            {examLoading ? (
              <div className="exam-loading"><LoaderCircle aria-hidden="true" /><span>합성 데모 문항을 불러오고 있습니다.</span></div>
            ) : examError ? (
              <p className="analysis-error" role="alert">{examError}</p>
            ) : activeExamQuestion ? (
              <div className="exam-layout">
                <aside className="exam-navigator" aria-label="문항 이동">
                  <div className="panel-heading">
                    <div><span className="section-label">제{examRound}회 · {examSubjectInfo.name}</span><h2>40문항</h2></div>
                    <StatusPill status={viewedLegacyAttempt ? `${viewedLegacyAttempt.attemptNo}회독 기록` : examSession.submitted ? "채점 완료" : "풀이 중"} />
                  </div>
                  <div className="question-number-grid">
                    {examQuestions.map((question) => {
                      const answer = displayedExamAnswers[question.id];
                      const legacyRecord = viewedLegacyAttempt?.records.find((record) => record.questionId === question.id);
                      const result = displayedExamSubmitted
                        ? (legacyRecord?.correct ?? examSession.results?.[question.id]?.correct) ? "correct" : "wrong"
                        : answer ? "answered" : "";
                      return (
                        <button
                          aria-label={`${question.questionNo}번${legacyRecord?.recordState === "marked-unknown" ? " W 표기" : answer ? " 답변 완료" : ""}`}
                          className={`${question.questionNo === examQuestionNo ? "current" : ""} ${result}`}
                          key={question.id}
                          onClick={() => setExamQuestionNo(question.questionNo)}
                          type="button"
                        >
                          {question.questionNo}
                        </button>
                      );
                    })}
                  </div>
                  {displayedExamSubmitted ? (
                    <div className="exam-result-summary">
                      <span>{viewedLegacyAttempt ? `${viewedLegacyAttempt.attemptNo}회독 과거 점수` : "채점 결과"}</span><strong>{displayedExamScore}<small>/40</small></strong>
                      {!viewedLegacyAttempt && examSession.submitted && (
                        <p className={`server-save-state ${examSession.serverSaved ? "saved" : "local"}`}>
                          {examSession.serverSaved
                            ? `학습 기록 서버 저장 완료${examSession.serverAttemptNo ? ` · ${examSession.serverAttemptNo}회독` : ""}${examSession.reviewTasksScheduled !== undefined ? ` · 24시간 복습 ${examSession.reviewTasksScheduled}문항 예약` : ""}`
                            : learner ? "서버 저장 실패 · 이 기기에 임시 보관" : "데모 기록 · 이 기기에만 보관"}
                        </p>
                      )}
                      <button onClick={resetExam} type="button"><RotateCcw aria-hidden="true" />{viewedLegacyAttempt ? `${nextAttemptNo}회독 시작` : "다시 풀기"}</button>
                    </div>
                  ) : (
                    <div className="exam-finish-block">
                      <button className="primary-button" disabled={examAnsweredCount !== 40 || examGrading} onClick={finishExam} type="button">
                        {examGrading ? <LoaderCircle aria-hidden="true" /> : <Flag aria-hidden="true" />}{examGrading ? "데모 기준 답안으로 채점 중" : "40문항 채점하기"}
                      </button>
                      <p>{examAnsweredCount === 40 ? "채점하면 전체 정답이 공개됩니다." : `정답은 남은 ${40 - examAnsweredCount}문항을 완료한 뒤 공개됩니다.`}</p>
                    </div>
                  )}
                </aside>

                <section className="exam-question-panel" aria-labelledby="exam-title">
                  <div className="exam-question-meta">
                    <span>Q{activeExamQuestion.questionNo} · {activeExamQuestion.domain}</span>
                    <small>{activeExamQuestion.classificationSource}</small>
                  </div>
                  <h2 id="exam-title">{activeExamQuestion.presentation?.prompt ?? activeExamQuestion.questionText}</h2>
                  {activeExamQuestion.presentation?.context && (
                    <div className="question-context"><span>{activeExamQuestion.presentation.context.label}</span><p>{activeExamQuestion.presentation.context.text}</p></div>
                  )}
                  {activeExamQuestion.presentation?.dataTable && <StructuredQuestionData table={activeExamQuestion.presentation.dataTable} />}
                  {activeExamQuestion.presentation && activeExamQuestion.presentation.statements.length > 0 && (
                    <div className={`internal-statements ${activeExamQuestion.presentation.structure}`}>
                      {activeExamQuestion.presentation.statements.map((statement, index) => (
                        <div key={`${statement.marker}-${index}`}><b>{statement.marker === "•" || statement.marker === "․" ? "•" : statement.marker}</b><p>{statement.text}</p></div>
                      ))}
                    </div>
                  )}
                  <div className="tag-row">
                    {[activeExamQuestion.questionForm, activeExamQuestion.numericType, ...activeExamQuestion.keywords].filter((tag, index, tags) => tag !== "없음" && tags.indexOf(tag) === index).slice(0, 4).map((tag) => <span key={tag}>{tag}</span>)}
                  </div>

                  <div className="choices exam-choices" aria-label="선택지">
                    {symbols.map((symbol) => {
                      const chosen = displayedExamAnswers[activeExamQuestion.id] === symbol;
                      const correct = displayedExamSubmitted && Boolean(activeExamResult?.acceptedAnswers.includes(symbol));
                      const wrong = displayedExamSubmitted && chosen && !activeExamResult?.acceptedAnswers.includes(symbol);
                      return (
                        <button
                          aria-pressed={chosen}
                          className={`${chosen ? "selected" : ""} ${correct ? "correct" : ""} ${wrong ? "wrong" : ""}`}
                          disabled={displayedExamSubmitted}
                          key={symbol}
                          onClick={() => selectExamAnswer(symbol)}
                          type="button"
                        >
                          <b>{symbol}</b><span>{activeExamQuestion.choices[symbol]}</span>
                        </button>
                      );
                    })}
                  </div>

                  {displayedExamSubmitted && (
                    <div className={`exam-answer-band ${activeExamResult?.correct ? "correct" : "wrong"}`}>
                      {activeExamResult?.correct ? <CheckCircle2 aria-hidden="true" /> : <Info aria-hidden="true" />}
                      <div>
                        <span>{activeExamResult?.correct ? "정답" : activeLegacyRecord?.recordState === "marked-unknown" ? "W 표기 · 선택 답안 미기록" : "오답"}</span>
                        <strong>데모 기준 정답 {activeExamResult?.acceptedAnswers.join(" · ")}{(activeExamResult?.acceptedAnswers.length ?? 0) > 1 ? " (복수정답)" : ""}</strong>
                        {activeConceptNote ? (
                          <section className="exam-concept-note" aria-label={activeConceptNote.title}>
                            <h3>{activeConceptNote.title}</h3>
                            <div className="exam-concept-contrast">
                              {activeConceptNote.points.map((point) => (
                                <p key={point.term}><b>{point.term}</b><span>{point.description}</span></p>
                              ))}
                            </div>
                            <p className="exam-concept-conclusion">{activeConceptNote.conclusion}</p>
                          </section>
                        ) : (
                          <p>{activeExamQuestion.concept} · {activeExamQuestion.trapType}</p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="exam-pager">
                    <button disabled={examQuestionNo === 1} onClick={() => setExamQuestionNo((current) => Math.max(1, current - 1))} type="button"><ChevronLeft aria-hidden="true" />이전</button>
                    <span>{examQuestionNo} / 40</span>
                    <button disabled={examQuestionNo === 40} onClick={() => setExamQuestionNo((current) => Math.min(40, current + 1))} type="button">다음<ChevronRight aria-hidden="true" /></button>
                  </div>
                </section>
              </div>
            ) : null}
          </section>
        )}

        {view === "analysis" && (
          <section className="analysis-workspace" aria-labelledby="analysis-title">
            <div className="analysis-filter-band">
              <div>
                <span className="section-label">분석 범위</span>
                <h2 id="analysis-title">40~49회 내용 키워드와 출제 형식</h2>
              </div>
              <div className="analysis-controls">
                <div className="analysis-audience-tabs" role="group" aria-label="분석 사용자">
                  <button className={analysisAudience === "learner" ? "active" : ""} onClick={() => changeAnalysisAudience("learner")} type="button">학습자</button>
                  <button className={analysisAudience === "instructor" ? "active" : ""} onClick={() => changeAnalysisAudience("instructor")} type="button">강의 인사이트</button>
                </div>
                <div className="analysis-subject-tabs" role="group" aria-label="분석 과목">
                  <button className={analysisSubject === "ALL" ? "active" : ""} onClick={() => changeAnalysisSubject("ALL")} type="button">3과목 전체</button>
                  {subjectOptions.map((subject) => <button className={analysisSubject === subject.code ? "active" : ""} key={subject.code} onClick={() => changeAnalysisSubject(subject.code)} type="button">{subject.name}</button>)}
                </div>
              </div>
            </div>

            {analyticsLoading ? (
              <div className="exam-loading"><LoaderCircle aria-hidden="true" /><span>1,200문항의 회차별 지표를 계산하고 있습니다.</span></div>
            ) : analyticsError ? (
              <p className="analysis-error" role="alert">{analyticsError}</p>
            ) : analytics ? (
              <>
                {analysisAudience === "learner" ? (
                  <>
                {leadKeywordInsight && leadKeywordCopy ? (
                  <section className="keyword-next-action" aria-labelledby="keyword-next-title">
                    <p className="keyword-next-kicker">다음 복습 1가지</p>
                    <p className="keyword-next-meta">{leadKeywordInsight.subject} · {leadKeywordInsight.area}</p>
                    <h3 id="keyword-next-title">{leadKeywordInsight.keyword}</h3>
                    <p className="keyword-next-reason">{leadKeywordCopy.reason}</p>
                    <p className="keyword-next-action-line"><b>학습 행동</b> {leadKeywordCopy.action}</p>
                    <button
                      className="keyword-study-button primary"
                      disabled={!leadKeywordInsight.targetQuestion}
                      onClick={() => leadKeywordInsight.targetQuestion && openSubjectExam(leadKeywordInsight.subjectCode, leadKeywordInsight.targetQuestion.round, null, leadKeywordInsight.targetQuestion.questionNo)}
                      type="button"
                    >
                      이 문항 풀기<ChevronRight aria-hidden="true" />
                    </button>
                    <small className="keyword-next-footnote">
                      {leadKeywordInsight.priorityScore === null
                        ? `출제 주목도 ${leadKeywordInsight.trendScore}/30. 개인 기록이 없어 취약도와 반복 오답은 더하지 않았습니다.`
                        : `집중도 ${leadKeywordInsight.priorityScore}/100 · 출제 ${leadKeywordInsight.trendScore}/30 · 취약 ${leadKeywordInsight.weaknessScore}/50 · 반복 ${leadKeywordInsight.repeatScore}/20. 시험 점수가 아닙니다.`}
                    </small>
                  </section>
                ) : (
                  <section className="keyword-next-action" aria-labelledby="keyword-next-title">
                    <p className="keyword-next-kicker">다음 복습 1가지</p>
                    <h3 id="keyword-next-title">이 범위에서 계산된 내용 키워드가 없습니다.</h3>
                    <p className="keyword-next-reason">출제 기록이나 풀이 기록이 없으면 복습 순위를 만들지 않습니다.</p>
                  </section>
                )}

                <section className="keyword-focus-section" aria-labelledby="keyword-focus-title">
                  <div className="panel-heading keyword-focus-heading">
                    <div>
                      <span className="section-label">출제경향 × 내 풀이 기록</span>
                      <h2 id="keyword-focus-title">지금 집중할 내용 키워드</h2>
                    </div>
                    <span className="keyword-measured-count"><Search aria-hidden="true" />{measuredKeywordCount}/{personalKeywordInsights.length}개 키워드 개인 진단</span>
                  </div>
                  <details className="keyword-method-details">
                  <summary>집중도 산정 기준</summary>
                  <div className="keyword-method-band">
                    <Info aria-hidden="true" />
                    <p><strong>집중도 100점</strong><span>출제 중요도 30 + 개인 취약 50 + 반복 오답 20</span><small>개인 기록이 없는 키워드는 취약도를 추정하지 않고 출제 주목도만 표시합니다.</small></p>
                  </div>
                  </details>
                  <p className="keyword-list-note">1위는 위의 다음 복습입니다. 아래는 같은 산식의 다음 키워드이며, 출제·풀이 수치는 각 항목에서 펼칩니다.</p>
                  <div className="keyword-focus-head" aria-hidden="true"><span>내용 키워드</span><span>복습 이유와 행동</span><span>집중도</span></div>
                  <ul className="keyword-focus-list" aria-label="내용 키워드별 학습 우선도">
                    {displayedKeywordInsights.map((insight) => {
                      const copy = keywordStudyCopy(insight);
                      const trendText = insight.trendDelta > 0 ? `+${insight.trendDelta}` : String(insight.trendDelta);
                      return (
                        <li className={`keyword-focus-row ${insight.priorityScore === null ? "unmeasured" : ""}`} key={insight.id}>
                          <div className="keyword-name-cell">
                            <span>{insight.subject} · {insight.area}</span>
                            <strong>{insight.keyword}</strong>
                          </div>
                          <div className="keyword-reason-cell">
                            <p>{copy.reason}</p>
                            <p className="keyword-learner-action"><b>학습 행동</b> {copy.action}</p>
                            <button
                              className="keyword-study-button quiet"
                              disabled={!insight.targetQuestion}
                              onClick={() => insight.targetQuestion && openSubjectExam(insight.subjectCode, insight.targetQuestion.round, null, insight.targetQuestion.questionNo)}
                              type="button"
                            >
                              문항 열기<ChevronRight aria-hidden="true" />
                            </button>
                          </div>
                          <button className={`keyword-priority ${insight.priorityScore === null ? "pending" : ""}`} type="button" aria-label={insight.priorityScore === null ? `${insight.keyword} 개인 진단 전` : `${insight.keyword} 집중도 ${insight.priorityScore}`}>
                            <span><b>{insight.priorityScore ?? "-"}</b><small>{insight.priorityScore === null ? "진단 전" : "집중도"}</small></span>
                            <span className="keyword-priority-tooltip" role="tooltip">
                              <strong>{insight.priorityScore === null ? `출제 주목도 ${insight.trendScore}/30` : `집중도 ${insight.priorityScore}/100`}</strong>
                              <em>시험 점수나 정답률이 아닙니다.</em>
                              <span>출제 중요도 <b>+{insight.trendScore}/30</b></span>
                              <span>개인 취약 <b>{insight.accuracy === null ? "측정 전" : `+${insight.weaknessScore}/50`}</b></span>
                              <span>반복 오답 <b>{insight.accuracy === null ? "측정 전" : `+${insight.repeatScore}/20`}</b></span>
                            </span>
                          </button>
                          <details className="keyword-evidence-details">
                            <summary>출제·풀이 근거</summary>
                            <div className="keyword-evidence-cell">
                              <strong>10회 중 {insight.roundCount}회 · 총 {insight.questionCount}문항 출제</strong>
                              <p>최근 48~49회 비중 {insight.recentRate}% <b className={insight.trendDelta > 0 ? "up" : insight.trendDelta < 0 ? "down" : ""}>({trendText}%p)</b></p>
                              <small>{insight.caseCount > 0 ? `사례형 ${insight.caseCount}` : "사례형 0"}{insight.numericCount > 0 ? ` · 수치형 ${insight.numericCount}` : " · 수치형 0"}</small>
                              {insight.accuracy === null ? (
                                <small>내 풀이 기록 없음 · 먼저 진단해야 취약도를 계산할 수 있습니다.</small>
                              ) : (
                                <small>내 최근 정답률 <b>{insight.accuracy}%</b> · {insight.attemptedQuestionCount}문항 측정 · 반복 오답 <b>{insight.repeatedWrongCount}문항</b></small>
                              )}
                              <small>출제 중요도 {insight.trendScore}/30 · 개인 취약 {insight.accuracy === null ? "측정 전" : `${insight.weaknessScore}/50`} · 반복 오답 {insight.accuracy === null ? "측정 전" : `${insight.repeatScore}/20`}</small>
                            </div>
                          </details>
                        </li>
                      );
                    })}
                  </ul>
                  {otherKeywordInsights.length > 3 && (
                    <button aria-expanded={showAllKeywords} className="keyword-expand-button" onClick={() => setShowAllKeywords((current) => !current)} type="button">
                      {showAllKeywords ? "우선순위 3개만 보기" : `전체 ${otherKeywordInsights.length}개 키워드 보기`}
                    </button>
                  )}
                </section>

                <details className="analysis-evidence-details">
                  <summary>학습 기록 요약 · 완료 {completedAttemptCount}회독 · 응시 {completedRoundCount}/10 · 평균 {completedAverage ?? "-"}/40</summary>
                  <div className="personal-analysis-strip">
                    <section><span>완료한 회독</span><strong>{completedAttemptCount}<small>개</small></strong></section>
                    <section><span>응시한 회차</span><strong>{completedRoundCount}<small>/10</small></strong></section>
                    <section><span>평균 점수</span><strong>{completedAverage ?? "-"}<small>/40</small></strong></section>
                    <section className="source-note"><Info aria-hidden="true" /><p><b>출처</b>{analytics.source}<small>과거 이력: {legacyPayload.metadata.sourceFile} · {legacyPayload.metadata.questionRecordCount}문항</small></p></section>
                  </div>
                </details>

                {(analysisSubject === "ALL" || analysisSubject === "THEORY") && (
                  <details className="analysis-evidence-details">
                    <summary>합성 풀이 이력 펼치기 · {legacyPayload.metadata.attemptCount}회독 · 실제 성과 아님</summary>
                  <section className="legacy-score-section" aria-labelledby="legacy-score-title">
                    <div className="panel-heading">
                      <div><span className="section-label">합성 풀이 이력 · 실제 성과 아님</span><h2 id="legacy-score-title">DEMO 세트 43~48 점수 예시</h2></div>
                      <span className="history-import-count"><FileSpreadsheet aria-hidden="true" />{legacyPayload.metadata.attemptCount}회독 · {legacyPayload.metadata.questionRecordCount}문항</span>
                    </div>
                    <div className="legacy-score-table">
                      <div className="legacy-score-head"><span>회차</span><span>1회독</span><span>2회독</span><span>향상</span><span>문항 기록</span></div>
                      {legacyScoreRows.map(({ round, attempts }) => {
                        const first = attempts.find((attempt) => attempt.attemptNo === 1);
                        const second = attempts.find((attempt) => attempt.attemptNo === 2);
                        const improvement = (second?.score ?? 0) - (first?.score ?? 0);
                        const latest = attempts.at(-1);
                        return (
                          <div className={round === 48 ? "recent" : ""} key={round}>
                            <strong>제{round}회</strong>
                            <span>{first?.score ?? "-"}<small>/40</small></span>
                            <span>{second?.score ?? "-"}<small>/40</small></span>
                            <b className={improvement > 0 ? "improved" : ""}>{improvement > 0 ? "+" : ""}{improvement}</b>
                            <button disabled={!latest} onClick={() => latest && openSubjectExam("THEORY", round, latest.id)} type="button">답안 보기<ChevronRight aria-hidden="true" /></button>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                  </details>
                )}
                  </>
                ) : (
                  <>
                    <section className="instructor-insight-section" aria-labelledby="instructor-insight-title">
                      <div className="panel-heading">
                        <div><span className="section-label">에이전트 강의 브리핑</span><h2 id="instructor-insight-title">학습 신호를 강의 수정안으로</h2></div>
                        <span className="keyword-measured-count"><Activity aria-hidden="true" />{instructorDataset?.label ?? "합성 데이터 준비 중"}</span>
                      </div>
                      <div className="instructor-method-band">
                        <Info aria-hidden="true" />
                        <p><strong>현재 결과는 실제 학습 성과가 아닌 해커톤 시연용 합성 데이터입니다.</strong><span>{instructorPayload?.scoring ?? "합성 학습자 집단의 오답률과 영향 범위를 계산합니다."} · 실사용 {instructorPayload?.realData.learnerCount ?? 0}명 데이터는 합산하지 않았습니다.</span></p>
                      </div>
                      {instructorLoading ? (
                        <div className="instructor-empty-state"><LoaderCircle aria-hidden="true" /><p><strong>50명의 풀이를 집계하고 있습니다.</strong><span>과목별 내용 키워드와 오답 학습자 수를 계산합니다.</span></p></div>
                      ) : instructorError ? (
                        <div className="instructor-empty-state"><CircleDashed aria-hidden="true" /><p><strong>집단 데이터를 불러오지 못했습니다.</strong><span>{instructorError}</span></p></div>
                      ) : instructorLeadInsight ? (
                        <>
                          <div className="instructor-command">
                            <div className="instructor-command-head">
                              <div>
                                <span>이번 보강 1순위 · {instructorLeadInsight.subject} · {instructorLeadInsight.domain}</span>
                                <h3>{instructorLeadInsight.concept}</h3>
                              </div>
                              <span className="instructor-demand-score" title={instructorPayload?.scoring}>보강 수요 <strong>{instructorLeadInsight.demandScore}</strong><small>/100</small></span>
                            </div>
                            <p className="instructor-command-summary">응답한 {instructorLeadInsight.learnerCount}명 중 {instructorLeadInsight.wrongLearners}명이 틀렸고, 이 내용의 오답률은 {instructorLeadInsight.wrongRate}%입니다.</p>
                            <div className="instructor-decision-grid">
                              <div>
                                <span>선택지 혼동 집중</span>
                                <strong>{instructorLeadInsight.dominantWrongChoice ? `Q${instructorLeadInsight.dominantWrongQuestionNo} · ${instructorLeadInsight.dominantWrongChoice} ${instructorLeadInsight.dominantWrongChoiceText ?? "오답선지"}` : `${instructorLeadInsight.wrongCount}/${instructorLeadInsight.answerCount}건 오답`}</strong>
                                <small>{instructorLeadInsight.dominantWrongChoice ? `${instructorLeadInsight.dominantWrongChoiceCount}건 · ${instructorLeadInsight.dominantWrongLearners}명 · ${instructorLeadInsight.confusionLabel ?? instructorLeadInsight.confusionSource}` : instructorLeadInsight.reason}</small>
                              </div>
                              <div><span>권장 수정</span><strong>{instructorLeadInsight.recommendation}</strong><small>강사가 바로 실행할 수 있는 최소 변경안</small></div>
                              <div>
                                <span>{instructorLeadInsight.intervention ? "보강 후 효과" : "효과 확인 계획"}</span>
                                <strong>
                                  {instructorLeadInsight.intervention?.effect.measurementReady
                                    ? `정답률 ${instructorLeadInsight.intervention.baseline.accuracy}% → ${instructorLeadInsight.intervention.post.accuracy}%`
                                    : instructorLeadInsight.intervention
                                      ? `기준 ${instructorLeadInsight.intervention.baseline.answerCount}건 저장 · 재풀이 측정 대기`
                                      : instructorLeadInsight.validation}
                                </strong>
                                <small>
                                  {instructorLeadInsight.intervention?.effect.measurementReady
                                    ? `목표 오답선지 ${instructorLeadInsight.intervention.baseline.targetChoiceRate}% → ${instructorLeadInsight.intervention.post.targetChoiceRate}% · 수요 ${instructorLeadInsight.baselineDemandScore} → ${instructorLeadInsight.demandScore}`
                                    : instructorLeadInsight.intervention
                                      ? `${new Date(instructorLeadInsight.intervention.appliedAt).toLocaleString("ko-KR")}부터 같은 개념 답안을 효과 구간으로 자동 집계`
                                      : "조치를 적용하면 기준 시점과 전후 집계가 저장됩니다."}
                                </small>
                              </div>
                            </div>
                            {instructorLeadEvidence && instructorLeadEvidenceRef && (
                              <div className="instructor-evidence-link">
                                <FileText aria-hidden="true" />
                                <span><b>허가된 강사 근거 연결 위치</b><strong>{instructorLeadEvidence.material} · p.{instructorLeadEvidence.page}</strong><small>동일 내용의 {instructorLeadEvidenceRef.id} 기준 · 실제 강의 ID와 영상 구간은 플랫폼 연결 대기</small></span>
                              </div>
                            )}
                            {instructorLeadTrend && <p className="instructor-trend-evidence"><Search aria-hidden="true" /><span><b>출제 근거</b> 40~49회 중 {instructorLeadTrend.roundCount}개 회차 · {instructorLeadTrend.questionCount}문항, 최근 48~49회 비중 {instructorLeadTrend.recentRate}%</span></p>}
                            <div className="instructor-command-actions">
                              <button className="instructor-command-action" onClick={() => openInstructorCandidates(instructorLeadInsight.subjectCode)} type="button">
                                {instructorLeadInsight.subject} 보강 후보 보기<ChevronRight aria-hidden="true" />
                              </button>
                              <button
                                className="instructor-intervention-action"
                                disabled={Boolean(instructorLeadInsight.intervention) || instructorActionSaving}
                                onClick={applyInstructorIntervention}
                                type="button"
                              >
                                {instructorActionSaving
                                  ? <><LoaderCircle aria-hidden="true" />적용 중</>
                                  : instructorLeadInsight.intervention
                                    ? <><CheckCircle2 aria-hidden="true" />보강 적용됨</>
                                    : <><ClipboardCheck aria-hidden="true" />이 보강안 적용</>}
                              </button>
                            </div>
                            {instructorActionMessage && <p className="instructor-action-message" role="status"><CheckCircle2 aria-hidden="true" />{instructorActionMessage}</p>}
                          </div>

                          <div className="instructor-subject-overview">
                            <div className="panel-heading">
                              <div><span className="section-label">과목별 보강 상태</span><h3>다음 결정을 기다리는 과목</h3></div>
                              <span>보강 후보 {instructorLectureCandidateCount}개 · 관찰된 오답 키워드 {instructorObservedKeywordCount}개</span>
                            </div>
                            <div className="instructor-subject-list">
                              {instructorSubjectBriefs.map((brief) => (
                                <button disabled={!brief.lead} key={brief.code} onClick={() => openInstructorCandidates(brief.code)} type="button">
                                  <span><strong>{brief.name}</strong><small>보강 후보 {brief.candidateCount}개</small></span>
                                  <b>{brief.lead?.concept ?? "보강 신호 없음"}</b>
                                  <small>{brief.lead ? `최고 수요 ${brief.lead.demandScore} · 관찰 키워드 ${brief.observedSignalCount}개` : "집계된 오답 없음"}</small>
                                  <ChevronRight aria-hidden="true" />
                                </button>
                              ))}
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="instructor-empty-state"><CircleDashed aria-hidden="true" /><p><strong>합성 풀이 데이터가 아직 없습니다.</strong><span>배치를 주입하면 실제 데이터와 분리된 강의 수요가 생성됩니다.</span></p></div>
                      )}
                    </section>

                    {instructorKeywordInsights.length > 0 && (
                      <section className="instructor-candidate-section" aria-labelledby="instructor-candidate-title">
                        <button className={`instructor-candidate-toggle ${showInstructorCandidates ? "expanded" : ""}`} onClick={() => setShowInstructorCandidates((current) => !current)} type="button">
                          <span><strong id="instructor-candidate-title">{showInstructorCandidates ? "전체 보강 후보 접기" : "전체 보강 후보 보기"}</strong><small>수요순 상위 {Math.min(10, instructorKeywordInsights.length)}개 · 필요할 때만 펼칩니다.</small></span>
                          <ChevronRight aria-hidden="true" />
                        </button>
                        {showInstructorCandidates && (
                          <div className="instructor-insight-table" role="table" aria-label="키워드별 강의 개선 수요">
                            <div className="instructor-insight-head" role="row"><span>내용 키워드</span><span>대표 오답선지</span><span>영향 학습자</span><span>추천 조치</span><span>수요</span></div>
                            {instructorKeywordInsights.slice(0, 10).map((insight) => (
                                <div className="instructor-insight-row" key={insight.id} role="row">
                                  <div><span>{insight.subject} · {insight.domain}</span><strong>{insight.concept}</strong><small>{insight.learnerCount}명 응답</small></div>
                                  <div><strong>{insight.dominantWrongChoice ? `Q${insight.dominantWrongQuestionNo} · ${insight.dominantWrongChoice}` : "집계 대기"}</strong><small>{insight.dominantWrongChoice ? `${insight.dominantWrongChoiceCount}건 · ${insight.confusionLabel ?? insight.confusionSource}` : `${insight.wrongCount}/${insight.answerCount}건 오답`}</small></div>
                                  <b>{insight.wrongLearners}<small>명 · 오답률 {insight.wrongRate}%</small></b>
                                  <p>{insight.recommendation}<small>{insight.reason} · 효과 확인 계획: {insight.validation}</small></p>
                                  <button onClick={() => openInstructorCandidates(insight.subjectCode)} title={instructorPayload?.scoring} type="button">수요 {insight.demandScore}<ChevronRight aria-hidden="true" /></button>
                                </div>
                            ))}
                          </div>
                        )}
                      </section>
                    )}
                  </>
                )}

                {analysisAudience === "learner" && <>
                <details className="analysis-evidence-details">
                  <summary>출제 형식·회차별 통계 펼치기</summary>
                <div className="change-grid" aria-label="최근 출제 변화">
                  {changeMetrics.map((metric) => (
                    <article key={metric.label} title={metric.description}>
                      <div><span>{metric.label}</span><b className={metric.delta > 0 ? "up" : metric.delta < 0 ? "down" : ""}>{metric.delta > 0 ? "+" : ""}{metric.delta}%p</b></div>
                      <strong>{metric.recent}<small>%</small></strong>
                      <p>40~47회 {metric.baseline}% → 48~49회 {metric.recent}%</p>
                    </article>
                  ))}
                </div>

                <div className="round-analysis-grid">
                  <section className="round-trend-panel">
                    <div className="panel-heading">
                      <div><span className="section-label">회차별 비중</span><h2>사례형·수치형 변화</h2></div>
                      <span className="analysis-legend"><i className="case" />사례형<i className="numeric" />수치형</span>
                    </div>
                    <div className="round-trend-table">
                      <div className="round-trend-head"><span>회차</span><span>문항 분포</span><span>사례</span><span>수치</span><span>평균 길이</span></div>
                      {analytics.rounds.map((round) => (
                        <div className={round.round >= 48 ? "recent" : ""} key={round.round}>
                          <strong>{round.round}회</strong>
                          <span className="dual-bars"><i className="case" style={{ width: `${(round.caseCount / maxTrendCount) * 100}%` }} /><i className="numeric" style={{ width: `${(round.numericCount / maxTrendCount) * 100}%` }} /></span>
                          <span>{round.caseCount}<small>/{round.total}</small></span>
                          <span>{round.numericCount}<small>/{round.total}</small></span>
                          <span>{round.averageStemLength}<small>자</small></span>
                        </div>
                      ))}
                    </div>
                  </section>

                  <aside className="analysis-detail-panel">
                    <div className="panel-heading"><div><span className="section-label">분류 기준</span><h2>계산문제 경향</h2></div><Calculator aria-hidden="true" /></div>
                    <div className="calculation-definition-list">
                      <article><span>직접계산형</span><p>보험금·손해액·보험료 등을 직접 산출</p></article>
                      <article><span>공식선택형</span><p>통계·요율·확률식 또는 산식을 선택</p></article>
                      <article><span>금액사례형</span><p>계약·사고 사례의 금액 조건을 판단</p></article>
                      <article><span>법정수치형</span><p>기간·인원·비율 등 법정 수치를 구분</p></article>
                    </div>
                    <div className="answer-distribution">
                      <span className="section-label">49회 정답 분포</span>
                      {Object.entries(analytics.rounds.at(-1)?.answerDistribution ?? {}).map(([answer, count]) => (
                        <div key={answer}><b>{answer}</b><span><i style={{ width: `${(count / Math.max(1, analytics.rounds.at(-1)?.total ?? 1)) * 100 * 3}%` }} /></span><strong>{count}</strong></div>
                      ))}
                    </div>
                  </aside>
                </div>
                </details>
                </>}
              </>
            ) : null}
          </section>
        )}

        {view === "questions" && (
          <div className="overview-grid">
            <section className="question-table-panel" aria-labelledby="all-questions-title">
              <div className="panel-heading overview-heading">
                <div><span className="section-label">제48회</span><h2 id="all-questions-title">{selectedSubjectInfo.name} 전체 문항</h2></div>
                <div className="segmented filters" aria-label="문항 필터">
                  <button className={questionFilter === "all" ? "active" : ""} onClick={() => setQuestionFilter("all")} type="button">전체 {subjectQuestions.length}</button>
                  <button className={questionFilter === "review" ? "active" : ""} disabled={!selectedSubjectInfo.hasDiagnostics} onClick={() => setQuestionFilter("review")} type="button">복습 {reviewCount}</button>
                  <button className={questionFilter === "calculation" ? "active" : ""} onClick={() => setQuestionFilter("calculation")} type="button"><Calculator aria-hidden="true" />수치 {calculationCount}</button>
                </div>
              </div>
              <div className="question-table" role="table" aria-label={`${selectedSubjectInfo.name} 문항별 진단`}>
                <div className="question-table-head" role="row"><span>문항</span><span>개념</span><span>유형</span><span>회독</span><span>상태</span><span aria-hidden="true" /></div>
                {filteredQuestions.map((question) => {
                  const diagnostic = diagnosticMap.get(question.id) ?? pendingDiagnostic(question);
                  return (
                    <button className="question-table-row" key={question.id} onClick={() => selectQuestion(question.id)} role="row" type="button">
                      <strong>Q{question.questionNo}</strong>
                      <span className="table-concept"><b>{question.concept}</b><small>{question.domain}</small></span>
                      <span>{question.numericType}</span>
                      <span>{diagnostic.attempts[0] ?? "-"} → {diagnostic.attempts[1] ?? "-"}</span>
                      <StatusPill status={diagnostic.status} /><ChevronRight aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            </section>

            <aside className="trend-panel" aria-labelledby="calculation-title">
              <div className="panel-heading"><div><span className="section-label">{selectedSubjectInfo.name}</span><h2 id="calculation-title">계산·수치 경향</h2></div><Calculator aria-hidden="true" /></div>
              <div className="trend-summary"><strong>{subjectCalculations.length}</strong><span>개 계산·수치 패턴</span></div>
              <div className="trend-bars">
                {Object.entries(numericCounts).map(([label, count]) => (
                  <div key={label}><span>{label}</span><div><i style={{ width: `${(count / maxNumericCount) * 100}%` }} /></div><b>{count}</b></div>
                ))}
              </div>
              <div className="pattern-list">
                {subjectCalculations.map((item) => (
                  <article key={item.id}><span>{item.subject} Q{item.questionNo} · {item.difficulty}</span><strong>{item.concept}</strong><p>{item.commonWrongPath}</p></article>
                ))}
              </div>
            </aside>
          </div>
        )}

        {view === "lectures" && (
          <>
          <div className="lecture-filter-band">
            <div className="lecture-round-control">
              <label htmlFor="lecture-round"><span>1. 회차</span><select id="lecture-round" value={lectureRound} onChange={(event) => setLectureRound(Number(event.target.value))}>{Array.from({ length: 10 }, (_, index) => 49 - index).map((round) => <option key={round} value={round}>제{round}회</option>)}</select></label>
              <div className="lecture-subject-control" role="tablist" aria-label={`제${lectureRound}회 추천 과목`}>
                <span>2. 과목</span>
                {subjectOptions.map((subject) => <button aria-selected={subject.code === selectedSubject} className={subject.code === selectedSubject ? "active" : ""} key={subject.code} onClick={() => changeSubject(subject.code)} role="tab" type="button"><strong>{subject.name}</strong><small>후보 {lectureCandidateCounts[subject.code]}개</small></button>)}
              </div>
            </div>
            <div className="lecture-selection-path"><span>현재 선택</span><strong>제{lectureRound}회 &gt; {selectedSubjectInfo.name} &gt; 오답 상위 {lectureCandidates.length}개</strong><p><Info aria-hidden="true" />저장된 오답만 사용하며, 강사 자료 근거가 없으면 연결 대기로 표시합니다.</p></div>
          </div>
          <div className="lecture-grid">
            <section className="lecture-queue" aria-labelledby="lecture-queue-title">
              <div className="panel-heading">
                <div><span className="section-label">제{lectureRound}회 오답 우선도순</span><h2 id="lecture-queue-title">상위 강의 후보</h2></div>
                <span className="count-badge">{lectureCandidates.length}</span>
              </div>
              <div className="lecture-list">
                {lectureCandidates.map((item) => (
                  <button className={`lecture-row ${item.id === selectedLectureCandidate?.id ? "selected" : ""}`} key={item.id} onClick={() => setSelectedLectureId(item.id)} type="button">
                    <span className="lecture-number">Q{item.questionNo}</span>
                    <span className="lecture-copy"><strong>{item.concept}</strong><small>{item.diagnosis} · {item.lectureSearchQuery}</small></span>
                    <ChevronRight aria-hidden="true" />
                  </button>
                ))}
                {lectureCandidates.length === 0 && <div className="lecture-empty"><BookOpen aria-hidden="true" /><strong>이 회차의 오답 진단이 없습니다.</strong><p>해당 회차와 과목을 채점하면 취약개념과 강의 후보가 여기에 연결됩니다.</p><button onClick={() => openSubjectExam(selectedSubject, lectureRound)} type="button">제{lectureRound}회 풀기<ChevronRight aria-hidden="true" /></button></div>}
              </div>
            </section>

            <section className="lecture-editor" aria-labelledby="lecture-editor-title">
              {selectedLectureCandidate ? <>
              <div className="editor-status"><StatusPill status={selectedLectureEvidence ? "근거 연결" : "연결 대기"} /><span>제{lectureRound}회 Q{selectedLectureCandidate.questionNo} · {selectedLectureCandidate.domain}</span></div>
              <h2 id="lecture-editor-title">{selectedLectureTitle}</h2>
              <p className="lecture-query"><Search aria-hidden="true" />{selectedLectureCandidate.lectureSearchQuery}</p>

              <button className="lecture-retry-button" onClick={() => openSubjectExam(selectedSubject, lectureRound, null, selectedLectureCandidate.questionNo)} type="button">
                <Play aria-hidden="true" /><span><strong>제{lectureRound}회 {selectedSubjectInfo.name} Q{selectedLectureCandidate.questionNo} 다시 보기</strong><small>강의 확인 후 같은 문항으로 즉시 복귀</small></span><ChevronRight aria-hidden="true" />
              </button>

              <div className="source-policy">
                <Info aria-hidden="true" />
                <div>
                  <span>추천 근거 정책</span>
                  <strong>강사 자료·전사·교재를 페이지 단위로 검색</strong>
                  <p>학생이 입력한 설명은 근거로 쓰지 않습니다. 데모 기준 정답과 실제 강사 자료가 일치하는 범위에서만 진단과 추천을 만듭니다.</p>
                </div>
              </div>

              <dl className="mapping-details">
                <div><dt>연결 자료</dt><dd>{selectedLectureEvidence?.material ?? "연결 대기"}</dd></div>
                <div><dt>근거 위치</dt><dd>{selectedLectureEvidence ? `p.${selectedLectureEvidence.page} · ${selectedLectureEvidence.matchedTerms.join(" · ")}` : "쪽수 확인 대기"}</dd></div>
                <div><dt>추천 단계</dt><dd>{selectedLectureRun?.recommendation.stage ?? "Essential"}</dd></div>
                <div><dt>학습 행동</dt><dd>{selectedLectureRun?.nextAction ?? selectedLectureCandidate.nextAction}</dd></div>
                <div><dt>실제 강의</dt><dd>플랫폼 강의 ID 연결 대기</dd></div>
              </dl>
              {selectedLectureEvidence && (
                <div className="linked-resource"><FileText aria-hidden="true" /><div><span>{selectedLectureEvidence.sourceType}</span><strong>{selectedLectureEvidence.sourceFile} · p.{selectedLectureEvidence.page}</strong></div><Activity aria-hidden="true" /></div>
              )}
              <div className="mapping-notice"><BookOpen aria-hidden="true" /><div><span>플랫폼 연결 후 추가</span><strong>강의 ID · 재생 구간 · 바로가기</strong></div></div>
              </> : <div className="lecture-editor-empty"><BookOpen aria-hidden="true" /><h2 id="lecture-editor-title">강의 추천을 만들 진단이 없습니다.</h2><p>왼쪽에서 다른 회차를 선택하거나, 이 회차를 먼저 풀어 주세요.</p></div>}
            </section>
          </div>
          </>
        )}

        {view === "pipeline" && (
          <div className="sponsor-workspace">
            <div className="demo-evidence-banner" role="note">
              <Info aria-hidden="true" />
              <span><b>데모 · 개발자 증거</b> 이 화면은 학습 진단이 아닙니다. Daytona 구조 검사와 Nosana 합성 예시 생성 기록입니다. 개인 답안은 전송하지 않으며, AI 결과는 검토가 필요합니다. 구조 검사 성공은 공식 채점이 아닙니다.</span>
              <button className="pipeline-study-link" onClick={openTodayDashboard} type="button">학습 화면으로</button>
            </div>
            <div className="panel-heading sponsor-heading">
              <div><span className="section-label">오늘 제출용 실행 상태</span><h2>Daytona · Nosana 실행</h2></div>
              <div className="sponsor-heading-metrics">
                <span><small>제출 범위</small><strong>2개</strong></span>
                <span><small>Daytona</small><strong>{daytonaRunStatusLabel}</strong></span>
                <span><small>Nosana</small><strong>예시 생성</strong></span>
              </div>
            </div>
            <div className="pipeline-readiness" aria-label="현장 연동 준비 단계">
              <section className="complete">
                <span>01 · 제품 흐름</span><strong>풀이 → 진단 → 다음 행동</strong><small>합성 문항 기반 학습 분석</small>
              </section>
              <section className="current">
                <span>02 · Daytona 라이브</span><strong>샌드박스 검증 receipt</strong><small>Sandbox ID·실행 시각·검증 건수</small>
              </section>
              <section className="complete">
                <span>03 · Nosana</span><strong>AI 복습 제안</strong><small>아래 버튼으로 실제 호출 결과 확인</small>
              </section>
            </div>
            <section className="daytona-evidence-panel" aria-label="Daytona HackSprint 실행 증거">
              <div className="daytona-evidence-copy">
                <span className="section-label">Daytona HackSprint 실행 검증</span>
                <h3>{daytonaRunPayload?.status === "verified" ? "샌드박스에서 합성 데이터 검증 완료" : "Daytona 샌드박스 검증을 실행하세요"}</h3>
                <p>
                  {daytonaRunPayload?.status === "verified" ? `Daytona 샌드박스에서 합성 문항 ${activeDaytonaEvidence.result.questionCount.toLocaleString("ko-KR")}개의 ID·정답·보기 구조를 검증했습니다.` : "API 키를 연결한 뒤 실행하면 이 공개 합성 데이터에 대한 새 receipt가 생성됩니다. 기본값은 실행 성공 증거가 아닙니다."}
                  키·쿠폰·계정 정보와 학습자 원본 답안은 화면과 기록에 표시하지 않습니다.
                </p>
                <div className="daytona-evidence-actions">
                  <button type="button" onClick={() => void runDaytonaHackSprintValidation()} disabled={daytonaRunLoading}>
                    {daytonaRunLoading ? <LoaderCircle className="spin" aria-hidden="true" /> : <Play aria-hidden="true" />}
                    Run in Daytona
                  </button>
                  <StatusPill status={daytonaRunStatusLabel} />
                </div>
                {daytonaRunPayload && <p className="daytona-run-message">{daytonaRunPayload.message}</p>}
                {daytonaRunError && <p className="analysis-error" role="alert">{daytonaRunError}</p>}
              </div>
              <div className="daytona-evidence-grid">
                <div><small>Sandbox ID</small><strong>{activeDaytonaSandboxId}</strong></div>
                <div><small>검증 범위</small><strong>{activeDaytonaEvidence.result.subjectCount}과목 · {activeDaytonaEvidence.result.roundRange}회</strong></div>
                <div><small>정합성</small><strong>고유 ID {activeDaytonaEvidence.result.uniqueIds.toLocaleString("ko-KR")}개 · 누락 {activeDaytonaEvidence.result.missingAnswers}건</strong></div>
                <div><small>실행 시각</small><strong>{activeDaytonaEvidence.verifiedAtKst}</strong></div>
              </div>
            </section>
            <HackSprintSponsors />
            {sponsorLoading ? (
              <div className="pipeline-loading"><LoaderCircle aria-hidden="true" />연동 상태 확인 중</div>
            ) : sponsorError ? (
              <p className="analysis-error" role="alert">{sponsorError}</p>
            ) : (
              <div className="sponsor-flow" aria-label="오늘 제출용 제품 연동 증거">
                {eventSponsors.map((sponsor, index) => (
                  <section key={sponsor.id}>
                    <span className="flow-number">0{index + 1}</span>
                    <div className="sponsor-name"><strong>{sponsor.name}</strong><StatusPill status={sponsor.state} /></div>
                    <p>{sponsor.role}</p>
                    <dl>
                      <dt>코드</dt><dd>{sponsor.codePath}</dd>
                      <dt>상태</dt><dd>{sponsor.id === "daytona" ? "Run in Daytona 버튼으로 새 receipt 생성" : "Nosana 버튼으로 합성 복습 제안 생성"}</dd>
                      <dt>증거</dt><dd>{sponsor.proof}</dd>
                    </dl>
                    {index < eventSponsors.length - 1 && <ChevronRight className="flow-arrow" aria-hidden="true" />}
                  </section>
                ))}
              </div>
            )}
            <div className="pipeline-summary">
              <section><span className="section-label">오늘의 라이브 실행</span><strong>Run in Daytona → 검증 → 새 receipt</strong><p>1,200문항의 ID·정답·보기 구조를 격리 샌드박스에서 확인하고 실행 출처를 남깁니다.</p></section>
              <section><span className="section-label">데모 안전장치</span><strong>실패해도 합성 문항 학습 흐름 유지</strong><p>외부 호출이 실패하면 로컬 근거 엔진으로 진단을 완료하고, 실제로 검증되지 않은 제품은 완료로 표시하지 않습니다.</p></section>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
