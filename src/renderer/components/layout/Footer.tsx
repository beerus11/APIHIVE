import React from "react";
import { APP_VERSION } from "../../constants";

export function Footer() {
  return (
    <footer className="app-footer">
      <div className="footer-left">
        <span className="status-dot status-ok" />
        <span>System Online</span>
        <span className="footer-version">V {APP_VERSION}</span>
      </div>
      <div className="footer-right">
        <span>Local Storage (94% free)</span>
        <a href="#" className="footer-link" onClick={(e) => e.preventDefault()}>
          Support Docs
        </a>
      </div>
    </footer>
  );
}
