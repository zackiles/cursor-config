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
REPO_OWNER="zackiles"
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

# Verify that we have extracted files (check for MDC files instead of rules.json)
if [ $(ls -1 "$TEMP_DIR"/*.mdc 2>/dev/null | wc -l) -eq 0 ]; then
  print_message "Error: Invalid release package. No rule files found." "${RED}"
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

# Check if the rules directory already contains files
if [ $(ls -1 "$RULES_DIR"/*.mdc 2>/dev/null | wc -l) -eq 0 ]; then
  print_message "First-time installation detected. Copying all rules..." "${BLUE}"
  cp "$TEMP_DIR"/*.mdc "$RULES_DIR/"
  
  # Verify files were copied successfully
  if [ $(ls -1 "$RULES_DIR"/*.mdc 2>/dev/null | wc -l) -eq 0 ]; then
    print_message "Error: Failed to copy files to $RULES_DIR" "${RED}"
    exit 1
  fi
  
  print_message "Successfully installed all rules." "${GREEN}"
else
  print_message "Existing rules found. Updating rules..." "${BLUE}"
  
  # Copy all MDC files
  cp "$TEMP_DIR"/*.mdc "$RULES_DIR/"
  
  print_message "All rules have been updated." "${GREEN}"
fi

# Ask about documentation
echo ""
read -p "Would you like to add Cursor Rules documentation to your project root? (y/n): " ADD_DOCS

if [[ $ADD_DOCS =~ ^[Yy]$ ]]; then
  print_message "Copying documentation files to project root..." "${BLUE}"
  
  # Check if documentation files exist in the extracted zip
  DOC_FILES_FOUND=false
  
  if [ -f "$TEMP_DIR/rules.md" ]; then
    cp "$TEMP_DIR/rules.md" "./rules.md"
    DOC_FILES_FOUND=true
  fi
  
  if [ -f "$TEMP_DIR/rules.html" ]; then
    cp "$TEMP_DIR/rules.html" "./rules.html"
    DOC_FILES_FOUND=true
  fi
  
  if [ "$DOC_FILES_FOUND" = true ]; then
    print_message "Documentation files added:" "${GREEN}"
    
    [ -f "./rules.md" ] && print_message "- rules.md: Markdown documentation" "${GREEN}"
    [ -f "./rules.html" ] && print_message "- rules.html: HTML documentation (can be viewed in a browser)" "${GREEN}"
  else
    print_message "Warning: No documentation files found in the release package." "${YELLOW}"
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
