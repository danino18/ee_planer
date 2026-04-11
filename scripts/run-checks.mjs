import { spawn } from 'node:child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const steps = [
  { label: 'lint', command: npmCommand, args: ['run', 'lint'] },
  { label: 'typecheck', command: npmCommand, args: ['run', 'typecheck'] },
  { label: 'tests', command: npmCommand, args: ['run', 'test'] },
  { label: 'build', command: npmCommand, args: ['run', 'build'] },
  { label: 'bundle analysis', command: npmCommand, args: ['run', 'analyze:bundle'] },
  { label: 'functions build', command: npmCommand, args: ['run', 'build:functions'] },
  { label: 'functions lint', command: npmCommand, args: ['run', 'lint:functions'] },
];

function quotePowerShellArg(value) {
  if (/^[A-Za-z0-9._:/=-]+$/.test(value)) {
    return value;
  }

  return `'${value.replaceAll("'", "''")}'`;
}

function runStep(step) {
  return new Promise((resolve, reject) => {
    const spawnCommand = process.platform === 'win32'
      ? 'powershell.exe'
      : step.command;
    const spawnArgs = process.platform === 'win32'
      ? [
          '-NoLogo',
          '-NoProfile',
          '-Command',
          [step.command, ...step.args].map(quotePowerShellArg).join(' '),
        ]
      : step.args;

    const child = spawn(spawnCommand, spawnArgs, {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: false,
    });

    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          signal
            ? `${step.label} exited with signal ${signal}`
            : `${step.label} failed with exit code ${code ?? 'unknown'}`,
        ),
      );
    });
  });
}

for (const step of steps) {
  console.log(`\n==> Running ${step.label}`);
  await runStep(step);
}
