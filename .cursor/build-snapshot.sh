#!/bin/bash
set -e

# Determine the script's directory and the project root
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
PROJECT_ROOT=$(dirname "$SCRIPT_DIR")

# Display usage information
usage() {
  echo "Usage: $0"
  echo "Create an AI-friendly context file using repomix for the project codebase."
  echo "Uses the configuration from $PROJECT_ROOT/repomix.config.json"
  echo "Output is saved to the path specified in the config (e.g., $PROJECT_ROOT/.cursor/snapshot.xml)"
  exit 1
}

# Check if help was requested
if [ "$1" == "--help" ] || [ "$1" == "-h" ]; then
  usage
fi

# Config file path relative to project root
CONFIG_FILE="repomix.config.json"
CONFIG_FILE_PATH="$PROJECT_ROOT/$CONFIG_FILE"

# Output directory specified in config (assuming relative to project root)
# A more robust script might parse the JSON, but this is simpler.
OUTPUT_PARENT_DIR="$PROJECT_ROOT/.cursor"
mkdir -p "$OUTPUT_PARENT_DIR"

# Change to the project root directory so repomix interprets paths correctly
cd "$PROJECT_ROOT"

# Run repomix using the root config file
echo "Changing directory to $PROJECT_ROOT"
echo "Building context using $CONFIG_FILE_PATH..."
repomix --config "$CONFIG_FILE" # Run from root, config path is relative to root

echo "Context build complete. Output should be in the directory specified in $CONFIG_FILE."
