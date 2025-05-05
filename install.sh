#!/bin/bash

# Cursor Rules Installer
# 
# This script installs or updates Cursor rules from either:
# - The latest GitHub release (default)
# - A local zip file (when --path/-p is specified)
#
# Usage:
#   ./install.sh [OPTIONS]
#
# Options:
#   -h, --help             Show this help message and exit
#   -p, --path PATH        Specify a local zip file to use instead of GitHub release
#   -s, --silent           Skip all prompts and use default answers (yes)
#   -v, --verbose          Enable verbose logging
#   -w, --workspace DIR    Specify a custom workspace directory for installation
#                         (default: current working directory)
#
# Examples:
#   ./install.sh                             # Install from GitHub, prompt for choices
#   ./install.sh --silent                    # Install from GitHub, use all defaults
#   ./install.sh -p ./rules.zip              # Install from local zip file
#   ./install.sh -p ./rules.zip -s           # Install from local zip file, use all defaults
#   ./install.sh -w ~/my-project             # Install to a specific workspace
#   ./install.sh -p ./rules.zip -w ~/project # Install from local zip, into a custom workspace
#   ./install.sh -v                          # Install with verbose logging

set -e

# ====================================================
# Configuration
# ====================================================

# Repository information
REPO_OWNER="zackiles"
REPO_NAME="cursor-config"
REQUIRED_DEPENDENCIES=("curl" "unzip" "grep" "cut" "jq")

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Verbosity levels
VERBOSE_MODE=false
CRITICAL=0
IMPORTANT=1
INFO=2

# ====================================================
# Utility Functions
# ====================================================

# Print a message with color based on verbosity level
print_message() {
  local message="$1"
  local color="${2:-$BLUE}"
  local level="${3:-$INFO}"
  
  # Always show critical messages (errors) and important messages
  # Otherwise, only show if verbose mode is enabled
  if [[ "$level" -le 0 || "$level" -le 1 || "$VERBOSE_MODE" == true ]]; then
    echo -e "${color}${message}${NC}"
  fi
}

# Print error message and exit
error_exit() {
  print_message "Error: $1" "${RED}" $CRITICAL
  exit 1
}

# Ensure a directory exists, create if needed
ensure_dir() {
  local dir="$1"
  local name="${2:-directory}"
  
  if [ ! -d "$dir" ]; then
    print_message "Creating $name: $dir" "${BLUE}" $INFO
    mkdir -p "$dir" || error_exit "Failed to create $name $dir"
    return 1  # Directory was created
  fi
  
  return 0  # Directory already existed
}

# Copy a file if it exists, with optional rename
copy_file() {
  local src="$1"
  local dest="$2"
  local desc="${3:-file}"
  
  if [ -f "$src" ]; then
    cp "$src" "$dest" || error_exit "Failed to copy $desc from $src to $dest"
    print_message "- Copied $desc to $dest" "${GREEN}" $INFO
    return 0
  fi
  
  return 1
}

# Copy files matching a pattern
copy_files() {
  local src_dir="$1"
  local pattern="$2"
  local dest_dir="$3"
  local desc="${4:-files}"

  # Ensure destination directory exists
  ensure_dir "$dest_dir" > /dev/null
  
  # Use find to avoid shell expansion issues
  find "$src_dir" -name "$pattern" -type f -exec cp {} "$dest_dir/" \; 2>/dev/null
  
  # Check if any files were copied
  if [ $(find "$dest_dir" -name "$pattern" -type f | wc -l) -eq 0 ]; then
    return 1
  fi
  
  print_message "- Copied $desc to $dest_dir" "${GREEN}" $INFO
  return 0
}

# Path join function to ensure cross-platform compatibility
path_join() {
  local IFS="/"
  echo "$*"
}

# Show help menu
show_help() {
  cat << EOF
Cursor Rules Installer

USAGE:
  ./install.sh [OPTIONS]

OPTIONS:
  -h, --help             Show this help message and exit
  -p, --path PATH        Specify a local zip file to use instead of GitHub release
  -s, --silent           Skip all prompts and use default answers (yes)
  -v, --verbose          Enable verbose logging
  -w, --workspace DIR    Specify a custom workspace directory for installation
                         (default: current working directory)

EXAMPLES:
  ./install.sh                             # Install from GitHub, prompt for choices
  ./install.sh --silent                    # Install from GitHub, use all defaults
  ./install.sh -p ./rules.zip              # Install from local zip file
  ./install.sh -p ./rules.zip -s           # Install from local zip file, use all defaults
  ./install.sh -w ~/my-project             # Install to a specific workspace
  ./install.sh -p ./rules.zip -w ~/project # Install from local zip, into a custom workspace
  ./install.sh -v                          # Install with verbose logging
EOF
  exit 0
}

