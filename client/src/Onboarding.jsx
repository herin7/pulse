import { useCallback, useEffect, useMemo, useState } from 'react';
import { validate, llmDumpSchema, linkedinSchema, githubSchema } from './lib/schemas';

const PROMPT_TEXT = `You know me well from our conversations. I want you to extract everything about me - my profession, skills, tech stack, projects I've built, communication style, personality traits, how I think, what I care about, my goals, my blind spots, and my working style. Be specific and brutally honest. Format it as a structured profile with clear sections.`;

const SOURCE_KEYS = {
  selfReport: 'selfReport',
  linkedin: 'linkedin',
  github: 'github',
};

function getStorageKey() {
  const userId = localStorage.getItem('lc_user_id') || 'anonymous';
  return `pulse_onboarding_${userId}`;
}

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

function FieldError({ schema, value, field, disabled }) {
  if (disabled || !value) return null;
  const result = validate(schema, { [field]: value });
  if (result.ok || !result.errors[field]) return null;
  return <span className="text-red-500 text-xs">{result.errors[field]}</span>;
}

function SourceToggle({ skipped, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="mb-4 px-4 py-2 text-xs rounded-full border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 transition-colors"
    >
      {skipped ? 'Use this source now' : 'Add later'}
    </button>
  );
}

export default function Onboarding({ onSubmit }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    llmDump: '',
    linkedinPaste: '',
    githubUsername: '',
  });
  const [sourcePreferences, setSourcePreferences] = useState({
    [SOURCE_KEYS.selfReport]: 'active',
    [SOURCE_KEYS.linkedin]: 'active',
    [SOURCE_KEYS.github]: 'active',
  });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(getStorageKey());
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (parsed?.formData) setFormData(parsed.formData);
      if (parsed?.sourcePreferences) setSourcePreferences(parsed.sourcePreferences);
      if (Number.isInteger(parsed?.currentStep)) setCurrentStep(parsed.currentStep);
    } catch {}
  }, []);

  useEffect(() => {
    sessionStorage.setItem(getStorageKey(), JSON.stringify({
      formData,
      sourcePreferences,
      currentStep,
    }));
  }, [currentStep, formData, sourcePreferences]);

  const toggleSource = useCallback((sourceKey) => {
    setSourcePreferences((prev) => ({
      ...prev,
      [sourceKey]: prev[sourceKey] === 'skipped' ? 'active' : 'skipped',
    }));
  }, []);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(PROMPT_TEXT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const next = useCallback(() => setCurrentStep((step) => Math.min(2, step + 1)), []);
  const back = useCallback(() => setCurrentStep((step) => Math.max(0, step - 1)), []);

  const isSelfReportSkipped = sourcePreferences[SOURCE_KEYS.selfReport] === 'skipped';
  const isLinkedinSkipped = sourcePreferences[SOURCE_KEYS.linkedin] === 'skipped';
  const isGithubSkipped = sourcePreferences[SOURCE_KEYS.github] === 'skipped';

  const stepTitles = useMemo(() => [
    'Ask your AI about yourself',
    'Paste your LinkedIn profile',
    'Your GitHub username',
  ], []);

  const step0Valid = isSelfReportSkipped || validate(llmDumpSchema, { llmDump: formData.llmDump }).ok;
  const step1Valid = isLinkedinSkipped || validate(linkedinSchema, { linkedinPaste: formData.linkedinPaste }).ok;
  const step2Valid = isGithubSkipped || validate(githubSchema, { githubUsername: formData.githubUsername }).ok;

  const handleSubmit = useCallback(() => {
    onSubmit({
      ...formData,
      sourcePreferences,
    });
  }, [formData, onSubmit, sourcePreferences]);

  return (
    <div className="min-h-screen flex items-center justify-center pt-16">
      <div className="pulse-card flex flex-col">
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
            Pulse builds your profile with source-level control.
          </div>
          <div className="flex items-center gap-3 mt-5">
            <button
              onClick={() => document.getElementById('onboarding-content')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-6 py-2.5 rounded-full bg-white text-neutral-900 text-sm font-semibold hover:bg-white/90 transition-colors shadow-sm"
            >
              Get Started
            </button>
          </div>
        </div>

        <StepIndicator currentStep={currentStep} />

        <div id="onboarding-content" className="px-8 pb-8 pt-2 flex-1">
          <h2 className="text-base font-medium text-neutral-700 mb-4 tracking-tight">
            Step {currentStep + 1}: {stepTitles[currentStep]}
          </h2>

          {currentStep === 0 && (
            <div>
              <SourceToggle
                skipped={isSelfReportSkipped}
                onToggle={() => toggleSource(SOURCE_KEYS.selfReport)}
              />
              {!isSelfReportSkipped && (
                <>
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
                    Paste the AI response
                  </label>
                  <textarea
                    className="w-full min-h-[180px] bg-white border border-neutral-200 rounded-xl p-3 text-neutral-800 resize-y focus:outline-none focus:border-neutral-400 text-sm"
                    value={formData.llmDump}
                    onChange={(event) => setFormData((prev) => ({ ...prev, llmDump: event.target.value }))}
                  />
                </>
              )}
              {isSelfReportSkipped && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  Self report will be skipped for now. You can add it later from settings.
                </div>
              )}
              <div className="mt-6 flex justify-end items-center gap-3">
                <FieldError schema={llmDumpSchema} value={formData.llmDump} field="llmDump" disabled={isSelfReportSkipped} />
                <button
                  disabled={!step0Valid}
                  onClick={next}
                  className="px-6 py-2.5 rounded-full bg-white border border-neutral-300 text-neutral-800 font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-neutral-50 transition-colors text-sm"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {currentStep === 1 && (
            <div>
              <SourceToggle
                skipped={isLinkedinSkipped}
                onToggle={() => toggleSource(SOURCE_KEYS.linkedin)}
              />
              {!isLinkedinSkipped && (
                <>
                  <p className="text-neutral-500 text-sm mb-4">
                    Open LinkedIn profile, copy page text, and paste below.
                  </p>
                  <textarea
                    className="w-full min-h-[200px] bg-white border border-neutral-200 rounded-xl p-3 text-neutral-800 resize-y focus:outline-none focus:border-neutral-400 text-sm"
                    value={formData.linkedinPaste}
                    onChange={(event) => setFormData((prev) => ({ ...prev, linkedinPaste: event.target.value }))}
                  />
                </>
              )}
              {isLinkedinSkipped && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  LinkedIn source will be skipped for now. You can re-fetch it later.
                </div>
              )}
              <div className="mt-6 flex justify-between items-center">
                <button
                  onClick={back}
                  className="px-6 py-2.5 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-600 transition-colors text-sm"
                >
                  Back
                </button>
                <div className="flex items-center gap-3">
                  <FieldError schema={linkedinSchema} value={formData.linkedinPaste} field="linkedinPaste" disabled={isLinkedinSkipped} />
                  <button
                    disabled={!step1Valid}
                    onClick={next}
                    className="px-6 py-2.5 rounded-full bg-white border border-neutral-300 text-neutral-800 font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-neutral-50 transition-colors text-sm"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div>
              <SourceToggle
                skipped={isGithubSkipped}
                onToggle={() => toggleSource(SOURCE_KEYS.github)}
              />
              {!isGithubSkipped && (
                <input
                  type="text"
                  placeholder="GitHub username"
                  className="w-full bg-white border border-neutral-200 rounded-xl p-3 text-neutral-800 focus:outline-none focus:border-neutral-400 text-sm"
                  value={formData.githubUsername}
                  onChange={(event) => setFormData((prev) => ({ ...prev, githubUsername: event.target.value }))}
                />
              )}
              {isGithubSkipped && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  GitHub source will be skipped for now. You can add it later in settings.
                </div>
              )}
              <div className="mt-6 flex justify-between items-center">
                <button
                  onClick={back}
                  className="px-6 py-2.5 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-600 transition-colors text-sm"
                >
                  Back
                </button>
                <div className="flex items-center gap-3">
                  <FieldError schema={githubSchema} value={formData.githubUsername} field="githubUsername" disabled={isGithubSkipped} />
                  <button
                    onClick={handleSubmit}
                    disabled={!step2Valid}
                    className="px-6 py-2.5 rounded-full bg-white border border-neutral-300 text-neutral-800 font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-neutral-50 transition-colors text-sm"
                  >
                    Build my profile
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
