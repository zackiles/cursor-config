#!/bin/bash

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Print a message with color
print_message() {
  echo -e "${2}${1}${NC}"
}

# Check for dependencies
check_dependencies() {
  local missing_deps=()
  
  for cmd in curl unzip grep cut; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
      missing_deps+=("$cmd")
    fi
  done
  
  if [ ${#missing_deps[@]} -gt 0 ]; then
    print_message "Error: Missing required dependencies: ${missing_deps[*]}" "${RED}"
    print_message "Please install these before running this script." "${RED}"
    exit 1
  fi
}

# Repository information
REPO_OWNER="zacharyiles"
REPO_NAME="cursor-config"
RULES_DIR=".cursor/rules/global"
TEMP_DIR=$(mktemp -d)

# Check for dependencies before starting
check_dependencies

print_message "Cursor Rules Installer" "${BLUE}"
print_message "======================" "${BLUE}"
print_message "This script will install or update Cursor rules from the latest GitHub release." "${BLUE}"
echo ""

cleanup() {
  print_message "Cleaning up temporary files..." "${BLUE}"
  rm -rf "$TEMP_DIR"
}

trap cleanup EXIT
trap 'print_message "Installation aborted." "${RED}"; exit 1' INT TERM

# Get the latest release
print_message "Fetching latest release information..." "${BLUE}"
LATEST_RELEASE_URL=$(curl -s https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/releases/latest | grep "browser_download_url.*zip" | cut -d '"' -f 4)

if [ -z "$LATEST_RELEASE_URL" ]; then
  print_message "Error: Could not find the latest release. Please check your internet connection and try again." "${RED}"
  exit 1
fi

print_message "Downloading latest release from $LATEST_RELEASE_URL" "${BLUE}"
if ! curl -sL "$LATEST_RELEASE_URL" -o "$TEMP_DIR/rules.zip"; then
  print_message "Error: Failed to download the release. Please check your internet connection and try again." "${RED}"
  exit 1
fi

# Unzip the release
print_message "Extracting files..." "${BLUE}"
if ! unzip -q "$TEMP_DIR/rules.zip" -d "$TEMP_DIR"; then
  print_message "Error: Failed to extract the zip file. The downloaded file may be corrupted." "${RED}"
  exit 1
fi

# Verify that rules.json exists in the extracted files
if [ ! -f "$TEMP_DIR/rules.json" ]; then
  print_message "Error: Invalid release package. Missing rules.json file." "${RED}"
  exit 1
fi

# Create the rules directory if it doesn't exist
if [ ! -d "$RULES_DIR" ]; then
  print_message "Creating directory: $RULES_DIR" "${BLUE}"
  mkdir -p "$RULES_DIR"
  if [ ! -d "$RULES_DIR" ]; then
    print_message "Error: Failed to create directory $RULES_DIR" "${RED}"
    exit 1
  fi
fi

# Check if rules.json exists in the target directory
if [ ! -f "$RULES_DIR/rules.json" ]; then
  print_message "First-time installation detected. Copying all rules..." "${BLUE}"
  cp "$TEMP_DIR"/*.* "$RULES_DIR/"
  
  # Verify files were copied successfully
  if [ ! -f "$RULES_DIR/rules.json" ]; then
    print_message "Error: Failed to copy files to $RULES_DIR" "${RED}"
    exit 1
  fi
  
  print_message "Successfully installed all rules." "${GREEN}"
else
  print_message "Existing rules found. Selectively updating..." "${BLUE}"
  
  # Parse rules.json from the downloaded release
  NEW_RULES=$(cat "$TEMP_DIR/rules.json")
  EXISTING_RULES=$(cat "$RULES_DIR/rules.json")
  
  # Copy rules.json and rules.jsonc from the downloaded release
  cp "$TEMP_DIR/rules.json" "$RULES_DIR/"
  cp "$TEMP_DIR/rules.jsonc" "$RULES_DIR/"
  
  # Track how many rules were updated
  UPDATED_COUNT=0
  NEW_COUNT=0
  SKIPPED_COUNT=0
  
  # Process each rule in the new rules.json
  echo "$NEW_RULES" | grep -o '"rule": "[^"]*"' | cut -d'"' -f4 | while read -r rule; do
    # Check if rule exists in the target directory
    if [ ! -f "$RULES_DIR/$rule.mdc" ]; then
      print_message "Installing new rule: $rule" "${GREEN}"
      cp "$TEMP_DIR/$rule.mdc" "$RULES_DIR/"
      NEW_COUNT=$((NEW_COUNT+1))
    else
      # Check updatedOn dates
      NEW_DATE=$(echo "$NEW_RULES" | grep -A10 "\"rule\": \"$rule\"" | grep -o '"updatedOn": "[^"]*"' | head -1 | cut -d'"' -f4)
      EXISTING_DATE=$(echo "$EXISTING_RULES" | grep -A10 "\"rule\": \"$rule\"" | grep -o '"updatedOn": "[^"]*"' | head -1 | cut -d'"' -f4)
      
      if [ -z "$NEW_DATE" ] || [ -z "$EXISTING_DATE" ]; then
        print_message "Warning: Could not determine dates for rule: $rule. Updating anyway." "${YELLOW}"
        cp "$TEMP_DIR/$rule.mdc" "$RULES_DIR/"
        UPDATED_COUNT=$((UPDATED_COUNT+1))
      elif [ "$NEW_DATE" \> "$EXISTING_DATE" ]; then
        print_message "Updating rule: $rule (newer version available)" "${GREEN}"
        cp "$TEMP_DIR/$rule.mdc" "$RULES_DIR/"
        UPDATED_COUNT=$((UPDATED_COUNT+1))
      else
        print_message "Skipping rule: $rule (already up to date)" "${BLUE}"
        SKIPPED_COUNT=$((SKIPPED_COUNT+1))
      fi
    fi
  done
  
  print_message "Update summary: $NEW_COUNT new rules, $UPDATED_COUNT updated rules, $SKIPPED_COUNT unchanged rules" "${GREEN}"
fi

# Ask about documentation
echo ""
read -p "Would you like to add Cursor Rules documentation to your project root? (y/n): " ADD_DOCS

if [[ $ADD_DOCS =~ ^[Yy]$ ]]; then
  print_message "Copying documentation files to project root..." "${BLUE}"
  cp "$TEMP_DIR/rules.md" "./rules.md"
  cp "$TEMP_DIR/rules.html" "./rules.html"
  
  # Verify files were copied successfully
  if [ -f "./rules.md" ] && [ -f "./rules.html" ]; then
    print_message "Documentation files added:" "${GREEN}"
    print_message "- rules.md: Markdown documentation" "${GREEN}"
    print_message "- rules.html: HTML documentation (can be viewed in a browser)" "${GREEN}"
  else
    print_message "Warning: Failed to copy some documentation files." "${YELLOW}"
  fi
else
  print_message "Skipping documentation files." "${BLUE}"
fi

echo ""
print_message "Installation complete! ✅" "${GREEN}"
print_message "Cursor Rules are now available in the $RULES_DIR directory." "${GREEN}"
print_message "Open your project in Cursor to start using the rules." "${GREEN}"

print_message "To access this script again:" "${BLUE}"
print_message "curl -sSL https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/install.sh | bash" "${YELLOW}" 
