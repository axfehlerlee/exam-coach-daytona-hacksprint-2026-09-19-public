"use client";
import { useState } from "react";
import { syntheticStudyExample, type SponsorReceipt } from "../lib/hacksprint-sponsors";

export function HackSprintSponsors() {
  const [receipts, setReceipts] = useState<Record<string, SponsorReceipt>>({});
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function run(provider: "nosana") {
    setRunning(provider);
    setError(null);
    try {
      const response = await fetch("/api/hacksprint-sponsors", {method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({provider})});
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "실행 요청 실패");
      setReceipts(previous => ({...previous, [provider]: payload}));
    } catch (error) { setError(error instanceof Error ? error.message : "연결 실패"); }
    finally { setRunning(null); }
  }
  return <section className="hacksprint-sponsors" aria-label="Nosana 실제 연동">
    {([
      {id:"nosana", title:"Nosana · AI 복습 제안", description:"개인 답안 없이 합성 학습 예시로 복습 문구를 생성합니다. AI 생성 결과는 검토가 필요하며 공식 채점에 사용하지 않습니다.", action:"Nosana에서 예시 생성"},
    ] as const).map(item => {
      const receipt = receipts[item.id];
      return <article key={item.id} className="daytona-evidence-panel" style={{display:"block"}}>
        <h3>{item.title}</h3>
        <p>{item.description}</p>
        <p className="nosana-example-facts">
          <b>합성 예시 · 현재 시험 과목</b>
          {syntheticStudyExample.subject} · {syntheticStudyExample.keyword}. {syntheticStudyExample.notice} 제공된 행동: {syntheticStudyExample.action}
        </p>
        <div className="daytona-evidence-actions"><button disabled={running !== null} onClick={() => void run(item.id)} type="button">{running === item.id ? "실제 호출 중…" : item.action}</button></div>
        <div aria-live="polite">
          <p className="nosana-safety-note">{receipt?.message ?? "실행 전 · 연결 성공 여부 미확인. 개인 답안은 전송하지 않으며, 생성 결과는 검토가 필요합니다."}</p>
          {receipt?.output && <blockquote><span>검토가 필요한 생성 결과 · 합성 예시 · 개인 답안 미전송</span>{receipt.output}</blockquote>}
          {receipt && <p><small>{receipt.model ? `모델: ${receipt.model} · ` : ""}확인 시각: {new Date(receipt.checkedAt).toLocaleString("ko-KR", {timeZone:"Asia/Seoul"})} KST</small></p>}
        </div>
      </article>;
    })}
    {error && <p className="analysis-error" role="alert">{error}</p>}
  </section>;
}