# ====================================================
# Core Functions
# ====================================================

# Check for dependencies
check_dependencies() {
  local missing_deps=()
  
  for cmd in "${REQUIRED_DEPENDENCIES[@]}"; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
      missing_deps+=("$cmd")
    fi
  done
  
  if [ ${#missing_deps[@]} -gt 0 ]; then
    error_exit "Missing required dependencies: ${missing_deps[*]}\nPlease install these before running this script."
  fi
}

# Parse command line arguments
parse_args() {
  LOCAL_ZIP_PATH=""
  SILENT_MODE=false
  VERBOSE_MODE=false
  WORKSPACE_DIR="$(pwd)"
  
  while [[ $# -gt 0 ]]; do
    case $1 in
      -h|--help)
        show_help
        ;;
      -p|--path)
        if [[ -z "$2" || "$2" == -* ]]; then
          error_exit "--path requires a value"
        fi
        LOCAL_ZIP_PATH="$2"
        shift 2
        ;;
      --path=*)
        LOCAL_ZIP_PATH="${1#*=}"
        shift
        ;;
      -s|--silent)
        SILENT_MODE=true
        shift
        ;;
      -v|--verbose)
        VERBOSE_MODE=true
        shift
        ;;
      -w|--workspace)
        if [[ -z "$2" || "$2" == -* ]]; then
          error_exit "--workspace requires a value"
        fi
        WORKSPACE_DIR="$2"
        shift 2
        ;;
      --workspace=*)
        WORKSPACE_DIR="${1#*=}"
        shift
        ;;
      *)
        error_exit "Unknown option: $1"
        ;;
    esac
  done
  
  # Normalize and validate workspace directory
  WORKSPACE_DIR=$(cd "$WORKSPACE_DIR" 2>/dev/null && pwd) || error_exit "Workspace directory '$WORKSPACE_DIR' does not exist"
  
  # Validate zip file if provided
  if [[ -n "$LOCAL_ZIP_PATH" && ! -f "$LOCAL_ZIP_PATH" ]]; then
    error_exit "Specified zip file '$LOCAL_ZIP_PATH' does not exist"
  fi
}

# Setup paths and directories
setup_paths() {
  # Set up directory paths using path_join for cross-platform compatibility
  RULES_DIR=$(path_join "$WORKSPACE_DIR" ".cursor" "rules" "global")
  LOCAL_RULES_DIR=$(path_join "$WORKSPACE_DIR" ".cursor" "rules" "local")
  DOCS_DIR=$(path_join "$WORKSPACE_DIR" ".cursor" "rules" "docs")
}

# Process local zip file
process_local_zip() {
  print_message "Copying local zip file..." "${BLUE}" $INFO
  cp "$LOCAL_ZIP_PATH" "$TEMP_DIR/rules.zip" || error_exit "Failed to copy the zip file"
}

