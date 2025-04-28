import type { LintResult, LintRule, MdcFile } from '../types.ts'
import { RuleType } from '../types.ts'

export const frontmatterAgentEmptyDescription: LintRule = {
  id: 'frontmatter-agent-empty-description',
  severity: 'error',
  description:
    'If the rule type is AgentAttached, ensures the description field is present and non-empty.',
  lint: (file: MdcFile): LintResult => {
    const result: LintResult = {
      ruleId: 'frontmatter-agent-empty-description',
      severity: 'error',
      passed: true,
    }

    // If frontmatter parsing failed or is missing, other rules will handle that case
    if (!file.frontmatter?.parsed) {
      return result
    }

    // Only apply this rule for AgentAttached rule types
    if (file.derivedRuleType !== RuleType.AgentAttached) {
      return result
    }

    // At this point, we know it's an AgentAttached rule, so description should exist
    if (!('description' in file.frontmatter.parsed)) {
      result.passed = false
      result.message = 'AgentAttached rule is missing the required description field'
      result.offendingLines = [
        { line: file.frontmatter.startLine, content: '---' },
      ]
      result.reason =
        'AgentAttached rules must provide a description for the AI to understand what the rule is for'
      return result
    }

    const descriptionValue = file.frontmatter.parsed.description

    // Check if description is null (which is not allowed for AgentAttached rules)
    if (descriptionValue === null) {
      result.passed = false
      result.message = 'AgentAttached rule description cannot be empty'
      result.offendingLines = [
        { line: file.frontmatter.startLine, content: '---' },
      ]
      result.offendingValue = {
        propertyPath: 'frontmatter.description',
        value: descriptionValue,
      }
      result.reason =
        'Found null value for description which is not allowed for AgentAttached rules'
      return result
    }

    // Check if description is not a string
    if (typeof descriptionValue !== 'string') {
      result.passed = false
      result.message = 'AgentAttached rule description must be a string'
      result.offendingLines = [
        { line: file.frontmatter.startLine, content: '---' },
      ]
      result.offendingValue = {
        propertyPath: 'frontmatter.description',
        value: descriptionValue,
      }
      result.reason = `Found ${typeof descriptionValue} instead of string for description`
      return result
    }

    // Check if description is an empty string or just whitespace
    if (descriptionValue.trim() === '') {
      result.passed = false
      result.message = 'AgentAttached rule has empty description'
      result.offendingLines = [
        { line: file.frontmatter.startLine, content: '---' },
      ]
      result.offendingValue = {
        propertyPath: 'frontmatter.description',
        value: descriptionValue,
      }
      result.reason =
        'The description field must contain meaningful text that explains the rule purpose'
    }

    return result
  },
}

export default frontmatterAgentEmptyDescription
