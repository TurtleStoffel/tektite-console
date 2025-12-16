# Codex Process Safety & Control Strategy

(for Bun-managed detached processes)

## 1. Constraints / Design Decisions

* Codex processes are started from a Bun process.
* Each Codex process:

  * must outlive the Bun process (detached, not tied to parent lifetime),
  * is identified by a PID and a unique marker stored in **the database**,
  * writes its history/logs into `~/.codex/` (no custom log files).
* On restart:

  * Bun should be able to safely identify which PIDs belong to “our” Codex jobs,
  * logs should be read from Codex history files in `~/.codex/`.

---

## 2. Starting a Codex Process

When starting Codex, generate a unique job marker and store it together with the PID in the DB.

Example:

```ts
// Pseudo-code / TypeScript-ish

type CodexJobRecord = {
  id: string;      // internal DB id
  pid: number;
  jobId: string;   // unique marker passed to Codex
  createdAt: Date;
};

async function startCodexJob(): Promise<CodexJobRecord> {
  const jobId = crypto.randomUUID();
  const marker = `--supervisor-id=${jobId}`;

  const proc = Bun.spawn({
    cmd: ["codex-binary", marker, /* other flags */],
    detached: true,
    stdin: "ignore",
    stdout: "ignore",
    stderr: "ignore",
  });

  proc.unref();

  const record: CodexJobRecord = {
    id: crypto.randomUUID(),
    pid: proc.pid,
    jobId,
    createdAt: new Date(),
  };

  // Store in DB (instead of file)
  await db.insert("codex_jobs", record);

  return record;
}
```

Key points:

* `detached: true` + `proc.unref()` allow Codex to keep running after the Bun process exits.
* `jobId` is a unique marker that we also pass on the Codex command line.
* `{ pid, jobId }` are stored in the **database**, not on disk.

---

## 3. Reading Codex Logs / History

Codex history lives in `~/.codex/`. The Bun side does **not** need to pipe stdout/stderr; it just needs to:

* know which Codex job it’s dealing with,
* read the relevant history from `~/.codex/`.

Depending on how Codex writes history, you might:

* derive a filename or path from the `jobId`, or
* query Codex’s own metadata files to map job → history.

Example (conceptual):

```ts
import { join } from "node:path";
import { homedir } from "node:os";

async function readCodexHistory(jobId: string): Promise<string> {
  const base = join(homedir(), ".codex");
  // This mapping depends on how Codex names its files:
  const historyPath = join(base, "history", `${jobId}.log`);

  const file = Bun.file(historyPath);
  if (!(await file.exists())) {
    throw new Error(`No history found for job ${jobId}`);
  }

  return await file.text();
}
```

You can now use:

1. DB to resolve `{ pid, jobId }`
2. `jobId` to read history from `~/.codex/`.

---

## 4. Safely Killing a Codex Process

You don’t want to kill arbitrary PIDs that might have been reused.
Instead, you:

1. Load `{ pid, jobId }` from the DB.
2. Confirm the PID still corresponds to a Codex process **with that marker**.
3. Only then send a kill signal.

### 4.1 Checking the PID and Marker

Use `ps` to inspect the command line:

```ts
function commandLineForPid(pid: number): string | null {
  const res = Bun.spawnSync({
    cmd: ["ps", "-p", String(pid), "-o", "command="],
    stdout: "pipe",
    stderr: "pipe",
  });

  if (!res.success) return null;

  const cmdline = new TextDecoder().decode(res.stdout).trim();
  return cmdline || null;
}

function isOurCodexProcess(pid: number, jobId: string): boolean {
  const cmdline = commandLineForPid(pid);
  if (!cmdline) return false;

  const marker = `--supervisor-id=${jobId}`;

  // Adjust "codex-binary" to your actual executable name
  const isCodex = cmdline.includes("codex-binary");
  const hasMarker = cmdline.includes(marker);

  return isCodex && hasMarker;
}
```

### 4.2 Safe Kill Procedure

```ts
async function safeKillCodexJob(jobDbId: string): Promise<boolean> {
  const job = await db.find<CodexJobRecord>("codex_jobs", jobDbId);
  if (!job) return false;

  const { pid, jobId } = job;

  if (!isOurCodexProcess(pid, jobId)) {
    console.warn(`Refusing to kill PID ${pid}: not our Codex job (${jobId})`);
    return false;
  }

  try {
    process.kill(pid, "SIGTERM");
    // Optionally mark job as "stopping" / "stopped" in DB
    await db.update("codex_jobs", jobDbId, { stoppedAt: new Date() });
    return true;
  } catch (err) {
    console.error("Failed to kill Codex job", jobDbId, "PID", pid, err);
    return false;
  }
}
```

This ensures:

* You only kill processes that:

  * are still running, and
  * look like your Codex binary, and
  * still carry your `--supervisor-id=<jobId>` marker.
* DB stays the source of truth for which jobs exist.

---

## 5. Flow Summary

**On start:**

1. Generate `jobId`.
2. Start Codex with `detached: true`, `proc.unref()`, and `--supervisor-id=<jobId>`.
3. Store `{ pid, jobId, createdAt, ... }` in your database.

**On restart / when inspecting jobs:**

1. Load job record from DB.
2. Use `jobId` to read Codex history from `~/.codex/` (based on how Codex structures its history).

**On kill:**

1. Load job record `{ pid, jobId }` from DB.
2. Check the process command line for:

   * Codex binary name,
   * `--supervisor-id=<jobId>` marker.
3. If both match, `process.kill(pid, "SIGTERM")`.
4. Update job status in DB.

---

## 6. Result

With:

* PID + job marker stored in the **database**,
* Codex history read directly from `~/.codex/`,
* strict verification before killing a PID,

you get:

* Codex processes that survive Bun restarts,
* log/history access that’s independent of Bun’s lifetime,
* safe, DB-driven control over Codex processes without risking killing unrelated PIDs.
