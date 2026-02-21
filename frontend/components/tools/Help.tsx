export default function Help() {
  return (
    <div className="space-y-6 text-sm text-neutral-300 leading-relaxed p-1">
      <div>
        <h2 className="text-lg font-semibold text-white">Markdown Guide</h2>
        <p className="text-neutral-500 text-xs">
          A quick reference to format your notes.
        </p>
      </div>

      {/* Headings */}
      <Section title="Headings">
        # Heading 1<br />
        ## Heading 2<br />
        ### Heading 3
      </Section>

      {/* Emphasis */}
      <Section title="Text Formatting">
        *italic* or _italic_<br />
        **bold**<br />
        ***bold italic***<br />
        ~~strikethrough~~
      </Section>

      {/* Lists */}
      <Section title="Lists">
        • Unordered list:<br />
        - item<br />
        - item<br />
        &nbsp;&nbsp;• nested item<br /><br />
        • Ordered list:<br />
        1. First<br />
        2. Second
      </Section>

      {/* Links & Images */}
      <Section title="Links & Images">
        Link → [title](https://example.com)<br />
        Image → ![alt text](https://example.com/image.png)
      </Section>

      {/* Code */}
      <Section title="Code">
        Inline: `const x = 10`<br /><br />
        Code block:<br />
        ```js<br />
        console.log("Hello");<br />
        ```
      </Section>

      {/* Task List */}
      <Section title="Task Lists">
        - [ ] To-do<br />
        - [x] Completed
      </Section>

      <p className="text-neutral-500 text-xs italic border-t border-neutral-800 pt-3">
        💡 Tip: Combine formatting freely — headings, quotes, bullets, and code can work together.
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: any }) {
  return (
    <div className="space-y-1 border border-neutral-800 rounded-md p-3 bg-neutral-900">
      <h3 className="font-semibold text-white text-xs tracking-wide uppercase opacity-80">
        {title}
      </h3>
      <div className="text-xs text-neutral-400 leading-5">{children}</div>
    </div>
  );
}
