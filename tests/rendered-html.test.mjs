import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function request(path = "/", init) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${Math.random()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, init),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("separates first-stage and second-stage entry pages", async () => {
  for (const path of ["/exams/first", "/exams/second"]) {
    const response = await request(path);
    assert.equal(response.status, 200);
  }
  const source = await readFile(new URL("../app/exams/second/page.tsx", import.meta.url), "utf8");
  assert.match(source, /TeachingWorkspace initialTab="answers"/);
  assert.match(source, /ExamStageNavigation stage="second"/);
  assert.doesNotMatch(source, /openSubjectExam|score-strip|subjectOptions/);
});

test("renders the Exam Coach access bootstrap", async () => {
  const response = await request();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /Exam Coach/);
  assert.match(html, /학습 기록을 연결하고 있습니다/);
});

test("keeps anonymous access available when the learner database is absent", async () => {
  const response = await request("/api/auth");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { authenticated: false, databaseReady: false });
});

test("synthetic history is complete, consistent, and labeled", async () => {
  const legacy = JSON.parse(await readFile(new URL("../app/data/legacy-attempts.json", import.meta.url), "utf8"));
  const examData = JSON.parse(await readFile(new URL("../app/data/exam-questions-40-49.json", import.meta.url), "utf8"));
  const answers = new Map(examData.questions.map(q => [q.id, q.acceptedAnswers]));
  assert.match(JSON.stringify(legacy.metadata), /synthetic|합성/i);
  assert.equal(legacy.attempts.length, legacy.metadata.attemptCount);
  assert.equal(legacy.attempts.flatMap(a => a.records).length, legacy.metadata.questionRecordCount);
  for (const attempt of legacy.attempts) {
    assert.equal(attempt.records.length, 40);
    assert.ok(attempt.score >= 0 && attempt.score <= 40);
    for (const record of attempt.records) assert.deepEqual(record.acceptedAnswers, answers.get(record.questionId));
  }
});

test("synthetic presentation preserves structured prompts and four choices", async () => {
  const data = JSON.parse(await readFile(new URL("../app/data/exam-questions-40-49.json", import.meta.url), "utf8"));
  assert.equal(data.questions.length, 1200);
  for (const q of data.questions) {
    assert.match(q.questionText, /합성|DEMO/);
    assert.equal(Object.keys(q.choices).length, 4);
    assert.ok(q.presentation.prompt);
    if (q.presentation.statements?.length) assert.ok(q.presentation.statements.every(x => x.marker && x.text));
    if (q.presentation.context) assert.ok(q.presentation.context.label && q.presentation.context.text);
    if (q.presentation.dataTable) assert.ok(q.presentation.dataTable.rows.length && q.presentation.dataTable.columns.length);
  }
});

test("public UI and concept notes do not claim private source provenance", async () => {
  const notes = JSON.parse(await readFile(new URL("../app/data/exam-concept-notes.json", import.meta.url), "utf8"));
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.deepEqual(notes, {});
  assert.match(page, /SYNTHETIC DEMO/);
  assert.doesNotMatch(page, /엑셀에서 불러온 실제 기록|32\/40 → 36\/40|공식 기출/);
});

test("serves 40-question rounds without leaking answers and grades on the server", async () => {
  const examData = JSON.parse(await readFile(new URL("../app/data/exam-questions-40-49.json", import.meta.url), "utf8"));
  const selected = examData.questions.filter((question) => question.round === 49 && question.subjectCode === "THEORY");
  const response = await request("/api/exams?round=49&subject=THEORY");
  assert.equal(response.status, 200);
  const publicPayload = await response.json();
  assert.equal(publicPayload.questions.length, 40);
  assert.ok(publicPayload.questions.every((question) => !("answer" in question) && !("acceptedAnswers" in question)));

  const answers = Object.fromEntries(selected.map((question) => [question.id, question.acceptedAnswers[0]]));
  const gradingResponse = await request("/api/exams", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ round: 49, subject: "THEORY", answers }),
  });
  assert.equal(gradingResponse.status, 200);
  const grading = await gradingResponse.json();
  assert.equal(grading.score, 40);
  assert.deepEqual(grading.results["49-THEORY-32"].acceptedAnswers, selected.find(q => q.id === "49-THEORY-32").acceptedAnswers);
  assert.deepEqual(grading.persistence, { saved: false, reason: "guest" });
});

test("loads only the selected saved-review question with its round context", async () => {
  const response = await request("/api/exams?mode=review&id=47-THEORY-05");
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.question.id, "47-THEORY-05");
  assert.equal(payload.question.round, 47);
  assert.equal(payload.question.subjectCode, "THEORY");
  assert.ok(["①", "②", "③", "④"].includes(payload.question.answer));
  assert.match(payload.source, /저장된 풀이 기록/);

  const missing = await request("/api/exams?mode=review&id=47-THEORY-99");
  assert.equal(missing.status, 404);
});

