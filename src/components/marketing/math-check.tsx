"use client";

import { useId } from "react";
import type { MathProblem } from "@/lib/human-check/shared";

export function MathCheck({
  problem,
  value,
  onChange,
}: {
  problem: Pick<MathProblem, "a" | "b"> | null;
  value: string;
  onChange: (next: string) => void;
}) {
  const id = useId();
  const question = problem ? `What is ${problem.a} + ${problem.b}?` : "Loading a quick check…";
  return (
    <div>
      <label className="mb-1 block text-sm" htmlFor={id} style={{ color: "var(--text-secondary, #3F4350)" }}>
        {question}
      </label>
      <input
        id={id}
        name="math_answer"
        inputMode="numeric"
        autoComplete="off"
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Answer"
        aria-label={problem ? `What is ${problem.a} plus ${problem.b}` : "Math answer"}
        className="input-field"
        style={{ fontSize: 16 }}
      />
    </div>
  );
}