# Process GitHub release
process_github_release() {
  # Retrieve all releases
  print_message "Fetching release information..." "${BLUE}" $INFO
  ALL_RELEASES=$(curl -s "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/releases")

  # Check if we got a valid JSON response
  if ! echo "$ALL_RELEASES" | jq empty 2>/dev/null; then
    error_exit "Failed to fetch releases. GitHub API response is not valid JSON.\nResponse: ${ALL_RELEASES}"
  fi

  # Check if we have any releases
  RELEASE_COUNT=$(echo "$ALL_RELEASES" | jq 'length')
  if [ "$RELEASE_COUNT" -eq 0 ]; then
    error_exit "No releases found for $REPO_OWNER/$REPO_NAME."
  fi

  # Find the first release with a rules.zip asset
  print_message "Finding latest release with assets..." "${BLUE}" $INFO
  
  DOWNLOAD_URL=""
  for i in $(seq 0 $((RELEASE_COUNT-1))); do
    ASSETS=$(echo "$ALL_RELEASES" | jq -r ".[$i].assets")
    
    # Use jq to find the download URL directly
    ASSET_MATCH=$(echo "$ASSETS" | jq -r '.[] | select(.name == "rules.zip") | .browser_download_url')
    
    if [ -n "$ASSET_MATCH" ]; then
      DOWNLOAD_URL="$ASSET_MATCH"
      RELEASE_NAME=$(echo "$ALL_RELEASES" | jq -r ".[$i].name")
      RELEASE_TAG=$(echo "$ALL_RELEASES" | jq -r ".[$i].tag_name")
      break
    fi
  done

  if [ -z "$DOWNLOAD_URL" ]; then
    error_exit "No rules.zip asset found in any release."
  fi

  print_message "Found release: ${RELEASE_NAME:-Unnamed} (${RELEASE_TAG:-Untagged})" "${BLUE}" $INFO
  print_message "Downloading from: $DOWNLOAD_URL" "${BLUE}" $INFO

  HTTP_CODE=$(curl -s -L -w "%{http_code}" -o "$TEMP_DIR/rules.zip" "$DOWNLOAD_URL")

  # Check if the download succeeded
  if [ "$HTTP_CODE" != "200" ]; then
    error_exit "Failed to download rules.zip (HTTP code: $HTTP_CODE). Please check your internet connection and try again."
  fi

  # Check if the file is empty or contains "Not Found"
  if [ ! -s "$TEMP_DIR/rules.zip" ]; then
    error_exit "The downloaded file is empty."
  fi

  if grep -q "Not Found" "$TEMP_DIR/rules.zip"; then
    error_exit "The downloaded file contains 'Not Found'. The asset may not exist."
  fi
}

# Extract and verify the zip file
extract_zip() {
  print_message "Extracting files..." "${BLUE}" $INFO
  if ! unzip -q "$TEMP_DIR/rules.zip" -d "$TEMP_DIR"; then
    error_exit "Failed to extract the zip file. The downloaded file may be corrupted."
  fi

  # Verify that we have extracted files (check for MDC files)
  if [ $(find "$TEMP_DIR" -name "*.mdc" -type f | wc -l) -eq 0 ]; then
    error_exit "Invalid release package. No rule files found."
  fi
}

# Install rules to the destination directory
install_rules() {
  # Create the rules directory if it doesn't exist
  ensure_dir "$RULES_DIR" "rules directory" || true
  
  # Check if this is a first-time installation
  if [ $(find "$RULES_DIR" -name "*.mdc" -type f 2>/dev/null | wc -l) -eq 0 ]; then
    print_message "First-time installation detected. Copying all rules..." "${BLUE}" $INFO
    
    # Copy all MDC files
    copy_files "$TEMP_DIR" "*.mdc" "$RULES_DIR" "rule files" || error_exit "Failed to copy files to $RULES_DIR"
    
    print_message "Successfully installed all rules." "${GREEN}" $INFO
  else
    print_message "Existing rules found. Updating rules..." "${BLUE}" $INFO
    
    # Copy all MDC files
    copy_files "$TEMP_DIR" "*.mdc" "$RULES_DIR" "rule files"
    
    print_message "All rules have been updated." "${GREEN}" $INFO
  fi
}

# Process documentation files
process_documentation() {
  # Ask about documentation (skip if silent mode)
  ADD_DOCS="n"
  if [[ "$SILENT_MODE" == false ]]; then
    echo ""
    read -p "Would you like to add Cursor Rules documentation to your project root? (y/n): " ADD_DOCS
  else
    ADD_DOCS="y" # Default to yes in silent mode
  fi

  if [[ $ADD_DOCS =~ ^[Yy]$ ]]; then
    print_message "Copying documentation files to project root..." "${BLUE}" $INFO
    
    # Check if documentation files exist in the extracted zip
    DOC_FILES_FOUND=false
    
    if copy_file "$TEMP_DIR/rules.md" "$WORKSPACE_DIR/rules.md" "Markdown documentation"; then
      DOC_FILES_FOUND=true
    fi
    
    if copy_file "$TEMP_DIR/rules.html" "$WORKSPACE_DIR/rules.html" "HTML documentation"; then
      DOC_FILES_FOUND=true
    fi
    
    if [ "$DOC_FILES_FOUND" = true ]; then
      print_message "Documentation files added:" "${GREEN}" $INFO
      
      [ -f "$WORKSPACE_DIR/rules.md" ] && print_message "- rules.md: Markdown documentation" "${GREEN}" $INFO
      [ -f "$WORKSPACE_DIR/rules.html" ] && print_message "- rules.html: HTML documentation (can be viewed in a browser)" "${GREEN}" $INFO
    else
      print_message "Warning: No documentation files found in the release package." "${YELLOW}" $IMPORTANT
    fi
  else
    print_message "Skipping documentation files." "${BLUE}" $INFO
  fi
}

