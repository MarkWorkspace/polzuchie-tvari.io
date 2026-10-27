// ROLE: Map width/height editor card in the React admin dashboard. No game logic.
interface MapSizeCardProps {
  width: string;
  height: string;
  originalWidth: number;
  originalHeight: number;
  onChange: (key: "world.width" | "world.height", value: string) => void;
  onReset: () => void;
}

export function MapSizeCard({
  width,
  height,
  originalWidth,
  originalHeight,
  onChange,
  onReset,
}: MapSizeCardProps) {
  const isModified = width !== String(originalWidth) || height !== String(originalHeight);

  return (
    <div className={`config-card admin-field ${isModified ? "modified" : ""}`}>
      <div>
        <div className="admin-field-header">
          <div className="admin-field-label">
            <span>Map Size</span>
            <span className="tooltip-container">
              <span className="tooltip-icon">?</span>
              <span className="tooltip-text">The width and height of the game board in cells.</span>
            </span>
          </div>
          {isModified ? <span className="admin-modified-badge">modified</span> : null}
        </div>
        <div className="admin-field-path">world.width × world.height</div>
      </div>

      {isModified ? (
        <div className="admin-field-was">
          <span>
            Was:{" "}
            <strong>
              {originalWidth} × {originalHeight}
            </strong>
          </span>
          <button type="button" className="admin-reset-link" onClick={onReset}>
            Reset ↺
          </button>
        </div>
      ) : null}

      <div className="admin-field-row">
        <input
          className="input-field admin-field-input admin-map-size-input"
          value={width}
          onChange={(event) => onChange("world.width", event.target.value)}
          aria-label="Map width"
          inputMode="numeric"
        />
        <span className="admin-map-size-x">×</span>
        <input
          className="input-field admin-field-input admin-map-size-input"
          value={height}
          onChange={(event) => onChange("world.height", event.target.value)}
          aria-label="Map height"
          inputMode="numeric"
        />
        <span className="admin-unit">cells</span>
      </div>
    </div>
  );
}
