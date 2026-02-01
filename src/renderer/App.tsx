import React, { useMemo, useState, useEffect } from "react";

type KeyValue = {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
};

type AuthConfig =
  | { type: "none" }
  | { type: "basic"; username: string; password: string }
  | { type: "bearer"; token: string }
  | { type: "apiKey"; key: string; value: string; addTo: "header" | "query" };

type RequestDraft = {
  id: string;
  name: string;
  method: string;
  url: string;
  params: KeyValue[];
  headers: KeyValue[];
  bodyType: "json" | "text";
  body: string;
  auth: AuthConfig;
};

type ResponseState = {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  duration: number;
  size: number;
};

type HistoryItem = {
  id: string;
  name: string;
  method: string;
  url: string;
  status: number;
  duration: number;
  size: number;
  at: number;
};

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

const emptyKeyValue = (): KeyValue => ({
  id: crypto.randomUUID(),
  key: "",
  value: "",
  enabled: true
});

const defaultRequest = (): RequestDraft => ({
  id: crypto.randomUUID(),
  name: "Untitled Request",
  method: "GET",
  url: "https://api.example.com",
  params: [emptyKeyValue()],
  headers: [emptyKeyValue()],
  bodyType: "json",
  body: "{\n  \"hello\": \"world\"\n}",
  auth: { type: "none" }
});

const loadJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const saveJson = (key: string, value: unknown) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const applyVariables = (input: string, vars: Record<string, string>) =>
  input.replace(/{{\s*([\w.-]+)\s*}}/g, (_, key) => vars[key] ?? "");

const buildUrl = (url: string, params: KeyValue[], vars: Record<string, string>) => {
  const baseUrl = applyVariables(url, vars);
  const queryPairs = params
    .filter((item) => item.enabled && item.key.trim().length > 0)
    .map((item) => [
      applyVariables(item.key.trim(), vars),
      applyVariables(item.value, vars)
    ]);

  if (queryPairs.length === 0) return baseUrl;
  const query = queryPairs
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");

  return baseUrl.includes("?") ? `${baseUrl}&${query}` : `${baseUrl}?${query}`;
};

const buildHeaders = (
  headers: KeyValue[],
  auth: AuthConfig,
  vars: Record<string, string>
) => {
  const resolved: Record<string, string> = {};
  headers
    .filter((item) => item.enabled && item.key.trim().length > 0)
    .forEach((item) => {
      const key = applyVariables(item.key.trim(), vars);
      resolved[key] = applyVariables(item.value, vars);
    });

  if (auth.type === "basic") {
    const token = btoa(`${auth.username}:${auth.password}`);
    resolved["Authorization"] = `Basic ${token}`;
  }
  if (auth.type === "bearer") {
    resolved["Authorization"] = `Bearer ${auth.token}`;
  }
  if (auth.type === "apiKey" && auth.addTo === "header") {
    resolved[auth.key] = auth.value;
  }

  return resolved;
};

const statusTone = (status: number) => {
  if (status >= 200 && status < 300) return "status-ok";
  if (status >= 400) return "status-error";
  if (status >= 300) return "status-warn";
  return "status-info";
};

