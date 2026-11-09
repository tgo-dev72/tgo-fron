import { useEffect, useState, type ReactNode } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { Placeholder } from "@tiptap/extension-placeholder";
import { t, type Locale } from "../i18n";
import { StarterKit } from "@tiptap/starter-kit";
import { TextAlign } from "@tiptap/extension-text-align";
import { Highlight } from "@tiptap/extension-highlight";
import {
  FiAlignCenter,
  FiAlignJustify,
  FiAlignLeft,
  FiAlignRight,
  FiBold,
  FiEdit3,
  FiCornerUpLeft,
  FiCornerUpRight,
  FiItalic,
  FiLink2,
  FiList,
  FiMaximize2,
  FiMinimize2,
  FiUnderline,
  FiXCircle,
} from "react-icons/fi";

const ALLOWED_TAGS = new Set(["A", "B", "BLOCKQUOTE", "BR", "EM", "H2", "H3", "I", "LI", "OL", "P", "S", "STRIKE", "STRONG", "U", "UL", "MARK"]);
const DROP_TAGS = new Set(["IFRAME", "OBJECT", "SCRIPT", "STYLE", "SVG"]);
const ALLOWED_MARKUP = /<(?:a|b|blockquote|br|em|h2|h3|i|li|mark|ol|p|s|strike|strong|u|ul)(?:\s|>|\/)/i;

function safeHref(value: string): string {
  const href = value.trim();
  return /^(?:https?:|mailto:|tel:|\/(?!\/)|#)/i.test(href) && !/[\u0000-\u0020\\]/.test(href) ? href : "";
}

export function sanitizeRichText(value: string): string {
  if (typeof document === "undefined") return value;
  const source = document.createElement("template");
  if (ALLOWED_MARKUP.test(value)) {
    source.innerHTML = value;
  } else if (value) {
    const wrapper = document.createElement("div");
    for (const line of value.split(/\r?\n/)) {
      const paragraph = document.createElement("p");
      paragraph.textContent = line;
      wrapper.appendChild(paragraph);
    }
    source.innerHTML = wrapper.innerHTML;
  }

  const cleanNode = (node: Node): Node | null => {
    if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent ?? "");
    if (!(node instanceof HTMLElement) || DROP_TAGS.has(node.tagName)) return null;
    const fragment = document.createDocumentFragment();
    for (const child of Array.from(node.childNodes)) {
      const cleanChild = cleanNode(child);
      if (cleanChild) fragment.appendChild(cleanChild);
    }
    if (!ALLOWED_TAGS.has(node.tagName)) return fragment;
    const element = document.createElement(node.tagName.toLowerCase());
    if (node.tagName === "A") {
      const href = safeHref(node.getAttribute("href") ?? "");
      if (href) {
        element.setAttribute("href", href);
        element.setAttribute("target", "_blank");
        element.setAttribute("rel", "noopener noreferrer");
      }
    }
    if (["P", "H2", "H3"].includes(node.tagName)) {
      const align = /^\s*text-align:\s*(left|center|right|justify)\s*;?\s*$/i.exec(node.getAttribute("style") ?? "");
      if (align) element.setAttribute("style", `text-align: ${align[1].toLowerCase()}`);
    }
    element.appendChild(fragment);
    return element;
  };

  const output = document.createElement("div");
  for (const child of Array.from(source.content.childNodes)) {
    const cleanChild = cleanNode(child);
    if (cleanChild) output.appendChild(cleanChild);
  }
  const html = output.innerHTML.trim();
  return /^(?:(?:<p><\/p>)|(?:<br\s*\/?>)|\s|&nbsp;)+$/i.test(html) ? "" : html;
}