test("makes the today queue selection rule and round context visible", async () => {
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(pageSource, /전 회차 학습기록/);
  assert.match(pageSource, /최근 정오 · 반복 오답 · 회독 변동 · 문항 복잡도 · 재검 시급성/);
  assert.match(pageSource, /제\{item\.round\}회 · Q\{item\.questionNo\}/);
  assert.match(pageSource, /왜 오늘 보나요\?/);
  assert.match(pageSource, /openSelectedLecture/);
});

test("separates the next keyword review from sponsor execution evidence", async () => {
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(pageSource, /다음 복습 1가지/);
  assert.match(pageSource, /데모 · 개발자 증거/);
  assert.match(pageSource, /출제·풀이 근거/);
  assert.match(pageSource, /SYNTHETIC DEMO/);
  assert.match(pageSource, /개인 답안은 전송하지 않으며/);
  assert.doesNotMatch(pageSource, /실행 파이프라인/);
});

test("keeps question review priority and keyword learning focus as separate metrics", async () => {
  const [pageSource, coachSource] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/coach.ts", import.meta.url), "utf8"),
  ]);

  assert.match(pageSource, /현재 답안·반복 혼동·회독 변동·문항 복잡도·재검 시급성의 합계/);
  assert.match(coachSource, /label: "현재 정오"/);
  assert.match(coachSource, /label: "문항 복잡도"/);
  assert.match(pageSource, /<strong>집중도 100점<\/strong><span>출제 중요도 30 \+ 개인 취약 50 \+ 반복 오답 20<\/span>/);
  assert.match(pageSource, /출제 주목도 \$\{insight\.trendScore\}\/30/);
});

test("front-loads one agent-prescribed action before the detailed review workspace", async () => {
  const [pageSource, cssSource] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(pageSource, /useState\(false\).*todayWorkspaceOpen|todayWorkspaceOpen.*useState\(false\)/s);
  assert.match(pageSource, /오늘 먼저 복습할 내용/);
  assert.match(pageSource, /왜 지금\?/);
  assert.match(pageSource, /다음 학습/);
  assert.match(pageSource, /이 복습 시작/);
  assert.match(pageSource, /3과목 상태/);
  assert.match(pageSource, /view === "today" && !todayWorkspaceOpen/);
  assert.match(pageSource, /view === "today" && todayWorkspaceOpen/);
  assert.match(cssSource, /\.agent-dashboard/);
  assert.match(cssSource, /\.subject-dashboard-list/);
});

test("keeps decision-critical text readable without browser zoom", async () => {
  const cssSource = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const fontSizeFor = (selectorPattern) => {
    const match = cssSource.match(new RegExp(`${selectorPattern} \\{[^}]*font-size: (\\d+)px`, "s"));
    assert.ok(match, `missing font-size rule for ${selectorPattern}`);
    return Number(match[1]);
  };

  assert.ok(fontSizeFor("\\.nav-item") >= 14);
  assert.ok(fontSizeFor("\\.agent-prescription-diagnosis") >= 15);
  assert.ok(fontSizeFor("\\.agent-next-action strong") >= 15);
  assert.ok(fontSizeFor("\\.question-header h2") >= 22);
  assert.ok(fontSizeFor("\\.question-context > p") >= 15);
  assert.ok(fontSizeFor("\\.coach-band p, \\.resource-block p, \\.retry-prompt span") >= 14);
});

test("keeps the learner's attention on the diagnosis value chain", async () => {
  const [pageSource, cssSource] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(pageSource, /scrollIntoView/);
  assert.match(pageSource, /진단 집중/);
  assert.match(pageSource, /선택에서 다음 학습까지의 진단 흐름/);
  assert.match(pageSource, /내 선택/);
  assert.match(pageSource, /취약 개념/);
  assert.match(pageSource, /강사 자료/);
  assert.match(pageSource, /다음 학습/);
  assert.match(cssSource, /\.app-shell\.focus-mode/);
  assert.match(cssSource, /\.work-grid\.diagnosis-focused/);
  assert.match(cssSource, /\.diagnosis-stage\.spotlight/);
});

test("keeps the JLPT experiment as a visible generalization analysis proof", async () => {
  const [pageSource, cssSource] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(pageSource, /일본어 합성 예시 분석/);
  assert.match(pageSource, /Generalization proof/);
  assert.match(pageSource, /문항·개념·오답 원인·다음 행동/);
  assert.match(pageSource, /공식 JLPT 문항·난도·성과가 아닌 합성 입력의 동작 예시/);
  assert.match(pageSource, /문자·어휘 skill map/);
  assert.match(cssSource, /\.jlpt-analysis-summary/);
  assert.match(cssSource, /\.jlpt-analysis-grid/);
});

