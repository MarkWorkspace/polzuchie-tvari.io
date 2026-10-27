// ROLE: Food type editor for the React admin dashboard. Uses ConfigEditor as data model.
import type { ConfigEditor } from "../ConfigEditor";

export interface FoodTypeDraft {
  key: string;
  value: number;
  weight: number;
  color: string;
  image: string;
  expanded?: boolean;
}

interface FoodTypesEditorProps {
  editor: ConfigEditor;
  originalTypes: FoodTypeDraft[];
  onChange: () => void;
}

export function FoodTypesEditor({ editor, originalTypes, onChange }: FoodTypesEditorProps) {
  const foodTypes = editor.getFoodTypes() as FoodTypeDraft[];
  const isModified =
    JSON.stringify(foodTypes.map(stripExpanded)) !==
    JSON.stringify(originalTypes.map(stripExpanded));

  const update = (index: number, key: keyof FoodTypeDraft, value: string | number | boolean) => {
    editor.updateFoodType(index, key, value);
    onChange();
  };

  return (
    <section className="config-card admin-food-section">
      <div className="admin-food-section-header">
        <div>
          <h3 className="admin-section-title">
            <span>🍎</span> Food Types &amp; Spawning Settings
            {isModified ? <span className="admin-modified-badge">modified</span> : null}
          </h3>
          <p className="admin-section-caption">
            Spawn weights and colors for different food types.
          </p>
        </div>
        <button
          type="button"
          className="login-button admin-add-food-button"
          onClick={() => {
            editor.addFoodType();
            onChange();
          }}
        >
          + Add Food Type
        </button>
      </div>

      <div className="admin-food-grid">
        {foodTypes.map((foodType, index) => {
          const original = originalTypes[index];
          const rowModified =
            !original ||
            original.value !== foodType.value ||
            original.weight !== foodType.weight ||
            original.color !== foodType.color ||
            original.image !== foodType.image;

          return (
            <div
              key={foodType.key}
              className={`food-card admin-food-card ${rowModified ? "is-modified" : ""}`}
            >
              <div className="admin-food-card-header">
                <button
                  type="button"
                  className="admin-food-expand"
                  onClick={() => update(index, "expanded", !foodType.expanded)}
                  aria-expanded={!!foodType.expanded}
                >
                  <span
                    className="admin-food-dot"
                    style={{ background: foodType.color }}
                    aria-hidden="true"
                  />
                  <span className="admin-food-summary">
                    <span className="admin-food-value">
                      Value: {foodType.value} pts {foodType.image ? `(🖼️ ${foodType.image})` : ""}
                    </span>
                    <span className="admin-food-weight">Spawn weight: {foodType.weight}</span>
                  </span>
                  <span className="admin-food-chevron">{foodType.expanded ? "▲" : "▼"}</span>
                </button>
                <button
                  type="button"
                  className="admin-food-remove"
                  onClick={() => {
                    editor.removeFoodType(index);
                    onChange();
                  }}
                  aria-label={`Remove food type ${index + 1}`}
                >
                  ✕
                </button>
              </div>

              {foodType.expanded ? (
                <div className="admin-food-body">
                  <label className="admin-food-label">
                    <span>Points Value</span>
                    <input
                      className="input-field"
                      type="number"
                      value={foodType.value}
                      onChange={(event) => update(index, "value", Number(event.target.value) || 0)}
                    />
                  </label>

                  <label className="admin-food-label">
                    <span>Spawn Weight</span>
                    <input
                      className="input-field"
                      type="number"
                      value={foodType.weight}
                      onChange={(event) => update(index, "weight", Number(event.target.value) || 0)}
                    />
                  </label>

                  <label className="admin-food-label">
                    <span>Color</span>
                    <div className="admin-food-color-row">
                      <input
                        type="color"
                        value={foodType.color}
                        onChange={(event) => update(index, "color", event.target.value)}
                        aria-label="Food color picker"
                      />
                      <input
                        className="input-field admin-food-color-text"
                        value={foodType.color}
                        onChange={(event) => update(index, "color", event.target.value)}
                        aria-label="Food color hex"
                      />
                    </div>
                  </label>

                  <label className="admin-food-label">
                    <span>Image (SVG filename)</span>
                    <input
                      className="input-field"
                      value={foodType.image}
                      placeholder="e.g. apple.svg"
                      onChange={(event) => update(index, "image", event.target.value)}
                    />
                    {foodType.image ? (
                      <span className="admin-food-image-preview">
                        <img src={`/${foodType.image}`} alt="" />
                      </span>
                    ) : null}
                  </label>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function stripExpanded(foodType: FoodTypeDraft) {
  return {
    value: foodType.value,
    weight: foodType.weight,
    color: foodType.color,
    image: foodType.image,
  };
}
