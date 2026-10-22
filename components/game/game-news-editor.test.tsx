import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EMPTY_GAME_NEWS_DOCUMENT, type GameNewsEditorArticle } from "@/lib/game/game-product-news";
import { GameNewsEditor, insertGameNewsFormatting, preserveSavedNewsArticle } from "./game-news-editor";

const article: GameNewsEditorArticle = {
  id: "news-123", revision: 7, publishedAt: "2026-10-22T10:00:00Z", updatedAt: "2026-10-22T10:00:00Z", hasUnpublishedChanges: true,
  draft: { ...EMPTY_GAME_NEWS_DOCUMENT, title: "Les nouveautés du peloton", summary: "Un résumé inédit à garder en brouillon.", body: "**Nouveau** : un outil d’actualités pour les membres.", title_en: "Peloton news", category_en: "Update", summary_en: "A draft English summary.", body_en: "An English draft announcement.", image_alt: "Le peloton", link_url: "/jeu/calendrier", link_label: "Voir le calendrier" },
  published: { ...EMPTY_GAME_NEWS_DOCUMENT, title: "Ancienne version publiée", summary: "Version visible avant la publication.", body: "Le texte précédent reste visible." },
};
const action = async () => ({ status: "success" as const, message: "Enregistré", article });
const text = (markup: string) => markup.replace(/<[^>]+>/g, "").replaceAll("&#x27;", "'");

describe("GameNewsEditor", () => {
  it("renders an empty private draft with explicit save and publish actions", () => {
    const html = renderToStaticMarkup(<GameNewsEditor initialArticle={null} action={action} />);
    expect(text(html)).toContain("Écrire une actualité");
    expect(text(html)).toContain("Brouillon privé");
    expect(text(html)).toContain("Un brouillon n’apparaît ni sur l’accueil ni dans le jeu");
    expect(html).toMatch(/<button[^>]+value="save_draft"[^>]+name="intent"/);
    expect(html).toContain('formNoValidate=""');
    expect(html).toMatch(/<button[^>]+value="publish"[^>]+name="intent"/);
    expect(html).toContain('name="revision" value="0"');
    expect(html).not.toContain('type="file"');
  });

  it("reuses a server-generated draft identifier before the first successful save", () => {
    const html = renderToStaticMarkup(<GameNewsEditor initialArticle={null} newDraftId="stable-new-draft-id" action={action} />);
    expect(html).toContain('name="id" value="stable-new-draft-id"');
    expect(html).toContain('name="revision" value="0"');
    expect(text(html)).toContain("Écrire une actualité");
    const source = readFileSync(new URL("./game-news-editor.tsx", import.meta.url), "utf8");
    expect(source).toContain("useState(newDraftId)");
  });

  it("uses the editable draft, not the old public snapshot, and carries revision protection", () => {
    const html = renderToStaticMarkup(<GameNewsEditor initialArticle={article} action={action} />);
    expect(html).toContain('name="id" value="news-123"');
    expect(html).toContain('name="revision" value="7"');
    expect(html).toContain('value="Les nouveautés du peloton"');
    expect(html).not.toContain("Ancienne version publiée");
    expect(text(html)).toContain("Votre version publiée reste visible pendant les modifications");
    expect(text(html)).toContain("Seul le bouton Publier mettra à jour l’actualité");
  });

  it("keeps every field submitted, including English hidden behind its optional tab", () => {
    const html = renderToStaticMarkup(<GameNewsEditor initialArticle={article} action={action} />);
    for (const key of Object.keys(EMPTY_GAME_NEWS_DOCUMENT)) {
      expect(html, key).toContain(`name="${key}"`);
    }
    expect(html).toContain('value="Peloton news"');
    expect(html).toContain("An English draft announcement.");
    expect(text(html)).toContain("English · facultatif");
    expect(text(html)).toContain("Prévisualiser");
    expect(text(html)).toContain(":tada:");
    expect(html).toContain('aria-label="Insérer Annonce"');
  });

  it("escapes stored text instead of executing markup", () => {
    const html = renderToStaticMarkup(<GameNewsEditor initialArticle={{ ...article, draft: { ...article.draft, title: '<script>alert("title")</script>', body: '<script>alert("body")</script>' } }} action={action} />);
    expect(html).not.toContain('<script>alert("');
    expect(html).toContain("&lt;script&gt;");
  });

  it("has no autosave, polling or browser storage of draft content", () => {
    const source = readFileSync(new URL("./game-news-editor.tsx", import.meta.url), "utf8");
    expect(source).not.toMatch(/setInterval|localStorage|sessionStorage|fetch\(/);
    expect(source).not.toMatch(/from ["']@\/app\/.+actions/);
    expect(source).toContain('state.status === "conflict"');
    expect(source).toContain("Votre texte est conservé");
  });
});

describe("insertGameNewsFormatting", () => {
  it("surrounds the selected text without replacing the rest of the draft", () => {
    expect(insertGameNewsFormatting("Un beau peloton", 3, 7, "**", "**")).toEqual({ value: "Un **beau** peloton", selectionStart: 5, selectionEnd: 9 });
  });
  it("creates a helpful placeholder when no text is selected", () => {
    expect(insertGameNewsFormatting("Bonjour", 7, 7, "\n- ", "", "Élément")).toEqual({ value: "Bonjour\n- Élément", selectionStart: 10, selectionEnd: 17 });
  });
  it("inserts an emoji or link exactly at the cursor", () => {
    expect(insertGameNewsFormatting("Salut !", 6, 6, "🎉 ").value).toBe("Salut 🎉 !");
    expect(insertGameNewsFormatting("Voir calendrier", 5, 15, "[", "](https://)").value).toBe("Voir [calendrier](https://)");
  });
});

describe("preserveSavedNewsArticle", () => {
  it("reuses a newly created id and revision after a later validation error", () => {
    const saved = preserveSavedNewsArticle({ status: "idle", message: null }, { status: "success", message: "Enregistré", article });
    const failed = preserveSavedNewsArticle(saved, { status: "error", message: "Titre trop court" });
    expect(failed.article).toBe(article);
    expect(failed.status).toBe("error");
  });
  it("keeps the previous revision when a conflicting save returns no confirmed article", () => {
    const next = preserveSavedNewsArticle({ status: "success", message: null, article }, { status: "conflict", message: "Une autre personne a modifié cette actualité" });
    expect(next.article?.revision).toBe(7);
    expect(next.status).toBe("conflict");
  });
  it("reuses the confirmed saved draft revision if only the publication step conflicts", () => {
    const savedDraft = { ...article, revision: 8 };
    const next = preserveSavedNewsArticle({ status: "success", message: null, article }, { status: "conflict", message: "Publication concurrente", article: savedDraft });
    expect(next.article).toBe(savedDraft);
    expect(next.article?.revision).toBe(8);
  });
  it("keeps a saved revision when publishing fails after the draft save succeeded", () => {
    const savedAfterFailedPublish = { ...article, revision: 8 };
    const next = preserveSavedNewsArticle({ status: "success", message: null, article }, { status: "error", message: "Publication momentanément indisponible", article: savedAfterFailedPublish });
    expect(next.article).toBe(savedAfterFailedPublish);
    expect(next.article?.revision).toBe(8);
  });
});
