import React, { useMemo, useState, useEffect, useRef } from "react";

type KeyValue = {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
  secret?: boolean;
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
  bodyType: "json" | "text" | "form-data";
  body: string;
  formDataFields?: KeyValue[];
  auth: AuthConfig;
  documentation?: string;
};

type CollectionFolder = {
  id: string;
  name: string;
  open: boolean;
  requests: RequestDraft[];
};

type EnvVariable = {
  id: string;
  key: string;
  initialValue: string;
  currentValue: string;
  sensitive: boolean;
};

type Environment = {
  id: string;
  name: string;
  variables: EnvVariable[];
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
  url: "https://api.example.com/v1/users",
  params: [emptyKeyValue()],
  headers: [emptyKeyValue()],
  bodyType: "json",
  body: "{\n  \"username\": \"\",\n  \"email\": \"\"\n}",
  formDataFields: [emptyKeyValue()],
  auth: { type: "none" },
  documentation: ""
});

const defaultFolders = (): CollectionFolder[] => [
  { id: crypto.randomUUID(), name: "User Service API", open: true, requests: [] },
  { id: crypto.randomUUID(), name: "Auth V2", open: false, requests: [] }
];

const emptyEnvVariable = (): EnvVariable => ({
  id: crypto.randomUUID(),
  key: "",
  initialValue: "",
  currentValue: "",
  sensitive: false
});

const defaultEnvironments = (): Environment[] => [
  {
    id: "dev",
    name: "Development",
    variables: [
      { ...emptyEnvVariable(), key: "base_url", initialValue: "https://dev-api.example.com", currentValue: "https://dev-api.example.com", sensitive: false },
      { ...emptyEnvVariable(), key: "api_key", initialValue: "", currentValue: "", sensitive: true },
      { ...emptyEnvVariable(), key: "timeout_ms", initialValue: "5000", currentValue: "5000", sensitive: false }
    ]
  },
  { id: "prod", name: "Production", variables: [emptyEnvVariable()] }
];

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

  const hashIndex = baseUrl.indexOf("#");
  const withoutHash = hashIndex >= 0 ? baseUrl.slice(0, hashIndex) : baseUrl;
  const hash = hashIndex >= 0 ? baseUrl.slice(hashIndex) : "";
  const separator = withoutHash.includes("?") ? "&" : "?";
  return `${withoutHash}${separator}${query}${hash}`;
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

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
};

