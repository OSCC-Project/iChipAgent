<div align="center">
<img src="/icon/iCA-wsy.png" width="16%" alt="iChipAgent" />
 <h1>iChipAgent</h1>

<h3> A multi agents system for chip design.</h3>

<p align="center">
    <a title="GitHub Watchers" target="_blank" href="https://github.com/OSCC-Project/iChipAgent/watchers">
        <img alt="GitHub Watchers" src="https://img.shields.io/github/watchers/OSCC-Project/iChipAgent.svg?label=Watchers&style=social" />
    </a>
    <a title="GitHub Stars" target="_blank" href="hhttps://github.com/OSCC-Project/iChipAgent/stargazers">
        <img alt="GitHub Stars" src="https://img.shields.io/github/stars/OSCC-Project/iChipAgent.svg?label=Stars&style=social" />
    </a>
    <a title="GitHub Forks" target="_blank" href="https://github.com/OSCC-Project/iChipAgent/network/members">
        <img alt="GitHub Forks" src="https://img.shields.io/github/forks/OSCC-Project/iChipAgent.svg?label=Forks&style=social" />
    </a>
</p>

[Chinese] | **English**

</div>



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

ctrl+Enter as shortcut to input message.


## Release Notes

### 0.0.1

Initial release of The iChipAgent.

## Owner
iEDA Team

## License
Mulan PSL v2