# Install additional files and create necessary directories
install_additional_files() {
  print_message "Installing additional files..." "${BLUE}" $INFO

  # Copy rules.json to .cursor/rules/global
  copy_file "$TEMP_DIR/rules.json" "$RULES_DIR/rules.json" "rules.json"

  # Copy documentation files with specific names
  copy_file "$TEMP_DIR/rules.md" "$WORKSPACE_DIR/cursor-rules.md" "rules.md"
  copy_file "$TEMP_DIR/rules.html" "$WORKSPACE_DIR/cursor-rules.html" "rules.html"

  # Create .cursor/rules/local if it doesn't exist
  if ensure_dir "$LOCAL_RULES_DIR" "local rules directory"; then
    touch "$LOCAL_RULES_DIR/.gitkeep"
    print_message "- Created $LOCAL_RULES_DIR with .gitkeep file" "${GREEN}" $INFO
  fi

  # Create .cursor/rules/docs if it doesn't exist
  if ensure_dir "$DOCS_DIR" "docs directory"; then
    touch "$DOCS_DIR/.gitkeep"
    print_message "- Created $DOCS_DIR with .gitkeep file" "${GREEN}" $INFO
  fi

  # Copy any docs from the temp directory to .cursor/rules/docs
  if [ -d "$TEMP_DIR/docs" ]; then
    print_message "Copying documentation files..." "${BLUE}" $INFO
    ensure_dir "$DOCS_DIR" > /dev/null
    cp -R "$TEMP_DIR/docs/"* "$DOCS_DIR/" 2>/dev/null || true
    print_message "- Copied documentation files to $DOCS_DIR" "${GREEN}" $INFO
  fi
}

# ====================================================
# Main Script
# ====================================================

main() {
  # Create temporary directory
  TEMP_DIR=$(mktemp -d) || error_exit "Failed to create temporary directory"
  
  # Setup cleanup
  trap "print_message 'Cleaning up temporary files...' '${BLUE}' $INFO; rm -rf '$TEMP_DIR'" EXIT
  trap 'print_message "Installation aborted." "${RED}" $CRITICAL; exit 1' INT TERM
  
  # Parse command line arguments
  parse_args "$@"
  
  # Setup paths
  setup_paths
  
  # Check for dependencies
  check_dependencies
  
  # Display header
  print_message "Cursor Rules Installer" "${BLUE}" $IMPORTANT
  print_message "======================" "${BLUE}" $IMPORTANT
  
  if [[ -n "$LOCAL_ZIP_PATH" ]]; then
    print_message "Installing Cursor rules from local zip: $LOCAL_ZIP_PATH" "${BLUE}" $IMPORTANT
  else
    print_message "Installing Cursor rules from the latest GitHub release." "${BLUE}" $IMPORTANT
  fi
  
  if [[ "$SILENT_MODE" == true ]]; then
    print_message "Running in silent mode. All prompts will use default answers." "${BLUE}" $INFO
  fi
  
  if [[ "$VERBOSE_MODE" == true ]]; then
    print_message "Running in verbose mode. All messages will be displayed." "${BLUE}" $INFO
  fi
  
  if [[ "$WORKSPACE_DIR" != "$(pwd)" ]]; then
    print_message "Installing to workspace: $WORKSPACE_DIR" "${BLUE}" $INFO
  fi
  
  echo ""
  
  # Get the zip file either from local path or GitHub
  if [[ -n "$LOCAL_ZIP_PATH" ]]; then
    process_local_zip
  else
    process_github_release
  fi
  
  # Extract and verify zip file
  extract_zip
  
  # Install rules
  install_rules
  
  # Process documentation
  process_documentation
  
  # Install additional files
  install_additional_files
  
  # Display completion message
  echo ""
  print_message "Installation complete! ✅" "${GREEN}" $IMPORTANT
  print_message "Cursor Rules are now available in the $RULES_DIR directory." "${GREEN}" $INFO
  print_message "Open your project in Cursor to start using the rules." "${GREEN}" $INFO
  
  print_message "To access this script again:" "${BLUE}" $INFO
  print_message "curl -sSL https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/install.sh | bash" "${YELLOW}" $INFO
}

# Run the main function
main "$@" 
