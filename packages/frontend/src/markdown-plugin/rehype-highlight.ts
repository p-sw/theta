import type { ElementContent, Element, Root } from "hast";
import type { VFile } from "vfile";
import { toText } from "hast-util-to-text";
import { common, createLowlight } from "lowlight";
import { visit } from "unist-util-visit";

export default function rehypeHighlight() {
  const name = "hljs";
  const prefix = name + "-";
  const lowlight = createLowlight(common);

  return function (tree: Root, file: VFile) {
    visit(tree, "element", function (node, _, parent) {
      if (
        node.tagName !== "code" ||
        !parent ||
        parent.type !== "element" ||
        parent.tagName !== "pre"
      ) {
        return;
      }

      // const ICodeMetaParams = node.properties
      //  .ICodeMetaParams! as unknown as Record<string, string>;
      node.properties = Object.fromEntries(
        Object.entries(node.properties).filter(([k]) => k !== "ICodeMetaParams")
      );
      const lang = language(node);

      if (!lang) {
        return;
      }

      if (!Array.isArray(node.properties.className)) {
        node.properties.className = [];
      }

      if (!node.properties.className.includes(name)) {
        node.properties.className.unshift(name);
      }

      const text = toText(node, { whitespace: "pre" });
      let result;

      try {
        result = lowlight.highlight(lang, text, { prefix });
      } catch (error: unknown) {
        const cause = error as Error;
        if (lang && /Unknown language/.test(cause.message)) {
          file.message(
            "Cannot highlight as `" + lang + "`, it is not registered",
            {
              ancestors: [parent, node],
              cause,
              place: node.position,
              ruleId: "missing-language",
              source: "rehype-highlight",
            }
          );
          return;
        }
        throw cause;
      }
      if (!lang && result.data && result.data.language) {
        node.properties.className.push("language-" + result.data.language);
      }
      if (result.children.length > 0) {
        // line number, working but hard to set line-height
        /*
        let newlineCount: number[] = [1];
        function newlines(children: RootContent[]) {
          for (const child of children) {
            if (child.type === "element") {
              newlines(child.children);
            } else if (child.type === "text" && child.value.includes("\n")) {
              for (const _ of child.value.split("\n").slice(1)) {
                newlineCount.push(newlineCount.length + 1);
              }
            }
          }
        }

        newlines(result.children);

        const lineNumbers = {
          type: "element",
          tagName: "div",
          properties: {
            className: ["line-numbers"],
          },
          children: newlineCount.map(
            (lineNumber): ElementContent => ({
              type: "element",
              tagName: "span",
              properties: {
                dataLineNumber: lineNumber,
              },
              children: [{ type: "text", value: lineNumber.toString() + "\n" }],
            })
          ),
        } satisfies Element;

        parent.children = [lineNumbers, node];
        */
        node.children = result.children as ElementContent[];
      }
    });
  };
}

function language(node: Element): string | undefined {
  const list = node.properties.className;
  let index = -1;

  if (!Array.isArray(list)) {
    return;
  }

  let name;

  while (++index < list.length) {
    const value = String(list[index]);

    if (!name && value.startsWith("lang-")) {
      name = value.slice(5);
    }

    if (!name && value.startsWith("language-")) {
      name = value.slice(9);
    }
  }

  return name;
}
