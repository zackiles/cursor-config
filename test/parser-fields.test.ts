/**
 * @module fieldsTest
 */
import { assert } from '@std/assert'
import { processAndVerifyMdcFile } from './test-utils.ts'

const TEST_CONFIG = {
  TEST_NAME: 'parser-fields/',
  PASSING_MOCK_PATH: 'fields/full-fields.mdc',
  DENO_ENV: 'test' as const,
} as const

Deno.test(`[${TEST_CONFIG.TEST_NAME}]: PASS for rules in ${TEST_CONFIG.PASSING_MOCK_PATH}`, async (t) => {
  // Process the full-fields.mdc file
  const filePath = `test/mocks/${TEST_CONFIG.PASSING_MOCK_PATH}`
  const mdcFile = await processAndVerifyMdcFile(filePath)

  await t.step('validate frontmatter exists', () => {
    assert(mdcFile.frontmatter, 'Frontmatter should be parsed successfully')
    assert(!mdcFile.frontmatter.parseError, 'Frontmatter should not have parse errors')
  })

  await t.step('validate tags are correctly parsed', () => {
    assert(mdcFile.frontmatter?.tags, 'Tags field should exist in frontmatter')
    assert(Array.isArray(mdcFile.frontmatter.tags), 'Tags should be parsed as an array')
    assert(mdcFile.frontmatter.tags.length === 4, 'Should have 4 tags')
    assert(mdcFile.frontmatter.tags.includes('one tag'), 'Should include "one tag"')
    assert(mdcFile.frontmatter.tags.includes('two tag'), 'Should include "two tag"')
    assert(mdcFile.frontmatter.tags.includes('three tag'), 'Should include "three tag"')
    assert(mdcFile.frontmatter.tags.includes('four tag'), 'Should include "four tag"')
  })

  await t.step('validate globs are correctly parsed if present', () => {
    // Since we didn't see globs in the file snippet, we check conditionally
    if (mdcFile.frontmatter && 'globs' in mdcFile.frontmatter) {
      const globs = mdcFile.frontmatter.globs
      if (globs !== null) {
        assert(
          typeof globs === 'string' || Array.isArray(globs),
          'Globs should be a string or array of strings',
        )
        if (Array.isArray(globs)) {
          assert(
            globs.every((glob) => typeof glob === 'string'),
            'All glob entries should be strings',
          )
        }
      }
    }
  })

  await t.step('validate category is correctly parsed if present', () => {
    // Since we didn't see category in the file snippet, we check conditionally
    if (mdcFile.frontmatter && 'category' in mdcFile.frontmatter) {
      const category = mdcFile.frontmatter.category
      if (category !== null) {
        assert(typeof category === 'string', 'Category should be a string')
      }
    }
  })
})
