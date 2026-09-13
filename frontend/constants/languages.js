// The default is explicit rather than "whatever happens to be first", so
// reordering the selector can never silently change which language loads.
export const DEFAULT_LANGUAGE = "python"

// Each language opens with a program that runs as-is. An empty editor gives a
// first-time visitor nothing to press Run on, and a disabled Run button is a
// poor first impression of a tool whose whole point is running code.
//
// Deliberately none of these read stdin: the input box starts empty, so a
// starter that called input() would greet a new visitor with an EOF traceback.
const languages = [
  {
    id: "python",
    label: "Python",
    starter: 'print("Hello from ByteCode")\n',
  },
  {
    id: "cpp",
    label: "C++",
    starter: `#include <iostream>

int main() {
    std::cout << "Hello from ByteCode\\n";
    return 0;
}
`,
  },
  {
    id: "java",
    label: "Java",
    // The class must be Main: the backend writes this to Main.java.
    starter: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello from ByteCode");
    }
}
`,
  },
]

export const STARTERS = Object.fromEntries(languages.map((l) => [l.id, l.starter]))

const STARTER_VALUES = new Set(languages.map((l) => l.starter))

/**
 * Is the editor holding something the user has not written?
 *
 * Switching language swaps the starter, but only when nothing would be lost —
 * so an untouched starter is replaced and real work never is. Every starter
 * counts, not just the current language's: switching Python -> C++ -> Java
 * should keep swapping rather than stop after the first hop.
 */
export function isUntouched(code) {
  return code.trim() === "" || STARTER_VALUES.has(code)
}

export default languages
