Deno.env.set('PACKAGE_NAME', 'mdc-linter')

// Re-export all exports from TS files in src/ except for linter.ts
export * from './types.ts'
export * from './processor.ts'
export * from './console-components.ts'
export * from './characters.ts'
export * from './lint-rules/index.ts'
export * from './parsers/frontmatter.ts'
export * from './parsers/markdown.ts'
export * from './parsers/attachment-type.ts'

// If this module is run directly, proxy to linter.ts
if (import.meta.main) {
  // Create the command to run linter.ts with all arguments
  const process = new Deno.Command(Deno.execPath(), {
    args: [
      'run',
      '-A',
      'src/linter.ts',
      ...Deno.args,
    ],
    cwd: Deno.cwd(),
    env: Deno.env.toObject(),
    stdout: 'inherit',
    stderr: 'inherit',
    stdin: 'inherit',
  })

  const { code } = await process.output()

  Deno.exit(code)
}
