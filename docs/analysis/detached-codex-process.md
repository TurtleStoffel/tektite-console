# Codex Process Safety & Logging Strategy

(for Bun-managed detached processes)

## 1. Problem Summary

When launching long-running Codex processes from a Bun server, we want:

1. Codex to outlive the Bun process (`detached: true` + `proc.unref()`),
2. Logs to remain readable after Bun restarts,
3. Safe termination of Codex processes later, without risking killing unrelated PIDs.

---

## 2. Detached Process Model

Launching Codex:

```ts
const proc = Bun.spawn({
  cmd: ["codex-binary", "--flags"],
  detached: true,
  stdin: "ignore",
  stdout: "ignore",
  stderr: "ignore",
});
proc.unref();
```

This ensures Codex continues running even if the Bun process exits.

---

## 3. Logging After Restart

You cannot reattach to a process’s stdout/stderr using only its PID.
Therefore, Codex must log to a file or external sink independent of Bun.

Recommended approach:

* Generate a unique log file per Codex instance.
* Store `{ pid, logPath }` in a metadata store.
* On Bun restart, read or tail the log file directly.

---

## 4. Preventing Accidental Kill Operations

Killing by PID alone is unsafe because:

* The PID might belong to another process.
* The PID might have been reused by the OS.

### Solution: Tag processes on launch

Add a unique marker to the Codex command line:

```ts
const jobId = crypto.randomUUID();
const marker = `--supervisor-id=${jobId}`;

const proc = Bun.spawn({
  cmd: ["codex-binary", marker],
  detached: true
});
proc.unref();

// Store { pid, jobId, logPath }
```

### Verification before kill

To confirm that a PID still corresponds to **your** Codex process:

```bash
ps -p <pid> -o command=
```

Check both:

* The command references the Codex binary.
* It contains the exact `--supervisor-id=<jobId>` marker.

If both conditions match, the process is safe to kill.

---

## 5. Safe Kill Procedure

1. Load stored metadata `{ pid, jobId }`.
2. Inspect the command line for that PID.
3. Verify it contains both:

   * the Codex binary,
   * the unique jobId marker.
4. Only then run:

```ts
process.kill(pid, "SIGTERM");
```

This protects against:

* Killing unrelated system processes
* Killing Codex processes not started by your supervisor
* PID reuse errors

---

## 6. Optional Hardening

* Compare expected start time vs process start time.
* Have Codex expose a status port/socket echoing the same jobId.
* Run a persistent supervisor process that tracks children directly.

---

## 7. Outcome

Using:

* Detached processes
* File-based logging
* Unique supervisor IDs
* Command-line verification before kill

You get a robust, restart-safe system where:

* Codex continues running after the Bun parent exits,
* Logs remain persistent and readable,
* You avoid killing the wrong process.
