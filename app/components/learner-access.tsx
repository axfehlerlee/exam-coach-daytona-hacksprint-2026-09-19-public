"use client";

import { Check, Clipboard, Database, LoaderCircle, LogIn, ShieldCheck, UserRound } from "lucide-react";
import { FormEvent, useState } from "react";

export type LearnerAccount = {
  id: string;
  nickname: string;
  createdAt: string;
  lastSeenAt: string;
  attemptCount: number;
  answerCount: number;
  lastAttemptAt: string | null;
};

type AuthPayload = {
  authenticated?: boolean;
  learner?: LearnerAccount;
  learnerCode?: string;
  error?: string;
};

export function LearnerAccess({
  onAuthenticated,
  onGuest,
}: {
  onAuthenticated: (learner: LearnerAccount) => void;
  onGuest: () => void;
}) {
  const [mode, setMode] = useState<"register" | "login">("register");
  const [nickname, setNickname] = useState("");
  const [learnerCode, setLearnerCode] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ learner: LearnerAccount; code: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (mode === "register" && !consent) {
      setError("익명 학습 기록 저장 안내를 확인해 주세요.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "register"
          ? { action: "register", nickname }
          : { action: "login", learnerCode }),
      });
      const payload = await response.json() as AuthPayload;
      if (!response.ok || !payload.learner) throw new Error(payload.error ?? "접속 정보를 확인해 주세요.");
      if (mode === "register" && payload.learnerCode) {
        setIssued({ learner: payload.learner, code: payload.learnerCode });
      } else {
        onAuthenticated(payload.learner);
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "접속 요청을 처리하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function copyCode() {
    if (!issued) return;
    await navigator.clipboard.writeText(issued.code);
    setCopied(true);
  }

  return (
    <main className="access-shell">
      <section className="access-intro">
        <div className="access-brand"><span>EC</span><strong>Exam Coach</strong></div>
        <p className="eyebrow">자격시험 인강 플랫폼용 AI 학습 분석</p>
        <h1>틀린 문제보다, 흔들린 개념부터</h1>
        <p className="access-lead">문제은행 풀이 기록을 오답 원인, 취약 키워드, 강사 자료 근거, 다음 복습 행동으로 연결합니다.</p>
        <ol className="access-demo-flow" aria-label="Exam Coach 진단 흐름">
          <li>문제 풀이</li>
          <li>오답 진단</li>
          <li>근거 연결</li>
          <li>다음 행동</li>
        </ol>
        <div className="access-points">
          <div><ShieldCheck aria-hidden="true" /><span><strong>학습자</strong><small>왜 틀렸는지와 다음 복습 행동 확인</small></span></div>
          <div><Database aria-hidden="true" /><span><strong>강사</strong><small>문항별 취약점과 계산·수치 오류 경향 확인</small></span></div>
          <div><UserRound aria-hidden="true" /><span><strong>플랫폼</strong><small>시험·과목 데이터를 바꿔 다른 자격시험으로 확장</small></span></div>
        </div>
      </section>

      <section className="access-panel" aria-labelledby="access-title">
        {issued ? (
          <div className="issued-code">
            <span className="issued-icon"><Check aria-hidden="true" /></span>
            <p className="eyebrow">익명 계정 생성 완료</p>
            <h2 id="access-title">학습자 코드를 보관해 주세요</h2>
            <div className="code-copy-row">
              <strong>{issued.code}</strong>
              <button aria-label="학습자 코드 복사" onClick={copyCode} type="button">
                {copied ? <Check aria-hidden="true" /> : <Clipboard aria-hidden="true" />}
              </button>
            </div>
            <p>다른 기기에서 기록을 불러올 때 필요합니다. 원본 코드는 서버에 저장하지 않습니다.</p>
            <button className="access-primary" onClick={() => onAuthenticated(issued.learner)} type="button">
              학습 시작 <LogIn aria-hidden="true" />
            </button>
          </div>
        ) : (
          <>
            <div className="demo-entry-card">
              <p className="eyebrow">Daytona HackSprint Seoul 2026 · SYNTHETIC DEMO</p>
              <h2>공개 합성 데모를 시작합니다</h2>
              <p>합성 문항과 가상 풀이 기록으로 취약 개념과 다음 학습 행동을 연결합니다. Daytona·Nosana 실행 증거는 학습 화면과 분리된 데모 영역에서 확인합니다.</p>
              <button className="access-primary" onClick={onGuest} type="button">
                로그인 없이 데모 시작 <LogIn aria-hidden="true" />
              </button>
            </div>
            <div className="access-tabs" role="tablist" aria-label="접속 방식">
              <button aria-selected={mode === "register"} className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(null); }} role="tab" type="button">기록 남기기</button>
              <button aria-selected={mode === "login"} className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(null); }} role="tab" type="button">기록 이어보기</button>
            </div>
            <form onSubmit={submit}>
              <p className="eyebrow">{mode === "register" ? "익명 학습자 등록" : "기존 기록 불러오기"}</p>
              <h2 id="access-title">{mode === "register" ? "내 풀이 변화를 저장하려면 별명만 입력하세요" : "학습자 코드를 입력하세요"}</h2>
              {mode === "register" ? (
                <label className="access-field">
                  <span>별명</span>
                  <input autoComplete="nickname" maxLength={16} minLength={2} onChange={(event) => setNickname(event.target.value)} placeholder="2~16자" required value={nickname} />
                </label>
              ) : (
                <label className="access-field">
                  <span>학습자 코드</span>
                  <input autoCapitalize="characters" autoComplete="off" onChange={(event) => setLearnerCode(event.target.value)} placeholder="EC-XXXX-XXXX-XXXX" required value={learnerCode} />
                </label>
              )}
              {mode === "register" && (
                <label className="access-consent">
                  <input checked={consent} onChange={(event) => setConsent(event.target.checked)} type="checkbox" />
                  <span>별명, 완료한 문항별 답안, 점수, 풀이 시각을 학습 분석 목적으로 저장하는 데 동의합니다.</span>
                </label>
              )}
              {error && <p className="access-error" role="alert">{error}</p>}
              <button className="access-primary" disabled={loading} type="submit">
                {loading ? <LoaderCircle className="spin" aria-hidden="true" /> : <LogIn aria-hidden="true" />}
                {mode === "register" ? "익명 계정 만들기" : "기록 불러오기"}
              </button>
            </form>
            <small className="guest-note">데모 모드의 새 풀이 기록은 서버에 저장되지 않습니다.</small>
          </>
        )}
      </section>
    </main>
  );
}

export function AccessLoading() {
  return (
    <main className="access-loading" aria-label="학습 기록 연결 중">
      <div className="access-brand"><span>EC</span><strong>Exam Coach</strong></div>
      <LoaderCircle className="spin" aria-hidden="true" />
      <p>학습 기록을 연결하고 있습니다.</p>
    </main>
  );
}
