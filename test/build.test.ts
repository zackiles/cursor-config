import { assert, assertEquals } from '@std/assert'
import * as path from '@std/path'

// Define the expected structure based on RuleObject in build.ts
interface ExpectedRuleObject {
  fileName: string
  description?: string // From frontmatter
  globs?: string[] | string
  alwaysApply?: boolean
  title?: string // Highest H1-H3
  descriptionShort?: string // frontmatter.description or first paragraph after title
  descriptionLong?: string // first paragraph after title
  examples?: string // Formatted markdown content under "Example(s)" headings
  createdOn?: string // Stubbed date
  updatedOn?: string // Stubbed date
}

// Helper to run the build script and get JSON output
async function runBuildScript(): Promise<ExpectedRuleObject[]> {
  const command = new Deno.Command(Deno.execPath(), {
    args: [
      'run',
      '-A', // Allow all permissions needed by the script
      path.join(Deno.cwd(), 'scripts', 'build.ts'),
    ],
    env: {
      'DENO_ENV': 'test',
    },
    stdout: 'piped',
    stderr: 'piped',
  })

  const { code, stdout, stderr } = await command.output()
  const outputString = new TextDecoder().decode(stdout)
  const errorString = new TextDecoder().decode(stderr)

  // Filter out the "Mock input directory ensured..." log message
  const jsonOutputString = outputString
    .split('\n')
    .filter((line) => !line.startsWith('Mock input directory'))
    .join('\n')

  // console.log("Raw STDOUT:\n", outputString);
  // console.log("Raw STDERR:\n", errorString);
  // console.log("Filtered JSON String:\n", jsonOutputString);

  assertEquals(
    code,
    0,
    `Build script exited with error code: ${code}\nSTDERR: ${errorString}`,
  )
  assert(
    jsonOutputString.trim().length > 0,
    'Build script did not produce JSON output.',
  )

  try {
    const rules = JSON.parse(jsonOutputString) as ExpectedRuleObject[]
    assert(Array.isArray(rules), 'Parsed output is not an array.')
    return rules
  } catch (e) {
    if (e instanceof Error) {
      throw new Error(
        `Failed to parse JSON output: ${e.message}\nOutput: ${jsonOutputString}`,
      )
    }
    throw new Error(
      `Failed to parse JSON output: Unknown error\nOutput: ${jsonOutputString}`,
    )
  }
}

Deno.test('build.ts - Script Execution and Basic Structure', async () => {
  const rules = await runBuildScript()
  assertEquals(rules.length, 6, 'Expected 6 rules to be processed')
  // Check if basic properties exist (flexible check)
  for (const rule of rules) {
    assert(rule.fileName, `Rule missing fileName: ${JSON.stringify(rule)}`)
    assertEquals(
      rule.createdOn,
      '2024-01-01',
      `Rule ${rule.fileName} missing or incorrect createdOn`,
    )
    assertEquals(
      rule.updatedOn,
      '2024-01-15',
      `Rule ${rule.fileName} missing or incorrect updatedOn`,
    )
  }
})

Deno.test('build.ts - Rule A (H1, Frontmatter Desc, Para Desc)', async () => {
  const rules = await runBuildScript()
  const rule = rules.find((r) => r.fileName === 'rule_a.mdc')
  assert(rule, 'Rule A not found')
  if (!rule) return
  assertEquals(rule.title, 'Rule A Title')
  assertEquals(rule.description, 'Rule A Description from Frontmatter')
  assertEquals(
    rule.descriptionLong,
    'This is the long description for Rule A.',
  )
  assertEquals(rule.descriptionShort, 'Rule A Description from Frontmatter') // Prefers frontmatter
  assertEquals(rule.globs, undefined)
  assertEquals(rule.alwaysApply, undefined)
  assertEquals(rule.examples, undefined)
})

