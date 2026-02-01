import React from "react";
import type { EnvVariable } from "../../types";
import { emptyEnvVariable } from "../../utils";

type Props = {
  variables: EnvVariable[];
  onChange: (vars: EnvVariable[]) => void;
  visibleIds: Set<string>;
  onToggleVisible: (id: string) => void;
  onOpenManager: () => void;
};

export function RightPanelEnvSection({
  variables,
  onChange,
  visibleIds,
  onToggleVisible,
  onOpenManager
}: Props) {
  return (
    <div className="right-panel-env">
      <div className="right-panel-env-list">
        {variables.map((v) => (
          <div key={v.id} className="right-panel-env-row">
            <input
              type="text"
              placeholder="Variable name"
              value={v.key}
              onChange={(e) =>
                onChange(
                  variables.map((x) => (x.id === v.id ? { ...x, key: e.target.value } : x))
                )
              }
              className="right-panel-env-key"
            />
            <div className="right-panel-env-value-wrap">
              <input
                type={v.sensitive && !visibleIds.has(v.id) ? "password" : "text"}
                placeholder="Value"
                value={v.currentValue}
                onChange={(e) =>
                  onChange(
                    variables.map((x) =>
                      x.id === v.id ? { ...x, currentValue: e.target.value } : x
                    )
                  )
                }
                className="right-panel-env-value"
              />
              {v.sensitive && (
                <button
                  type="button"
                  className="icon-btn-small right-panel-env-eye"
                  title={visibleIds.has(v.id) ? "Hide" : "Show"}
                  onClick={() => onToggleVisible(v.id)}
                >
                  {visibleIds.has(v.id) ? "👁" : "👁‍🗨"}
                </button>
              )}
            </div>
            <label className="right-panel-env-sensitive">
              <input
                type="checkbox"
                checked={v.sensitive}
                onChange={(e) =>
                  onChange(
                    variables.map((x) =>
                      x.id === v.id ? { ...x, sensitive: e.target.checked } : x
                    )
                  )
                }
              />
              <span>Secret</span>
            </label>
            <button
              type="button"
              className="icon-btn-small"
              title="Delete"
              onClick={() => onChange(variables.filter((x) => x.id !== v.id))}
            >
              🗑
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="add-variable-btn right-panel-add"
        onClick={() => onChange([...variables, emptyEnvVariable()])}
      >
        + Add Variable
      </button>
      <button type="button" className="right-panel-open-manager" onClick={onOpenManager}>
        Open Environment Manager
      </button>
    </div>
  );
}
