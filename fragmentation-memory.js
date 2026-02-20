import { VirtualMemory } from "/usr/local/lib/node_modules/@tjamescouch/gro/dist/memory/virtual-memory.js";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * FragmentationMemory — VirtualMemory extension with pluggable fragmenter strategies.
 * 
 * Instead of summarizing old messages, fragments them into hyperlinked chunks using
 * a configurable fragmenter (random sampling, importance-weighted, B-tree, etc).
 * 
 * Fragmenters implement: fragment(messages, config) => Fragment[]
 * Fragment: { messages: Message[], metadata: { preview, position, count, ... } }
 */
export class FragmentationMemory extends VirtualMemory {
    constructor(config = {}) {
        super(config);
        
        /** Pluggable fragmenter strategy */
        this.fragmenter = config.fragmenter ?? null;
        
        /** Fragmenter-specific config */
        this.fragmenterConfig = config.fragmenterConfig ?? {};
    }

    /**
     * Override createPageFromMessages to use fragmentation instead of summarization.
     * 
     * Original behavior: summarize older messages into a single page.
     * New behavior: fragment older messages into multiple pages with hyperlinks.
     */
    async createPageFromMessages(messages, label, role) {
        if (!this.fragmenter) {
            // Fallback to summarization if no fragmenter configured
            return super.createPageFromMessages(messages, label, role);
        }

        // Call fragmenter strategy
        const fragments = this.fragmenter.fragment(messages, this.fragmenterConfig);

        // Store each fragment as a separate page
        const fragmentPages = [];
        for (let i = 0; i < fragments.length; i++) {
            const frag = fragments[i];
            const fragLabel = `${label} [frag ${i + 1}/${fragments.length}]`;
            const fragId = this.generateFragmentId(fragLabel, i);

            const pageContent = {
                id: fragId,
                label: fragLabel,
                role: role,
                createdAt: Date.now(),
                messages: frag.messages,
                metadata: {
                    ...frag.metadata,
                    fragmentIndex: i,
                    totalFragments: fragments.length,
                    parent: label,
                },
            };

            // Write fragment page to disk
            const pagePath = join(this.cfg.pagesDir, `${fragId}.json`);
            writeFileSync(pagePath, JSON.stringify(pageContent, null, 2), "utf-8");

            // Register in memory
            this.pages.set(fragId, pageContent);
            fragmentPages.push({ id: fragId, metadata: pageContent.metadata });
        }

        // Build hyperlink summary referencing all fragments
        const hyperlinkSummary = this.buildHyperlinkSummary(fragmentPages, label);

        return {
            summary: hyperlinkSummary,
            pageId: fragmentPages[0]?.id ?? "unknown",
        };
    }

    /**
     * Generate a stable fragment ID based on label and index.
     */
    generateFragmentId(label, index) {
        const hash = createHash("sha256")
            .update(`${label}-${index}`)
            .digest("hex")
            .slice(0, 12);
        return `frag_${hash}`;
    }

    /**
     * Build a concise hyperlink summary for fragment pages.
     * Format: 🧠 [preview] (N messages)
     */
    buildHyperlinkSummary(fragmentPages, parentLabel) {
        const links = fragmentPages.map(({ id, metadata }) => {
            const preview = metadata.preview ?? "no preview";
            const count = metadata.count ?? 0;
            return `🧠 ${preview} (${count} msgs)`;
        });

        return `Fragmented: ${parentLabel}\n${links.join("\n")}`;
    }
}

/**
 * Base fragmenter interface — all fragmenters implement this.
 */
export class Fragmenter {
    /**
     * Fragment messages into chunks.
     * @param {Message[]} messages - Messages to fragment
     * @param {object} config - Fragmenter-specific config
     * @returns {Fragment[]} Array of fragments
     */
    fragment(messages, config) {
        throw new Error("Fragmenter.fragment() must be implemented by subclass");
    }
}
