const { execSync } = require('child_process');
try {
  const output = execSync('npx tsc --noEmit', {
    cwd: 'D:/DIILZO-MOBILE',
    encoding: 'utf8',
    timeout: 120000,
    stdio: 'pipe',
  });
  console.log(output || 'No errors');
} catch (e) {
  console.log(e.stdout || '');
  console.log(e.stderr || '');
}
