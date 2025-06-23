const api = require('../../api');
const { perms, Cond } = require('../../api/utils');
module.exports = {
    misc: require('./misc'),
    user: require('./user'),
    item: require('./item'),
    story: require('./story'),
    universe: require('./universe'),
    async home(req, res) {
        const user = req.session.user;
        if (user) {
            const [code1, universes] = await api.universe.getMany(user, null, perms.WRITE);
            res.status(code1);
            if (!universes)
                return;
            const [code2, followedUniverses] = await api.universe.getMany(user, {
                strings: ['fu.user_id = ?', 'fu.is_following = ?'],
                values: [user.id, true],
            }, perms.READ);
            res.status(code2);
            if (!followedUniverses)
                return;
            const followedUniverseIds = `(${followedUniverses.map(universe => universe.id).join(',')})`;
            const [code3, recentlyUpdated] = followedUniverses.length > 0 ? await api.item.getMany(user, null, perms.READ, {
                sort: 'updated_at',
                sortDesc: true,
                limit: 8,
                select: [['lub.username', 'last_updated_by']],
                join: [['LEFT', ['user', 'lub'], new Cond('lub.id = item.last_updated_by')]],
                where: new Cond(`item.universe_id IN ${followedUniverseIds}`)
                    .and(new Cond('lub.id <> ?', user.id).or(new Cond('item.last_updated_by IS NULL').and('item.author_id <> ?', user.id))),
            }) : [200, []];
            res.status(code3);
            const [code4, oldestUpdated] = await api.item.getMany(user, null, perms.WRITE, {
                sort: `GREATEST(IFNULL(snooze.snoozed_at, '1000-01-01'), IFNULL(item.updated_at, '1000-01-01'))`,
                sortDesc: false,
                forceSort: true,
                limit: 16,
                join: [['LEFT', 'snooze', new Cond('snooze.item_id = item.id').and('snooze.snoozed_by = ?', user.id)]],
                where: new Cond('item.updated_at < DATE_SUB(NOW(), INTERVAL 2 DAY)'),
                groupBy: ['snooze.snoozed_at'],
            });
            res.status(code4);
            if (!oldestUpdated)
                return;
            // if (universes.length === 1) {
            //   res.redirect(`${ADDR_PREFIX}/universes/${universes[0].shortname}`);
            // }
            return res.prepareRender('home', { universes, followedUniverses, recentlyUpdated, oldestUpdated });
        }
        res.prepareRender('home', { universes: [] });
    },
};
