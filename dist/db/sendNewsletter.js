const db = require(".");
const readline = require('readline');
const api = require("../api");
const { askQuestion } = require("./import");
function askMultiline(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    console.log(query);
    return new Promise(resolve => {
        let lines = [];
        let blankCount = 0;
        rl.on('line', line => {
            lines.push(line);
            if (!line) {
                blankCount++;
            }
            else {
                blankCount = 0;
            }
            if (blankCount === 2) {
                rl.close();
                lines.pop();
                resolve(lines.join('\n'));
            }
        });
    });
}
async function main() {
    console.log('Please input newletter info below:');
    const title = await askQuestion('Title: ');
    const preview = await askQuestion('Preview: ');
    const body = await askMultiline('Body:');
    console.log(`Title: ${title}`);
    console.log(`Preview: ${preview}`);
    console.log(`Body: ${body}`);
    const ans = await askQuestion('Does this look right? [y/N] ');
    if (ans.toUpperCase() === 'N') {
        const ans = await askQuestion('Try again? [y/N] ');
        if (ans.toUpperCase() === 'Y') {
            await main();
        }
        else {
            console.log('Exiting.');
        }
        return;
    }
    const [code, { insertId }] = await api.newsletter.post({ title, preview, body });
    if (code !== 201)
        return;
    const [, users] = await api.user.getMany(null, true);
    const proceed = await askQuestion(`${users.length} users to send to, proceed? [y/N] `);
    if (proceed.toUpperCase() === 'N') {
        console.log('Exiting.');
        return;
    }
    for (let i = 0; i < users.length; i++) {
        const user = users[i];
        console.log(`Sending... (${i}/${users.length})`);
        await api.notification.notify(user, api.notification.types.FEATURES, {
            title,
            body: preview,
            clickUrl: `/news/${insertId}`,
        });
        readline.moveCursor(process.stdout, 0, -1);
    }
    console.log(`Sending... (${users.length}/${users.length})`);
}
if (require.main === module) {
    main().then(() => db.end());
}