const isValidHttpUrl = (s: string): boolean => {
  const trimmed = s.trim();
  if (!trimmed) return false;
  try {
    const u = new URL(trimmed);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

const deepCloneRequest = (item: RequestDraft): RequestDraft => ({
  ...item,
  id: crypto.randomUUID(),
  name: `${item.name} Copy`,
  params: item.params.map((p) => ({ ...p, id: crypto.randomUUID() })),
  headers: item.headers.map((h) => ({ ...h, id: crypto.randomUUID() }))
});

const REQUEST_TAB_ORDER = ["params", "auth", "headers", "body"] as const;
type RequestTab = (typeof REQUEST_TAB_ORDER)[number];

const App = () => {
  const [tabs, setTabs] = useState<RequestDraft[]>(() => [defaultRequest()]);
  const [activeTabId, setActiveTabId] = useState<string>("");
  const [folders, setFolders] = useState<CollectionFolder[]>(() => defaultFolders());
  const [response, setResponse] = useState<ResponseState | null>(null);
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<RequestTab>("params");
  const [environments, setEnvironments] = useState<Environment[]>(defaultEnvironments);
  const [activeEnvId, setActiveEnvId] = useState<string>("dev");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [responseFullscreen, setResponseFullscreen] = useState(false);
  const [activeMainView, setActiveMainView] = useState<"requests" | "environments">("requests");
  const [envVarFilter, setEnvVarFilter] = useState("");
  const [envVarVisibleIds, setEnvVarVisibleIds] = useState<Set<string>>(new Set());

  const request = tabs.find((t) => t.id === activeTabId) ?? tabs[0];
  const setRequest = (updater: RequestDraft | ((prev: RequestDraft) => RequestDraft)) => {
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId
          ? typeof updater === "function"
            ? updater(t)
            : updater
          : t
      )
    );
  };

  useEffect(() => {
    const saved = loadJson<{ folders?: CollectionFolder[]; tabs?: RequestDraft[] } | RequestDraft[]>(
      "apihive.collections",
      {}
    );
    if (Array.isArray(saved)) {
      if (saved.length) setTabs(saved as RequestDraft[]);
      if ((saved as RequestDraft[])[0]?.id) setActiveTabId((saved as RequestDraft[])[0].id);
    } else {
      if (saved.folders?.length) setFolders(saved.folders);
      if (saved.tabs?.length) setTabs(saved.tabs);
      if (saved.tabs?.[0]?.id) setActiveTabId(saved.tabs[0].id);
    }
    setHistory(loadJson<HistoryItem[]>("apihive.history", []));
  }, []);

  useEffect(() => {
    const raw = loadJson<unknown>("apihive.environments", null);
    const envs: Environment[] = Array.isArray(raw)
      ? raw.map((e: unknown) => {
          const env = e as { id: string; name: string; variables?: unknown[] };
          const vars = (env.variables ?? []).map((v: unknown) => {
            const rec = v as Record<string, unknown>;
            const hasLegacy = "value" in rec && typeof rec.value === "string";
            if (hasLegacy) {
              const kv = rec as KeyValue;
              return {
                id: kv.id ?? crypto.randomUUID(),
                key: kv.key ?? "",
                initialValue: kv.value ?? "",
                currentValue: kv.value ?? "",
                sensitive: kv.secret ?? false
              } as EnvVariable;
            }
            return rec as EnvVariable;
          }) as EnvVariable[];
          return { id: env.id, name: env.name, variables: vars };
        })
      : defaultEnvironments();
    if (envs.length) {
      setEnvironments(envs);
      setActiveEnvId((id) => (!id || !envs.find((e) => e.id === id)) ? envs[0].id : id);
    }
  }, []);

  useEffect(() => {
    saveJson("apihive.collections", { folders, tabs });
  }, [folders, tabs]);

  useEffect(() => {
    saveJson("apihive.environments", environments);
  }, [environments]);

  useEffect(() => {
    saveJson("apihive.history", history);
  }, [history]);

  useEffect(() => {
    if ((!activeTabId || !tabs.find((t) => t.id === activeTabId)) && tabs[0])
      setActiveTabId(tabs[0].id);
  }, [tabs, activeTabId]);

  const activeEnv = environments.find((e) => e.id === activeEnvId);
  const variables = activeEnv?.variables ?? [];

  const variableMap = useMemo(() => {
    const map: Record<string, string> = {};
    (variables as EnvVariable[])
      .filter((item) => item.key.trim().length > 0)
      .forEach((item) => {
        map[item.key.trim()] = item.currentValue;
      });
    return map;
  }, [variables]);

  const resolvedUrl = useMemo(
    () => buildUrl(request.url, request.params, variableMap),
    [request.url, request.params, variableMap]
  );

  const handleSend = async () => {
    if (!window.api?.request) {
      setResponse({
        status: 0,
        statusText: "Error",
        headers: {},
        body: "API not available. Restart the app.",
        duration: 0,
        size: 0
      });
      return;
    }
    if (!isValidHttpUrl(resolvedUrl)) {
      setResponse({
        status: 0,
        statusText: "Invalid URL",
        headers: {},
        body: "Enter a valid http or https URL.",
        duration: 0,
        size: 0
      });
      return;
    }
    setSending(true);
    setResponse(null);
    try {
      const mergedHeaders = buildHeaders(request.headers, request.auth, variableMap);
      let body: string | undefined;
      if (!["GET", "HEAD"].includes(request.method)) {
        if (request.bodyType === "json" && request.body.trim().length > 0) {
          mergedHeaders["Content-Type"] = "application/json";
          body = request.body;
        } else if (request.bodyType === "form-data" && request.formDataFields?.length) {
          mergedHeaders["Content-Type"] = "application/x-www-form-urlencoded";
          body = request.formDataFields
            .filter((item) => item.enabled && item.key.trim())
            .map(
              (item) =>
                `${encodeURIComponent(applyVariables(item.key.trim(), variableMap))}=${encodeURIComponent(
                  applyVariables(item.value, variableMap)
                )}`
            )
            .join("&");
        } else if (request.bodyType === "text" && request.body.trim()) {
          body = request.body;
        }
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
        body
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

  const addTab = () => {
    const newReq = defaultRequest();
    setTabs((prev) => [...prev, newReq]);
    setActiveTabId(newReq.id);
    setResponse(null);
  };

  const closeTab = (id: string) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (next.length === 0) {
        const newReq = defaultRequest();
        setActiveTabId(newReq.id);
        setResponse(null);
        return [newReq];
      }
      if (activeTabId === id) setActiveTabId(next[0]?.id ?? next[next.length - 1]?.id ?? "");
      return next;
    });
    if (activeTabId === id) setResponse(null);
  };

  const saveToCollection = () => {
    setFolders((prev) => {
      const next = prev.map((f) => ({ ...f }));
      const first = next[0];
      if (first) {
        const idx = first.requests.findIndex((r) => r.id === request.id);
        if (idx >= 0) first.requests[idx] = request;
        else first.requests = [request, ...first.requests];
      }
      return next;
    });
  };

  const duplicateRequest = (item: RequestDraft) => {
    setFolders((prev) => {
      const next = prev.map((f) => ({ ...f }));
      if (next[0]) next[0].requests = [deepCloneRequest(item), ...next[0].requests];
      return next;
    });
  };

  const removeRequest = (id: string, folderId: string) => {
    setFolders((prev) =>
      prev.map((f) =>
        f.id === folderId
          ? { ...f, requests: f.requests.filter((r) => r.id !== id) }
          : f
      )
    );
  };

  const loadRequest = (item: RequestDraft) => {
    const existing = tabs.find((t) => t.id === item.id);
    if (existing) {
      setActiveTabId(item.id);
    } else {
      const newReq: RequestDraft = {
        ...item,
        id: crypto.randomUUID(),
        formDataFields: item.formDataFields ?? [emptyKeyValue()]
      };
      setTabs((prev) => [...prev, newReq]);
      setActiveTabId(newReq.id);
    }
    setResponse(null);
  };

  const toggleFolder = (folderId: string) => {
    setFolders((prev) =>
      prev.map((f) => (f.id === folderId ? { ...f, open: !f.open } : f))
    );
  };

  const setEnvironmentVariables = (vars: EnvVariable[]) => {
    setEnvironments((prev) =>
      prev.map((e) => (e.id === activeEnvId ? { ...e, variables: vars } : e))
    );
  };

  const addNewEnvironment = () => {
    const name = `Environment ${environments.length + 1}`;
    const newEnv: Environment = {
      id: crypto.randomUUID(),
      name,
      variables: [emptyEnvVariable()]
    };
    setEnvironments((prev) => [...prev, newEnv]);
    setActiveEnvId(newEnv.id);
  };

  const removeEnvVariable = (id: string) => {
    setEnvironmentVariables(variables.filter((v) => v.id !== id));
  };

  const toggleEnvVarVisible = (id: string) => {
    setEnvVarVisibleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };


  const loadFromHistory = (item: HistoryItem) => {
    setRequest((prev) => ({
      ...prev,
      url: item.url,
      method: item.method
    }));
    setResponse(null);
  };

  const resetRequest = () => {
    setRequest({ ...defaultRequest(), id: request.id });
    setResponse(null);
  };

  const copyResponseBody = () => {
    if (response?.body)
      void navigator.clipboard.writeText(response.body);
  };

  const handleSendRef = useRef(handleSend);
  handleSendRef.current = handleSend;
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSendRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const prettyBody = useMemo(() => {
    if (!response?.body) return "";
    try {
      return JSON.stringify(JSON.parse(response.body), null, 2);
    } catch {
      return response.body;
    }
  }, [response]);

  const filteredFolders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return folders;
    return folders.map((f) => ({
      ...f,
      requests: f.requests.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.url.toLowerCase().includes(q) ||
          r.method.toLowerCase().includes(q)
      )
    }));
  }, [folders, searchQuery]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo-icon-wrap">
          <img src={`${import.meta.env.BASE_URL}icon.png`} alt="APIHive" className="logo-icon" />
        </div>
        <div className="logo">APIHive</div>
        {activeMainView === "environments" ? (
          <div className="header-tabs">
            <div className="header-tab active">
              <span className="header-tab-label">Environments</span>
              <button type="button" className="header-tab-close" title="Close" disabled>
                ×
              </button>
            </div>
            <button type="button" className="header-tab-new" title="New" disabled>
              +
            </button>
          </div>
        ) : (
          <div className="header-tabs">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                className={`header-tab ${tab.id === activeTabId ? "active" : ""}`}
              >
                <button
                  type="button"
                  className="header-tab-label"
                  onClick={() => {
                    setActiveTabId(tab.id);
                    setResponse(null);
                  }}
                >
                  {tab.name}
                </button>
                <button
                  type="button"
                  className="header-tab-close"
                  onClick={() => closeTab(tab.id)}
                  title="Close"
                >
                  ×
                </button>
              </div>
            ))}
            <button type="button" className="header-tab-new" onClick={addTab} title="New request">
              +
            </button>
          </div>
        )}
        <div className="spacer" />
        {activeMainView === "environments" ? (
          <>
            <button className="secondary" onClick={() => saveJson("apihive.environments", environments)}>
              Export
            </button>
            <button className="primary" onClick={() => saveJson("apihive.environments", environments)}>
              Save Changes
            </button>
          </>
        ) : (
          <>
            <button className="secondary" onClick={addTab}>
              New Request
            </button>
            <button className="primary" onClick={saveToCollection}>
              Save to Collection
            </button>
          </>
        )}
        <button type="button" className="icon-btn" title="Settings">
          ⚙
        </button>
        <button type="button" className="icon-btn" title="Profile">
          👤
        </button>
      </header>

      <div className="app-body">
        <aside className="sidebar">
          <div className="sidebar-search">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
          <section className="sidebar-section">
            <h3 className="sidebar-heading">
              <span className="folder-icon">📁</span>
              COLLECTIONS
            </h3>
            <div className="collection-folders">
              {filteredFolders.map((folder) => (
                <div key={folder.id} className="collection-folder">
                  <button
                    type="button"
                    className="folder-toggle"
                    onClick={() => {
                      toggleFolder(folder.id);
                      setActiveMainView("requests");
                    }}
                  >
                    <span className="folder-arrow">{folder.open ? "▼" : "▶"}</span>
                    <span className="folder-name">{folder.name}</span>
                  </button>
                  {folder.open && (
                    <div className="folder-requests">
                      {folder.requests.length === 0 && (
                        <div className="empty">No requests</div>
                      )}
                      {folder.requests.map((item) => (
                        <div
                          key={item.id}
                          className={`collection-item ${
                            item.id === request.id ? "active" : ""
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              loadRequest(item);
                              setActiveMainView("requests");
                            }}
                          >
                            <span className={`pill method-${item.method.toLowerCase()}`}>{item.method}</span>
                            <span className="text">{item.name}</span>
                          </button>
                          <div className="row-actions">
                            <button onClick={() => duplicateRequest(item)}>Copy</button>
                            <button onClick={() => removeRequest(item.id, folder.id)}>Del</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <button
                type="button"
                className={`sidebar-nav-item ${activeMainView === "environments" ? "active" : ""}`}
                onClick={() => setActiveMainView("environments")}
              >
                <span className="nav-icon">⊞</span>
                <span className="folder-name">Environments</span>
              </button>
            </div>
          </section>

          <section className="sidebar-section">
            <h3 className="sidebar-heading">
              <span className="refresh-icon" title="Refresh">↻</span>
              HISTORY
            </h3>
            <div className="history-list">
              {history.length === 0 && (
                <div className="empty">Recent activity shows here...</div>
              )}
              {history.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="history-item history-item-button"
                  onClick={() => loadFromHistory(item)}
                  title="Use this URL and method"
                >
                  <div className="row">
                    <span className="pill">{item.method}</span>
                    <span className={`status ${statusTone(item.status)}`}>
                      {item.status || "--"}
                    </span>
                  </div>
                  <div className="history-meta">
                    <div className="text">{item.name}</div>
                    <div className="muted">
                      {item.duration}ms · {formatSize(item.size)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </aside>

        <main className="main">
          {activeMainView === "environments" ? (
            <div className="env-manager">
              <div className="breadcrumbs">Settings &gt; Environments</div>
              <div className="env-manager-header">
                <h1 className="env-manager-title">Environment Manager</h1>
                <div className="env-manager-current">
                  <span className="env-manager-label">CURRENT:</span>
                  <select
                    className="env-manager-select"
                    value={activeEnvId}
                    onChange={(e) => setActiveEnvId(e.target.value)}
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
                    onChange={(e) => setEnvVarFilter(e.target.value)}
                    className="env-filter-input"
                  />
                </div>
                <button type="button" className="secondary" onClick={addNewEnvironment}>
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
                    {variables
                      .filter(
                        (v) =>
                          !envVarFilter.trim() ||
                          v.key.toLowerCase().includes(envVarFilter.trim().toLowerCase())
                      )
                      .map((v) => (
                        <tr key={v.id}>
                          <td className="env-var-name">
                            <input
                              type="text"
                              value={v.key}
                              onChange={(e) => {
                                setEnvironmentVariables(
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
                                  setEnvironmentVariables(
                                    variables.map((x) =>
                                      x.id === v.id ? { ...x, initialValue: e.target.value } : x
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
                              type={v.sensitive && !envVarVisibleIds.has(v.id) ? "password" : "text"}
                              value={v.currentValue}
                              onChange={(e) => {
                                setEnvironmentVariables(
                                  variables.map((x) =>
                                    x.id === v.id ? { ...x, currentValue: e.target.value } : x
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
                                  setEnvironmentVariables(
                                    variables.map((x) =>
                                      x.id === v.id ? { ...x, sensitive: e.target.checked } : x
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
                              onClick={() => toggleEnvVarVisible(v.id)}
                            >
                              {v.sensitive && !envVarVisibleIds.has(v.id) ? "👁‍🗨" : "👁"}
                            </button>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="icon-btn-small"
                              title="Delete"
                              onClick={() => removeEnvVariable(v.id)}
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
                onClick={() => setEnvironmentVariables([...variables, emptyEnvVariable()])}
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
                    Initial values are shared when you export collections. <strong>Current values</strong> stay
                    local to your machine—use them for secrets and tokens you don&apos;t want to leak.
                  </p>
                </div>
                <div className="usage-panel">
                  <div className="usage-heading">
                    <span className="usage-icon">ℹ</span>
                    Usage
                  </div>
                  <p>
                    Reference these variables anywhere in your requests using double curly braces:{" "}
                    <code>{`{{variable_name}}`}</code>
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
          <section className="request-panel">
            <div className="request-top">
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
                  placeholder="https://api.example.com/v1/users"
                />
                <button className="primary send-btn" onClick={handleSend} disabled={sending} title="Send request (⌘ Enter)">
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
                          onChange={(event) => {
                            const a = request.auth;
                            if (a.type !== "basic") return;
                            setRequest({
                              ...request,
                              auth: {
                                type: "basic",
                                username: event.target.value,
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
                          onChange={(event) => {
                            const a = request.auth;
                            if (a.type !== "basic") return;
                            setRequest({
                              ...request,
                              auth: {
                                type: "basic",
                                username: a.username,
                                password: event.target.value
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
                        onChange={(event) =>
                          setRequest({
                            ...request,
                            auth: { type: "bearer", token: event.target.value }
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
                          onChange={(event) => {
                            const a = request.auth;
                            if (a.type !== "apiKey") return;
                            setRequest({
                              ...request,
                              auth: {
                                type: "apiKey",
                                key: event.target.value,
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
                          onChange={(event) => {
                            const a = request.auth;
                            if (a.type !== "apiKey") return;
                            setRequest({
                              ...request,
                              auth: {
                                type: "apiKey",
                                key: a.key,
                                value: event.target.value,
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
                          onChange={(event) => {
                            const a = request.auth;
                            if (a.type !== "apiKey") return;
                            setRequest({
                              ...request,
                              auth: {
                                type: "apiKey",
                                key: a.key,
                                value: a.value,
                                addTo: event.target.value as "header" | "query"
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
                            formDataFields: request.formDataFields ?? [emptyKeyValue()]
                          })
                        }
                      />
                      <span>form-data</span>
                    </label>
                  </div>
                  {request.bodyType === "json" && (
                    <textarea
                      value={request.body}
                      onChange={(event) =>
                        setRequest({ ...request, body: event.target.value })
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
                      onChange={(event) =>
                        setRequest({ ...request, body: event.target.value })
                      }
                    />
                  )}
                </div>
              )}
            </div>
          </section>

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
                  <button type="button" className="icon-btn-small" onClick={copyResponseBody} title="Copy response">
                    📋
                  </button>
                  <button
                    type="button"
                    className="icon-btn-small"
                    onClick={() => setResponseFullscreen(!responseFullscreen)}
                    title="Full screen"
                  >
                    ⛶
                  </button>
                </div>
              )}
            </div>
            <div className="response-body">
              {!response && <div className="empty">Run a request to see output.</div>}
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
            </>
          )}
        </main>

        <aside className="sidebar right">
          {activeMainView === "requests" && (
          <section className="sidebar-section">
            <h3 className="sidebar-heading">ENVIRONMENT</h3>
            <select
              className="env-select"
              value={activeEnvId}
              onChange={(e) => setActiveEnvId(e.target.value)}
            >
              {environments.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            <RightPanelEnvSection
              variables={variables}
              onChange={setEnvironmentVariables}
              visibleIds={envVarVisibleIds}
              onToggleVisible={toggleEnvVarVisible}
              onOpenManager={() => setActiveMainView("environments")}
            />
          </section>
          )}
          <section className="sidebar-section">
            <h3 className="sidebar-heading">DOCUMENTATION</h3>
            <div className="documentation">
              {request.documentation ? (
                <p>{request.documentation}</p>
              ) : (
                <p className="doc-placeholder">
                  This endpoint retrieves a paginated list of all active users. Requires an admin-level API key.
                </p>
              )}
              <ul>
                <li>Supports filtering by <code>active</code></li>
                <li>Default limit is 10</li>
              </ul>
            </div>
          </section>
          <section className="sidebar-section">
            <h3 className="sidebar-heading quick-tip">
              <span className="tip-icon">💡</span>
              Quick Tip
            </h3>
            <div className="tips">
              <p>Use {'{{variable}}'} to reference environment variables in your URLs and headers.</p>
            </div>
          </section>
        </aside>
      </div>

      <footer className="app-footer">
        <div className="footer-left">
          <span className="status-dot status-ok" />
          <span>System Online</span>
          <span className="footer-version">V 2.4.0</span>
        </div>
        <div className="footer-right">
          <span>Local Storage (94% free)</span>
          <a href="#" className="footer-link" onClick={(e) => e.preventDefault()}>
            Support Docs
          </a>
        </div>
      </footer>
    </div>
  );
};

const KeyValueTable = ({
  title,
  items,
  onChange,
  addLabel = "Add"
}: {
  title: string;
  items: KeyValue[];
  onChange: (next: KeyValue[]) => void;
  addLabel?: string;
}) => (
  <div className="kv-table">
    <div className="kv-header">
      {title ? <span>{title}</span> : null}
      <button onClick={() => onChange([...items, emptyKeyValue()])}>{addLabel}</button>
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
                  entry.id === item.id ? { ...entry, key: event.target.value } : entry
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
                  entry.id === item.id ? { ...entry, value: event.target.value } : entry
                )
              )
            }
          />
          <button onClick={() => onChange(items.filter((entry) => entry.id !== item.id))}>
            Remove
          </button>
        </div>
      ))}
    </div>
  </div>
);

const RightPanelEnvSection = ({
  variables,
  onChange,
  visibleIds,
  onToggleVisible,
  onOpenManager
}: {
  variables: EnvVariable[];
  onChange: (vars: EnvVariable[]) => void;
  visibleIds: Set<string>;
  onToggleVisible: (id: string) => void;
  onOpenManager: () => void;
}) => (
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
    <button
      type="button"
      className="right-panel-open-manager"
      onClick={onOpenManager}
    >
      Open Environment Manager
    </button>
  </div>
);

export default App;
