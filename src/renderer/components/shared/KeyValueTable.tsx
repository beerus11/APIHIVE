import React from "react";
import type { KeyValue } from "../../types";
import { emptyKeyValue } from "../../utils";

type Props = {
  title: string;
  items: KeyValue[];
  onChange: (next: KeyValue[]) => void;
  addLabel?: string;
};

export function KeyValueTable({
  title,
  items,
  onChange,
  addLabel = "Add"
}: Props) {
  return (
    <div className="kv-table">
      <div className="kv-header">
        {title ? <span>{title}</span> : null}
        <button onClick={() => onChange([...items, emptyKeyValue()])}>
          {addLabel}
        </button>
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
}
