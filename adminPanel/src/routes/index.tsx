import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { toast, Toaster } from "sonner";
import { db } from "@/lib/firebase";
import { ADMIN_PASSWORD } from "@/lib/constants";
import {
  buildPayload,
  generateKeyId,
  generateLicenseKey,
  slugify,
} from "@/lib/license";

export const Route = createFileRoute("/")({
  component: AdminPanel,
  head: () => ({
    meta: [
      { title: "POS License Admin Panel" },
      { name: "description", content: "Generate and manage restaurant POS license keys." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

interface LicenseRecord {
  keyId: string;
  restaurantId: string;
  restaurantName: string;
  issuedAt: number;
  expiresAt: number;
  isUsed: boolean;
  usedAt: number | null;
  usedByDeviceId: string | null;
  formattedKey?: string;
}

function AdminPanel() {
  const [authed, setAuthed] = useState(false);
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster position="top-right" richColors />
      {authed ? <Dashboard /> : <Login onSuccess={() => setAuthed(true)} />}
    </div>
  );
}

function Login({ onSuccess }: { onSuccess: () => void }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (pw === ADMIN_PASSWORD) onSuccess();
          else setErr("Incorrect password");
        }}
        className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-8 shadow-sm"
      >
        <div>
          <h1 className="text-2xl font-bold">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">POS License Manager</p>
        </div>
        <input
          type="password"
          autoFocus
          value={pw}
          onChange={(e) => {
            setPw(e.target.value);
            setErr("");
          }}
          placeholder="Password"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        {err && <p className="text-sm text-destructive">{err}</p>}
        <button
          type="submit"
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}

type FilterTab = "all" | "available" | "active" | "expired";

function Dashboard() {
  const [records, setRecords] = useState<LicenseRecord[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const q = query(collection(db, "licenseKeys"), orderBy("issuedAt", "desc"));
      const snap = await getDocs(q);
      const list: LicenseRecord[] = snap.docs.map((d) => d.data() as LicenseRecord);
      setRecords(list);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load licenses. Check Firebase config.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">License Admin</h1>
          <p className="text-sm text-muted-foreground">
            Generate and manage restaurant POS license keys.
          </p>
        </div>
      </header>

      <GenerateSection onCreated={load} />
      <RecordsSection records={records} loading={loading} onChange={load} />
    </div>
  );
}

function GenerateSection({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [keyId, setKeyId] = useState(() => generateKeyId());
  const [issuedAt] = useState(() => Date.now());
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<string | null>(null);

  const restaurantId = useMemo(() => slugify(name), [name]);
  const expiresAt = issuedAt + 1000 * 60 * 60 * 24 * 30 * 6;

  async function handleGenerate() {
    if (!restaurantId) {
      toast.error("Enter a restaurant name");
      return;
    }
    setGenerating(true);
    try {
      const payload = buildPayload(restaurantId, keyId);
      const formattedKey = await generateLicenseKey(payload);
      await setDoc(doc(db, "licenseKeys", keyId), {
        keyId,
        restaurantId,
        restaurantName: name.trim(),
        issuedAt: payload.issuedAt,
        expiresAt: payload.expiresAt,
        isUsed: false,
        usedAt: null,
        usedByDeviceId: null,
        formattedKey,
        generatedAt: serverTimestamp(),
      });
      setGenerated(formattedKey);
      toast.success("License generated and saved to Firebase");
      setKeyId(generateKeyId());
      onCreated();
    } catch (e) {
      console.error(e);
      toast.error("Failed to save license. Check Firebase config.");
    } finally {
      setGenerating(false);
    }
  }

  function copyKey() {
    if (!generated) return;
    navigator.clipboard.writeText(generated);
    toast.success("Key copied");
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">Generate License</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Restaurant Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Pizza Palace Karachi"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="text-xs text-muted-foreground">
            Slug: <span className="font-mono">{restaurantId || "—"}</span>
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <ReadOnly label="Duration" value="6 months" />
          <ReadOnly label="Key ID" value={keyId} mono />
          <ReadOnly label="Issued" value={new Date(issuedAt).toLocaleDateString()} />
          <ReadOnly label="Expires" value={new Date(expiresAt).toLocaleDateString()} />
        </div>
      </div>
      <button
        onClick={handleGenerate}
        disabled={generating || !restaurantId}
        className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {generating ? "Generating…" : "Generate License Key"}
      </button>

      {generated && (
        <div className="mt-6 rounded-lg border-2 border-primary/40 bg-primary/5 p-5">
          <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
            Generated License Key
          </p>
          <div className="flex items-center justify-between gap-4">
            <code className="break-all font-mono text-xl font-bold tracking-wider">
              {generated}
            </code>
            <button
              onClick={copyKey}
              className="shrink-0 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium hover:bg-accent"
            >
              Copy
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function ReadOnly({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-sm ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

function statusOf(r: LicenseRecord): { label: string; cls: string; key: FilterTab | "revoked" } {
  if (r.usedByDeviceId === "REVOKED")
    return { label: "Revoked", cls: "bg-muted text-muted-foreground", key: "revoked" };
  if (r.expiresAt < Date.now())
    return { label: "Expired", cls: "bg-destructive/15 text-destructive", key: "expired" };
  if (r.isUsed)
    return { label: "Active", cls: "bg-blue-500/15 text-blue-600 dark:text-blue-400", key: "active" };
  return { label: "Available", cls: "bg-green-500/15 text-green-700 dark:text-green-400", key: "available" };
}

function RecordsSection({
  records,
  loading,
  onChange,
}: {
  records: LicenseRecord[];
  loading: boolean;
  onChange: () => void;
}) {
  const [tab, setTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");

  const filtered = records.filter((r) => {
    const s = statusOf(r);
    if (tab !== "all" && s.key !== tab) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!r.restaurantName.toLowerCase().includes(q) && !r.keyId.toLowerCase().includes(q))
        return false;
    }
    return true;
  });

  async function revoke(r: LicenseRecord) {
    if (!confirm(`Revoke license for "${r.restaurantName}"? This cannot be undone.`)) return;
    try {
      await updateDoc(doc(db, "licenseKeys", r.keyId), {
        isUsed: true,
        usedByDeviceId: "REVOKED",
      });
      toast.success("License revoked");
      onChange();
    } catch (e) {
      console.error(e);
      toast.error("Failed to revoke");
    }
  }

  function copy(r: LicenseRecord) {
    if (!r.formattedKey) {
      toast.error("Key not stored");
      return;
    }
    navigator.clipboard.writeText(r.formattedKey);
    toast.success("Key copied");
  }

  const tabs: { id: FilterTab; label: string }[] = [
    { id: "all", label: "All" },
    { id: "available", label: "Available" },
    { id: "active", label: "Active" },
    { id: "expired", label: "Expired" },
  ];

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">License Records</h2>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by restaurant or key ID…"
          className="w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="mb-4 flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-3">Restaurant</th>
              <th className="py-2 pr-3">Key ID</th>
              <th className="py-2 pr-3">Issued</th>
              <th className="py-2 pr-3">Expires</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Device ID</th>
              <th className="py-2 pr-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-muted-foreground">
                  No licenses found.
                </td>
              </tr>
            )}
            {filtered.map((r) => {
              const s = statusOf(r);
              return (
                <tr key={r.keyId} className="border-b border-border/60">
                  <td className="py-3 pr-3 font-medium">{r.restaurantName}</td>
                  <td className="py-3 pr-3 font-mono text-xs">{r.keyId}</td>
                  <td className="py-3 pr-3">{new Date(r.issuedAt).toLocaleDateString()}</td>
                  <td className="py-3 pr-3">{new Date(r.expiresAt).toLocaleDateString()}</td>
                  <td className="py-3 pr-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>
                      {s.label}
                    </span>
                  </td>
                  <td className="py-3 pr-3 font-mono text-xs text-muted-foreground">
                    {r.usedByDeviceId ?? "—"}
                  </td>
                  <td className="py-3 pr-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => copy(r)}
                        className="rounded-md border border-input bg-background px-2 py-1 text-xs hover:bg-accent"
                      >
                        Copy Key
                      </button>
                      {s.key !== "revoked" && (
                        <button
                          onClick={() => revoke(r)}
                          className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-xs text-destructive hover:bg-destructive/20"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
