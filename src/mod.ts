// Re-export all exports from TS files in src/ except for linter.ts
export * from './types.ts'
export * from './processor.ts'
export * from './console-components.ts'
export * from './characters.ts'
export * from './lint-rules/index.ts'
export * from './parsers/frontmatter.ts'
export * from './parsers/markdown.ts'
export * from './parsers/rule-type.ts'

// If this module is run directly, proxy to linter.ts
if (import.meta.main) {
  // Get the current working directory
  const cwd = Deno.cwd()

  // Create the command to run linter.ts with all arguments
  const process = new Deno.Command(Deno.execPath(), {
    args: [
      'run',
      '-A', // Allow all permissions
      'src/linter.ts',
      ...Deno.args, // Pass all arguments from mod.ts to linter.ts
    ],
    cwd, // Use the same working directory
    env: Deno.env.toObject(), // Pass all environment variables
    stdout: 'inherit', // Inherit stdout
    stderr: 'inherit', // Inherit stderr
    stdin: 'inherit', // Inherit stdin
  })

  // Run the command
  const { code } = await process.output()

  // Exit with the same code as linter.ts
  Deno.exit(code)
}
