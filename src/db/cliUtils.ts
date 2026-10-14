import * as readline from 'readline';


// https://stackoverflow.com/a/50890409
export function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise<string>(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}
