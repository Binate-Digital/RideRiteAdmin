import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Plus } from "lucide-react";
import { adminApi, errorMessage, type LegalDoc } from "@/lib/api";
import { dateTime } from "@/lib/format";
import { btn, ConfirmDialog, ErrorBanner, inputCls, Notice, PageHeader, Panel, Spinner } from "@/components/ui";
import { renderMarkdown } from "@/lib/markdown";
import { WEB_APP_URL } from "@/lib/links";

/**
 * Legal pages (Terms, Privacy, Refund & Cancellation, EULA, and any custom page): Markdown
 * editor with a live preview. Saving bumps the page version (signups record the Terms /
 * Privacy versions they agreed to); every change is in the audit log. Raw HTML is stripped
 * on save and the preview / website escape everything.
 */
export function LegalPagesPage() {
  const [pages, setPages] = useState<LegalDoc[] | null>(null);
  const [core, setCore] = useState<string[]>([]);
  const [slug, setSlug] = useState<string>("terms");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newSlug, setNewSlug] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async (select?: string) => {
    try {
      const r = await adminApi.legalPages();
      setPages(r.pages);
      setCore(r.corePages);
      const current = r.pages.find((p) => p.slug === (select ?? slug)) ?? r.pages[0];
      if (current) {
        setSlug(current.slug);
        setTitle(current.title);
        setBody(current.body);
      }
    } catch (e) {
      setError(errorMessage(e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const page = pages?.find((p) => p.slug === slug) ?? null;
  const dirty = Boolean(page && (page.title !== title || page.body !== body));
  const preview = useMemo(() => renderMarkdown(body), [body]);

  const pick = (p: LegalDoc) => {
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
    setSlug(p.slug);
    setTitle(p.title);
    setBody(p.body);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const r = await adminApi.saveLegalPage(slug, { title: title.trim(), body });
      setNotice(r.changed ? `Saved — now version ${r.page.version}` : "No changes to save");
      await load(slug);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const create = async () => {
    setError(null);
    try {
      const r = await adminApi.createLegalPage({ slug: newSlug.trim().toLowerCase(), title: newTitle.trim(), body: `# ${newTitle.trim()}\n\n` });
      setCreating(false);
      setNewSlug("");
      setNewTitle("");
      await load(r.page.slug);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  if (!pages) return error ? <ErrorBanner error={error} /> : <Spinner />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Legal pages"
        subtitle="Terms, Privacy, Refund & Cancellation and EULA shown on the website. Markdown; every save is versioned and audited."
        actions={
          <button className={btn.ghost} onClick={() => setCreating((v) => !v)}>
            <Plus className="h-3.5 w-3.5" /> New page
          </button>
        }
      />
      <ErrorBanner error={error} onClose={() => setError(null)} />
      <Notice message={notice} onClose={() => setNotice(null)} />

      {creating && (
        <Panel className="p-4 flex flex-wrap items-end gap-3">
          <label className="text-xs">
            <div className="mb-1 font-bold text-muted">Slug (URL)</div>
            <input className={inputCls} value={newSlug} onChange={(e) => setNewSlug(e.target.value)} placeholder="cookie-policy" />
          </label>
          <label className="text-xs flex-1 min-w-[200px]">
            <div className="mb-1 font-bold text-muted">Title</div>
            <input className={`${inputCls} w-full`} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Cookie Policy" />
          </label>
          <button className={btn.primary} disabled={newSlug.length < 2 || newTitle.length < 2} onClick={() => void create()}>
            Create
          </button>
        </Panel>
      )}

      <div className="flex flex-wrap gap-2">
        {pages.map((p) => (
          <button
            key={p.slug}
            onClick={() => pick(p)}
            className={`rounded-full border px-3 py-1 text-xs font-bold ${p.slug === slug ? "border-primary bg-primary/10 text-primary" : "border-border text-muted hover:text-foreground"}`}
          >
            {p.title}
            {p.placeholder ? " · placeholder" : ""}
          </button>
        ))}
      </div>

      {page && (
        <>
          <Panel className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
              <span>
                /{page.slug} · version {page.version} · updated {dateTime(page.updatedAt)}
                {page.placeholder ? " · still the seeded placeholder text" : ""}
              </span>
              <span className="flex items-center gap-3">
                {core.includes(page.slug) && (
                  <a className={btn.link} href={`${WEB_APP_URL}/${page.slug}`} target="_blank" rel="noreferrer">
                    View on site <ExternalLink className="inline h-3 w-3" />
                  </a>
                )}
                {!core.includes(page.slug) && (
                  <button className={btn.danger} onClick={() => setConfirmDelete(true)}>
                    Delete page
                  </button>
                )}
              </span>
            </div>
            <input className={`${inputCls} w-full font-bold`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
            <div className="grid lg:grid-cols-2 gap-4">
              <div>
                <div className="mb-1 text-xs font-bold text-muted">Markdown</div>
                <textarea
                  className={`${inputCls} w-full h-[60vh] font-mono text-xs leading-relaxed`}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  spellCheck
                />
                <div className="mt-1 text-[11px] text-muted">
                  ## Heading · **bold** · _italic_ · - list item · 1. numbered · [link](https://…) · &gt; note. HTML is removed.
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs font-bold text-muted">Preview</div>
                <div
                  className="h-[60vh] overflow-auto rounded-lg border border-border bg-background p-4 text-sm leading-relaxed text-muted [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-foreground [&_h3]:mt-4 [&_h3]:font-bold [&_h3]:text-foreground [&_p]:mt-2 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mt-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-primary [&_a]:underline [&_strong]:text-foreground [&_blockquote]:mt-3 [&_blockquote]:border-l-2 [&_blockquote]:border-primary/50 [&_blockquote]:pl-3"
                  dangerouslySetInnerHTML={{ __html: preview }}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button className={btn.ghost} disabled={!dirty || saving} onClick={() => { setTitle(page.title); setBody(page.body); }}>
                Discard
              </button>
              <button className={btn.primary} disabled={!dirty || saving || title.trim().length < 2} onClick={() => void save()}>
                {saving ? "Saving…" : "Save & publish"}
              </button>
            </div>
          </Panel>
          <ConfirmDialog
            open={confirmDelete}
            title={`Delete “${page.title}”?`}
            message="The page disappears from the website. This is recorded in the audit log."
            confirmLabel="Delete"
            danger
            onClose={() => setConfirmDelete(false)}
            onConfirm={async () => {
              await adminApi.deleteLegalPage(page.slug);
              setConfirmDelete(false);
              await load("terms");
            }}
          />
        </>
      )}
    </div>
  );
}
