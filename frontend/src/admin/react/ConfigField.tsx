// ROLE: One configuration field card in the React admin dashboard. No global state.
import { FIELD_TOOLTIPS, FIELD_UNITS } from "../AdminLabels";

export interface ConfigFieldData {
  section: string;
  key: string;
  value: unknown;
  label: string;
  draftKey: string;
}

interface ConfigFieldProps {
  field: ConfigFieldData;
  draftValue: string;
  formulaError: string | null;
  onChange: (draftKey: string, value: string) => void;
  onReset: (draftKeys: string[]) => void;
}

export function ConfigField({
  field,
  draftValue,
  formulaError,
  onChange,
  onReset,
}: ConfigFieldProps) {
  const originalValue = String(field.value);
  const isModified = draftValue !== originalValue;
  const tooltip = FIELD_TOOLTIPS[field.key];
  const hasFormulaError = field.key === "growth_score_per_segment" && !!formulaError;

  return (
    <div className={`config-card admin-field ${isModified ? "modified" : ""}`}>
      <div>
        <div className="admin-field-header">
          <div className="admin-field-label">
            <span>{field.label}</span>
            {tooltip ? (
              <span className="tooltip-container">
                <span className="tooltip-icon">?</span>
                <span className="tooltip-text">{tooltip}</span>
              </span>
            ) : null}
          </div>
          {isModified ? <span className="admin-modified-badge">modified</span> : null}
        </div>
        <div className="admin-field-path">{field.draftKey}</div>
      </div>

      {isModified ? (
        <div className="admin-field-was">
          <span>
            Was: <strong>{originalValue}</strong>
          </span>
          <button
            type="button"
            className="admin-reset-link"
            onClick={() => onReset([field.draftKey])}
          >
            Reset ↺
          </button>
        </div>
      ) : null}

      <div className="admin-field-row">
        <input
          className="input-field admin-field-input"
          value={draftValue}
          onChange={(event) => onChange(field.draftKey, event.target.value)}
          aria-label={field.label}
          spellCheck={false}
        />
        {FIELD_UNITS[field.key] ? (
          <span className="admin-unit">{FIELD_UNITS[field.key]}</span>
        ) : null}
      </div>

      {hasFormulaError ? (
        <div className="admin-formula-error" role="alert">
          <strong>Error:</strong> {formulaError}
        </div>
      ) : null}
    </div>
  );
}
