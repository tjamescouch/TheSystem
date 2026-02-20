# 🧠 Directive Implementation Plan

## Overview
Add `🧠 marker support to gro's stream-markers.js + main.js to allow agents to switch memory backends mid-conversation.

## Marker Syntax
```
🧠     — VirtualMemory (default, current behavior)
🧠    — FragmentationMemory (stochastic fragmenter)
🧠        — HNSWMemory (semantic search)
```

## Implementation Steps

### 1. Add marker handler in main.js
Location: `onMarker` callback (~line 830-910)

```javascript
else if (marker.name === "memory" && marker.arg) {
    // Switch memory backend mid-conversation
    const newMemoryType = marker.arg.toLowerCase();
    const supportedTypes = ["virtual", "fragment", "hnsw"];
    
    if (!supportedTypes.includes(newMemoryType)) {
        Logger.warn(`Stream marker: memory('${marker.arg}') — unknown type. Supported: ${supportedTypes.join(", ")}`);
        return;
    }
    
    // Save current memory state
    const messages = memory.messages.slice();
    const currentModel = memory.model;
    
    // Create new memory instance
    let newMemory;
    if (newMemoryType === "virtual") {
        newMemory = new VirtualMemory(cfg);
    } else if (newMemoryType === "fragment") {
        // Import FragmentationMemory + default fragmenter
        const { FragmentationMemory } = await import("./memory/fragmentation-memory.js");
        const { RandomSamplingFragmenter } = await import("./memory/random-sampling-fragmenter.js");
        newMemory = new FragmentationMemory({
            ...cfg,
            fragmenter: new RandomSamplingFragmenter(),
        });
    } else if (newMemoryType === "hnsw") {
        // Import HNSWMemory + embedder
        const { HNSWMemory } = await import("./memory/hnsw-memory.js");
        newMemory = new HNSWMemory({
            ...cfg,
            embedder: cfg.embedder ?? simpleEmbedder,
            dimensions: cfg.embeddingDimensions ?? 384,
        });
    }
    
    // Restore messages into new memory
    for (const msg of messages) {
        newMemory.addMessage(msg);
    }
    newMemory.setModel(currentModel);
    
    // Swap memory reference
    memory = newMemory;
    Logger.info(`Stream marker: memory('${newMemoryType}') — backend switched`);
}
```

### 2. Add imports at top of main.js
```javascript
import { FragmentationMemory } from "./memory/fragmentation-memory.js";
import { RandomSamplingFragmenter } from "./memory/random-sampling-fragmenter.js";
import { HNSWMemory } from "./memory/hnsw-memory.js";
```

### 3. Add embedder config option
For HNSW support, add `--embedder` flag + default simple embedder:

```javascript
// In parseArgs():
embedder: null,  // Function(text) => float[]
embeddingDimensions: 384,

// Simple word-frequency embedder fallback:
function simpleEmbedder(text) {
    // TODO: integrate real embedding model (OpenAI, sentence-transformers, etc)
    const words = text.toLowerCase().split(/\s+/);
    const vocab = Array.from(new Set(words)).sort();
    const vec = new Float32Array(384).fill(0);
    words.forEach((w, i) => {
        const idx = vocab.indexOf(w) % 384;
        vec[idx] += 1.0 / words.length;
    });
    return Array.from(vec);
}
```

### 4. Session persistence
Memory type should persist across `--resume`:

```javascript
// In saveSession():
metadata: {
    model: memory.model,
    memoryType: memory.constructor.name,  // "VirtualMemory" | "FragmentationMemory" | "HNSWMemory"
}

// In loadSession():
const memoryType = session.metadata?.memoryType ?? "VirtualMemory";
if (memoryType === "FragmentationMemory") {
    memory = new FragmentationMemory({ ...cfg, fragmenter: new RandomSamplingFragmenter() });
} else if (memoryType === "HNSWMemory") {
    memory = new HNSWMemory({ ...cfg, embedder: simpleEmbedder, dimensions: 384 });
} else {
    memory = new VirtualMemory(cfg);
}
```

## Testing
```bash
# Test marker in conversation
echo "🧠 Switch to fragmentation mode." | gro

# Test persistence
gro --session test-memory
# (emit 🧠 in response)
# Ctrl-C
gro --resume test-memory
# Should reload with HNSWMemory
```

## Integration with gro-fragmenters repo
Once this patch lands in gro core:
1. Move FragmentationMemory, RandomSamplingFragmenter, HNSWMemory into gro/src/memory/
2. Update gro imports to use these classes
3. Document 🧠 marker in gro README

## Backwards compatibility
- Default behavior unchanged (VirtualMemory)
- No breaking changes to existing sessions
- Marker ignored if memory type not available
