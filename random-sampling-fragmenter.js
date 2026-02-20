import { Fragmenter } from "./fragmentation-memory.js";

/**
 * RandomSamplingFragmenter — age-biased stochastic fragmentation.
 * 
 * No topic detection, no heuristics. Pure random sampling with configurable
 * pressure based on message age. Old memories fragment heavily, recent stays intact.
 * 
 * Config:
 *   sampleRate: base probability of split (0.0-1.0, default 0.2)
 *   ageWeightExponent: how aggressively to fragment old pages (default 1.5)
 *   minFragmentSize: minimum messages per fragment (default 1)
 *   maxFragmentSize: maximum messages before forced split (default 20)
 */
export class RandomSamplingFragmenter extends Fragmenter {
    fragment(messages, config = {}) {
        const {
            sampleRate = 0.2,
            ageWeightExponent = 1.5,
            minFragmentSize = 1,
            maxFragmentSize = 20,
        } = config;

        if (messages.length === 0) return [];

        const fragments = [];
        const now = Date.now();
        let currentFragment = [];

        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            currentFragment.push(msg);

            // Calculate age-weighted split probability
            const age = now - (msg.timestamp ?? now);
            const ageSeconds = age / 1000;
            const ageFactor = Math.pow(Math.min(ageSeconds / 3600, 10), ageWeightExponent); // Cap at 10 hours
            const splitProbability = Math.min(sampleRate * (1 + ageFactor), 0.95);

            // Force split if max size reached
            const shouldSplit = 
                currentFragment.length >= maxFragmentSize ||
                (currentFragment.length >= minFragmentSize && Math.random() < splitProbability);

            if (shouldSplit && i < messages.length - 1) {
                // Finalize current fragment
                fragments.push(this.createFragment(currentFragment));
                currentFragment = [];
            }
        }

        // Add remaining messages as final fragment
        if (currentFragment.length > 0) {
            fragments.push(this.createFragment(currentFragment));
        }

        return fragments;
    }

    createFragment(messages) {
        const preview = this.generatePreview(messages);
        return {
            messages,
            metadata: {
                preview,
                count: messages.length,
                firstRole: messages[0]?.role ?? "unknown",
                lastRole: messages[messages.length - 1]?.role ?? "unknown",
            },
        };
    }

    generatePreview(messages) {
        if (messages.length === 0) return "empty";
        
        const first = messages[0];
        const content = first.content?.slice(0, 60) ?? "";
        const truncated = content.length === 60 ? "..." : "";
        
        return `${first.role}: ${content}${truncated}`;
    }
}
