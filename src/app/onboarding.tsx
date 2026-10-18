"use client";

import { useState } from "react";
import styles from "./page.module.css";
import type { Settings } from "./settings";

type Country = Settings["profile"]["country"];
type Age = Settings["profile"]["age"];
type Experience = Settings["profile"]["experience"];

const COUNTRIES: { value: Country; label: string; currency: Settings["profile"]["currency"] }[] = [
  { value: "uk", label: "🇬🇧 United Kingdom", currency: "GBP" },
  { value: "in", label: "🇮🇳 India", currency: "INR" },
  { value: "us", label: "🇺🇸 United States", currency: "USD" },
  { value: "other", label: "🌍 Somewhere else", currency: "" },
];

const GOALS: Record<string, string[]> = {
  uk: ["Retirement", "A house deposit", "My children's future", "Growing my savings", "Learning how investing works"],
  in: ["Retirement", "Buying a home", "My children's education", "Growing my savings", "Saving tax", "Learning how investing works"],
  us: ["Retirement", "Buying a home", "My children's education", "Growing my savings", "Learning how investing works"],
  other: ["Retirement", "Buying a home", "My children's future", "Growing my savings", "Learning how investing works"],
};

const PRODUCTS: Record<string, string[]> = {
  uk: ["Stocks and Shares ISA", "Lifetime ISA", "Workplace pension", "SIPP (personal pension)", "Cash ISA"],
  in: ["Mutual fund SIPs", "ELSS", "PPF", "NPS", "EPF", "Shares in a demat account"],
  us: ["401(k)", "IRA", "Brokerage account"],
  other: [],
};

/** First-visit setup: five quick questions that fill in the investment profile. */
export default function Onboarding({
  detected,
  onDone,
}: {
  detected: Country; // from the visitor's location, preselected
  onDone: (profile: Partial<Settings["profile"]> | null) => void; // null when skipped
}) {
  const [step, setStep] = useState(0);
  // Until they pick, the country they're browsing from is suggested (it can arrive after this mounts).
  const [picked, setCountry] = useState<Country | null>(null);
  const country = picked ?? detected;
  const [age, setAge] = useState<Age>("");
  const [goals, setGoals] = useState<string[]>([]);
  const [products, setProducts] = useState<string[]>([]);
  const [experience, setExperience] = useState<Experience>("");

  const where = country || "other";
  const toggle = (list: string[], set: (v: string[]) => void, item: string) =>
    set(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

  const finish = (exp: Experience) => {
    onDone({
      country,
      currency: COUNTRIES.find((c) => c.value === country)?.currency ?? "",
      age,
      goals: goals.join(", "),
      accounts: products.length ? products.join(", ") : PRODUCTS[where].length ? "None yet" : "",
      experience: exp,
    });
  };

  const steps = [
    {
      title: "Where do you invest?",
      hint: "So answers use your country's accounts, taxes, and currency.",
      body: (
        <div className={styles.onboardOptions}>
          {COUNTRIES.map((c) => (
            <button
              key={c.value}
              aria-pressed={country === c.value}
              className={country === c.value ? styles.onboardOn : ""}
              onClick={() => {
                setCountry(c.value);
                setProducts([]);
                setStep(1);
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      ),
    },
    {
      title: "How old are you?",
      hint: "It changes how long your money has to grow.",
      body: (
        <div className={styles.onboardOptions}>
          {(["18-29", "30-39", "40-54", "55+"] as Age[]).map((a) => (
            <button
              key={a}
              aria-pressed={age === a}
              className={age === a ? styles.onboardOn : ""}
              onClick={() => {
                setAge(a);
                setStep(2);
              }}
            >
              {a === "55+" ? "55 or over" : a.replace("-", " to ")}
            </button>
          ))}
          <button className={styles.onboardQuiet} onClick={() => setStep(2)}>
            Prefer not to say
          </button>
        </div>
      ),
    },
    {
      title: "What are you investing for?",
      hint: "Pick any that apply.",
      multi: true,
      body: (
        <div className={styles.onboardOptions}>
          {GOALS[where].map((g) => (
            <button
              key={g}
              aria-pressed={goals.includes(g)}
              className={goals.includes(g) ? styles.onboardOn : ""}
              onClick={() => toggle(goals, setGoals, g)}
            >
              {g}
            </button>
          ))}
        </div>
      ),
    },
    {
      title: "Which of these do you already have?",
      hint: "Pick any, or none yet. Answers will build on what you have.",
      multi: true,
      skip: PRODUCTS[where].length === 0,
      body: (
        <div className={styles.onboardOptions}>
          {PRODUCTS[where].map((p) => (
            <button
              key={p}
              aria-pressed={products.includes(p)}
              className={products.includes(p) ? styles.onboardOn : ""}
              onClick={() => toggle(products, setProducts, p)}
            >
              {p}
            </button>
          ))}
        </div>
      ),
    },
    {
      title: "How much do you know about investing?",
      hint: "Answers explain more or less to match.",
      body: (
        <div className={styles.onboardOptions}>
          {(
            [
              ["new", "I'm new to it"],
              ["some", "I know the basics"],
              ["experienced", "I'm experienced"],
            ] as [Experience, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              aria-pressed={experience === value}
              className={experience === value ? styles.onboardOn : ""}
              onClick={() => {
                setExperience(value);
                finish(value);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      ),
    },
  ];

  // Steps that don't apply (products, for "somewhere else") are passed over.
  const next = (from: number) => {
    let n = from + 1;
    while (steps[n]?.skip) n++;
    setStep(n);
  };
  const back = () => {
    let n = step - 1;
    while (n > 0 && steps[n]?.skip) n--;
    setStep(Math.max(0, n));
  };
  const current = steps[step];

  return (
    <section className={styles.onboard} aria-labelledby="onboard-title">
      <div className={styles.onboardTop}>
        <span>
          Make Tickerwise yours · {step + 1} of {steps.length}
        </span>
        <button className={styles.onboardQuiet} onClick={() => onDone(null)}>
          Skip
        </button>
      </div>
      <h2 id="onboard-title" className={styles.onboardTitle}>
        {current.title}
      </h2>
      <p className={styles.onboardHint}>{current.hint}</p>
      {current.body}
      <div className={styles.onboardNav}>
        {step > 0 && (
          <button className={styles.onboardQuiet} onClick={back}>
            ← Back
          </button>
        )}
        {current.multi && (
          <button className={styles.onboardNext} onClick={() => next(step)}>
            Next
          </button>
        )}
      </div>
    </section>
  );
}
