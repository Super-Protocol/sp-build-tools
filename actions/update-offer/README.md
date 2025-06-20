# Update Offer Action

This GitHub Action updates an existing Super Protocol offer using the `spctl` utility. It is written in Node.js to ensure cross-platform compatibility and reliability.

This action executes the command: `./spctl offers update value <offer_id> --configuration <file_path>`.

## Features

-   **Cross-Platform:** Works on runners using Linux, macOS, and Windows.
-   **Validation:** Automatically validates the existence and JSON validity of the configuration file.
-   **Secure:** Follows security best practices.
-   **Simple:** Accepts the minimum required inputs to perform its task.

## Prerequisites

This action requires the `spctl` utility to be installed and available in the `PATH` or in the workflow's root directory. It is recommended to use the official `download-spctl` action in a previous step.

## Usage

### Inputs

| Parameter                 | Description                                                   | Required | Default         |
| ------------------------- | ------------------------------------------------------------- | -------- | --------------- |
| `offer_id`                | The numeric ID of the offer to be updated.                    | `true`   | -               |
| `configuration_file_path` | The path to the new offer configuration file in JSON format.  | `true`   | -               |
| `spctl_config_file`       | The path to the `spctl` configuration file (e.g., `config.json`). | `false`  | `./config.json` |

### Outputs

This action has no outputs.

### Example Workflow

```yaml
# .github/workflows/update-my-offer.yml
name: Update My Special Offer

on:
  workflow_dispatch:
    inputs:
      target_offer_id:
        description: 'ID of the offer to update'
        required: true

jobs:
  update_offer:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Prepare configuration files
        run: |
          echo "${{ secrets.SPCTL_CONFIG_BASE64 }}" | base64 --decode > ./spctl-config.json
          echo '{ "attributes": { "new_attribute": "new_value" } }' > ./new-offer-config.json

      - name: Download and install SPCTL
        uses: Super-Protocol/sp-build-tools/actions/download-spctl@v1
        # ... other inputs

      - name: Update Offer Configuration
        uses: Super-Protocol/sp-build-tools/actions/update-offer@main
        with:
          offer_id: ${{ inputs.target_offer_id }}
          configuration_file_path: ./new-offer-config.json
          spctl_config_file: ./spctl-config.json
```

## Contributing and Development

This section provides instructions for developers who want to modify or contribute to this action.

### Building

**This is the most important step after making code changes.**

This action uses [`@vercel/ncc`](https://github.com/vercel/ncc) to compile the code and all its dependencies into a single file located in the `dist` directory. This is necessary because the `node_modules` directory is not checked into the repository.

After making any changes to `index.js` or installing new dependencies in `package.json`, you must re-compile the action.

1.  **Install dependencies (if you haven't already):**
    ```bash
    npm install
    ```
2.  **Run the build command:**
    ```bash
    npm run build
    ```
3.  **Commit the result:** This command will generate a new `dist/index.js` file. You must commit this file to the repository for your changes to take effect in workflows.

### Local Debugging

You can easily debug this action locally using VS Code.

1.  **Setup Test Files:** In the action's directory, create the files needed for the test run:
    -   `test-config.json`:
        ```json
        { "description": "This is a test config" }
        ```
    -   A mock executable file named `spctl`:
        ```bash
        #!/bin/bash
        echo "Mock spctl executed with args: $@"
        exit 0
        ```
        Make it executable: `chmod +x spctl`.

2.  **Create `launch.json`:** In the `.vscode` directory, create a `launch.json` file:
    ```json
    {
      "version": "0.2.0",
      "configurations": [
        {
          "type": "node",
          "request": "launch",
          "name": "Debug Local Action",
          "program": "${workspaceFolder}/index.js",
          "env": {
            "INPUT_OFFER_ID": "12345",
            "INPUT_CONFIGURATION_FILE_PATH": "${workspaceFolder}/test-config.json",
            "INPUT_SPCTL_CONFIG_FILE": "${workspaceFolder}/spctl-config.json"
          }
        }
      ]
    }
    ```
3.  **Run the Debugger:** Open `index.js`, set a breakpoint, and press F5.

## License

This project is licensed under the [Business Source License 1.1](https://mariadb.com/bsl11/).

