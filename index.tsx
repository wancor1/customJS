/*
 * CustomJS for TestCord / Vencord-compatible clients
 * SPDX-License-Identifier: MIT
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { React } from "@webpack/common";

const { useState } = React;

type Cleanup = () => void;
let cleanup: Cleanup | undefined;
let running = false;
let lastError = "";

const settings = definePluginSettings({
    script: {
        type: OptionType.STRING,
        description: "Saved JavaScript source",
        default: "",
        hidden: true
    },
    autoRun: {
        type: OptionType.BOOLEAN,
        description: "Run saved JavaScript when the plugin starts",
        default: false
    },
    editor: {
        type: OptionType.COMPONENT,
        description: "Edit and run your own JavaScript",
        component: CustomJSEditor
    }
});

function stopScript() {
    if (!running) return;
    running = false;
    const dispose = cleanup;
    cleanup = undefined;
    if (dispose) {
        try { dispose(); }
        catch (error) {
            lastError = String(error);
            console.error("[CustomJS] Cleanup failed", error);
        }
    }
}

function runScript(source = settings.store.script) {
    stopScript();
    lastError = "";
    if (!source.trim()) return;

    try {
        // Intentionally execute user-authored JavaScript in the Discord renderer.
        // An optional returned function is called when the script is stopped.
        const result: unknown = new Function(source)();
        if (result && typeof (result as Promise<unknown>).then === "function") {
            // Async scripts are allowed, but they cannot register cleanup through
            // their returned value. Prefer synchronous return of a cleanup function.
            void (result as Promise<unknown>).catch(error => {
                lastError = String(error);
                console.error("[CustomJS] Async error", error);
            });
        } else if (typeof result === "function") {
            cleanup = result as Cleanup;
        }
        running = true;
        console.info("[CustomJS] Script executed");
    } catch (error) {
        lastError = String(error);
        console.error("[CustomJS] Script failed", error);
    }
}

function CustomJSEditor() {
    const [source, setSource] = useState(settings.store.script);
    const [message, setMessage] = useState("");

    const buttonStyle: React.CSSProperties = {
        padding: "8px 14px",
        borderRadius: 6,
        border: "none",
        cursor: "pointer",
        color: "var(--interactive-active)",
        background: "var(--background-modifier-hover)"
    };

    function save() {
        settings.store.script = source;
        setMessage("Saved");
    }

    function run() {
        settings.store.script = source;
        runScript(source);
        setMessage(lastError || (source.trim() ? "Executed" : "Nothing to execute"));
    }

    function stop() {
        stopScript();
        setMessage(lastError || "Stopped (only registered cleanup is reverted)");
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <textarea
                aria-label="Custom JavaScript"
                spellCheck={false}
                value={source}
                onChange={event => setSource(event.currentTarget.value)}
                placeholder="// Your JavaScript here"
                style={{
                    width: "100%", minHeight: 260, boxSizing: "border-box",
                    padding: 12, resize: "vertical", borderRadius: 6,
                    color: "var(--text-normal)",
                    background: "var(--input-background)",
                    border: "1px solid var(--background-modifier-accent)",
                    fontFamily: "monospace", fontSize: 13, lineHeight: 1.5
                }}
            />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <button style={buttonStyle} onClick={save}>Save</button>
                <button style={buttonStyle} onClick={run}>Save &amp; Run</button>
                <button style={buttonStyle} onClick={stop}>Stop</button>
            </div>
            {message && <div role="status" style={{ color: "var(--text-muted)", overflowWrap: "anywhere" }}>{message}</div>}
            <small style={{ color: "var(--text-muted)" }}>
                Only run JavaScript you trust. Stop can only undo changes if the script returns a cleanup function.
            </small>
        </div>
    );
}

export default definePlugin({
    name: "CustomJS",
    description: "Write, save and run custom JavaScript in Discord.",
    authors: [{ name: "Local", id: 0n }],
    settings,
    start() {
        if (settings.store.autoRun) runScript();
    },
    stop() {
        stopScript();
    }
});
