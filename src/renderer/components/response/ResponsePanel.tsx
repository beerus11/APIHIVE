import React from "react";
import type { ResponseState } from "../../types";
import { formatSize, statusTone } from "../../utils";

type ResponsePanelProps = {
  response: ResponseState | null;
  prettyBody: string;
  onCopyBody: () => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
};

export function ResponsePanel({
  response,
  prettyBody,
  onCopyBody,
  fullscreen,
  onToggleFullscreen
}: ResponsePanelProps) {
  return (
    <section className="response-panel">
      <div className="panel-header response-header">
        <h3>RESPONSE</h3>
        {response && (
          <div className="meta">
            <span className={`status-dot ${statusTone(response.status)}`} />
            <span className={`status ${statusTone(response.status)}`}>
              {response.status} {response.statusText}
            </span>
            <span>Time: {response.duration}ms</span>
            <span>Size: {formatSize(response.size)}</span>
            <button
              type="button"
              className="icon-btn-small"
              onClick={onCopyBody}
              title="Copy response"
            >
              📋
            </button>
            <button
              type="button"
              className="icon-btn-small"
              onClick={onToggleFullscreen}
              title="Full screen"
            >
              ⛶
            </button>
          </div>
        )}
      </div>
      <div className="response-body">
        {!response && (
          <div className="empty">Run a request to see output.</div>
        )}
        {response && (
          <>
            <div className="response-split">
              <pre>{prettyBody}</pre>
              <div className="headers-list">
                {Object.entries(response.headers).length === 0 && (
                  <div className="empty">No headers</div>
                )}
                {Object.entries(response.headers).map(([key, value], i) => (
                  <div key={`${key}-${i}`} className="header-row">
                    <span>{key}</span>
                    <span>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
