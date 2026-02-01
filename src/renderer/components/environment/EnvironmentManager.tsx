import React from "react";
import type { Environment, EnvVariable } from "../../types";
import { emptyEnvVariable } from "../../utils";

type EnvironmentManagerProps = {
  environments: Environment[];
  activeEnvId: string;
  onActiveEnvChange: (id: string) => void;
  variables: EnvVariable[];
  onVariablesChange: (vars: EnvVariable[]) => void;
  envVarFilter: string;
  onEnvVarFilterChange: (value: string) => void;
  envVarVisibleIds: Set<string>;
  onToggleEnvVarVisible: (id: string) => void;
  onAddEnvironment: () => void;
  onRemoveEnvVariable: (id: string) => void;
};

export function EnvironmentManager(props: EnvironmentManagerProps) {
  const {
    environments,
    activeEnvId,
    onActiveEnvChange,
    variables,
    onVariablesChange,
    envVarFilter,
    onEnvVarFilterChange,
    envVarVisibleIds,
    onToggleEnvVarVisible,
    onAddEnvironment,
    onRemoveEnvVariable
  } = props;

  const filteredVariables = variables.filter(
    (v) =>
      !envVarFilter.trim() ||
      v.key.toLowerCase().includes(envVarFilter.trim().toLowerCase())
  );

  return (
    <div className="env-manager">
      <div className="breadcrumbs">Settings &gt; Environments</div>
      <div className="env-manager-header">
        <h1 className="env-manager-title">Environment Manager</h1>
        <div className="env-manager-current">
          <span className="env-manager-label">CURRENT:</span>
          <select
            className="env-manager-select"
            value={activeEnvId}
            onChange={(e) => onActiveEnvChange(e.target.value)}
          >
            {environments.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="env-manager-toolbar">
        <div className="env-filter-wrap">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Filter variables..."
            value={envVarFilter}
            onChange={(e) => onEnvVarFilterChange(e.target.value)}
            className="env-filter-input"
          />
        </div>
        <button type="button" className="secondary" onClick={onAddEnvironment}>
          + New Environment
        </button>
      </div>
      <div className="env-table-wrap">
        <table className="env-table">
          <thead>
            <tr>
              <th>VARIABLE NAME</th>
              <th>INITIAL VALUE</th>
              <th>CURRENT VALUE</th>
              <th>SENSITIVE</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredVariables.map((v) => (
              <tr key={v.id}>
                <td className="env-var-name">
                  <input
                    type="text"
                    value={v.key}
                    onChange={(e) => {
                      onVariablesChange(
                        variables.map((x) =>
                          x.id === v.id ? { ...x, key: e.target.value } : x
                        )
                      );
                    }}
                    placeholder="variable_name"
                    className="env-table-input"
                  />
                </td>
                <td className="env-var-value">
                  {v.sensitive ? (
                    <span className="masked">************</span>
                  ) : (
                    <input
                      type="text"
                      value={v.initialValue}
                      onChange={(e) => {
                        onVariablesChange(
                          variables.map((x) =>
                            x.id === v.id
                              ? { ...x, initialValue: e.target.value }
                              : x
                          )
                        );
                      }}
                      placeholder="—"
                      className="env-table-input"
                    />
                  )}
                </td>
                <td className="env-var-value">
                  <input
                    type={
                      v.sensitive && !envVarVisibleIds.has(v.id)
                        ? "password"
                        : "text"
                    }
                    value={v.currentValue}
                    onChange={(e) => {
                      onVariablesChange(
                        variables.map((x) =>
                          x.id === v.id
                            ? { ...x, currentValue: e.target.value }
                            : x
                        )
                      );
                    }}
                    placeholder="—"
                    className="env-table-input"
                  />
                </td>
                <td>
                  <label className="env-sensitive-label">
                    <input
                      type="checkbox"
                      checked={v.sensitive}
                      onChange={(e) => {
                        onVariablesChange(
                          variables.map((x) =>
                            x.id === v.id
                              ? { ...x, sensitive: e.target.checked }
                              : x
                          )
                        );
                      }}
                    />
                    <span className="env-sensitive-text">Sensitive</span>
                  </label>
                  <button
                    type="button"
                    className="icon-btn-small"
                    title={envVarVisibleIds.has(v.id) ? "Hide" : "Show"}
                    onClick={() => onToggleEnvVarVisible(v.id)}
                  >
                    {v.sensitive && !envVarVisibleIds.has(v.id) ? "👁‍🗨" : "👁"}
                  </button>
                </td>
                <td>
                  <button
                    type="button"
                    className="icon-btn-small"
                    title="Delete"
                    onClick={() => onRemoveEnvVariable(v.id)}
                  >
                    🗑
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className="add-new-variable-btn"
        onClick={() => onVariablesChange([...variables, emptyEnvVariable()])}
      >
        + ADD NEW VARIABLE
      </button>
      <div className="env-manager-panels">
        <div className="pro-tip-panel">
          <div className="pro-tip-heading">
            <span className="tip-icon">💡</span>
            Pro Tip
          </div>
          <p>
            Initial values are shared when you export collections.{" "}
            <strong>Current values</strong> stay local to your machine—use them
            for secrets and tokens you do not want to leak.
          </p>
        </div>
        <div className="usage-panel">
          <div className="usage-heading">
            <span className="usage-icon">ℹ</span>
            Usage
          </div>
          <p>
            Reference these variables anywhere in your requests using double
            curly braces: <code>{"{{variable_name}}"}</code>
          </p>
        </div>
      </div>
    </div>
  );
}
