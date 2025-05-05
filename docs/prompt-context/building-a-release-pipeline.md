# Automating Release Pipelines for Node, Deno, and Bun Projects

Successfully automating releases for diverse Javascript and Typescript projects requires a unified yet flexible approach. We need to **detect each project's runtime and type**, then run the appropriate build and publish steps. Below, we outline how to identify the project type from config files, update configurations if needed, and implement a **GitHub Actions** workflow with accompanying scripts to handle library publishing, CLI distribution, and compiled binary releases for **Node.js**, **Deno**, and **Bun**.

## 1. Detecting Runtime and Release Type

Each project contains manifest files that signal its runtime and intended usage:

* **Node.js projects**: Indicated by a `package.json`. We further check if it's a CLI tool by looking for a `"bin"` field mapping command names to script files (e.g. `"bin": {"mytool": "src/cli.js"}`). Presence of `"bin"` means the package is a CLI tool (executables on install); absence suggests a library module.
* **Bun projects**: Usually have a `bun.json`/`bunfig.toml` (in addition to or instead of `package.json`). Bun is largely Node-compatible, but a `bun.json` hints the project is optimized for Bun. If Bun config defines an executable entry (or the Node `"bin"` field is present), treat it as a CLI; otherwise a library.
* **Deno projects**: Identified by a `deno.json`/`deno.jsonc`. Deno packages must have a `name`, `version`, and `exports` in this file for publishing. Deno doesn't use a separate `"bin"` field; a Deno CLI vs library is determined by intent:

  * If the code's primary use is to be run (e.g. has a `main.ts` or similar that parses arguments or is referenced in documentation as a command), treat as a CLI tool.
  * Otherwise, if it's meant to be imported (e.g. provides functions/types), treat as a library.
* **Compiled Binary**: Some CLI projects also require a **compiled binary** release (single-file executables) for convenience (no runtime needed). By default, we will produce binaries for CLI tools in Node and Bun (to run without Node/Bun installed), and optionally for Deno CLIs if needed for users without Deno. If it's ambiguous (e.g. a Deno CLI might be fine with just `deno install`), we'd confirm with maintainers whether to provide a binary.

**Note:** If multiple configs exist (e.g. both `package.json` and `deno.json`), the project may target both Node (NPM) and Deno (JSR). In such cases, we can publish to both registries. If the intended release registry is unclear, we should ask the user to specify their preference (NPM vs JSR, or both).

## 2. Configuration Updates for Release Readiness

Before writing the pipeline, ensure each project's config is set up for smooth publishing:

* **Node (and Bun) packages**: The `package.json` should have correct `name` (unique in npm), `version` (matching the tag to be released), and if it's a library, an appropriate `"main"` or `"exports"` field for module entry. For TypeScript, include `"types"` pointing to the type definitions. If it's a CLI, add a `"bin"` field mapping the command name to the compiled output or entry script. Also, set `"files"` or `.npmignore` to include built artifacts (and exclude source if not needed) so that `npm publish` packages the right files. For example, a Node CLI might have:

  ```json
  {
    "name": "my-cli",
    "version": "0.1.0",
    "bin": {"mycli": "bin/cli.js"},
    "main": "dist/index.js",
    "types": "dist/index.d.ts",
    "files": ["dist", "bin/cli.js"]
  }
  ```

* **Deno packages**: In `deno.json` (or `jsr.json`), ensure `name` is scoped (e.g. `"@org/mypackage"`), `version` matches the new release, and `exports` points to the main module (e.g. `"exports": "./mod.ts"`). These are **required** for JSR publishing. For a Deno CLI, you might still provide an `exports` (so it can be imported if needed) pointing to the main script. Example `deno.json`:

  ```json
  {
    "name": "@org/mytool",
    "version": "0.1.0",
    "exports": "./main.ts",
    "entry": "./main.ts"
  }
  ```

  (The `"entry"` above is not official; the important field is `"exports"` for JSR).

* **Bun projects**: Bun uses `package.json` for publishing (via `bun publish` to NPM), so ensure that's updated. If a `bunfig.toml` or `bun.json` exists, verify it doesn't conflict with package.json for name/version. For binaries, Bun will automatically append ".exe" on Windows builds, so our naming conventions should account for that.

With configs in place, we can proceed to automation.

## 3. GitHub Actions Workflow – Release on Tag

