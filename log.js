/*
 * Shadowrun 1e GameBot by Discord user AstroMacGuffin#1486 (Nathan Hawks)
 * https://github.com/NathanHawks/SR1eGameBot
 * Yes I do regret baking 1e into the name
 * version 0.3, yeah that sounds good
 * Released under the terms of the UnLicense. This work is in the public domain.
 * Released as-is with no warranty or claim of usability for any purpose.
 */
const {config} = require('./config');
function getCurrentDateNY() {
  let d = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
  return d;
}
function getColorCurrentDateNY() {
  let d = getCurrentDateNY();
  return `\x1b[1m\x1b[34m${d}\x1b[0m`;
}
function getCyanString(msg) {
  return `\x1b[36m${msg}\x1b[0m`;
}
async function logWrite(msg) {
  // prep for file & line number printing thanks to
  // https://gist.github.com/mikesmullin/008721d4753d3e0d9a95cda617874736
  const orig = Error.prepareStackTrace;
  Error.prepareStackTrace = (_, stack) => stack;
  const err = new Error();
  Error.captureStackTrace(err, arguments.callee);
  const callee = err.stack[0];
  Error.prepareStackTrace = orig;
  //process.stdout.write(`${path.relative(process.cwd(), callee.getFileName())}:${callee.getLineNumber()}: ${s}\n`);

  let d = getColorCurrentDateNY().padEnd(36, ' ');
  let line = callee.getLineNumber();
  let file = callee.getFileName();
  file = file.split('\\');
  file = file[file.length-1].padEnd(25, ' ');
  line = new String(line);
  line = line.padEnd(6);

  console.log(`${d} ${getCyanString(`${file} ${line}`)} ${msg}`);
  return true;
}
async function logSpam(msg) {
  // prep for file & line number printing thanks to
  // https://gist.github.com/mikesmullin/008721d4753d3e0d9a95cda617874736
  const orig = Error.prepareStackTrace;
  Error.prepareStackTrace = (_, stack) => stack;
  const err = new Error();
  Error.captureStackTrace(err, arguments.callee);
  const callee = err.stack[0];
  Error.prepareStackTrace = orig;
  //process.stdout.write(`${path.relative(process.cwd(), callee.getFileName())}:${callee.getLineNumber()}: ${s}\n`);

  let d = getColorCurrentDateNY().padEnd(36, ' ');
  let line = callee.getLineNumber();
  let file = callee.getFileName();
  file = file.split('\\');
  file = file[file.length-1].padEnd(25, ' ');
  line = new String(line);
  line = line.padEnd(6);

  if (config.logspam)
    console.log(`${d} ${getCyanString(`${file} ${line}`)} ${msg}`);
  return true;
}
async function logError(msg) {
  // prep for file & line number printing thanks to
  // https://gist.github.com/mikesmullin/008721d4753d3e0d9a95cda617874736
  const orig = Error.prepareStackTrace;
  Error.prepareStackTrace = (_, stack) => stack;
  const err = new Error();
  Error.captureStackTrace(err, arguments.callee);
  const callee = err.stack[0];
  Error.prepareStackTrace = orig;
  //process.stdout.write(`${path.relative(process.cwd(), callee.getFileName())}:${callee.getLineNumber()}: ${s}\n`);

  let d = getColorCurrentDateNY().padEnd(36, ' ');
  let line = callee.getLineNumber();
  let file = callee.getFileName();
  file = file.split('\\');
  file = file[file.length-1].padEnd(25, ' ');
  line = new String(line);
  line = line.padEnd(6);

  console.error(
    `${d} ${getCyanString(`${file} ${line}`)} \x1b[33m${msg}\x1b[0m`
  );
}
module.exports = {logSpam,logWrite,logError,getCurrentDateNY,
  getColorCurrentDateNY,getCyanString};
