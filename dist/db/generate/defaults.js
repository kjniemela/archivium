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
            _tables: (self) => ({
                events: [
                    { event_title: 'Birth', abstime: (age * 316224000) + Math.round(Math.random() * 7654321), src_id: self.id, src_shortname: self.shortname, src_title: self.title },
                    { event_title: 'Death', abstime: (age * 316224000) + 31557600000 + Math.round(Math.random() * 7654321), src_id: self.id, src_shortname: self.shortname, src_title: self.title },
                ],
                parents: parent ? [{ parent_shortname: parent.shortname, parent_title: parent.title }] : [],
                children: child ? [{ child_shortname: child.shortname, child_title: child.title }] : [],
            }),
            body: 'This is a test character.',
            lineage: { title: 'Lineage' },
            timeline: { title: 'Timeline' },
        };
    },
    event: {
        body: 'This is a test event.',
        _tables: (self) => ({
            events: [
                { event_title: null, abstime: Math.round(Math.random() * 31557600000), src_id: self.id, src_shortname: self.shortname, src_title: self.title },
            ],
        }),
        timeline: { title: 'Timeline' },
        comments: true,
    },
    timeline(items) {
        const events = items.reduce((list, item) => ([
            ...list,
            ...item.events ?? [],
        ]), []);
        return {
            _tables: () => ({
                events,
            }),
            timeline: { title: 'Timeline' },
        };
    },
};
