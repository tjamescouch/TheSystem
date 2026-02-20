import { VirtualMemory } from "/usr/local/lib/node_modules/@tjamescouch/gro/dist/memory/virtual-memory.js";
import { HNSW } from "hnsw";
import { createHash } from "node:crypto";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * HNSWMemory — VirtualMemory extension with HNSW vector index for semantic retrieval.
 * 
 * Instead of temporal paging, messages are embedded and stored in a Hierarchical Navigable
 * Small World graph. Retrieval is by semantic similarity (vector search), not chronology.
 * 
 * Flow:
 * 1. Messages arrive → embed content → add to HNSW index
 * 2. Context cleanup → query HNSW for most relevant messages given recent conversation
 * 3. Load relevant message clusters as pages (like 🧠 but semantic, not temporal)
 * 
 * Config:
 *   embedder: function(text) => float[] — embedding function (required)
 *   dimensions: embedding vector size (required)
 *   maxElements: max HNSW index capacity (default: 10000)
 *   efConstruction: HNSW construction param (default: 200)
 *   M: HNSW max connections per layer (default: 16)
 *   retrievalK: number of neighbors to retrieve (default: 10)
 */
export class HNSWMemory extends VirtualMemory {
    constructor(config = {}) {
        super(config);

        if (!config.embedder || typeof config.embedder !== "function") {
            throw new Error("HNSWMemory requires config.embedder function");
        }
        if (!config.dimensions || typeof config.dimensions !== "number") {
            throw new Error("HNSWMemory requires config.dimensions (embedding size)");
        }

        this.embedder = config.embedder;
        this.dimensions = config.dimensions;
        this.maxElements = config.maxElements ?? 10000;
        this.efConstruction = config.efConstruction ?? 200;
        this.M = config.M ?? 16;
        this.retrievalK = config.retrievalK ?? 10;

        // HNSW index: message embeddings
        this.index = new HNSW({
            space: "cosine", // cosine similarity
            numDimensions: this.dimensions,
        });

        // Message store: id -> message object
        this.messageStore = new Map();
        
        // Index metadata
        this.indexPath = join(this.cfg.pagesDir, "hnsw-index.json");
        this.loadIndex();
    }

    /**
     * Override addMessage to embed and index.
     */
    async addMessage(message) {
        // Add to conversation buffer (parent behavior)
        super.addMessage(message);

        // Embed message content
        const text = this.extractText(message);
        if (!text || text.length < 5) return; // Skip empty/tiny messages

        const embedding = await this.embedder(text);
        if (embedding.length !== this.dimensions) {
            console.warn(`Embedding dimension mismatch: expected ${this.dimensions}, got ${embedding.length}`);
            return;
        }

        // Generate message ID
        const msgId = this.hashMessage(message);

        // Add to HNSW index
        this.index.addPoint(embedding, msgId);

        // Store message
        this.messageStore.set(msgId, message);
    }

    /**
     * Override cleanup to use semantic retrieval instead of temporal paging.
     */
    async cleanup(targetTokens) {
        const currentTokens = this.estimateTokens();
        if (currentTokens <= targetTokens) return;

        // Get recent context to query against
        const recentMessages = this.messages.slice(-10);
        const recentText = recentMessages.map((m) => this.extractText(m)).join(" ");
        const queryEmbedding = await this.embedder(recentText);

        // Search HNSW for semantically relevant messages
        const neighbors = this.index.searchKnn(queryEmbedding, this.retrievalK);

        // Build page from retrieved messages
        const retrievedMessages = neighbors
            .map((neighbor) => this.messageStore.get(neighbor.item))
            .filter(Boolean);

        if (retrievedMessages.length === 0) {
            // Fallback to parent cleanup if no semantic matches
            return super.cleanup(targetTokens);
        }

        // Create semantic page
        const pageLabel = `semantic_cluster_${Date.now()}`;
        const pageId = this.generatePageId(pageLabel);
        const pageContent = {
            id: pageId,
            label: pageLabel,
            role: "system",
            createdAt: Date.now(),
            messages: retrievedMessages,
            metadata: {
                retrieval: "hnsw",
                neighborCount: neighbors.length,
                queryPreview: recentText.slice(0, 60),
            },
        };

        // Write page to disk
        const pagePath = join(this.cfg.pagesDir, `${pageId}.json`);
        writeFileSync(pagePath, JSON.stringify(pageContent, null, 2), "utf-8");

        // Register in memory
        this.pages.set(pageId, pageContent);

        // Remove old messages from active conversation
        const tokensToRemove = currentTokens - targetTokens;
        const messagesToRemove = Math.floor(this.messages.length * 0.3); // Remove 30% oldest
        this.messages = this.messages.slice(messagesToRemove);

        console.log(`[HNSWMemory] cleanup: removed ${messagesToRemove} msgs, created page ${pageId}`);
    }

    /**
     * Extract text content from message for embedding.
     */
    extractText(message) {
        if (typeof message.content === "string") return message.content;
        if (Array.isArray(message.content)) {
            return message.content
                .filter((block) => block.type === "text")
                .map((block) => block.text)
                .join(" ");
        }
        return "";
    }

    /**
     * Hash message to generate stable ID.
     */
    hashMessage(message) {
        const text = this.extractText(message);
        const hash = createHash("sha256")
            .update(`${message.role}-${text.slice(0, 100)}-${message.timestamp ?? Date.now()}`)
            .digest("hex")
            .slice(0, 16);
        return `msg_${hash}`;
    }

    /**
     * Generate page ID.
     */
    generatePageId(label) {
        const hash = createHash("sha256")
            .update(label)
            .digest("hex")
            .slice(0, 12);
        return `hnsw_${hash}`;
    }

    /**
     * Save HNSW index to disk.
     */
    saveIndex() {
        const indexData = {
            messages: Array.from(this.messageStore.entries()),
            config: {
                dimensions: this.dimensions,
                maxElements: this.maxElements,
                efConstruction: this.efConstruction,
                M: this.M,
            },
        };
        writeFileSync(this.indexPath, JSON.stringify(indexData, null, 2), "utf-8");
    }

    /**
     * Load HNSW index from disk.
     */
    loadIndex() {
        if (!existsSync(this.indexPath)) return;

        try {
            const indexData = JSON.parse(readFileSync(this.indexPath, "utf-8"));
            this.messageStore = new Map(indexData.messages);
            
            // Rebuild HNSW index from stored messages
            for (const [msgId, message] of this.messageStore.entries()) {
                const text = this.extractText(message);
                if (text.length < 5) continue;
                
                const embedding = this.embedder(text);
                this.index.addPoint(embedding, msgId);
            }
            
            console.log(`[HNSWMemory] loaded ${this.messageStore.size} messages from index`);
        } catch (err) {
            console.warn(`[HNSWMemory] failed to load index: ${err.message}`);
        }
    }

    /**
     * Override shutdown to persist index.
     */
    async shutdown() {
        this.saveIndex();
        return super.shutdown();
    }
}