test("keeps the legacy subjective experiment behind an explicit demo URL", async () => {
  const [pageSource, cssSource] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(pageSource, /demo === "jlpt" \|\| demo === "essay"/);
  assert.match(pageSource, /<ExamStageNavigation stage="first"/);
  assert.match(pageSource, /서술 답안 구조 진단/);
  assert.match(pageSource, /논점별 답안 진단/);
  assert.match(pageSource, /Daytona 의존성 판단/);
  assert.match(pageSource, /검증·재현·배치 실행 의존성/);
  assert.match(pageSource, /공식 채점·합격 예측·손글씨 OCR 완성 claim이 아닙니다/);
  assert.match(cssSource, /\.essay-analysis-shell/);
  assert.match(cssSource, /\.essay-daytona-panel/);
});

test("summarizes all ten synthetic sets", async () => {
  const response = await request("/api/exams?mode=analytics");
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.total, 1200);
  assert.equal(payload.rounds.length, 10);
  assert.equal(payload.rounds.reduce((sum, round) => sum + round.total, 0), 1200);
  assert.equal(payload.rounds.some((round) => Object.keys(round.answerDistribution).includes("undefined")), false);
  assert.equal(payload.keywordInsights.reduce((sum, insight) => sum + insight.questionCount, 0), 1200);
  assert.deepEqual(new Set(payload.keywordInsights.map((insight) => insight.subjectCode)), new Set(["BIZ", "CONTRACT", "THEORY"]));
  assert.match(payload.source, /SYNTHETIC DEMO/);
  assert.ok(payload.keywordInsights.every(x => x.questionCount > 0));
});

test("returns a synthetic coach run without private textbook evidence", async () => {
  const data = JSON.parse(await readFile(new URL("../app/data/keyword-map.json", import.meta.url), "utf8"));
  const question = data.questions.find(q => q.id === "48-THEORY-33");
  const selectedChoice = Object.keys(question.choices).find(c => c !== question.answer);
  const response = await request("/api/coach", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({question, selectedChoice, priorAttempts: [], history: []}) });
  assert.equal(response.status, 200);
  const {run} = await response.json();
  assert.equal(run.correct, false);
  assert.equal(run.correctChoice, question.answer);
  assert.equal(run.evidence, null);
  assert.equal(run.recommendation.stage, "Essential");
  assert.equal(run.trace.length, 4);
  assert.ok(run.diagnosis && run.choiceAnalysis.reasoningSteps.length > 0);
  assert.equal(run.trace.find(t => t.step === "학습 근거 검색").status, "waiting");
});

test("evaluates each synthetic distractor against its own selected interpretation", async () => {
  const data = JSON.parse(await readFile(new URL("../app/data/keyword-map.json", import.meta.url), "utf8"));
  const question = data.questions.find(q => q.id === "48-THEORY-33");
  for (const selectedChoice of Object.keys(question.choices).filter(c => c !== question.answer)) {
    const response = await request("/api/coach", {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({question, selectedChoice, priorAttempts:[], history:[]})});
    const {run} = await response.json();
    assert.equal(run.correct, false);
    assert.equal(run.selectedChoice, selectedChoice);
    assert.ok(run.choiceAnalysis.selectedInterpretation);
    assert.ok(run.choiceAnalysis.reasoningSteps.length > 0);
  }
});

test("unmapped synthetic questions use an explicit fallback diagnostic", async () => {
  const data = JSON.parse(await readFile(new URL("../app/data/exam-questions-40-49.json", import.meta.url), "utf8"));
  const question = data.questions.find(q => q.id === "40-THEORY-21");
  const selectedChoice = Object.keys(question.choices).find(c => c !== question.answer);
  const response = await request("/api/coach", {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({question, selectedChoice, priorAttempts:[], history:[]})});
  const {run} = await response.json();
  assert.equal(run.correct, false);
  assert.equal(run.choiceAnalysis.source, "문항 공통 진단");
  assert.equal(run.evidence, null);
});

test("synthetic choice-diagnostic scope is explicit and self-consistent", async () => {
  const data = JSON.parse(await readFile(new URL("../app/data/choice-diagnostics.json", import.meta.url), "utf8"));
  assert.match(JSON.stringify(data.metadata), /synthetic|합성/i);
  assert.equal(Object.keys(data.questions).length, data.metadata.questionCount);
  for (const item of Object.values(data.questions)) assert.ok(item.axis && item.correctPrinciple && Object.keys(item.choices).length);
});