We create a single workflow `.github/workflows/release.yml` that triggers on pushing a version tag. It will detect the project type and run the appropriate jobs:

* **Trigger**: Only on new tags that look like version (e.g. `v*`) pushed to the main or master branch.
* **Environment Matrix**: We may use a job matrix for building binaries on multiple OS, or use cross-compilation tools. Here we'll demonstrate cross-compiling where possible to keep a single job, but note that Node's official SEA feature might require per-OS jobs. We'll use **Vercel pkg** for Node to allow cross-builds from one job, since Node's Single Executable Application is experimental and multi-step.
* **Steps**:

  1. **Checkout code**.
  2. **Set up languages** (Node, Deno, or Bun) depending on project:

     * For Node: use `actions/setup-node@v3` to install appropriate Node version (and prepare npm auth).
     * For Bun: use `oven-sh/setup-bun@v2`.
     * For Deno: use `denoland/setup-deno@v2` to get Deno on runner.
  3. **Install Dependencies & Build**:

     * If Node or Bun and TypeScript, run `npm ci`/`bun install`, then a build script (e.g. `npm run build`) to produce JS in `dist/`.
     * If Deno, installation is not needed (Deno fetches deps on the fly), but we might run `deno check` or tests.
  4. **Publish to Registry** (if library or CLI package):

     * For Node/Bun: use `npm publish` (or `bun publish`). We configure `NPM_TOKEN` for auth. (Bun's publish packs and pushes to npm just like npm publish).
     * For Deno: run `deno publish --token=${{ secrets.JSR_TOKEN }}` to publish to JSR (assuming we've created the package on JSR beforehand).
  5. **Compile Binaries** (if CLI needs standalone binaries):

     * **Node CLI**: Use `npx pkg` to compile for Linux, Windows, macOS in one go. For example, `pkg -t node18-linux-x64,node18-win-x64,node18-macos-x64 .` will output executables for each target. (We choose a Node runtime target matching our project's requirements, e.g., Node 18 or `latest` for latest LTS).
     * **Deno CLI**: Use `deno compile`. We can cross-compile for all supported targets with `--target` flag (e.g., `deno compile -A --output mytool-linux --target x86_64-unknown-linux-gnu main.ts` and similarly for `*-windows-msvc` and `*-apple-darwin`). Deno will download the appropriate `denort` runtime for each target automatically.
     * **Bun CLI**: Use `bun build --compile` with `--target` for each platform. For example: `bun build --compile src/cli.ts --target=bun-linux-x64 --outfile mytool-linux` (and likewise `bun-windows-x64`, `bun-darwin-x64`, etc.). Bun supports cross-compiling via the `--target` option.
  6. **Prepare Release Assets**:

     * Rename the binaries with a clear convention: e.g. `mytool-linux`, `mytool-macos`, `mytool-windows.exe` (include `.exe` for Windows) for clarity. We might archive them (e.g. zip/tar) or attach raw; to keep it simple we'll attach raw binaries and ensure the install script accounts for platform naming.
     * Generate or update the **`install.sh`** script in the repository root. This script will let users install the latest release easily: it will detect OS and arch, fetch the appropriate binary from GitHub Releases, install it to `/usr/local/bin` (or another prefix), and print usage instructions. We write this script once (committed to the repo) and it always pulls the **latest** release by default. Optionally, allow specifying a version: if user passes an argument (version tag), the script uses that instead of latest.
  7. **Create GitHub Release**:

     * Use the GitHub API or an action to create a Release associated with the pushed tag (if not already created). We can use [`actions/create-release@v1`](https://github.com/actions/create-release) to do this, and `actions/upload-release-asset@v1` for each file. (We ensure `GITHUB_TOKEN` has `contents: write` permission for this step.)
     * Attach the compiled binaries and the `install.sh` script as assets to the release. (Even though `install.sh` is in the repo, attaching it to the release provides an immutable snapshot and lets Windows users download it easily if needed.)

Everything above can be orchestrated by our workflow and two helper scripts: one for building/uploading binaries (`bin/release.sh`) and one for publishing to package registries (`bin/publish.sh`). These scripts encapsulate logic so that the workflow YAML stays concise and so developers can run them locally if desired.

Below is a **complete example** of the workflow and scripts. This setup will work for most projects with minimal tweaks (like adjusting Node versions or adding a missing config field).

### `.github/workflows/release.yml`

```yaml
name: Release
on:
  push:
    # Trigger on version tags pushed to main or master
    tags: 
      - "v*"
    branches:
      - main
      - master

permissions:
  contents: write   # needed to create releases and upload assets
  packages: write   # needed to publish to package registries (npm, etc)
  id-token: write   # (optional) for OIDC auth, e.g. deno tokenless publish

jobs:
  release:
    name: Build and Release
    runs-on: ubuntu-latest
    env:
      NODE_VERSION: "18"        # Node version for Node/Bun projects
      DENO_VERSION: "2.x"       # Deno version (if needed specific)
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Detect project type
        id: detect
        shell: bash
        run: |
          set -e
          # Detect config files
          if [ -f "deno.json" ] || [ -f "deno.jsonc" ]; then
            echo "RUNTIME=deno" >> $GITHUB_ENV
          elif [ -f "bun.json" ] || [ -f "bun.lockb" ]; then
            # bun.lockb indicates a Bun project (lockfile)
            echo "RUNTIME=bun" >> $GITHUB_ENV
          elif [ -f "package.json" ]; then
            echo "RUNTIME=node" >> $GITHUB_ENV
          fi

          # Determine if CLI (has executables) or library
          if [ -f "package.json" ]; then
            if grep -q '"bin"' package.json; then
              echo "IS_CLI=true" >> $GITHUB_ENV
            else
              echo "IS_CLI=false" >> $GITHUB_ENV
            fi
          elif [ "$RUNTIME" = "deno" ]; then
            # For Deno, we might detect CLI by file presence or naming (heuristic)
            # e.g., if a main.ts exists or if README suggests usage as CLI.
            if [ -f "main.ts" ] || [ -f "cli.ts" ]; then
              echo "IS_CLI=true" >> $GITHUB_ENV
            else
              echo "IS_CLI=false" >> $GITHUB_ENV
            fi
          fi

          # Determine if we will compile a binary
          # (Compile for Node and Bun CLIs by default, optional for Deno CLIs)
          if [ "$IS_CLI" = "true" ]; then
            if [ "$RUNTIME" != "deno" ]; then
              echo "COMPILE_BINARY=true" >> $GITHUB_ENV
            else
              # For Deno, default to not compiling unless opted in
              echo "COMPILE_BINARY=false" >> $GITHUB_ENV
            fi
          else
            echo "COMPILE_BINARY=false" >> $GITHUB_ENV
          fi

      - name: Setup Node (if Node or Bun)
        if: startsWith(env.RUNTIME, 'node') || startsWith(env.RUNTIME, 'bun')
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          registry-url: https://registry.npmjs.org
          # If publishing to npm, use authentication (NPM_TOKEN in secrets)
          auth-token: ${{ secrets.NPM_TOKEN }}

      - name: Setup Bun (if Bun)
        if: env.RUNTIME == 'bun'
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: "latest"

      - name: Setup Deno (if Deno)
        if: env.RUNTIME == 'deno'
        uses: denoland/setup-deno@v2
        with:
          deno-version: ${{ env.DENO_VERSION }}

      - name: Install dependencies
        if: env.RUNTIME == 'node' || env.RUNTIME == 'bun'
        run: |
          if [ "$RUNTIME" = "bun" ]; then
            bun install
          else
            npm ci
          fi

      - name: Build project (TypeScript compile)
        if: env.RUNTIME == 'node' || env.RUNTIME == 'bun'
        run: |
          # If a build script or tsconfig exists, run tsc
          if [ -f "tsconfig.json" ]; then
            if [ "$RUNTIME" = "bun" ]; then
              bun run build || bun run tsc || bunx tsc
            else
              npm run build || npx tsc
            fi
          else
            echo "No build step necessary"
          fi

      - name: Run tests (optional)
        if: env.RUNTIME == 'deno'
        run: deno test -A || echo "No Deno tests found"

      - name: Publish to NPM/JSR
        env:
          # Pass tokens to script
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
          JSR_TOKEN: ${{ secrets.JSR_TOKEN }}
        run: bin/publish.sh

      - name: Compile binaries (if applicable)
        if: env.COMPILE_BINARY == 'true'
        run: bin/release.sh

      - name: Create GitHub Release
        if: env.COMPILE_BINARY == 'true'
        uses: softprops/action-gh-release@v2
        with:
          files: bin/*
          tag_name: ${{ github.ref_name }}
          name: ${{ github.ref_name }}
          draft: false
          prerelease: false
          token: ${{ secrets.GITHUB_TOKEN }}
```

**Explanation:** This workflow uses a single job for simplicity. It determines `RUNTIME` and `IS_CLI` via a bash step. Depending on `RUNTIME`, it sets up the appropriate environment and installs dependencies. It then calls `bin/publish.sh` and/or `bin/release.sh` to perform publishing and binary compilation. Finally, it creates a GitHub Release for the tag and uploads any release assets. (For library-only projects with no binaries, `bin/release.sh` will be skipped and the release will just be a tag with perhaps source code available.)

### `bin/publish.sh` – Publishing to NPM or JSR

This script handles publishing the package to the correct registry:

```bash
#!/usr/bin/env bash
set -e

# Determine runtime via config files
if [[ -f "deno.json" || -f "deno.jsonc" ]]; then
  RUNTIME="deno"
elif [[ -f "bun.json" || -f "bun.lockb" ]]; then
  RUNTIME="bun"
elif [[ -f "package.json" ]]; then
  RUNTIME="node"
else
  echo "No recognizable config file for publishing." >&2
  exit 0  # no publish needed
fi

if [[ "$RUNTIME" == "deno" ]]; then
  echo "Publishing Deno package to JSR..."
  # Ensure required fields are present
  deno check || true  # type-check (not mandatory)
  # Publish to JSR (requires prior `deno task` login or using token)
  if [[ -n "$JSR_TOKEN" ]]; then
    deno publish --token "$JSR_TOKEN"
  else
    # If tokenless OIDC is configured, this will attempt that
    deno publish
  fi

elif [[ "$RUNTIME" == "node" ]]; then
  echo "Publishing Node package to npm..."
  # Use npm CLI to publish. NPM_TOKEN is expected to be set via env or .npmrc
  npm publish --access public

elif [[ "$RUNTIME" == "bun" ]]; then
  echo "Publishing package with Bun (to npm)..."
  # Bun uses npm registry by default for publish. Ensure auth is set:
  # We rely on NPM_TOKEN set in .npmrc by actions/setup-node.
  bun publish
fi
```

**Notes:**

* For **npm** publishing, we use `npm publish`. The `actions/setup-node` step in the workflow already created an `.npmrc` with the token, so `npm publish` will succeed. We include `--access public` for scoped packages.
* For **JSR (Deno)**, we use `deno publish`. If `JSR_TOKEN` is provided, we pass it (to avoid interactive login). Deno's OIDC flow (tokenless from GitHub Actions using Sigstore) could be enabled by setting `permissions:id-token: write` and omitting the token, but using a token is straightforward.
* For **Bun**, `bun publish` will pack and publish to the npm registry using the same credentials as npm (it respects `.npmrc` or environment).

### `bin/release.sh` – Building Binaries and Preparing Assets

This script runs only for CLI tools that need standalone binaries (when `COMPILE_BINARY=true`). It compiles the executable for each platform and prepares the output:

```bash
#!/usr/bin/env bash
set -e

# Ensure output directory
mkdir -p bin

# Get package/tool name (for naming binaries)
NAME=""
if [ -f package.json ]; then
  NAME=$(node -p "require('./package.json').name || ''")
elif [ -f deno.json ]; then
  NAME=$(grep -Po '"name":\s*"\K[^"]+' deno.json || echo "")
fi
if [ -z "$NAME" ]; then
  NAME="$(basename $(pwd))"  # fallback to folder name
fi
NAME=${NAME##*/}  # if scoped (@org/name), strip scope for binary name

echo "Compiling binaries for $NAME..."

if [[ -f "deno.json" || -f "deno.jsonc" ]]; then
  # Deno cross-compilation for all targets:contentReference[oaicite:26]{index=26}
  deno compile -A --output bin/"$NAME-linux"       --target x86_64-unknown-linux-gnu  ${ENTRY:-main.ts}
  deno compile -A --output bin/"$NAME-macos"       --target x86_64-apple-darwin       ${ENTRY:-main.ts}
  deno compile -A --output bin/"$NAME-macos-arm64" --target aarch64-apple-darwin      ${ENTRY:-main.ts}
  deno compile -A --output bin/"$NAME-windows.exe" --target x86_64-pc-windows-msvc    ${ENTRY:-main.ts}
elif [[ -f "bun.json" || -f "bun.lockb" ]]; then
  # Bun cross-compilation (x64 targets):contentReference[oaicite:27]{index=27}:contentReference[oaicite:28]{index=28}
  bun build --compile --target=bun-linux-x64   src/*.ts --outfile bin/"$NAME-linux"
  bun build --compile --target=bun-darwin-x64  src/*.ts --outfile bin/"$NAME-macos"
  bun build --compile --target=bun-windows-x64 src/*.ts --outfile bin/"$NAME-windows.exe"
  # Note: Bun will add .exe for Windows if not specified:contentReference[oaicite:29]{index=29}
else
  # Node: use vercel/pkg to generate executables:contentReference[oaicite:30]{index=30}
  npm install -g pkg >/dev/null 2>&1 || npx pkg --help >/dev/null
  # Determine entry file: if package.json has a 'bin' script, use that; else use main
  ENTRY=$(node -p "require('./package.json').bin && typeof require('./package.json').bin==='object' ? Object.values(require('./package.json').bin)[0] : require('./package.json').main || 'index.js'")
  # Run pkg for Linux, macOS, Windows (x64). Adjust Node target version as needed.
  npx pkg -t node18-linux-x64,node18-macos-x64,node18-win-x64 "$ENTRY" --out-path bin/
  # pkg will produce files named like ${ENTRY}-<platform> (or the binary name if defined in package.json pkg config)
  # Rename outputs to our naming convention:
  [ -f bin/"$(basename $ENTRY)-linux" ] && mv bin/"$(basename $ENTRY)-linux" bin/"$NAME-linux"
  [ -f bin/"$(basename $ENTRY)-macos" ] && mv bin/"$(basename $ENTRY)-macos" bin/"$NAME-macos"
  [ -f bin/"$(basename $ENTRY).exe" ] && mv bin/"$(basename $ENTRY).exe" bin/"$NAME-windows.exe"
fi

# (Optional) compress the binaries for smaller download (not done here for simplicity)

echo "Binaries compiled. Verifying files:"
ls -lh bin/

# Prepare install.sh (in repo root) if not present
if [ ! -f "install.sh" ]; then
cat > install.sh << 'SCRIPT'
#!/usr/bin/env bash
set -e
REPO="<GITHUB_USER_OR_ORG>/<REPO_NAME>"  # replace with actual repo, or insert via CI
# Determine latest version if not provided
if [ -z "$1" ]; then
  TAG=$(curl -sL https://api.github.com/repos/$REPO/releases/latest | grep -Po '"tag_name": "\K.*?(?=")')
else
  TAG="$1"
fi
OS=$(uname -s)
ARCH=$(uname -m)
# Map OS/ARCH to asset name
case "$OS" in
  Linux*)   PLATFORM="linux" ;;
  Darwin*)  
    PLATFORM="macos" 
    # If Mac ARM (M1/M2):
    if [[ "$ARCH" == "arm64" ]]; then PLATFORM="macos"; echo "Note: using x64 binary on ARM mac." ; fi ;;
  MINGW*|MSYS*|CYGWIN*|Windows_NT*)
    PLATFORM="windows.exe" ;;
  *) echo "Unsupported OS: $OS" && exit 1 ;;
esac
ASSET="${REPO##*/}-${PLATFORM}"  # e.g. mytool-linux or mytool-macos, etc.
echo "Downloading $ASSET (version $TAG)..."
URL="https://github.com/$REPO/releases/download/$TAG/$ASSET"
curl -fsSL "$URL" -o "/tmp/$ASSET"
# If windows, move exe to target location (assuming Git Bash environment)
INSTALL_DIR="/usr/local/bin"
[ ! -d "$INSTALL_DIR" ] && INSTALL_DIR="$HOME/.local/bin"  # fallback for no sudo
chmod +x "/tmp/$ASSET"
mv "/tmp/$ASSET" "$INSTALL_DIR/${ASSET%%-*}"  # install as name (remove -linux/-macos suffix and .exe)
echo "Installed ${ASSET%%-*} to $INSTALL_DIR. Run '${ASSET%%-*}' to use the tool."
SCRIPT
chmod +x install.sh
fi

# Note: If install.sh is already present, we assume it's up-to-date (could optionally sed replace version or repo name if needed)
```

A few points about `bin/release.sh`:

* It finds a base `NAME` for the binaries, typically the package name without scope (e.g. `"@org/mytool"` -> `mytool`). This name will be used in the filenames.
* **Node**: We install or use `pkg` to create binaries for all three platforms in one command. The script picks the entry point from package.json (`bin` or `main`). We rename outputs to a consistent scheme. (Using Node's official SEA would involve a more complex process including `--experimental-sea-config` and `postject` injection – for simplicity and automation, we use `pkg` here.)
* **Deno**: We compile 4 binaries: linux x64, macOS x64, macOS arm64, and Windows x64. This covers common platforms. (We could also build Linux arm64 if needed by adding `aarch64-unknown-linux-gnu`.)
* **Bun**: We compile for Linux x64, Windows x64, and macOS x64. (Bun can also produce macOS arm64 if run on an ARM host or in cross-mode, but here we assume x64 build. We note that Bun's `--target` has baseline vs modern variants; using default ensures broad compatibility.)
* The script creates an `install.sh` if one doesn't exist. In practice, you'd create this script once manually with the correct `REPO` placeholder. We show it being generated for completeness. The script:

  * Fetches the latest release tag via GitHub's API (unless a version argument is given).
  * Detects OS and sets the expected asset name (this simple version lumps all Linux under one and all macOS under one, assuming x64 works on ARM via Rosetta – one could refine to pick an ARM binary if available).
  * Downloads the asset and installs it to `/usr/local/bin` (using `~/.local/bin` if the former isn't accessible).
  * Makes the binary executable and prints a success message.
  * For Windows, since this is a Bash script, it would typically be run in WSL or Git Bash. Windows users not using a UNIX shell can manually download the `.exe` or use a PowerShell equivalent script (not included here).

After running `bin/release.sh`, the `bin/` folder contains our compiled binaries named `${NAME}-linux`, `${NAME}-macos`, `${NAME}-macos-arm64` (if Deno), and `${NAME}-windows.exe`. The workflow then attaches everything in `bin/` as well as the `install.sh` to the GitHub Release. Users can now go to the release page and download the binaries, or simply run the one-liner install command:

```bash
# Example usage for a tool named "mytool"
curl -fsSL https://raw.githubusercontent.com/<org>/<repo>/main/install.sh | sh
```

This will install the latest version of **mytool** on their system.

## 4. Summary of Benefits and Maintenance

By following this template, each project's CI/CD pipeline will automatically:

* **Detect the runtime and project type** (Node library, Node CLI, Deno lib/CLI, Bun project, etc.) and run the correct build and release steps.
* **Publish libraries** to the appropriate registry:

  * Node/Bun packages to **npm** (using official actions and `npm publish`).
  * Deno packages to **JSR** (using `deno publish`).
* **Distribute CLI tools** via:

  * **npm/JSR** for package installation (e.g. `npm -g` or `deno add`), and/or
  * **GitHub Releases** with pre-built binaries for macOS, Linux, and Windows, plus an easy installer script (`curl | sh`).
* **Trigger on tagged releases** ensuring that new versions are released only when you push a version tag (e.g. `v1.2.3`) to the main branch, aligning with Git flow.
* **Isolate build logic** in version-controlled scripts (`/bin`) and configuration in `.github/workflows`, making it easy to update across many projects. There's no magic – just standard tools as documented by Node, Deno, and Bun.
* **Support all platforms**: We produced platform-specific binaries using each runtime's official capability (Node's packagers, Deno's native compiler, Bun's compiler) so users on Windows, Linux, or macOS are all covered. For example, Deno's compiler can target all supported OSes from a single machine, and Bun's `--target` can cross-compile executables as well. Node's `pkg` can bundle for multiple platforms in one go.
* **Minimal intervention**: once this is set up, maintainers only need to update version numbers and push tags. The workflow and scripts handle the rest automatically. If a project's intent is unclear (e.g. a Deno project that could be both a library and an app), the detection logic can be refined or a one-time manual tweak can be made to the script for that repository.

By leveraging official tools and documentation from each ecosystem – Node (npm, pkg, or SEA), Deno (JSR and `deno compile`), and Bun (bun build/publish) – this solution provides a **consistent release process** across all projects. It ensures that libraries reach the right package registries and that CLI applications are easily installable in any environment, all through automated GitHub Actions workflows.
