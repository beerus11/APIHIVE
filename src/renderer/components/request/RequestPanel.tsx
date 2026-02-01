import React from "react";
import type { RequestDraft, AuthConfig, RequestTab } from "../../types";
import { HTTP_METHODS, REQUEST_TAB_ORDER } from "../../constants";
import { KeyValueTable } from "../shared/KeyValueTable";
import { emptyKeyValue } from "../../utils";

type RequestPanelProps = {
  request: RequestDraft;
  setRequest: (updater: RequestDraft | ((prev: RequestDraft) => RequestDraft)) => void;
  activeTab: RequestTab;
  setActiveTab: (tab: RequestTab) => void;
  onSend: () => void;
  sending: boolean;
};

export function RequestPanel({
  request,
  setRequest,
  activeTab,
  setActiveTab,
  onSend,
  sending
}: RequestPanelProps) {
  return (
    <section className="request-panel">
      <div className="request-top">
        <div className="request-bar">
          <select
            value={request.method}
            onChange={(e) => setRequest({ ...request, method: e.target.value })}
          >
            {HTTP_METHODS.map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </select>
          <input
            className="request-url"
            value={request.url}
            onChange={(e) => setRequest({ ...request, url: e.target.value })}
            placeholder="https://api.example.com/v1/users"
          />
          <button
            className="primary send-btn"
            onClick={onSend}
            disabled={sending}
            title="Send request (⌘ Enter)"
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>

      <div className="request-tabs">
        {REQUEST_TAB_ORDER.map((tab) => (
          <button
            key={tab}
            type="button"
            className={activeTab === tab ? "active" : ""}
            onClick={() => setActiveTab(tab)}
          >
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="request-content">
        {activeTab === "params" && (
          <KeyValueTable
            title="Query Parameters"
            items={request.params}
            onChange={(next) => setRequest({ ...request, params: next })}
          />
        )}
        {activeTab === "auth" && (
          <div className="auth-panel">
            <label>
              Type
              <select
                value={request.auth.type}
                onChange={(e) => {
                  const type = e.target.value as AuthConfig["type"];
                  if (type === "none") setRequest({ ...request, auth: { type } });
                  if (type === "basic")
                    setRequest({
                      ...request,
                      auth: { type, username: "", password: "" }
                    });
                  if (type === "bearer")
                    setRequest({ ...request, auth: { type, token: "" } });
                  if (type === "apiKey")
                    setRequest({
                      ...request,
                      auth: { type, key: "", value: "", addTo: "header" }
                    });
                }}
              >
                <option value="none">None</option>
                <option value="basic">Basic</option>
                <option value="bearer">Bearer</option>
                <option value="apiKey">API Key</option>
              </select>
            </label>
            {request.auth.type === "basic" && (
              <>
                <label>
                  Username
                  <input
                    value={request.auth.username}
                    onChange={(e) => {
                      const a = request.auth;
                      if (a.type !== "basic") return;
                      setRequest({
                        ...request,
                        auth: {
                          type: "basic",
                          username: e.target.value,
                          password: a.password
                        }
                      });
                    }}
                  />
                </label>
                <label>
                  Password
                  <input
                    type="password"
                    value={request.auth.password}
                    onChange={(e) => {
                      const a = request.auth;
                      if (a.type !== "basic") return;
                      setRequest({
                        ...request,
                        auth: {
                          type: "basic",
                          username: a.username,
                          password: e.target.value
                        }
                      });
                    }}
                  />
                </label>
              </>
            )}
            {request.auth.type === "bearer" && (
              <label>
                Token
                <input
                  value={request.auth.token}
                  onChange={(e) =>
                    setRequest({
                      ...request,
                      auth: { type: "bearer", token: e.target.value }
                    })
                  }
                />
              </label>
            )}
            {request.auth.type === "apiKey" && (
              <>
                <label>
                  Key
                  <input
                    value={request.auth.key}
                    onChange={(e) => {
                      const a = request.auth;
                      if (a.type !== "apiKey") return;
                      setRequest({
                        ...request,
                        auth: {
                          type: "apiKey",
                          key: e.target.value,
                          value: a.value,
                          addTo: a.addTo
                        }
                      });
                    }}
                  />
                </label>
                <label>
                  Value
                  <input
                    value={request.auth.value}
                    onChange={(e) => {
                      const a = request.auth;
                      if (a.type !== "apiKey") return;
                      setRequest({
                        ...request,
                        auth: {
                          type: "apiKey",
                          key: a.key,
                          value: e.target.value,
                          addTo: a.addTo
                        }
                      });
                    }}
                  />
                </label>
                <label>
                  Add to
                  <select
                    value={request.auth.addTo}
                    onChange={(e) => {
                      const a = request.auth;
                      if (a.type !== "apiKey") return;
                      setRequest({
                        ...request,
                        auth: {
                          type: "apiKey",
                          key: a.key,
                          value: a.value,
                          addTo: e.target.value as "header" | "query"
                        }
                      });
                    }}
                  >
                    <option value="header">Header</option>
                    <option value="query">Query</option>
                  </select>
                </label>
              </>
            )}
          </div>
        )}
        {activeTab === "headers" && (
          <KeyValueTable
            title="Headers"
            items={request.headers}
            onChange={(next) => setRequest({ ...request, headers: next })}
          />
        )}
        {activeTab === "body" && (
          <div className="body-editor">
            <div className="body-radio">
              <label className="radio-label">
                <input
                  type="radio"
                  name="bodyType"
                  checked={request.bodyType === "json"}
                  onChange={() =>
                    setRequest({ ...request, bodyType: "json" })
                  }
                />
                <span>JSON</span>
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="bodyType"
                  checked={request.bodyType === "form-data"}
                  onChange={() =>
                    setRequest({
                      ...request,
                      bodyType: "form-data",
                      formDataFields:
                        request.formDataFields ?? [emptyKeyValue()]
                    })
                  }
                />
                <span>form-data</span>
              </label>
            </div>
            {request.bodyType === "json" && (
              <textarea
                value={request.body}
                onChange={(e) =>
                  setRequest({ ...request, body: e.target.value })
                }
              />
            )}
            {request.bodyType === "form-data" && (
              <KeyValueTable
                title=""
                items={request.formDataFields ?? [emptyKeyValue()]}
                onChange={(next) =>
                  setRequest({ ...request, formDataFields: next })
                }
              />
            )}
            {request.bodyType === "text" && (
              <textarea
                value={request.body}
                onChange={(e) =>
                  setRequest({ ...request, body: e.target.value })
                }
              />
            )}
          </div>
        )}
      </div>
    </section>
  );
}