export function richTextLabels(locale: Locale): RichTextEditorProps["labels"] {
  return {
    paragraph: t(locale, "editor.richText.paragraph"), heading: t(locale, "editor.richText.heading"),
    subheading: t(locale, "editor.richText.subheading"), quote: t(locale, "editor.richText.quote"),
    bold: t(locale, "editor.richText.bold"), italic: t(locale, "editor.richText.italic"),
    underline: t(locale, "editor.richText.underline"), strike: t(locale, "editor.richText.strike"),
    unorderedList: t(locale, "editor.richText.unorderedList"), orderedList: t(locale, "editor.richText.orderedList"),
    alignLeft: t(locale, "editor.richText.alignLeft"), alignCenter: t(locale, "editor.richText.alignCenter"),
    alignRight: t(locale, "editor.richText.alignRight"), alignJustify: t(locale, "editor.richText.alignJustify"),
    highlight: t(locale, "editor.richText.highlight"), clearFormatting: t(locale, "editor.richText.clearFormatting"),
    link: t(locale, "editor.richText.link"), linkPrompt: t(locale, "editor.richText.linkPrompt"),
    undo: t(locale, "editor.richText.undo"), redo: t(locale, "editor.richText.redo"),
    fullscreen: t(locale, "editor.richText.fullscreen"), exitFullscreen: t(locale, "editor.richText.exitFullscreen"),
  };
}

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  compact?: boolean;
  direction?: "ltr" | "rtl";
  labels: {
    paragraph: string;
    heading: string;
    subheading: string;
    quote: string;
    bold: string;
    italic: string;
    underline: string;
    strike: string;
    unorderedList: string;
    orderedList: string;
    alignLeft: string;
    alignCenter: string;
    alignRight: string;
    alignJustify: string;
    highlight: string;
    clearFormatting: string;
    link: string;
    linkPrompt: string;
    undo: string;
    redo: string;
    fullscreen: string;
    exitFullscreen: string;
  };
}

