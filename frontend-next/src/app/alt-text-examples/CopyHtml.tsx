"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import styles from "./examples.module.css";

export default function CopyHtml({ html }: { html: string }) {
  const [message, setMessage] = useState("");

  async function copy() {
    try {
      await navigator.clipboard.writeText(html);
      setMessage("Copied HTML.");
    } catch {
      setMessage("Select and copy the HTML below.");
    }
  }

  return (
    <details className={styles.htmlExample}>
      <summary>HTML example</summary>
      <div className={styles.copyBar}>
        <button type="button" onClick={copy} className={styles.copyButton}>
          <Copy size={15} aria-hidden="true" /> Copy HTML
        </button>
        <span role="status">{message}</span>
      </div>
      <pre><code>{html}</code></pre>
    </details>
  );
}
