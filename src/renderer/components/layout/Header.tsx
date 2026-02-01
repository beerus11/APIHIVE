import React from "react";
import type { RequestDraft } from "../../types";
import type { MainView } from "../../types";

type HeaderProps = {
  activeMainView: MainView;
  tabs: RequestDraft[];
  activeTabId: string;
  onTabSelect: (id: string) => void;
  onCloseTab: (id: string) => void;
  onAddTab: () => void;
  onSaveToCollection: () => void;
  onExportEnvironments: () => void;
  onSaveEnvironments: () => void;
};

const BASE_URL = typeof import.meta !== "undefined" && import.meta.env?.BASE_URL != null
  ? String(import.meta.env.BASE_URL)
  : "./";

export function Header({
  activeMainView,
  tabs,
  activeTabId,
  onTabSelect,
  onCloseTab,
  onAddTab,
  onSaveToCollection,
  onExportEnvironments,
  onSaveEnvironments
}: HeaderProps) {
  return (
    <header className="app-header">
      <div className="logo-icon-wrap">
        <img src={`${BASE_URL}icon.png`} alt="APIHive" className="logo-icon" />
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
                onClick={() => onTabSelect(tab.id)}
              >
                {tab.name}
              </button>
              <button
                type="button"
                className="header-tab-close"
                onClick={() => onCloseTab(tab.id)}
                title="Close"
              >
                ×
              </button>
            </div>
          ))}
          <button type="button" className="header-tab-new" onClick={onAddTab} title="New request">
            +
          </button>
        </div>
      )}
      <div className="spacer" />
      {activeMainView === "environments" ? (
        <>
          <button className="secondary" onClick={onExportEnvironments}>
            Export
          </button>
          <button className="primary" onClick={onSaveEnvironments}>
            Save Changes
          </button>
        </>
      ) : (
        <>
          <button className="secondary" onClick={onAddTab}>
            New Request
          </button>
          <button className="primary" onClick={onSaveToCollection}>
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
  );
}