Deno.test('build.ts - Rule B (H2 Only)', async () => {
  const rules = await runBuildScript()
  const rule = rules.find((r) => r.fileName === 'rule_b.mdc')
  assert(rule, 'Rule B not found')
  if (!rule) return
  assertEquals(rule.title, 'Rule B Title Only')
  assertEquals(rule.descriptionLong, undefined) // No paragraph directly after H2
  assertEquals(rule.descriptionShort, undefined)
  assertEquals(rule.description, undefined)
  assertEquals(rule.globs, undefined)
  assertEquals(rule.alwaysApply, undefined)
  assertEquals(rule.examples, undefined)
})

Deno.test('build.ts - Rule C (H3, Frontmatter Desc, Globs, AlwaysApply)', async () => {
  const rules = await runBuildScript()
  const rule = rules.find((r) => r.fileName === 'rule_c.mdc')
  assert(rule, 'Rule C not found')
  if (!rule) return
  assertEquals(rule.title, 'Rule C Title')
  assertEquals(rule.description, 'Rule C Short Desc')
  assertEquals(rule.descriptionLong, 'Rule C long description paragraph.')
  assertEquals(rule.descriptionShort, 'Rule C Short Desc') // Prefers frontmatter
  assertEquals(rule.globs, ['*.ts', '*.js'])
  assertEquals(rule.alwaysApply, true)
  assertEquals(rule.examples, undefined)
})

Deno.test('build.ts - Rule D (H1 Only, No Desc)', async () => {
  const rules = await runBuildScript()
  const rule = rules.find((r) => r.fileName === 'rule_d.mdc')
  assert(rule, 'Rule D not found')
  if (!rule) return
  assertEquals(rule.title, 'Rule D Title Only (H1)')
  assertEquals(rule.descriptionLong, undefined)
  assertEquals(rule.descriptionShort, undefined)
  assertEquals(rule.description, undefined)
  assertEquals(rule.globs, undefined)
  assertEquals(rule.alwaysApply, undefined)
  assertEquals(rule.examples, undefined)
})

Deno.test('build.ts - Rule E (Examples Section)', async () => {
  const rules = await runBuildScript()
  const rule = rules.find((r) => r.fileName === 'rule_e.mdc')
  assert(rule, 'Rule E not found')
  if (!rule) return
  assertEquals(rule.title, 'Rule E Title')
  assertEquals(rule.description, 'Rule E Desc')
  assertEquals(rule.descriptionLong, 'Description E.')
  assertEquals(rule.descriptionShort, 'Rule E Desc')
  assert(rule.examples, 'Examples section not extracted')
  // Check specific parts of the example content
  assert(rule.examples.includes('## Examples'), 'Example H2 missing')
  assert(
    rule.examples.includes('This is an example paragraph.'),
    'Example paragraph missing',
  )
  assert(
    rule.examples.includes('```typescript\nconsole.log("Example code");\n```'),
    'Example TS code block missing',
  )
  assert(rule.examples.includes('### Sub Example'), 'Example H3 missing')
  assert(rule.examples.includes('- List item 1'), 'Example list item missing')
  assert(
    rule.examples.includes('```javascript\nfunction hello() {}\n```'),
    'Example JS code block missing',
  )
  assert(
    !rule.examples.includes('Another Section'),
    'Examples captured content outside its section',
  )
})

Deno.test('build.ts - Rule F (No Title, Frontmatter Only)', async () => {
  const rules = await runBuildScript()
  const rule = rules.find((r) => r.fileName === 'rule_f.mdc')
  assert(rule, 'Rule F not found')
  if (!rule) return
  assertEquals(rule.title, undefined)
  assertEquals(rule.description, 'Rule F Description')
  assertEquals(rule.descriptionLong, undefined) // No header, so no long description derived from body
  assertEquals(rule.descriptionShort, 'Rule F Description') // Uses frontmatter
  assertEquals(rule.globs, '*.md')
  assertEquals(rule.alwaysApply, undefined)
  assertEquals(rule.examples, undefined)
})
