"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultItemData = exports.defaultUniverseData = void 0;
exports.defaultUniverseData = {
    cats: {
        article: ['article', 'articles', '#deddca'],
        character: ['character', 'characters', '#F44336'],
        location: ['location', 'locations', '#4CAF50'],
        event: ['event', 'events', '#9e9e9e'],
        archive: ['archive', 'archives', '#a1887f'],
        document: ['document', 'documents', '#4d4d4d'],
        timeline: ['timeline', 'timelines', '#64B5F6'],
        item: ['item', 'items', '#ffc107'],
        organization: ['organization', 'organizations', '#9262df']
    }
};
exports.defaultItemData = {
    article: {
        body: '# Markdown Test\n\n- **Bold**\n- *Italics*\n- _Italics 2_\n- __Underline__\n- ~~Strikethrough~~\n- [Link](@test-character)\n- Lists',
    },
    character(age = 0, parent = null, child = null) {
        return {
            body: 'This is a test character.',
            lineage: {
                title: 'Lineage',
                parents: parent ? { [parent.shortname]: [null, null] } : {},
                children: child ? { [child.shortname]: [null, null] } : {},
            },
            timeline: {
                title: 'Timeline',
                events: [
                    { title: 'Birth', time: (age * 316224000) + Math.round(Math.random() * 7654321), imported: false },
                    { title: 'Death', time: (age * 316224000) + 31557600000 + Math.round(Math.random() * 7654321), imported: false },
                ],
            },
        };
    },
    event: {
        body: 'This is a test event.',
        timeline: {
            title: 'Timeline',
            events: [
                { title: null, time: Math.round(Math.random() * 31557600000), imported: false },
            ],
        },
        comments: true,
    },
    timeline(items) {
        const imports = items.reduce((list, item) => ([
            ...list,
            ...item.events.filter(e => e.src_id === item.id).map(e => ([
                { id: e.src_id, title: e.src_title, shortname: e.src_shortname },
                { title: e.event_title, time: e.abstime },
            ])),
        ]), []);
        const events = items.reduce((list, item) => ([
            ...list,
            ...item.events.map(e => ({ title: e.event_title, time: e.abstime, imported: e.src_id === item.id, src: e.src_title, srcId: e.src_id })),
        ]), []);
        return {
            timeline: {
                title: 'Timeline',
                imports,
                events,
            },
        };
    },
};
