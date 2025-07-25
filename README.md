# iChipAgent

The iChipAgent is a multi Agents system that provides a set of function for chip physical design.

## Features

- **Question Answer** : Ask question about chip design.

![QA](./images/QA.png "QA")

- **Paper Search** : Search papers from google.

![PaperSearch](./images/paper-search.png "PaperSearch")

- **Generate EDA Tool Script**: Generate EDA tool script, cuurently support opensource EDA Tool iEDA.

![GenerateScript](./images/generate-script.png "GenerateScript")

- **Run EDA Tool**: Run EDA tool such as physical design tool with MCP protocol to complete chip design.

![RunTool](./images/run-tool.png "RunTool")

![LayoutShow](./images/layout-show.png "LayoutShow")

- **Report Analysis**: Analyze the report from EDA tool and provide summary and recommendation.

![ReportAnalysis](./images/report-analysis.png "ReportAnalysis")



## Requirements

- The iChipAgent requires LLM(large language model) to run. We support commercial LLM such as GPT4o、Claude and open source LLM such as Qwen3. You need provide the API key of LLM in the settings.
- node >= v22.14
- npm >= 10.9

## Run

To run the extension, run the following command in the root directory of the extension to install the dependencies:

```bash
npm install
npm run compile
code --extensionDevelopmentPath=.
```
Or press `F5` to open a new window with your extension loaded.

## Testing the Extension

To test extension, you'll want to first install the @vscode/test-cli module, as well as @vscode/test-electron module that enables tests to be run in VS Code Desktop:

```bash
npm install --save-dev @vscode/test-cli @vscode/test-electron
npm run test
```

## Extension Settings

TBD


## Release Notes

### 1.0.0

Initial release of The iChipAgent.