export function RichTextEditor({ value, onChange, placeholder, labels, compact = false, direction }: RichTextEditorProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const [, refreshToolbar] = useState(0);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
        },
        code: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      TextAlign.configure({ types: ["heading", "paragraph"], alignments: ["left", "center", "right", "justify"] }),
      Highlight,
      Placeholder.configure({ placeholder }),
    ],
    content: sanitizeRichText(value),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "rich-text-content",
        "data-placeholder": placeholder,
        "aria-label": placeholder,
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChange(sanitizeRichText(currentEditor.getHTML()));
      refreshToolbar((revision) => revision + 1);
    },
    onSelectionUpdate: () => refreshToolbar((revision) => revision + 1),
  });

  useEffect(() => {
    if (!editor || editor.isFocused) return;
    const normalized = sanitizeRichText(value);
    if (sanitizeRichText(editor.getHTML()) !== normalized) {
      editor.commands.setContent(normalized, { emitUpdate: false });
    }
  }, [editor, value]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreen(false);
    };
    document.body.classList.add("rich-text-open");
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.classList.remove("rich-text-open");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [fullscreen]);

  const toolbarButton = (label: string, icon: ReactNode, action: () => void, active = false, disabled = false) => (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={active ? "is-active" : undefined}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={action}
    >
      {icon}
    </button>
  );

  if (!editor) return <div className="rich-text-editor rich-text-editor-loading" aria-busy="true" />;

  const blockType = editor.isActive("heading", { level: 2 })
    ? "h2"
    : editor.isActive("heading", { level: 3 })
      ? "h3"
      : editor.isActive("blockquote")
        ? "blockquote"
        : "p";

  return (
    <div className={`rich-text-editor${fullscreen ? " is-fullscreen" : ""}${compact ? " is-compact" : ""}`} dir={direction}>
      <div className="rich-text-toolbar" role="toolbar">
        <select
          aria-label={labels.paragraph}
          value={blockType}
          onChange={(event) => {
            const block = event.target.value;
            if (block === "h2") editor.chain().focus().toggleHeading({ level: 2 }).run();
            else if (block === "h3") editor.chain().focus().toggleHeading({ level: 3 }).run();
            else if (block === "blockquote") editor.chain().focus().toggleBlockquote().run();
            else editor.chain().focus().setParagraph().run();
          }}
        >
          <option value="p">{labels.paragraph}</option>
          <option value="h2">{labels.heading}</option>
          <option value="h3">{labels.subheading}</option>
          <option value="blockquote">{labels.quote}</option>
        </select>
        <span className="rich-text-toolbar-divider" />
        {toolbarButton(labels.bold, <FiBold />, () => editor.chain().focus().toggleBold().run(), editor.isActive("bold"), !editor.can().chain().focus().toggleBold().run())}
        {toolbarButton(labels.italic, <FiItalic />, () => editor.chain().focus().toggleItalic().run(), editor.isActive("italic"), !editor.can().chain().focus().toggleItalic().run())}
        {toolbarButton(labels.underline, <FiUnderline />, () => editor.chain().focus().toggleUnderline().run(), editor.isActive("underline"), !editor.can().chain().focus().toggleUnderline().run())}
        {toolbarButton(labels.strike, <span className="rich-text-strike">S</span>, () => editor.chain().focus().toggleStrike().run(), editor.isActive("strike"), !editor.can().chain().focus().toggleStrike().run())}
        {toolbarButton(labels.highlight, <FiEdit3 />, () => editor.chain().focus().toggleHighlight().run(), editor.isActive("highlight"))}
        <span className="rich-text-toolbar-divider" />
        {toolbarButton(labels.unorderedList, <FiList />, () => editor.chain().focus().toggleBulletList().run(), editor.isActive("bulletList"))}
        {toolbarButton(labels.orderedList, <span className="rich-text-ordered">1.</span>, () => editor.chain().focus().toggleOrderedList().run(), editor.isActive("orderedList"))}
        <span className="rich-text-toolbar-divider" />
        {toolbarButton(labels.alignLeft, <FiAlignLeft />, () => editor.chain().focus().setTextAlign("left").run(), editor.isActive({ textAlign: "left" }))}
        {toolbarButton(labels.alignCenter, <FiAlignCenter />, () => editor.chain().focus().setTextAlign("center").run(), editor.isActive({ textAlign: "center" }))}
        {toolbarButton(labels.alignRight, <FiAlignRight />, () => editor.chain().focus().setTextAlign("right").run(), editor.isActive({ textAlign: "right" }))}
        {toolbarButton(labels.alignJustify, <FiAlignJustify />, () => editor.chain().focus().setTextAlign("justify").run(), editor.isActive({ textAlign: "justify" }))}
        {toolbarButton(labels.clearFormatting, <FiXCircle />, () => editor.chain().focus().unsetAllMarks().clearNodes().run())}
        {toolbarButton(labels.link, <FiLink2 />, () => {
          const previous = editor.getAttributes("link").href as string | undefined;
          const href = window.prompt(labels.linkPrompt, previous || "https://");
          if (href === null) return;
          if (!href.trim()) editor.chain().focus().extendMarkRange("link").unsetLink().run();
          else if (safeHref(href)) editor.chain().focus().extendMarkRange("link").setLink({ href: href.trim() }).run();
        }, editor.isActive("link"))}
        {toolbarButton(labels.undo, <FiCornerUpLeft />, () => editor.chain().focus().undo().run(), false, !editor.can().undo())}
        {toolbarButton(labels.redo, <FiCornerUpRight />, () => editor.chain().focus().redo().run(), false, !editor.can().redo())}
        <span className="rich-text-toolbar-spacer" />
        {toolbarButton(fullscreen ? labels.exitFullscreen : labels.fullscreen, fullscreen ? <FiMinimize2 /> : <FiMaximize2 />, () => setFullscreen((current) => !current))}
      </div>
      <EditorContent editor={editor} className="rich-text-surface" />
    </div>
  );
}
