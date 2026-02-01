import React, { useMemo, useState, useEffect, useRef } from "react";
import type {
  KeyValue,
  RequestDraft,
  CollectionFolder,
  EnvVariable,
  Environment,
  ResponseState,
  HistoryItem,
  RequestTab,
  MainView
} from "./types";
// RequestTab is used for activeTab state
import { STORAGE_KEYS } from "./constants";
import {
  loadJson,
  saveJson,
  applyVariables,
  buildUrl,
  buildHeaders,
  isValidHttpUrl,
  emptyKeyValue,
  defaultRequest,
  deepCloneRequest,
  emptyEnvVariable,
  defaultFolders,
  defaultEnvironments
} from "./utils";
import {
  Header,
  Sidebar,
  Footer,
  RightPanelEnvSection,
  EnvironmentManager,
  RequestPanel,
  ResponsePanel
} from "./components";

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

  const onTabSelect = (id: string) => {
    setActiveTabId(id);
    setResponse(null);
  };

  return (
    <div className="app">
      <Header
        activeMainView={activeMainView}
        tabs={tabs}
        activeTabId={activeTabId}
        onTabSelect={onTabSelect}
        onCloseTab={closeTab}
        onAddTab={addTab}
        onSaveToCollection={saveToCollection}
        onExportEnvironments={() => saveJson("apihive.environments", environments)}
        onSaveEnvironments={() => saveJson("apihive.environments", environments)}
      />

      <div className="app-body">
        <Sidebar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filteredFolders={filteredFolders}
          request={request}
          activeMainView={activeMainView}
          onToggleFolder={toggleFolder}
          onLoadRequest={loadRequest}
          onDuplicateRequest={duplicateRequest}
          onRemoveRequest={removeRequest}
          onSetMainView={setActiveMainView}
          history={history}
          onLoadFromHistory={loadFromHistory}
        />

        <main className="main">
          {activeMainView === "environments" ? (
            <EnvironmentManager
              environments={environments}
              activeEnvId={activeEnvId}
              onActiveEnvChange={setActiveEnvId}
              variables={variables}
              onVariablesChange={setEnvironmentVariables}
              envVarFilter={envVarFilter}
              onEnvVarFilterChange={setEnvVarFilter}
              envVarVisibleIds={envVarVisibleIds}
              onToggleEnvVarVisible={toggleEnvVarVisible}
              onAddEnvironment={addNewEnvironment}
              onRemoveEnvVariable={removeEnvVariable}
            />
          ) : (
            <>
              <RequestPanel
                request={request}
                setRequest={setRequest}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onSend={handleSend}
                sending={sending}
              />
              <ResponsePanel
                response={response}
                prettyBody={prettyBody}
                onCopyBody={copyResponseBody}
                fullscreen={responseFullscreen}
                onToggleFullscreen={() => setResponseFullscreen((v) => !v)}
              />
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

      <Footer />
    </div>
  );
};

export default App;
