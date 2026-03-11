import { useState } from 'react';
import { validate, llmDumpSchema, linkedinSchema, githubSchema } from './lib/schemas';

const PROMPT_TEXT = `You know me well from our conversations. I want you to extract everything about me — my profession, skills, tech stack, projects I've built, communication style, personality traits, how I think, what I care about, my goals, my blind spots, and my working style. Be specific and brutally honest. Format it as a structured profile with clear sections.`;

function StepIndicator({ currentStep }) {
  return (
    <div className="flex gap-2 justify-center pt-5 pb-2">
      {[0, 1, 2].map((step) => (
        <div
          key={step}
          className={`w-2 h-2 rounded-full transition-colors ${step <= currentStep ? 'bg-neutral-800' : 'bg-neutral-300'}`}
        />
      ))}
    </div>
  );
}

function FieldError({ schema, value, field }) {
  if (!value) return null;
  const r = validate(schema, { [field]: value });
  if (r.ok || !r.errors[field]) return null;
  return <span className="text-red-500 text-xs">{r.errors[field]}</span>;
}

export default function Onboarding({ onSubmit }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    llmDump: '',
    linkedinPaste: '',
    githubUsername: '',
  });
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(PROMPT_TEXT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const next = () => setCurrentStep((s) => s + 1);
  const back = () => setCurrentStep((s) => s - 1);

  const stepTitles = [
    'Ask your AI about yourself',
    'Paste your LinkedIn profile',
    'Your GitHub username',
  ];

  const step0Valid = validate(llmDumpSchema, { llmDump: formData.llmDump }).ok;
  const step1Valid = validate(linkedinSchema, { linkedinPaste: formData.linkedinPaste }).ok;
  const step2Valid = validate(githubSchema, { githubUsername: formData.githubUsername }).ok;

  return (
    <div className="min-h-screen flex items-center justify-center pt-16">
      <div className="pulse-card flex flex-col">
        {/* Hero */}
        <div className="pulse-card-hero">
          <div className="pulse-corner-dot" style={{ top: 16, left: 16 }} />
          <div className="pulse-corner-dot" style={{ top: 16, right: 16 }} />
          <div className="pulse-corner-dot" style={{ bottom: 16, left: 16 }} />
          <div className="pulse-corner-dot" style={{ bottom: 16, right: 16 }} />

          <div className="pulse-hero-text">
            <div className="text-[2.4rem] font-serif font-normal tracking-tight">Work.</div>
            <div className="text-[5rem] font-serif italic leading-none -mt-2">Create.</div>
            <div className="text-[2rem] font-serif font-semibold mt-0.5 tracking-wide">Build.</div>
          </div>

          <div className="text-white/80 text-sm mt-5 text-center leading-relaxed">
            Pulse is an open-source AI<br />coding agent that runs in your terminal.
          </div>
          <div className="flex items-center gap-3 mt-5">
            <button
              onClick={() => document.getElementById('onboarding-content')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-6 py-2.5 rounded-full bg-white text-neutral-900 text-sm font-semibold hover:bg-white/90 transition-colors shadow-sm"
            >
              Get Started
            </button>
            <button className="px-6 py-2.5 rounded-full bg-neutral-900/70 border border-white/20 text-white text-sm font-medium hover:bg-neutral-900/80 transition-colors backdrop-blur-sm">
              Explore
            </button>
          </div>
        </div>

        {/* Step dots */}
        <StepIndicator currentStep={currentStep} />

        {/* Content */}
        <div id="onboarding-content" className="px-8 pb-8 pt-2 flex-1">
          <h2 className="text-base font-medium text-neutral-700 mb-4 tracking-tight">
            Step {currentStep + 1}: {stepTitles[currentStep]}
          </h2>

          {/* ── STEP 0 ── */}
          {currentStep === 0 && (
            <div>
              <pre className="bg-neutral-50 text-neutral-600 p-4 rounded-xl text-sm whitespace-pre-wrap mb-4 border border-neutral-200">
                {PROMPT_TEXT}
              </pre>
              <button
                onClick={handleCopy}
                className="mb-5 px-4 py-2 text-sm rounded-full bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 transition-colors"
              >
                {copied ? 'Copied!' : 'Copy Prompt'}
              </button>
              <label className="block text-sm text-neutral-500 mb-2">
                Paste the AI's response here
              </label>
              <textarea
                className="w-full min-h-[180px] bg-white border border-neutral-200 rounded-xl p-3 text-neutral-800 resize-y focus:outline-none focus:border-neutral-400 text-sm"
                value={formData.llmDump}
                onChange={(e) => setFormData({ ...formData, llmDump: e.target.value })}
              />
              <div className="mt-6 flex justify-end items-center gap-3">
                <FieldError schema={llmDumpSchema} value={formData.llmDump} field="llmDump" />
                <button
                  disabled={!step0Valid}
                  onClick={next}
                  className="px-6 py-2.5 rounded-full bg-white border border-neutral-300 text-neutral-800 font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-neutral-50 transition-colors text-sm"
                >
                  Next →
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 1 ── */}
          {currentStep === 1 && (
            <div>
              <p className="text-neutral-500 text-sm mb-4">
                Go to your LinkedIn profile in browser → press Ctrl+A (select all) → Ctrl+C (copy) → paste below. Raw text is fine.
              </p>
              <textarea
                className="w-full min-h-[200px] bg-white border border-neutral-200 rounded-xl p-3 text-neutral-800 resize-y focus:outline-none focus:border-neutral-400 text-sm"
                value={formData.linkedinPaste}
                onChange={(e) => setFormData({ ...formData, linkedinPaste: e.target.value })}
              />
              <div className="mt-6 flex justify-between items-center">
                <button
                  onClick={back}
                  className="px-6 py-2.5 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-600 transition-colors text-sm"
                >
                  ← Back
                </button>
                <div className="flex items-center gap-3">
                  <FieldError schema={linkedinSchema} value={formData.linkedinPaste} field="linkedinPaste" />
                  <button
                    disabled={!step1Valid}
                    onClick={next}
                    className="px-6 py-2.5 rounded-full bg-white border border-neutral-300 text-neutral-800 font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-neutral-50 transition-colors text-sm"
                  >
                    Next →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2 ── */}
          {currentStep === 2 && (
            <div>
              <input
                type="text"
                placeholder="username"
                className="w-full bg-white border border-neutral-200 rounded-xl p-3 text-neutral-800 focus:outline-none focus:border-neutral-400 text-sm"
                value={formData.githubUsername}
                onChange={(e) => setFormData({ ...formData, githubUsername: e.target.value })}
              />
              <div className="mt-6 flex justify-between items-center">
                <button
                  onClick={back}
                  className="px-6 py-2.5 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-600 transition-colors text-sm"
                >
                  ← Back
                </button>
                <div className="flex items-center gap-3">
                  <FieldError schema={githubSchema} value={formData.githubUsername} field="githubUsername" />
                  <button
                    onClick={() => onSubmit(formData)}
                    disabled={!step2Valid}
                    className="px-6 py-2.5 rounded-full bg-white border border-neutral-300 text-neutral-800 font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-neutral-50 transition-colors text-sm"
                  >
                    Build my profile →
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