test("changes the Q33 priority after a correct retry while preserving evidence and review", async () => {
  const keywordData = JSON.parse(await readFile(new URL("../app/data/keyword-map.json", import.meta.url), "utf8"));
  const diagnosisData = JSON.parse(await readFile(new URL("../app/data/diagnosis.json", import.meta.url), "utf8"));
  const question = keywordData.questions.find((item) => item.id === "48-THEORY-33");
  const diagnostic = diagnosisData.diagnostics.find((item) => item.id === "48-THEORY-33");
  const history = [{
    questionId: question.id,
    concept: question.concept,
    correct: false,
    answeredAt: "2026-08-16T00:00:00.000Z",
    source: "app",
  }];
  const coach = async (selectedChoice) => {
    const response = await request("/api/coach", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question, selectedChoice, priorAttempts: diagnostic.attempts, history }),
    });
    assert.equal(response.status, 200);
    return (await response.json()).run;
  };

  const wrongRun = await coach(Object.keys(question.choices).find(c => c !== question.answer));
  const retryRun = await coach(question.answer);

  assert.equal(wrongRun.correct, false);
  assert.equal(retryRun.correct, true);
  assert.ok(wrongRun.priority.score > retryRun.priority.score);
  assert.equal(wrongRun.evidence, null);
  assert.equal(retryRun.evidence, null);
  assert.match(wrongRun.nextAction, /쪽수 확인 대기.*24시간/);
  assert.equal(retryRun.recommendation.stage, "Essential");
  assert.match(retryRun.nextAction, /같은 개념 변형 1문항/);
});

test("public checkout excludes private textbook evidence", async () => {
  for (const name of ["lecture-evidence-index", "lecture-evidence-top"]) {
    const data = JSON.parse(await readFile(new URL(`../app/data/${name}.json`, import.meta.url), "utf8"));
    assert.deepEqual(data.matches, {});
    assert.match(JSON.stringify(data.metadata), /synthetic|합성|excluded/i);
  }
});

test("public sponsor checkout never claims recorded live execution", async () => {
  const response = await request("/api/sponsors");
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.integrationCount, 2);
  assert.equal(payload.adapterReadyCount, 2);
  assert.equal(payload.configuredCount, 0);
  assert.equal(payload.verifiedCount, 0);
  assert.deepEqual(payload.sponsors.map(x => x.name), ["Daytona", "Nosana"]);
  assert.ok(payload.sponsors.every(x => !x.verified && x.proof));
});

test("shows Daytona HackSprint sandbox evidence without exposing secrets", async () => {
  const [pageSource, cssSource, routeSource, evidence] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/api/daytona-hacksprint/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/data/daytona-hacksprint-evidence.json", import.meta.url), "utf8"),
  ]);
  const payload = JSON.parse(evidence);

  assert.match(payload.event, /Daytona HackSprint Seoul 2026/);
  assert.match(payload.keyScope, /API key/);
  assert.equal(payload.result.valid, false);
  assert.equal(payload.result.questionCount, 0);
  assert.equal(payload.executionStatus, "not-run");
  assert.match(pageSource, /Daytona HackSprint 실행 검증/);
  assert.match(pageSource, /Daytona 샌드박스 검증을 실행하세요/);
  assert.match(pageSource, /키·쿠폰·계정 정보와 학습자 원본 답안은 화면과 기록에 표시하지 않습니다/);
  assert.match(pageSource, /Run in Daytona/);
  assert.match(routeSource, /POST/);
  assert.match(routeSource, /fallbackPayload/);
  assert.match(routeSource, /DAYTONA_API_KEY/);
  assert.match(cssSource, /\.daytona-evidence-panel/);
  assert.match(cssSource, /\.daytona-evidence-actions/);
  assert.doesNotMatch(evidence, /DAYTONA_API_KEY|Bearer\s|sk-[A-Za-z0-9_-]+/);
  assert.doesNotMatch(`${pageSource}\n${routeSource}`, /DAYTONA_API_KEY=|Bearer\s+[A-Za-z0-9._-]+|sk-[A-Za-z0-9_-]{20,}/);
});

test("keeps one field command for dry-run and live sponsor evidence", async () => {
  const runner = await readFile(new URL("../scripts/sponsors/field_check.mjs", import.meta.url), "utf8");
  const qwenSmoke = await readFile(new URL("../scripts/sponsors/qwen_smoke.mjs", import.meta.url), "utf8");
  const readiness = JSON.parse(await readFile(new URL("../app/data/sponsor-readiness.json", import.meta.url), "utf8"));
  assert.match(runner, /process\.argv\.includes\("--live"\)/);
  assert.match(runner, /evidenceSha256/);
  assert.match(qwenSmoke, /responseVerified: true/);
  assert.equal(readiness.adapterReadyCount, 2);
  assert.equal(readiness.failedCount, 0);
  assert.equal(readiness.integrations.length, 2);
});
