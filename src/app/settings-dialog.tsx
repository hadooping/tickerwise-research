"use client";

import React, { useEffect, useRef, useState } from "react";
import styles from "./settings.module.css";
import { LANGUAGES, MAX_MEMORIES, type Settings } from "./settings";

type Tab = "appearance" | "answers" | "profile" | "memory" | "data";
const TABS: { key: Tab; label: string }[] = [
  { key: "appearance", label: "Appearance" },
  { key: "answers", label: "Answers" },
  { key: "profile", label: "Investment profile" },
  { key: "memory", label: "Memory" },
  { key: "data", label: "Data & account" },
];

// A row of mutually exclusive buttons, like a segmented control.
function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className={styles.field}>
      <legend>{label}</legend>
      <div className={styles.choice}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={o.value === value}
            className={o.value === value ? styles.choiceOn : ""}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <select className={styles.input} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Text({
  label,
  hint,
  value,
  onChange,
  multiline,
  max = 300,
  placeholder,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  max?: number;
  placeholder?: string;
}) {
  const props = {
    className: styles.input,
    value,
    maxLength: max,
    placeholder,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
  };
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      {hint && <span className={styles.hint}>{hint}</span>}
      {multiline ? <textarea rows={4} {...props} /> : <input type="text" {...props} />}
    </label>
  );
}

