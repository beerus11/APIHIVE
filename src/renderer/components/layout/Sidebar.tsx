import React from "react";
import type { RequestDraft, CollectionFolder, HistoryItem } from "../../types";
import { statusTone, formatSize } from "../../utils";

type SidebarProps = {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  filteredFolders: CollectionFolder[];
  request: RequestDraft;
  activeMainView: "requests" | "environments";
  onToggleFolder: (folderId: string) => void;
  onLoadRequest: (item: RequestDraft) => void;
  onDuplicateRequest: (item: RequestDraft) => void;
  onRemoveRequest: (id: string, folderId: string) => void;
  onSetMainView: (view: "requests" | "environments") => void;
  history: HistoryItem[];
  onLoadFromHistory: (item: HistoryItem) => void;
};

export function Sidebar({
  searchQuery,
  onSearchChange,
  filteredFolders,
  request,
  activeMainView,
  onToggleFolder,
  onLoadRequest,
  onDuplicateRequest,
  onRemoveRequest,
  onSetMainView,
  history,
  onLoadFromHistory
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-search">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
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
                  onToggleFolder(folder.id);
                  onSetMainView("requests");
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
                      className={`collection-item ${item.id === request.id ? "active" : ""}`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onLoadRequest(item);
                          onSetMainView("requests");
                        }}
                      >
                        <span className={`pill method-${item.method.toLowerCase()}`}>
                          {item.method}
                        </span>
                        <span className="text">{item.name}</span>
                      </button>
                      <div className="row-actions">
                        <button onClick={() => onDuplicateRequest(item)}>Copy</button>
                        <button onClick={() => onRemoveRequest(item.id, folder.id)}>Del</button>
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
            onClick={() => onSetMainView("environments")}
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
              onClick={() => onLoadFromHistory(item)}
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
  );
}
