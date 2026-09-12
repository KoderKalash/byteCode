/**
 * End-to-end smoke test against a running API with a real Docker daemon.
 *
 * The unit suite stubs the docker CLI out, so it proves how containers are
 * invoked but not that anything actually executes. This proves the real thing:
 * that each toolchain compiles and runs a program under --read-only as an
 * unprivileged uid, that stdin is delivered, that a compile error comes back as
 * a compile error, and that a runaway program is killed without leaking a
 * container.
 *
 *   API_URL=http://localhost:5000 node test/smoke.mjs
 */

import { execFileSync } from "node:child_process"

const API_URL = (process.env.API_URL || "http://localhost:5000").replace(/\/$/, "")

let failures = 0

function pass(name) {
  console.log(`  ok   ${name}`)
}

function fail(name, detail) {
  failures += 1
  console.error(`  FAIL ${name}`)
  console.error(`       ${detail}`)
}

async function post(body) {
  const res = await fetch(`${API_URL}/run-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return { status: res.status, data: await res.json() }
}

async function waitForApi(attempts = 60) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(`${API_URL}/health`)
      if (res.ok) return await res.json()
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  throw new Error(`API at ${API_URL} never became healthy`)
}

// ---------------------------------------------------------------- programs

const HELLO = {
  python: 'print("hello from python")',
  cpp: '#include <iostream>\nint main() { std::cout << "hello from cpp" << std::endl; }',
  java:
    "public class Main {\n" +
    "  public static void main(String[] args) {\n" +
    '    System.out.println("hello from java");\n' +
    "  }\n" +
    "}",
}

// Each reads one line from stdin and prints it back with an exclamation mark.
const ECHO = {
  python: "print(input() + \"!\")",
  cpp:
    "#include <iostream>\n#include <string>\n" +
    "int main() { std::string s; std::getline(std::cin, s); std::cout << s << \"!\" << std::endl; }",
  java:
    "import java.util.Scanner;\n" +
    "public class Main {\n" +
    "  public static void main(String[] args) {\n" +
    "    Scanner in = new Scanner(System.in);\n" +
    '    System.out.println(in.nextLine() + "!");\n' +
    "  }\n" +
    "}",
}

// ------------------------------------------------------------------- tests

async function testHello(language) {
  const name = `${language}: compiles and runs`
  const { status, data } = await post({ language, code: HELLO[language] })

  if (status !== 200 || !data.ok) {
    return fail(name, `HTTP ${status} ok=${data.ok} stage=${data.stage} stderr=${data.stderr}`)
  }
  if (data.stdout.trim() !== `hello from ${language}`) {
    return fail(name, `unexpected stdout: ${JSON.stringify(data.stdout)}`)
  }
  pass(name)
}

async function testStdin(language) {
  const name = `${language}: receives stdin`
  const { status, data } = await post({ language, code: ECHO[language], stdin: "ping\n" })

  if (status !== 200 || !data.ok) {
    return fail(name, `HTTP ${status} ok=${data.ok} stage=${data.stage} stderr=${data.stderr}`)
  }
  if (data.stdout.trim() !== "ping!") {
    return fail(name, `unexpected stdout: ${JSON.stringify(data.stdout)}`)
  }
  pass(name)
}

async function testCompileError() {
  const name = "cpp: compile error reports the compiler's message"
  // Missing semicolon.
  const { status, data } = await post({
    language: "cpp",
    code: "#include <iostream>\nint main() { std::cout << 1 }",
  })

  if (status !== 200) return fail(name, `expected HTTP 200, got ${status}`)
  if (data.ok) return fail(name, "expected ok=false")
  if (data.stage !== "compile") return fail(name, `expected stage=compile, got ${data.stage}`)
  if (!/error/i.test(data.stderr)) {
    return fail(name, `expected compiler diagnostics, got: ${JSON.stringify(data.stderr)}`)
  }
  if (/Execution Failed/.test(data.stderr)) {
    return fail(name, "diagnostics were replaced by a generic message")
  }
  pass(name)
}

async function testRuntimeError() {
  const name = "python: runtime error reports the traceback"
  const { status, data } = await post({ language: "python", code: "print(1 / 0)" })

  if (status !== 200) return fail(name, `expected HTTP 200, got ${status}`)
  if (data.ok) return fail(name, "expected ok=false")
  if (!/ZeroDivisionError/.test(data.stderr)) {
    return fail(name, `expected a traceback, got: ${JSON.stringify(data.stderr)}`)
  }
  pass(name)
}

// Unambiguous check on --network none: nothing else in the setup would stop this.
async function testNoNetwork() {
  const name = "python: sandbox has no network access"
  const { data } = await post({
    language: "python",
    code:
      "import socket\n" +
      "try:\n" +
      "    socket.create_connection(('1.1.1.1', 53), timeout=3)\n" +
      "    print('NETWORK REACHABLE')\n" +
      "except Exception:\n" +
      "    print('no network')\n",
  })

  if (/NETWORK REACHABLE/.test(data.stdout)) {
    return fail(name, "the sandbox reached the network; --network none is not in effect")
  }
  if (!/no network/.test(data.stdout)) {
    return fail(name, `unexpected stdout: ${JSON.stringify(data.stdout)}`)
  }
  pass(name)
}

async function testWriteProtection() {
  // Blocked by --read-only and by the unprivileged uid; this asserts the
  // outcome, not which flag produced it.
  const name = "python: cannot write outside the work directory"
  const { data } = await post({
    language: "python",
    code:
      "try:\n" +
      "    open('/etc/passwd', 'a').write('x')\n" +
      "    print('WROTE TO ROOTFS')\n" +
      "except Exception as e:\n" +
      "    print('blocked')\n",
  })

  if (/WROTE TO ROOTFS/.test(data.stdout)) {
    return fail(name, "the sandbox wrote to its rootfs; containment is not in effect")
  }
  // Require the positive marker too, so this cannot pass just because the
  // program produced no output at all.
  if (!/blocked/.test(data.stdout)) {
    return fail(name, `expected the write to be refused, got: ${JSON.stringify(data.stdout)}`)
  }
  pass(name)
}

async function testTimeoutAndNoLeak() {
  const name = "python: infinite loop times out"
  const { status, data } = await post({ language: "python", code: "while True: pass" })

  if (status !== 200) return fail(name, `expected HTTP 200, got ${status}`)
  if (!data.timedOut) return fail(name, `expected timedOut=true, got ${JSON.stringify(data)}`)
  pass(name)

  // The important half: the container must not survive the timeout. Give the
  // daemon a moment to finish the kill we issued.
  const leakName = "timeout does not leak a container"
  await new Promise((resolve) => setTimeout(resolve, 3000))

  let running
  try {
    running = execFileSync("docker", ["ps", "--filter", "name=bytecode-", "--quiet"], {
      encoding: "utf8",
    }).trim()
  } catch (err) {
    return fail(leakName, `could not query docker: ${err.message}`)
  }

  if (running) {
    return fail(leakName, `containers still running after timeout:\n${running}`)
  }
  pass(leakName)
}

// -------------------------------------------------------------------- main

const health = await waitForApi()
console.log(`API healthy at ${API_URL}; languages: ${health.languages.join(", ")}`)

console.log("\nexecution")
for (const language of ["python", "cpp", "java"]) await testHello(language)

console.log("\nstdin")
for (const language of ["python", "cpp", "java"]) await testStdin(language)

console.log("\ndiagnostics")
await testCompileError()
await testRuntimeError()

console.log("\ncontainment")
await testNoNetwork()
await testWriteProtection()
await testTimeoutAndNoLeak()

console.log("")
if (failures > 0) {
  console.error(`${failures} smoke check(s) failed`)
  process.exit(1)
}
console.log("all smoke checks passed")