export default function SettingsDialog({
  open,
  onClose,
  settings,
  onChange,
  signedIn,
  email,
  onExportMarkdown,
  onExportJson,
  onDeleteAccount,
  onClearDevice,
}: {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  onChange: (update: (s: Settings) => Settings) => void;
  signedIn: boolean;
  email: string | null;
  onExportMarkdown: () => void;
  onExportJson: () => void;
  onDeleteAccount: () => Promise<string | null>; // resolves to an error message, or null when done
  onClearDevice: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<Tab>("appearance");
  const [newMemory, setNewMemory] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const set = <K extends "appearance" | "answers" | "profile" | "memory">(key: K, value: Partial<Settings[K]>) =>
    onChange((s) => ({ ...s, [key]: { ...s[key], ...value } }));
  const a = settings.appearance;
  const p = settings.profile;

  const addMemory = () => {
    const text = newMemory.trim();
    if (!text) return;
    onChange((s) => ({
      ...s,
      memory: {
        ...s.memory,
        items: [{ id: crypto.randomUUID(), text, savedAt: Date.now() }, ...s.memory.items].slice(0, MAX_MEMORIES),
      },
    }));
    setNewMemory("");
  };

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="settings-title"
    >
      <div className={styles.panel}>
        <header className={styles.head}>
          <h2 id="settings-title">Settings</h2>
          <button className={styles.close} onClick={onClose} aria-label="Close settings">
            ✕
          </button>
        </header>

        <nav className={styles.tabs} aria-label="Settings sections">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={t.key === tab ? styles.tabOn : ""}
              aria-current={t.key === tab ? "page" : undefined}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className={styles.body}>
          <p className={styles.syncNote}>
            {signedIn
              ? `Saved to your account (${email}), so it follows you to other devices.`
              : "Saved in this browser. Sign in to keep it on every device."}
          </p>

          {tab === "appearance" && (
            <section>
              <Choice
                label="Theme"
                value={a.theme}
                onChange={(theme) => set("appearance", { theme })}
                options={[
                  { value: "system", label: "Match device" },
                  { value: "light", label: "Light" },
                  { value: "dark", label: "Dark" },
                ]}
              />
              <Choice
                label="Font"
                value={a.font}
                onChange={(font) => set("appearance", { font })}
                options={[
                  { value: "sans", label: "Modern" },
                  { value: "serif", label: "Classic" },
                  { value: "readable", label: "Easy to read" },
                ]}
              />
              <Choice
                label="Text size"
                value={a.size}
                onChange={(size) => set("appearance", { size })}
                options={[
                  { value: "small", label: "Small" },
                  { value: "medium", label: "Medium" },
                  { value: "large", label: "Large" },
                  { value: "xl", label: "Extra large" },
                ]}
              />
              <Choice
                label="Reading width"
                value={a.width}
                onChange={(width) => set("appearance", { width })}
                options={[
                  { value: "narrow", label: "Narrow" },
                  { value: "standard", label: "Standard" },
                  { value: "wide", label: "Wide" },
                ]}
              />
              <div className={styles.preview} aria-hidden="true">
                <strong>Preview</strong>
                <p>
                  An index fund buys every company in a list such as the FTSE 100, so one company doing badly matters
                  less.
                </p>
              </div>
            </section>
          )}

          {tab === "answers" && (
            <section>
              <Choice
                label="Answer length"
                value={settings.answers.length}
                onChange={(length) => set("answers", { length })}
                options={[
                  { value: "short", label: "Short" },
                  { value: "standard", label: "Standard" },
                  { value: "detailed", label: "Detailed" },
                ]}
              />
              <Select
                label="Answer language"
                value={settings.answers.language}
                onChange={(language) => set("answers", { language })}
                options={LANGUAGES.map((l) => ({ value: l, label: l }))}
              />
              <Text
                label="Instructions for Tickerwise"
                hint="Anything you'd like it to keep in mind in every answer."
                multiline
                max={1500}
                value={settings.instructions}
                onChange={(instructions) => onChange((s) => ({ ...s, instructions }))}
                placeholder="For example: always show figures in pounds; compare with a global index fund; use bullet points."
              />
            </section>
          )}

          {tab === "profile" && (
            <section>
              <p className={styles.intro}>
                Tickerwise uses this to make answers fit you: your country&apos;s accounts and taxes, your currency, and
                how much to explain. It still won&apos;t tell you what to buy. Leave anything blank.
              </p>
              <div className={styles.grid}>
                <Select
                  label="Where you live"
                  value={p.country}
                  onChange={(country) => set("profile", { country })}
                  options={[
                    { value: "", label: "Not set" },
                    { value: "uk", label: "United Kingdom" },
                    { value: "us", label: "United States" },
                    { value: "in", label: "India" },
                    { value: "other", label: "Somewhere else" },
                  ]}
                />
                <Select
                  label="Age"
                  value={p.age}
                  onChange={(age) => set("profile", { age })}
                  options={[
                    { value: "", label: "Not set" },
                    { value: "18-29", label: "18 to 29" },
                    { value: "30-39", label: "30 to 39" },
                    { value: "40-54", label: "40 to 54" },
                    { value: "55+", label: "55 or over" },
                  ]}
                />
                <Select
                  label="Currency"
                  value={p.currency}
                  onChange={(currency) => set("profile", { currency })}
                  options={[
                    { value: "", label: "Not set" },
                    { value: "GBP", label: "£ Pounds (GBP)" },
                    { value: "USD", label: "$ Dollars (USD)" },
                    { value: "INR", label: "₹ Rupees (INR)" },
                    { value: "EUR", label: "€ Euros (EUR)" },
                  ]}
                />
                <Select
                  label="Investing experience"
                  value={p.experience}
                  onChange={(experience) => set("profile", { experience })}
                  options={[
                    { value: "", label: "Not set" },
                    { value: "new", label: "New to investing" },
                    { value: "some", label: "Some experience" },
                    { value: "experienced", label: "Experienced" },
                  ]}
                />
                <Select
                  label="How long you'll invest for"
                  value={p.horizon}
                  onChange={(horizon) => set("profile", { horizon })}
                  options={[
                    { value: "", label: "Not set" },
                    { value: "short", label: "Under 2 years" },
                    { value: "medium", label: "2 to 5 years" },
                    { value: "long", label: "5 to 10 years" },
                    { value: "very-long", label: "More than 10 years" },
                  ]}
                />
              </div>
              <Choice
                label="How you feel about ups and downs"
                value={p.risk}
                onChange={(risk) => set("profile", { risk })}
                options={[
                  { value: "", label: "Not set" },
                  { value: "low", label: "Prefer steady" },
                  { value: "medium", label: "Some swings are OK" },
                  { value: "high", label: "Big swings are OK" },
                ]}
              />
              <Text
                label="Goals"
                value={p.goals}
                onChange={(goals) => set("profile", { goals })}
                placeholder="For example: retirement, a house deposit in 5 years, children's education"
              />
              <Text
                label="Accounts you use"
                value={p.accounts}
                onChange={(accounts) => set("profile", { accounts })}
                placeholder="For example: Stocks and Shares ISA, workplace pension, SIP, 401(k)"
              />
              <Text
                label="Things to avoid"
                value={p.avoid}
                onChange={(avoid) => set("profile", { avoid })}
                placeholder="For example: tobacco, weapons, cryptocurrency"
              />
            </section>
          )}

          {tab === "memory" && (
            <section>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={settings.memory.enabled}
                  onChange={(e) => set("memory", { enabled: e.target.checked })}
                />
                <span>
                  <strong>Let Tickerwise remember things you tell it</strong>
                  <span className={styles.hint}>
                    When you mention something lasting, like your goals or the accounts you use, it saves a short note
                    here and uses it in later answers. Turn this off to stop saving and using notes.
                  </span>
                </span>
              </label>

              <div className={styles.addRow}>
                <input
                  className={styles.input}
                  value={newMemory}
                  maxLength={200}
                  onChange={(e) => setNewMemory(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addMemory()}
                  placeholder="Add a note, e.g. I already have a workplace pension"
                  aria-label="New memory"
                />
                <button className={styles.button} onClick={addMemory} disabled={!newMemory.trim()}>
                  Add
                </button>
              </div>

              {settings.memory.items.length === 0 ? (
                <p className={styles.empty}>Nothing remembered yet.</p>
              ) : (
                <>
                  <ul className={styles.memories}>
                    {settings.memory.items.map((m) => (
                      <li key={m.id}>
                        <span>{m.text}</span>
                        <button
                          className={styles.remove}
                          aria-label={`Forget: ${m.text}`}
                          onClick={() =>
                            onChange((s) => ({
                              ...s,
                              memory: { ...s.memory, items: s.memory.items.filter((x) => x.id !== m.id) },
                            }))
                          }
                        >
                          Forget
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button
                    className={styles.linkButton}
                    onClick={() => onChange((s) => ({ ...s, memory: { ...s.memory, items: [] } }))}
                  >
                    Forget everything
                  </button>
                </>
              )}
            </section>
          )}

          {tab === "data" && (
            <section>
              <h3 className={styles.sectionTitle}>Export your data</h3>
              <p className={styles.intro}>
                Download every chat {signedIn ? "in your account" : "in this browser"}, with sources, plus your settings
                and memory.
              </p>
              <div className={styles.buttonRow}>
                <button className={styles.button} onClick={onExportMarkdown}>
                  Chats as a document (.md)
                </button>
                <button className={styles.button} onClick={onExportJson}>
                  Everything as data (.json)
                </button>
              </div>

              {signedIn ? (
                <div className={styles.danger}>
                  <h3 className={styles.sectionTitle}>Delete your account</h3>
                  <p className={styles.intro}>
                    This permanently deletes your account, every saved chat, your settings, and your memory. It
                    can&apos;t be undone. Export first if you want a copy.
                  </p>
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Type DELETE to confirm</span>
                    <input
                      className={styles.input}
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      autoComplete="off"
                    />
                  </label>
                  {deleteError && (
                    <p className={styles.error} role="alert">
                      {deleteError}
                    </p>
                  )}
                  <button
                    className={styles.dangerButton}
                    disabled={confirmText !== "DELETE" || deleting}
                    onClick={async () => {
                      setDeleting(true);
                      setDeleteError(await onDeleteAccount());
                      setDeleting(false);
                      setConfirmText("");
                    }}
                  >
                    {deleting ? "Deleting…" : "Delete my account"}
                  </button>
                </div>
              ) : (
                <div className={styles.danger}>
                  <h3 className={styles.sectionTitle}>Clear this device</h3>
                  <p className={styles.intro}>
                    Removes every chat, setting, and memory stored in this browser. It can&apos;t be undone.
                  </p>
                  <button className={styles.dangerButton} onClick={onClearDevice}>
                    Clear everything on this device
                  </button>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </dialog>
  );
}