const App = () => {
  const [collections, setCollections] = useState<RequestDraft[]>([]);
  const [request, setRequest] = useState<RequestDraft>(defaultRequest());
  const [response, setResponse] = useState<ResponseState | null>(null);
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<"params" | "headers" | "body" | "auth">(
    "params"
  );
  const [variables, setVariables] = useState<KeyValue[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    setCollections(loadJson<RequestDraft[]>("apihive.collections", []));
    setVariables(loadJson<KeyValue[]>("apihive.variables", [emptyKeyValue()]));
    setHistory(loadJson<HistoryItem[]>("apihive.history", []));
  }, []);

  useEffect(() => {
    saveJson("apihive.collections", collections);
  }, [collections]);

  useEffect(() => {
    saveJson("apihive.variables", variables);
  }, [variables]);

  useEffect(() => {
    saveJson("apihive.history", history);
  }, [history]);

  const variableMap = useMemo(() => {
    const map: Record<string, string> = {};
    variables
      .filter((item) => item.enabled && item.key.trim().length > 0)
      .forEach((item) => {
        map[item.key.trim()] = item.value;
      });
    return map;
  }, [variables]);

  const resolvedUrl = useMemo(
    () => buildUrl(request.url, request.params, variableMap),
    [request.url, request.params, variableMap]
  );

  const handleSend = async () => {
    setSending(true);
    setResponse(null);
    try {
      const mergedHeaders = buildHeaders(request.headers, request.auth, variableMap);
      let body = request.body;
      if (request.bodyType === "json" && body.trim().length > 0) {
        mergedHeaders["Content-Type"] = "application/json";
      }

      let url = resolvedUrl;
      if (request.auth.type === "apiKey" && request.auth.addTo === "query") {
        const join = url.includes("?") ? "&" : "?";
        url = `${url}${join}${encodeURIComponent(request.auth.key)}=${encodeURIComponent(
          request.auth.value
        )}`;
      }

      const resp = await window.api.request({
        url,
        method: request.method,
        headers: mergedHeaders,
        body: ["GET", "HEAD"].includes(request.method) ? undefined : body
      });
      setResponse(resp);
      const nextHistory = [
        {
          id: crypto.randomUUID(),
          name: request.name,
          method: request.method,
          url: resolvedUrl,
          status: resp.status,
          duration: resp.duration,
          size: resp.size,
          at: Date.now()
        },
        ...history
      ].slice(0, 20);
      setHistory(nextHistory);
    } catch (error) {
      setResponse({
        status: 0,
        statusText: "Request failed",
        headers: {},
        body: error instanceof Error ? error.message : "Unknown error",
        duration: 0,
        size: 0
      });
    } finally {
      setSending(false);
    }
  };

  const saveToCollection = () => {
    setCollections((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === request.id);
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = request;
        return next;
      }
      return [request, ...prev];
    });
  };

  const duplicateRequest = (item: RequestDraft) => {
    const cloned = {
      ...item,
      id: crypto.randomUUID(),
      name: `${item.name} Copy`
    };
    setCollections((prev) => [cloned, ...prev]);
  };

  const removeRequest = (id: string) => {
    setCollections((prev) => prev.filter((item) => item.id !== id));
    if (request.id === id) {
      setRequest(defaultRequest());
    }
  };

  const loadRequest = (item: RequestDraft) => {
    setRequest(item);
    setResponse(null);
  };

  const resetRequest = () => {
    setRequest(defaultRequest());
    setResponse(null);
  };

  const prettyBody = useMemo(() => {
    if (!response?.body) return "";
    try {
      return JSON.stringify(JSON.parse(response.body), null, 2);
    } catch {
      return response.body;
    }
  }, [response]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo">APIHive</div>
        <div className="spacer" />
        <button className="secondary" onClick={resetRequest}>
          New Request
        </button>
        <button className="primary" onClick={saveToCollection}>
          Save to Collection
        </button>
      </header>

      <div className="app-body">
        <aside className="sidebar">
          <section>
            <h3>Collections</h3>
            <div className="collection-list">
              {collections.length === 0 && (
                <div className="empty">No saved requests yet.</div>
              )}
              {collections.map((item) => (
                <div
                  key={item.id}
                  className={`collection-item ${
                    item.id === request.id ? "active" : ""
                  }`}
                >
                  <button onClick={() => loadRequest(item)}>
                    <span className="pill">{item.method}</span>
                    <span className="text">{item.name}</span>
                  </button>
                  <div className="row-actions">
                    <button onClick={() => duplicateRequest(item)}>Copy</button>
                    <button onClick={() => removeRequest(item.id)}>Del</button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3>History</h3>
            <div className="history-list">
              {history.length === 0 && <div className="empty">No runs yet.</div>}
              {history.map((item) => (
                <div key={item.id} className="history-item">
                  <div className="row">
                    <span className="pill">{item.method}</span>
                    <span className={`status ${statusTone(item.status)}`}>
                      {item.status || "--"}
                    </span>
                  </div>
                  <div className="history-meta">
                    <div className="text">{item.name}</div>
                    <div className="muted">
                      {item.duration}ms · {Math.round(item.size / 1024)}kb
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>

        <main className="main">
          <section className="request-panel">
            <div className="request-top">
              <input
                className="request-name"
                value={request.name}
                onChange={(event) =>
                  setRequest({ ...request, name: event.target.value })
                }
              />
              <div className="request-bar">
                <select
                  value={request.method}
                  onChange={(event) =>
                    setRequest({ ...request, method: event.target.value })
                  }
                >
                  {METHODS.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
                <input
                  className="request-url"
                  value={request.url}
                  onChange={(event) =>
                    setRequest({ ...request, url: event.target.value })
                  }
                />
                <button className="primary" onClick={handleSend} disabled={sending}>
                  {sending ? "Sending..." : "Send"}
                </button>
              </div>
              <div className="resolved-url">Resolved: {resolvedUrl}</div>
            </div>

            <div className="request-tabs">
              {(["params", "headers", "body", "auth"] as const).map((tab) => (
                <button
                  key={tab}
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
              {activeTab === "headers" && (
                <KeyValueTable
                  title="Headers"
                  items={request.headers}
                  onChange={(next) => setRequest({ ...request, headers: next })}
                />
              )}
              {activeTab === "body" && (
                <div className="body-editor">
                  <div className="body-tabs">
                    <button
                      className={request.bodyType === "json" ? "active" : ""}
                      onClick={() =>
                        setRequest({ ...request, bodyType: "json" })
                      }
                    >
                      JSON
                    </button>
                    <button
                      className={request.bodyType === "text" ? "active" : ""}
                      onClick={() =>
                        setRequest({ ...request, bodyType: "text" })
                      }
                    >
                      TEXT
                    </button>
                  </div>
                  <textarea
                    value={request.body}
                    onChange={(event) =>
                      setRequest({ ...request, body: event.target.value })
                    }
                  />
                </div>
              )}
              {activeTab === "auth" && (
                <div className="auth-panel">
                  <label>
                    Type
                    <select
                      value={request.auth.type}
                      onChange={(event) => {
                        const type = event.target.value as AuthConfig["type"];
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
                          onChange={(event) =>
                            setRequest({
                              ...request,
                              auth: { ...request.auth, username: event.target.value }
                            })
                          }
                        />
                      </label>
                      <label>
                        Password
                        <input
                          type="password"
                          value={request.auth.password}
                          onChange={(event) =>
                            setRequest({
                              ...request,
                              auth: { ...request.auth, password: event.target.value }
                            })
                          }
                        />
                      </label>
                    </>
                  )}
                  {request.auth.type === "bearer" && (
                    <label>
                      Token
                      <input
                        value={request.auth.token}
                        onChange={(event) =>
                          setRequest({
                            ...request,
                            auth: { ...request.auth, token: event.target.value }
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
                          onChange={(event) =>
                            setRequest({
                              ...request,
                              auth: { ...request.auth, key: event.target.value }
                            })
                          }
                        />
                      </label>
                      <label>
                        Value
                        <input
                          value={request.auth.value}
                          onChange={(event) =>
                            setRequest({
                              ...request,
                              auth: { ...request.auth, value: event.target.value }
                            })
                          }
                        />
                      </label>
                      <label>
                        Add to
                        <select
                          value={request.auth.addTo}
                          onChange={(event) =>
                            setRequest({
                              ...request,
                              auth: {
                                ...request.auth,
                                addTo: event.target.value as "header" | "query"
                              }
                            })
                          }
                        >
                          <option value="header">Header</option>
                          <option value="query">Query</option>
                        </select>
                      </label>
                    </>
                  )}
                </div>
              )}
            </div>
          </section>

          <section className="response-panel">
            <div className="panel-header">
              <h3>Response</h3>
              {response && (
                <div className="meta">
                  <span className={`status ${statusTone(response.status)}`}>
                    {response.status || "--"} {response.statusText}
                  </span>
                  <span>{response.duration}ms</span>
                  <span>{Math.round(response.size / 1024)}kb</span>
                </div>
              )}
            </div>
            <div className="response-body">
              {!response && <div className="empty">Run a request to see output.</div>}
              {response && (
                <>
                  <div className="response-tabs">
                    <span>Body</span>
                    <span>Headers</span>
                  </div>
                  <div className="response-split">
                    <pre>{prettyBody}</pre>
                    <div className="headers-list">
                      {Object.entries(response.headers).length === 0 && (
                        <div className="empty">No headers</div>
                      )}
                      {Object.entries(response.headers).map(([key, value]) => (
                        <div key={key} className="header-row">
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
        </main>

        <aside className="sidebar right">
          <section>
            <h3>Environment</h3>
            <KeyValueTable
              title="Variables"
              items={variables}
              onChange={setVariables}
            />
          </section>
          <section>
            <h3>Tips</h3>
            <div className="tips">
              <p>Use {'{{variable}}'} in URLs, headers, and bodies.</p>
              <p>All requests run through the main process, so CORS is bypassed.</p>
              <p>Collections are saved locally in `localStorage`.</p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
};

const KeyValueTable = ({
  title,
  items,
  onChange
}: {
  title: string;
  items: KeyValue[];
  onChange: (next: KeyValue[]) => void;
}) => {
  return (
    <div className="kv-table">
      <div className="kv-header">
        <span>{title}</span>
        <button onClick={() => onChange([...items, emptyKeyValue()])}>Add</button>
      </div>
      <div className="kv-rows">
        {items.map((item) => (
          <div key={item.id} className="kv-row">
            <input
              type="checkbox"
              checked={item.enabled}
              onChange={(event) =>
                onChange(
                  items.map((entry) =>
                    entry.id === item.id
                      ? { ...entry, enabled: event.target.checked }
                      : entry
                  )
                )
              }
            />
            <input
              placeholder="Key"
              value={item.key}
              onChange={(event) =>
                onChange(
                  items.map((entry) =>
                    entry.id === item.id
                      ? { ...entry, key: event.target.value }
                      : entry
                  )
                )
              }
            />
            <input
              placeholder="Value"
              value={item.value}
              onChange={(event) =>
                onChange(
                  items.map((entry) =>
                    entry.id === item.id
                      ? { ...entry, value: event.target.value }
                      : entry
                  )
                )
              }
            />
            <button
              onClick={() => onChange(items.filter((entry) => entry.id !== item.id))}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
