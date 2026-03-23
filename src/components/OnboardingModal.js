import { useEffect, useMemo, useState } from 'react';
import { INDUSTRIES, ROLES } from '../data/articles';

const LS_ROLE = 'aiSignal.role';
const LS_INDUSTRY = 'aiSignal.industry';

export function loadSelection() {
  const role = localStorage.getItem(LS_ROLE) || '';
  const industry = localStorage.getItem(LS_INDUSTRY) || '';
  return { role, industry };
}

export function saveSelection({ role, industry }) {
  if (role) localStorage.setItem(LS_ROLE, role);
  if (industry) localStorage.setItem(LS_INDUSTRY, industry);
}

export default function OnboardingModal({ open, initialRole, initialIndustry, onClose }) {
  const [step, setStep] = useState(1);
  const [role, setRole] = useState(initialRole || '');
  const [industry, setIndustry] = useState(initialIndustry || '');

  const canContinue = useMemo(() => {
    if (step === 1) return Boolean(role);
    return Boolean(role) && Boolean(industry);
  }, [step, role, industry]);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setRole(initialRole || '');
    setIndustry(initialIndustry || '');
  }, [open, initialRole, initialIndustry]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const onPrimary = () => {
    if (!canContinue) return;
    if (step === 1) return setStep(2);
    const next = { role, industry };
    saveSelection(next);
    onClose?.(next);
  };

  return (
    <div className="modalOverlay" role="dialog" aria-modal="true" aria-label="Onboarding" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      <div className="modalCard">
        <div className="modalHeader">
          <div>
            <div className="kicker">Personalize your feed</div>
            <div className="modalTitle">
              {step === 1 ? 'Pick your role' : 'Pick your industry'}
            </div>
          </div>
          <button className="iconButton" type="button" onClick={() => onClose?.(null)}>
            ✕
          </button>
        </div>

        {step === 1 ? (
          <div className="choiceGrid">
            {ROLES.map((r) => (
              <button
                key={r}
                type="button"
                className={r === role ? 'choiceBtn selected' : 'choiceBtn'}
                onClick={() => setRole(r)}
              >
                {r}
              </button>
            ))}
          </div>
        ) : (
          <div className="choiceGrid">
            {INDUSTRIES.map((i) => (
              <button
                key={i}
                type="button"
                className={i === industry ? 'choiceBtn selected' : 'choiceBtn'}
                onClick={() => setIndustry(i)}
              >
                {i}
              </button>
            ))}
          </div>
        )}

        <div className="modalFooter">
          <div className="stepHint">
            Step {step} of 2{step === 2 ? '' : ' — you can change this anytime'}
          </div>
          <div className="modalActions">
            {step === 2 ? (
              <button type="button" className="btnGhost" onClick={() => setStep(1)}>
                Back
              </button>
            ) : (
              <button type="button" className="btnGhost" onClick={() => onClose?.(null)}>
                Not now
              </button>
            )}
            <button
              type="button"
              className={canContinue ? 'btnPrimary' : 'btnPrimary disabled'}
              onClick={onPrimary}
              disabled={!canContinue}
            >
              {step === 1 ? 'Continue' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

